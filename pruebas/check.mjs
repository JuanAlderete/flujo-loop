#!/usr/bin/env node
/**
 * GUARD DE `flujo-loop`.
 *
 * Verifica dos cosas que, si se rompen, NO AVISAN:
 *
 *   1. Que el frontmatter de cada skill sea YAML válido. Si no parsea, la skill **no se
 *      registra** y el síntoma es que el comando no aparece — sin ningún error en ningún lado.
 *   2. Que la skill genérica no nombre ninguna tecnología ni comando de ningún proyecto. Si lo
 *      hace, deja de ser genérica y el que trabaja en otra cosa la archiva como "no es mi
 *      problema" — y con eso archiva el principio también.
 *
 * 🔑 POR QUÉ EXISTE, Y NO ES HIPOTÉTICO. La primera versión de esta skill tenía dos puntos
 * seguidos de espacio dentro de un valor sin comillas, que en YAML significa otra cosa. La skill
 * entera no cargaba. Y la verificación manual no lo vio: se chequeó que el frontmatter EMPEZARA
 * con la marca y que el nombre coincidiera con la carpeta —la forma— pero nunca que el YAML
 * fuera válido.
 *
 * ⚠️ QUÉ NO ES. No es un parser de YAML, y no se agregó una dependencia para tenerlo. Cubre las
 * formas de valor mal escrito que rompen de verdad. Un YAML inválido por otra razón se le puede
 * escapar; el día que eso pase, ahí vale traer un parser.
 *
 * Uso:
 *   node guard/check.mjs              verifica las skills del repo
 *   node guard/check.mjs --self-test  verifica el verificador contra entradas conocidas
 */

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills');

/** La skill genérica: la única a la que se le exige no nombrar nada de ningún proyecto. */
const GENERICA = 'flujo-loop';

// ── El validador de valores de frontmatter ────────────────────────────────────

/** Caracteres que YAML reserva al inicio de un valor sin comillas. */
const RESERVADO_AL_INICIO = ['`', '@', '%', '*', '&', '!', '[', '{', ',', '?', '#'];
const COMILLA_DOBLE_SIN_ESCAPAR = /(^|[^\\])"/;

/**
 * Devuelve el motivo por el que un valor de frontmatter es inválido, o null si está bien.
 */
export function motivoInvalido(valor) {
  const v = valor.trim();
  if (v === '') return 'vacío';

  //  Escalar de bloque: el cuerpo se valida aparte, no acá.
  if (/^[>|]/.test(v)) return null;

  if (v.startsWith('"')) {
    if (!v.endsWith('"') || v.length < 2) return 'abre con comilla doble y no cierra';
    const interior = v.slice(1, -1);
    if (COMILLA_DOBLE_SIN_ESCAPAR.test(interior)) return 'comilla doble interna sin escapar';
    return null;
  }

  if (v.startsWith("'")) {
    if (!v.endsWith("'") || v.length < 2) return 'abre con comilla simple y no cierra';
    return null;
  }

  //  Sin comillas: acá están las formas que rompen.
  if (v.includes(': ')) return 'sin comillas y con dos puntos seguidos de espacio';
  if (v.endsWith(':')) return 'sin comillas y termina en dos puntos';
  if (/\s#/.test(v)) return 'sin comillas y con numeral: YAML lo lee como comentario y trunca';
  if (RESERVADO_AL_INICIO.includes(v[0])) return `arranca con el carácter reservado ${v[0]}`;

  return null;
}

// ── El detector de acoplamiento a un proyecto ─────────────────────────────────

/**
 * Tecnologías y comandos concretos. Si la skill genérica nombra uno, deja de ser genérica.
 *
 * ⚠️ Los nombres van con límite de palabra y en minúscula, y el texto se compara en minúscula.
 * Sin el límite, "next" pega dentro de cualquier palabra que lo contenga y el guard se vuelve
 * ruido — y un guard ruidoso se desactiva, que es peor que no tenerlo.
 */
const TECNOLOGIAS = [
  'supabase', 'postgres', 'postgresql', 'psql', 'sql',
  'tailwind', 'react', 'nextjs', 'next.js', 'typescript', 'javascript',
  'vitest', 'jest', 'eslint', 'playwright', 'webpack', 'turbopack',
  'npm', 'npx', 'pnpm', 'yarn', 'node', 'python', 'docker',
  'github', 'vercel', 'git',
];

/** Números con unidad: casi siempre una medida de un proyecto, y las medidas vencen. */
const MEDIDA = /\b\d+\s*(px|rem|em|ms|segundos?|minutos?|horas?|[kmg]b|%|líneas?|lineas?|tests?|casos?|archivos?)\b/gi;

/**
 * Devuelve los acoplamientos encontrados en un texto. Vacío = está bien.
 */
export function acoplamientos(texto) {
  const hallados = [];
  const bajo = texto.toLowerCase();

  for (const t of TECNOLOGIAS) {
    //  Se escapa el punto de los nombres que lo llevan (`next.js`), y se exige que lo que rodea
    //  no sea parte de una palabra más larga.
    const re = new RegExp(`(^|[^a-z0-9.])${t.replace(/\./g, '\\.')}([^a-z0-9.]|$)`, 'i');
    if (re.test(bajo)) hallados.push(`nombra "${t}"`);
  }

  for (const m of texto.matchAll(MEDIDA)) hallados.push(`afirma la medida "${m[0].trim()}"`);

  return hallados;
}

// ── Lo que el texto de las skills propias tiene que decir ────────────────────

/**
 * Los patrones de `patrones` que NO aparecen en el texto (o en el tramo que pide `desde`/`hasta`,
 * o en sus primeras `lineas`). Vacío = está bien.
 *
 * 🔑 Estructural a propósito: verifica que esté el disparador o la regla, no la prosa exacta. Y
 * acotado a la sección: que "AGENTS.md" aparezca en cualquier parte no prueba que el Paso 0 lo diga.
 */
export function faltantes(texto, { desde, hasta, lineas, patrones }) {
  let t = texto;
  if (desde) {
    const i = t.indexOf(desde);
    if (i < 0) return [`no está la sección ${desde}`];
    const f = hasta ? t.indexOf(hasta, i + desde.length) : -1;
    t = f < 0 ? t.slice(i) : t.slice(i, f);
  }
  if (lineas) t = t.split('\n').slice(0, lineas).join('\n');
  return patrones.filter((p) => !p.test(t)).map(String);
}

const CERCA = (a, b, n) => new RegExp(`${a}[\\s\\S]{0,${n}}${b}|${b}[\\s\\S]{0,${n}}${a}`);
const IDIOMA = /(person's|their) (own )?language|language of the person/i;

/** [skill, qué exige, pedido a `faltantes`]. Ver plan-de-mejoras, secciones 4 y 6. */
const REQUISITOS = [
  ['flujo-loop', 'el Paso 0 busca los controles en AGENTS.md y CLAUDE.md', {
    desde: '## Paso 0', hasta: '## Paso 1', patrones: [/AGENTS\.md/, /CLAUDE\.md/, /\/init/],
  }],
  ['flujo-loop', 'el Paso 5 dice cuándo corre cada skill suelta', {
    desde: '## Paso 5', hasta: '## Las tres pruebas',
    patrones: [
      CERCA('gha-security-review', '\\.github/workflows', 300),
      CERCA('secret-serialization', 'credencial', 400),
      /skill-scanner/,
    ],
  }],
  ['flujo-loop', 'el Paso 5 cierra con el reporte en lenguaje llano, que es también el mensaje final', {
    desde: '## Paso 5', hasta: '## Las tres pruebas',
    patrones: [
      /reporte (en lenguaje )?llano/i,
      /Qué hace este cambio/,
      /\bDebe\b/, /\bConviene\b/, /\bOpcional\b/,
      /numerad/i,
      /qué pasa si no se\s+arregla/i,
      /veredicto/i,
      /Lo que no se revis/i,
      CERCA('mensaje final', 'chat', 200),
    ],
  }],
  ['flujo-loop', 'el rastro lista el reporte llano como su primera sección', {
    desde: '## El rastro', hasta: '## Cuando alguien encuentra algo',
    patrones: [/\|---\|---\|\r?\n\| \*\*reporte (en lenguaje )?llano\*\*/i],
  }],
  ['flujo-loop', 'el Paso 5 corre la revisión independiente: siempre, con segundo revisor en plata/datos/permisos', {
    desde: '## Paso 5', hasta: '## Las tres pruebas',
    patrones: [
      /revision-independiente/,
      CERCA('revision-independiente', 'Corre \\*\\*siempre\\*\\*', 300),
      CERCA('segundo revisor', '(plata|datos|permisos)', 300),
    ],
  }],
  ['flujo-loop', 'el Paso 5 limita la excepción a la documentación pura y la anota en "Lo que no se revisó"', {
    desde: '## Paso 5', hasta: '## Las tres pruebas',
    patrones: [
      /En la duda, se corre/,
      CERCA('skills', 'no son documentación', 300),
      /Lo que no se revisó\*\*:[\s\S]{0,400}revisión no aplicada: cambio de sólo docs/,
    ],
  }],
  ['revision-independiente', 'corre siempre; la excepción es sólo documentación pura, y en la duda se corre', {
    desde: '## Cuándo corre', hasta: '## Quién revisa',
    patrones: [
      /Siempre/,
      /En la duda, se corre/,
      CERCA('skills', 'no son documentación', 300),
      CERCA('plantillas', 'texto de pantalla', 300),
      /revisión no aplicada: cambio de sólo docs/,
    ],
  }],
  ['revision-independiente', 'el revisor es nuevo, no vio la conversación y puede leer el repo; el segundo es ciego', {
    desde: '## Quién revisa', hasta: '## Qué le pedís al revisor',
    patrones: [
      CERCA('(subagente|sesión)', 'no vio la conversación', 300),
      /acceso de lectura al repositorio/,
      CERCA('segundo revisor', 'no ve lo que dijo el primero', 300),
      /En la duda, dos/,
      CERCA('migraciones', 'importes', 400),
      /unificá/,
      CERCA('contradic', 'decide la persona', 200),
    ],
  }],
  ['revision-independiente', 'exige caso concreto, leer a quienes usan el código y no inflar la prioridad', {
    patrones: [/Sin un caso concreto no hay hallazgo/, /a quienes usan el código tocado/, /No inflar la prioridad/],
  }],
  ['revision-independiente', 'entrega hallazgos Debe/Conviene/Opcional con las cuatro partes, los riesgos nuevos y los descartados al rastro', {
    patrones: [
      /\bDebe\b/, /\bConviene\b/, /\bOpcional\b/,
      /qué es/i, /el problema/i, /el arreglo/i, /qué pasa si no se\s+arregla/i,
      /variables de entorno/i, /detrás de un flag/, /lo que se pidió romper no es un hallazgo/,
      CERCA('descart', 'rastro', 300),
    ],
  }],
  ['flujo-loop', 'pantallas: la cuarta prueba usa cada elemento y anota acción, resultado y errores de consola', {
    desde: '### La cuarta prueba', hasta: '### Checklist de accesibilidad',
    patrones: [
      /cuarta prueba/,
      /cada\s+elemento\s+interactivo/,
      /elemento por elemento[\s\S]{0,300}errores de consola/,
      /celular real[\s\S]{0,300}no pude verificar/,
      /sin\s+que\s+nadie\s+la\s+haya\s+usado/,
    ],
  }],
  ['flujo-loop', 'pantallas: el checklist propio cubre accesibilidad y celular, sin script de contraste', {
    desde: '### Checklist de accesibilidad', hasta: '## Lo que esta skill NO dice',
    patrones: [
      /\*\*Contraste\*\*/, /\*\*Foco\*\*/, /\*\*Teclado\*\*/,
      /\*\*Estados\*\*[\s\S]{0,200}cargando[\s\S]{0,60}vacío[\s\S]{0,60}error[\s\S]{0,60}deshabilitado/,
      /\*\*Zoom\*\*/, /\*\*Desbordes\*\*/,
      /\*\*Botones\*\*[\s\S]{0,200}dedo/,
      /\*\*Navegación\*\*/,
    ],
  }],
  ['flujo-loop', 'el rastro lista el uso de la pantalla y los atajos conocidos (sólo si los hay)', {
    desde: '## El rastro', hasta: '## Cuando alguien encuentra algo',
    patrones: [
      /\| \*\*uso de la pantalla\*\* \|[^\n]*elemento por elemento/,
      /\| \*\*atajos conocidos\*\* \|[^\n]*sólo si hay/,
    ],
  }],
  ['flujo-loop', 'el Paso 3 pide contenido real o un placeholder que diga que lo es', {
    desde: '## Paso 3', hasta: '## Paso 4',
    patrones: [
      /\*\*Contenido real o un placeholder honesto\.\*\*[\s\S]{0,400}testimonios/,
      /placeholder que diga que lo es/,
    ],
  }],
  ['flujo-loop', 'el Paso 3 marca los atajos con su límite y cuándo mejorarlos, y marca el que no tiene cuándo', {
    desde: '## Paso 3', hasta: '## Paso 4',
    patrones: [
      /\*\*Los atajos se marcan\.\*\*[\s\S]{0,300}`atajo:`/,
      /límite[\s\S]{0,200}cuándo mejorarlo/,
      /atajos conocidos/,
      /atajo\s+sin\s+«cuándo»[\s\S]{0,200}se\s+marca\s+como\s+"sin\s+cuándo"[\s\S]{0,120}\*\*Conviene\*\*/,
    ],
  }],
  ['flujo-loop', 'el Paso 3 trae la escalera de decisión y lo que nunca se recorta', {
    desde: '## Paso 3', hasta: '## Paso 4',
    patrones: [
      /¿Hace falta que exista\?[\s\S]{0,300}¿Ya existe en el proyecto\?[\s\S]{0,300}plataforma[\s\S]{0,300}lo mínimo/,
      /Lo que nunca se recorta[\s\S]{0,300}validación en los límites[\s\S]{0,200}seguridad[\s\S]{0,200}accesibilidad[\s\S]{0,200}perder datos/,
      /Paso 2 no se negocia/,
    ],
  }],
  ['flujo-loop', 'el Paso 5 hace que el agente ofrezca /no-entendi al cerrar un mensaje largo', {
    desde: '## Paso 5', hasta: '## Las tres pruebas',
    patrones: [/Ofrecé\s+`\/no-entendi`[\s\S]{0,300}mensaje\s+largo[\s\S]{0,300}sólo\s+en\s+el\s+chat/],
  }],
  ['seguridad-de-skills', 'pide skill-scanner cada vez que entra o se actualiza una skill de afuera', {
    patrones: [/skill-scanner/],
  }],
  ['grilling', 'le habla a la persona en su idioma', { lineas: 12, patrones: [IDIOMA] }],
  ['test-driven-development', 'le habla a la persona en su idioma', { lineas: 12, patrones: [IDIOMA] }],
];

// ── Lectura de las skills ─────────────────────────────────────────────────────

const carpetas = existsSync(RAIZ)
  ? readdirSync(RAIZ).filter((n) => statSync(join(RAIZ, n)).isDirectory())
  : [];

function textoDe(carpeta) {
  return readFileSync(join(RAIZ, carpeta, 'SKILL.md'), 'utf8').replace(/\r/g, '');
}

function frontmatter(carpeta) {
  const t = textoDe(carpeta);
  if (!t.startsWith('---\n')) throw new Error('no abre con la marca de frontmatter');
  const fin = t.indexOf('\n---', 4);
  if (fin < 0) throw new Error('el frontmatter no cierra');
  return t.slice(4, fin);
}

/**
 * Los campos de un frontmatter: [{clave, valor}]. Una clave sin valor con líneas sangradas
 * debajo es un mapa: no se valida ella, se validan sus campos (`metadata.autor`). Una clave sin
 * valor y sin nada debajo queda con valor vacío, que es inválido.
 */
export function camposDe(texto) {
  const lineas = texto.split('\n');
  const hallados = [];
  lineas.forEach((l, i) => {
    if (!/^[A-Za-z0-9_-]+:/.test(l)) return;
    const j = l.indexOf(':');
    const clave = l.slice(0, j);
    const valor = l.slice(j + 1);
    const debajo = [];
    for (const s of lineas.slice(i + 1)) {
      if (!/^\s+\S/.test(s)) break;
      debajo.push(s);
    }
    if (valor.trim() !== '' || !/^\s+[A-Za-z0-9_-]+:/.test(debajo[0] ?? '')) {
      hallados.push({ clave, valor });
      return;
    }
    for (const s of debajo) {
      const m = s.match(/^\s+([A-Za-z0-9_-]+):(.*)$/);
      if (m) hallados.push({ clave: `${clave}.${m[1]}`, valor: m[2] });
    }
  });
  return hallados;
}

function campos(carpeta) {
  return camposDe(frontmatter(carpeta));
}

function valorDe(carpeta, clave) {
  return campos(carpeta).find((c) => c.clave === clave)?.valor;
}

/** El cuerpo de un escalar de bloque, para que una clave con marcador y nada debajo no pase. */
function cuerpoDeBloque(carpeta, clave) {
  const lineas = frontmatter(carpeta).split('\n');
  const i = lineas.findIndex((l) => l.startsWith(clave + ':'));
  if (i < 0) return '';
  const cuerpo = [];
  for (const l of lineas.slice(i + 1)) {
    if (!/^\s/.test(l) && l.trim() !== '') break;
    if (l.trim() !== '') cuerpo.push(l.trim());
  }
  return cuerpo.join('\n').trim();
}

/**
 * Documentos que viven en el proyecto DEL LECTOR, no en la skill. La skill los nombra para que
 * el lector los busque en su repo, así que exigir que existan acá es un rojo falso.
 *
 * ⚠️ Es una lista, y eso es a propósito. La alternativa era chequear sólo las rutas con barra —
 * pero entonces se perdería el chequeo más valioso, que es el de un archivo vecino nombrado por
 * su nombre pelado. Con lista, agregar una referencia nueva a un documento de proyecto **falla
 * ruidosamente** y alguien la suma; sin lista, un vecino renombrado pasaría en silencio. Falla
 * en la dirección correcta.
 *
 * 🔑 Y este chequeo ya dio este mismo rojo falso antes, en otro repo: resolvía sólo contra la
 * carpeta de la skill y daba por faltantes los documentos de la raíz. Se arregló allá y se
 * reintrodujo al portar el código acá.
 */
const DEL_PROYECTO_DEL_LECTOR = ['CLAUDE.md', 'AGENTS.md', 'README.md', 'DESIGN.md', 'MEMORY.md'];

/** Todos los archivos de una skill, como rutas relativas con barra normal. */
function archivosDeSkill(carpeta, base = carpeta) {
  return readdirSync(carpeta).flatMap((n) => {
    const p = join(carpeta, n);
    return statSync(p).isDirectory()
      ? archivosDeSkill(p, base)
      : [p.slice(base.length + 1).replace(/\\/g, '/')];
  });
}

/** Los archivos que el cuerpo de la skill nombra con una ruta relativa. */
function archivosNombrados(carpeta) {
  const cuerpo = textoDe(carpeta).replace(/^---\n[\s\S]*?\n---/, '');
  const hallados = new Set();
  for (const m of cuerpo.matchAll(/\]\(([^)\s]+\.md)\)/g)) hallados.add(m[1]);
  for (const m of cuerpo.matchAll(/`([A-Za-z0-9_./-]+\.md)`/g)) hallados.add(m[1]);
  return [...hallados].filter(
    (r) => !r.startsWith('/') && !r.includes('://') && !DEL_PROYECTO_DEL_LECTOR.includes(r),
  );
}

// ── Los casos del auto-test ───────────────────────────────────────────────────

const FRONTMATTER_INVALIDO = [
  ['dos puntos y espacio', 'Cómo se trabaja: el orden de los pasos'],
  ['termina en dos puntos', 'Cómo se trabaja así:'],
  ['espacio y numeral', 'Usala siempre # incluso al final'],
  ['arranca con acento grave', '`flujo-loop` es el procedimiento'],
  ['arranca con arroba', '@equipo el procedimiento'],
  ['arranca con corchete', '[el procedimiento]'],
  ['arranca con llave', '{el procedimiento}'],
  ['arranca con asterisco', '*el procedimiento'],
  ['arranca con numeral', '#el procedimiento'],
  ['comilla doble que no cierra', '"el procedimiento'],
  ['comilla simple que no cierra', "'el procedimiento"],
  ['citado con comilla interna', '"el procedimiento "bueno" del equipo"'],
  ['vacío', '   '],
];

const FRONTMATTER_VALIDO = [
  '"Cómo se trabaja: el orden de los pasos"',
  "'Cómo se trabaja: el orden'",
  'Cómo se trabaja en el equipo',
  '"con \\"comillas\\" escapadas"',
  '>',
  '|',
  'termina en punto.',
];

const ACOPLADO = [
  ['nombra una base', 'Los datos viven en Supabase y es producción.'],
  ['nombra un comando', 'Corré npm run check antes de commitear.'],
  ['nombra un framework', 'Las clases de Tailwind se generan al compilar.'],
  ['nombra un runner', 'Corré vitest para los tests.'],
  ['afirma una medida en px', 'El mínimo táctil es 44px con el dedo.'],
  ['afirma una cantidad de tests', 'La suite tiene 5655 tests en verde.'],
  ['afirma una cantidad de líneas', 'El cambio son 400 líneas como máximo.'],
];

const DESACOPLADO = [
  'Corré los controles que el proyecto declara, en el orden que los declara.',
  'Un test que nadie rompió a propósito es un control documentado pero no probado.',
  'Averiguá qué fuerza ya el proyecto antes de dibujar.',
  'El paso 0 construye el enchufe en vez de exigirlo.',
  'Van las tres pruebas: el fallo textual, la mutación y los números.',
];

/**
 * Frontmatters enteros, para lo que un valor suelto no alcanza a decidir: una clave sin valor
 * es válida si debajo tiene un mapa (`metadata:` con sus campos sangrados), e inválida si no.
 * Lo trajo la primera skill copiada de afuera: su `metadata:` es YAML válido y daba rojo.
 */
const FRONTMATTER_ENTERO = [
  ['mapa anidado válido', 'name: x\nmetadata:\n  autor: "alguien"\n  version: "1.0"', 0],
  ['clave sin valor y sin nada debajo', 'name: x\nmetadata:\nlicense: y', 1],
  ['campo anidado mal escrito', 'name: x\nmetadata:\n  autor: uno: dos', 1],
];

function autoTest() {
  const fallas = [];
  const ok = (cond, msg) => { if (!cond) fallas.push(msg); };

  //  Un requisito tiene que poder fallar: texto vacío, patrón fuera de la sección, y el caso bueno.
  const pedido = { desde: '## A', hasta: '## B', patrones: [/zeta/] };
  ok(faltantes('', pedido).length > 0, 'faltantes: debía fallar con un texto vacío');
  ok(faltantes('## A\nzeta\n## B', pedido).length === 0, 'faltantes: debía aceptar el patrón dentro de la sección');
  ok(faltantes('## A\nnada\n## B\nzeta', pedido).length > 0, 'faltantes: debía rechazar el patrón fuera de la sección');
  ok(faltantes('uno\ndos\nzeta', { lineas: 2, patrones: [/zeta/] }).length > 0, 'faltantes: debía rechazar el patrón fuera de las primeras líneas');
  ok(faltantes('a\nb', { patrones: [/a/, /c/] }).length === 1, 'faltantes: debía listar sólo el patrón que falta');

  for (const [nombre, texto, invalidos] of FRONTMATTER_ENTERO) {
    const n = camposDe(texto).filter((c) => motivoInvalido(c.valor) !== null).length;
    ok(n === invalidos, `frontmatter entero "${nombre}": esperaba ${invalidos} inválidos y dio ${n}`);
  }

  for (const [nombre, valor] of FRONTMATTER_INVALIDO) {
    ok(motivoInvalido(valor) !== null, `debía rechazar frontmatter: ${nombre}`);
  }
  for (const valor of FRONTMATTER_VALIDO) {
    const m = motivoInvalido(valor);
    ok(m === null, `debía aceptar frontmatter ${JSON.stringify(valor)} — dijo: ${m}`);
  }
  for (const [nombre, texto] of ACOPLADO) {
    ok(acoplamientos(texto).length > 0, `debía detectar acoplamiento: ${nombre}`);
  }
  for (const texto of DESACOPLADO) {
    const a = acoplamientos(texto);
    ok(a.length === 0, `no debía detectar nada en ${JSON.stringify(texto)} — dijo: ${a}`);
  }

  const total =
    FRONTMATTER_INVALIDO.length + FRONTMATTER_VALIDO.length + ACOPLADO.length + DESACOPLADO.length +
    FRONTMATTER_ENTERO.length + 5;
  return { fallas, total };
}

// ── La verificación de las skills reales ──────────────────────────────────────

function verificar() {
  const fallas = [];
  let chequeos = 0;
  const ok = (cond, msg) => { chequeos++; if (!cond) fallas.push(msg); };

  //  Sin esto, todo lo de abajo pasa con cero carpetas: verde por vacuidad.
  ok(carpetas.length > 0, 'no hay ninguna skill en skills/');
  ok(carpetas.includes(GENERICA), `falta la skill genérica "${GENERICA}"`);

  for (const c of carpetas) {
    ok(existsSync(join(RAIZ, c, 'SKILL.md')), `${c}: no tiene SKILL.md`);
    if (!existsSync(join(RAIZ, c, 'SKILL.md'))) continue;

    try {
      for (const { clave, valor } of campos(c)) {
        const m = motivoInvalido(valor);
        ok(m === null, `${c}: el campo "${clave}" está mal escrito (${m})`);
      }
    } catch (e) {
      ok(false, `${c}: ${e.message}`);
      continue;
    }

    const nombre = valorDe(c, 'name')?.trim().replace(/^["']|["']$/g, '');
    ok(nombre === c, `${c}: el name del frontmatter dice "${nombre}" y la carpeta es "${c}"`);

    const desc = (valorDe(c, 'description') ?? '').trim();
    const contenido = /^[>|]/.test(desc)
      ? cuerpoDeBloque(c, 'description')
      : desc.replace(/^["']|["']$/g, '').trim();
    ok(contenido.length > 0, `${c}: la description está vacía`);

    //  Un nombre pelado, sin barra, puede estar nombrado dentro de la descripción de una
    //  subcarpeta ("`references/` — ... `00-indice.md`"): se busca en toda la skill. Una ruta
    //  con barra se sigue exigiendo exacta.
    //
    //  Una skill copiada de afuera puede nombrar archivos que tampoco existen en su fuente: no
    //  se arreglan tocando la copia. Se declaran en su ORIGEN.json (`faltan_en_origen`) y se
    //  aceptan ESOS, ni uno más: un faltante nuevo sigue fallando, y uno declarado que aparece
    //  también, para que la lista no quede vieja.
    const todos = archivosDeSkill(join(RAIZ, c));
    const rutaOrigen = join(RAIZ, c, 'ORIGEN.json');
    const declarados = existsSync(rutaOrigen)
      ? JSON.parse(readFileSync(rutaOrigen, 'utf8')).faltan_en_origen ?? []
      : [];
    const esDeclarado = (rel) => declarados.some((d) => d === rel || d.endsWith(`/${rel}`));
    for (const rel of archivosNombrados(c)) {
      const existe = rel.includes('/')
        ? existsSync(join(RAIZ, c, rel))
        : todos.some((f) => f === rel || f.endsWith(`/${rel}`));
      ok(existe || esDeclarado(rel), `${c}: nombra "${rel}" y no existe`);
    }
    for (const d of declarados) {
      ok(!existsSync(join(RAIZ, c, d)), `${c}: declara que falta "${d}" pero existe: sacalo de faltan_en_origen`);
    }
  }

  for (const [skill, que, pedido] of REQUISITOS) {
    if (!carpetas.includes(skill)) { ok(false, `${skill}: falta la carpeta`); continue; }
    const f = faltantes(textoDe(skill), pedido);
    ok(f.length === 0, `${skill}: ${que} — falta ${f.join(', ')}`);
  }

  //  Sólo a la genérica se le exige no nombrar nada de ningún proyecto. Las otras dos viajan
  //  intactas desde su fuente y no son nuestras para reescribir.
  if (carpetas.includes(GENERICA)) {
    const a = acoplamientos(textoDe(GENERICA));
    ok(a.length === 0, `${GENERICA}: dejó de ser genérica — ${a.join('; ')}`);
  }

  return { fallas, chequeos };
}

// ── Salida ────────────────────────────────────────────────────────────────────

const soloAutoTest = process.argv.includes('--self-test');
const r = soloAutoTest ? autoTest() : verificar();
const cuantos = soloAutoTest ? r.total : r.chequeos;
const etiqueta = soloAutoTest ? 'casos del verificador' : 'chequeos';

if (r.fallas.length > 0) {
  console.log(`FALLA  ${r.fallas.length} de ${cuantos} ${etiqueta}:`);
  for (const f of r.fallas) console.log(`  - ${f}`);
  process.exit(1);
}
console.log(`OK  ${cuantos} ${etiqueta}, sin fallas.`);
