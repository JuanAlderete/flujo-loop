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

/** Los campos de una línea del frontmatter: [{clave, valor}]. */
function campos(carpeta) {
  return frontmatter(carpeta)
    .split('\n')
    .filter((l) => /^[A-Za-z0-9_-]+:/.test(l))
    .map((l) => {
      const i = l.indexOf(':');
      return { clave: l.slice(0, i), valor: l.slice(i + 1) };
    });
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
const DEL_PROYECTO_DEL_LECTOR = ['CLAUDE.md', 'AGENTS.md', 'README.md', 'DESIGN.md'];

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

function autoTest() {
  const fallas = [];
  const ok = (cond, msg) => { if (!cond) fallas.push(msg); };

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
    FRONTMATTER_INVALIDO.length + FRONTMATTER_VALIDO.length + ACOPLADO.length + DESACOPLADO.length;
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

    for (const rel of archivosNombrados(c)) {
      ok(existsSync(join(RAIZ, c, rel)), `${c}: nombra "${rel}" y no existe`);
    }
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
