#!/usr/bin/env node
/**
 * EL HOOK DE `flujo-loop`.
 *
 * Tres trabajos, y nada más:
 *
 *   `UserPromptSubmit` → mete el procedimiento en contexto. Así no depende de que alguien se
 *                        acuerde de invocar la skill, que es el mecanismo que ya falló.
 *   `Stop`             → no deja declarar "listo" si hay trabajo sin rastro, o si el rastro no
 *                        trae sus encabezados (sólo que estén, nunca lo que dicen). No mira
 *                        `stop_hook_active`: mientras la condición siga, bloquea cada vez.
 *                        Sólo cuenta lo que escribió ESTA sesión (ver tocadosPorLaSesion): un
 *                        cambio de otra sesión en el mismo checkout no la traba.
 *   `PreToolUse`       → el guardrail: frena los comandos de git que borran trabajo sin vuelta
 *                        atrás, o que lo publican, y los comandos que escriben en la base de
 *                        producción (lista fija). Ver más abajo.
 *
 * Actúa **sólo** en repos con el marcador `.flujo-loop` en la raíz. En cualquier otro proyecto no
 * hace absolutamente nada.
 *
 * 🔑 FALLA ABIERTO, Y ES LA DECISIÓN DE DISEÑO MÁS IMPORTANTE DE ESTE ARCHIVO. El peor modo de
 * falla de un hook no es dejar pasar algo: es **bloquear cuando no debe**. Un hook que se rompe y
 * corta el turno vuelve la herramienta inusable en todos los proyectos a la vez, y lo primero que
 * hace cualquiera es desinstalarlo — con lo cual el control no protege nada nunca más.
 *
 * Así que sólo bloquea cuando determinó POSITIVAMENTE que hay cambios sin rastro. Ante un error,
 * una entrada rara, un dato que no pudo obtener o un repo en un estado que no entiende, sale en 0
 * y se calla. Eso incluye un rastro que existe pero no se puede leer.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const MARCADOR = '.flujo-loop';
const CARPETA_RASTRO = 'flujo';

/**
 * Los encabezados que el rastro tiene que traer: [línea exacta que se acepta, patrón del título].
 *
 * El patrón se aplica al título ya sin tildes ni mayúsculas y sin la decoración que lo precede
 * (emoji, `1.`, `**`): tiene que estar AL PRINCIPIO del título, y lo que sigue puede ser el fin
 * de la línea, un signo, o más palabras ("Decisiones y por qué"). Lo que no puede seguir es una
 * letra: "Decisionesx" no es "Decisiones". Una palabra en prosa, en un ítem de lista o en medio
 * de otro título ("Mis decisiones") no cuenta.
 *
 * ⚠️ Sólo encabezados con `#`. El subrayado con `===` o `---` (setext) no se reconoce, y el
 * mensaje de bloqueo lo dice.
 */
const ENCABEZADOS = [
  ['## Reporte en lenguaje llano', 'reporte en lenguaje llano'],
  ['## Decisiones', 'decisiones'],
  ['## Las tres pruebas', 'las (tres|3) pruebas'],
  ['## Lo que no se pudo verificar', 'lo que no (se )?pud[eo] verificar'],
];

const sinTildes = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Los títulos del rastro, ya normalizados: sin BOM, sin lo que está dentro de un bloque de código. */
function titulos(texto) {
  const salida = [];
  let cerco = null; // la marca completa que abrió el bloque de código (``` o ````, ~~~), si hay uno
  //  Un BOM al principio no hace falta quitarlo: `\s` ya lo cuenta como espacio, y el patrón del
  //  encabezado admite espacios delante. Lo fija el caso del BOM.
  for (const linea of texto.split(/\r?\n/)) {
    const marca = /^\s{0,3}(`{3,}|~{3,})(.*)$/.exec(linea);
    if (cerco) {
      //  Sólo cierra una línea del mismo carácter, igual o más larga, y sin nada más: una línea
      //  de ``` adentro de un cerco de ```` o un ```js no lo cierran.
      if (marca && marca[1][0] === cerco[0] && marca[1].length >= cerco.length && marca[2].trim() === '') cerco = null;
      continue;
    }
    if (marca) { cerco = marca[1]; continue; }
    const m = /^\s{0,3}#{1,6}[ \t]+(.*)$/.exec(linea);
    if (m) salida.push(sinTildes(m[1]).replace(/^[^a-z]+/, ''));
  }
  return salida;
}

/** Las líneas de los encabezados que no están en el rastro. Sólo mira la forma, no el contenido. */
function encabezadosFaltantes(texto) {
  const ts = titulos(texto);
  return ENCABEZADOS.filter(([, re]) => {
    const r = new RegExp(`^(${re})(?![a-z0-9_])`);
    return !ts.some((t) => r.test(t));
  }).map(([linea]) => linea);
}

/** Sale en 0 sin decir nada. El camino por defecto ante cualquier duda. */
function callarse() {
  process.exit(0);
}

async function leerEntrada() {
  if (process.stdin.isTTY) return '';
  const partes = [];
  for await (const c of process.stdin) partes.push(c);
  return Buffer.concat(partes).toString('utf8');
}

function git(raiz, ...args) {
  const r = spawnSync('git', args, { cwd: raiz, encoding: 'utf8' });
  //  `status === null` es git que no se pudo ejecutar; cualquier código distinto de 0 es git que
  //  no pudo contestar. Las dos cosas son "no sé", nunca "no".
  if (r.error || r.status !== 0) return null;
  return (r.stdout || '').replace(/\r/g, '');
}

/**
 * Todo lo que hay que preguntarle al control de versiones, en UNA función y con UN solo punto de
 * falla-abierto: devuelve `{rastro, pendientes}` o null si no se pudo saber algo.
 *
 * 🔑 Está junto a propósito. La primera versión preguntaba en dos lugares y fallaba abierto en
 * los dos — y eso dejó una de las dos ramas **inalcanzable desde los tests**: cuando git no está,
 * la primera pregunta ya sale en 0 y la segunda nunca se evalúa. Una mutación que rompía la
 * segunda SOBREVIVIÓ a la suite entera. Con un solo punto, el caso de "sin control de versiones"
 * lo cubre de verdad.
 */
function estadoGit(raiz) {
  const rama = git(raiz, 'rev-parse', '--abbrev-ref', 'HEAD')?.trim();
  if (!rama || rama === 'HEAD') return null; // no se pudo preguntar, sin rama, o cabeza suelta

  //  `-uall`: una carpeta nueva lista sus archivos y no sólo `?? carpeta/`, y `quotePath=false`: un
  //  nombre con tilde o ñ sale tal cual y no escapado. Sin los dos, lo que escribió la sesión no
  //  coincidía con lo que dice git, y el Stop lo dejaba pasar (revisión independiente, 2026-11-17).
  const estado = git(raiz, '-c', 'core.quotePath=false', 'status', '--porcelain', '-uall');
  if (estado === null) return null;

  const rutas = new Set();
  for (const linea of estado.split('\n')) {
    if (linea.trim() === '') continue;
    //  El formato deja dos columnas de estado y un espacio antes de la ruta, y los renombres
    //  llevan "viejo -> nuevo": interesa el destino.
    const ruta = linea.slice(3).trim().split(' -> ').pop().replace(/^"|"$/g, '');
    if (ruta) rutas.add(ruta);
  }

  //  Los commits de la rama, cuando hay una referencia remota con la que compararlos. Si no la
  //  hay —una rama que nunca se pusheó— se queda con el árbol de trabajo: un dato incompleto, y
  //  por eso se usa para NO bloquear, nunca para bloquear de más.
  const arriba = git(raiz, 'rev-parse', '--abbrev-ref', '@{upstream}')?.trim();
  if (arriba) {
    const diff = git(raiz, '-c', 'core.quotePath=false', 'diff', '--name-only', `${arriba}...HEAD`);
    if (diff !== null) for (const r of diff.split('\n')) if (r.trim()) rutas.add(r.trim());
  }

  const pendientes = [...rutas].filter(
    (r) => r !== MARCADOR && !r.replace(/\\/g, '/').startsWith(`${CARPETA_RASTRO}/`),
  );

  //  Con barra normal a proposito: es como lo escribe el control de versiones y como se lee
  //  en cualquier sistema. La ruta igual sirve para buscar el archivo en disco.
  return { rastro: `${CARPETA_RASTRO}/${rama.replace(/\//g, '-')}.md`, pendientes };
}

/** Una ruta del repo, comparable: barra normal y, en Windows, sin distinguir mayúsculas. */
const comparable = (r) => {
  const n = r.replace(/\\/g, '/');
  return process.platform === 'win32' ? n.toLowerCase() : n;
};

const HERRAMIENTAS_QUE_ESCRIBEN = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);
const SHELLS = new Set(['Bash', 'PowerShell']);

/**
 * Un comando de shell que ESCRIBE archivos: redirección, `tee`, `sed -i`, `perl -pi`, copiar o
 * mover, aplicar un parche, restaurar de otra rama, un formateador con `--write` o `--fix`, o
 * escribir desde node, python, PowerShell o .NET. Ante la duda cuenta como escritura: es el lado
 * seguro. Se mira sin las redirecciones que no escriben archivos (ver INOFENSIVAS).
 */
const ESCRIBE = /(^|[^<>-])>>?|\btee\b|\bsed\s+-i|\b(perl|ruby)\s+-\w*i|\bawk\s+-i\s+inplace|\b(cp|mv|rm|install|touch|patch)\b|\bgit\s+(apply|am|restore|checkout\b[^\n]*\s--\s)|--write\b|--fix\b|writeFileSync|appendFileSync|open\([^)]*,\s*(mode\s*=\s*)?['"][wa]|\.write_text\(|WriteAll(Text|Lines|Bytes)|Set-Content|Add-Content|Out-File|New-Item|Copy-Item|Move-Item|Remove-Item/i;

/**
 * Lo que parece una escritura y no escribe ningún archivo (flujo-loop #15): `2>&1`, `2>/dev/null`,
 * `> $null` y las flechas `=>` / `->`. Sin sacarlas, `git diff ajeno.txt 2>&1` hacía propio a un
 * archivo ajeno que sólo se leía.
 */
const INOFENSIVAS = /\d*>&\d+|\d*>\s*\/dev\/null\b|\d*>\s*\$null\b|[=-]>/gi;

/** Escapa un texto para usarlo literal en una expresión regular. */
const literal = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Cambiar de carpeta en bash o PowerShell: `cd`, `pushd`, `Set-Location`/`sl`, `chdir`. */
const CAMBIA_CARPETA = /^(?:cd|pushd|chdir|set-location|sl)\s+(?:"([^"]+)"|'([^']+)'|([^\s;&|]+))/i;

/**
 * Un nombre como palabra entera, con los bordes que aparecen en un comando: espacio, comillas
 * (también el backtick), `=`, `(`, `:`, `/`, `>` (una redirección pegada: `echo x >a.ts`), `,`,
 * `;`, `&`, `[`. Así `a.ts` no está en `data.ts`. Se compila una vez por nombre.
 */
const comoPalabra = new Map();
function palabra(f) {
  if (!comoPalabra.has(f)) {
    comoPalabra.set(f, new RegExp(`(^|[\\s'"\`=(:/>,;&\\[])${literal(f)}($|[\\s'"\`;|&)>,:\\]])`));
  }
  return comoPalabra.get(f);
}

/**
 * ¿El comando ESCRIBE el archivo `r` (ruta comparable, relativa al repo)? Se lee tramo por tramo
 * (separados por `&&`, `||`, `;`, `|` o un salto de línea) siguiendo la carpeta actual: cada
 * `cd`/`pushd`/`Set-Location` la mueve desde la anterior, y un nombre cuenta sólo en un tramo que
 * escribe, tal cual o relativo a esa carpeta. Así `cd src; sed -i … a.ts` escribe `src/a.ts`, y en
 * `cd src && git diff a.ts && cd .. && echo > b.ts` el `a.ts` sólo se leyó (flujo-loop #15).
 * `base` es la raíz del repo, para un cd absoluto.
 */
function nombra(cmd, r, base) {
  let actual = base;
  for (const tramo of cmd.split(/&&|\|\||[;|\n]/)) {
    const t = tramo.trim();
    const cd = CAMBIA_CARPETA.exec(t);
    if (cd) {
      const destino = cd[1] ?? cd[2] ?? cd[3];
      if (destino !== '-') actual = resolve(actual, destino);
      continue;
    }
    if (!ESCRIBE.test(t.replace(INOFENSIVAS, ' '))) continue;
    const formas = [r];
    const dir = comparable(relative(base, actual));
    if (dir !== '' && !dir.startsWith('..') && r.startsWith(`${dir}/`)) formas.push(r.slice(dir.length + 1));
    if (formas.some((f) => palabra(f).test(t))) return true;
  }
  return false;
}

/**
 * Lo que ESTA sesión escribió en el repo, sacado del historial que Claude Code le pasa al hook
 * (`transcript_path`) y de los de sus subagentes (`<carpeta>/<id de sesión>/subagents/*.jsonl`):
 * los archivos que tocó con Write/Edit/MultiEdit/NotebookEdit, y los comandos de shell que
 * escriben (un archivo pendiente que uno de ellos nombra cuenta como propio).
 *
 * `null` si no llegó historial (otro cliente): el Stop mira todo, como antes. Si llegó pero no se
 * puede leer, NO es "mirar todo": es un dato que no se pudo obtener, y el hook se calla (vacío).
 *
 * Decisión del dueño (2026-11-17): "la recomendada, solo lo que tocó la sesión". Mirando todo el
 * checkout, el cambio sin commitear de UNA sesión trababa en loop a todas las demás del mismo repo.
 *
 * ⚠️ Lo que no ve: código que genera un script (npm, un generador) sin que el comando nombre el
 * archivo, y lo que escriben herramientas de MCP.
 */
function tocadosPorLaSesion(transcriptPath, raiz) {
  if (typeof transcriptPath !== 'string' || transcriptPath === '') return null;
  const historiales = [transcriptPath];
  try {
    const sub = join(dirname(transcriptPath), basename(transcriptPath, '.jsonl'), 'subagents');
    if (existsSync(sub)) {
      for (const f of readdirSync(sub)) if (f.endsWith('.jsonl')) historiales.push(join(sub, f));
    }
  } catch {
    //  sin subagentes legibles: queda el historial principal
  }
  const base = resolve(raiz);
  const tocados = new Set();
  const comandos = [];
  let leido = false;
  for (const h of historiales) {
    let texto;
    try {
      texto = readFileSync(h, 'utf8');
      leido = true;
    } catch {
      continue;
    }
    for (const linea of texto.split('\n')) {
      if (!linea.includes('"tool_use"')) continue;
      let m;
      try {
        m = JSON.parse(linea);
      } catch {
        continue;
      }
      for (const c of m?.message?.content ?? []) {
        if (c?.type !== 'tool_use') continue;
        if (SHELLS.has(c.name)) {
          const cmd = c.input?.command;
          if (typeof cmd === 'string' && ESCRIBE.test(cmd.replace(INOFENSIVAS, ' '))) comandos.push(comparable(cmd));
          continue;
        }
        if (!HERRAMIENTAS_QUE_ESCRIBEN.has(c.name)) continue;
        const ruta = c.input?.file_path ?? c.input?.notebook_path;
        if (typeof ruta !== 'string' || ruta === '') continue;
        const rel = relative(base, resolve(base, ruta));
        if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) continue; // fuera del repo
        tocados.add(comparable(rel));
      }
    }
  }
  //  Llegó un historial y no se pudo leer ninguno: no se sabe qué tocó la sesión, y no se bloquea.
  if (!leido) return { esPropio: () => false };
  return { esPropio: (r) => tocados.has(comparable(r)) || comandos.some((c) => nombra(c, comparable(r), base)) };
}

const RECORDATORIO = `Este proyecto sigue el flujo de Loop (hay un archivo ${MARCADOR} en la raíz).

Antes de cambiar nada, invocá la skill \`flujo-loop\` y seguí su orden. En resumen:

0. Los controles del proyecto: si su AGENTS.md o CLAUDE.md no los declara, se buscan y se
   confirman con la persona antes de seguir (Paso 0).
1. \`/grilling\` ANTES de tener la solución pensada. Se ejecuta el comando, no se lee la skill.
2. \`/test-driven-development\` al EMPEZAR a implementar, no al terminar.
3. (Paso 4) Antes de los controles, con la tarea ya guardada en su commit, si cambió código
   (los tests cuentan como código): \`/desenredar-codigo acotado\` (modo acotado) sobre los
   archivos que tocó, sin cambiar lo que hace ni sus interfaces públicas. Si no suma lógica (sólo nombres,
   formato o valores), se saltea y el rastro anota por qué.
4. Los controles que declara el proyecto, reportando los números que dieron.
5. El rastro en \`${CARPETA_RASTRO}/<rama>.md\`, commiteado, con las tres pruebas:
   el fallo textual observado antes de implementar, la mutación verificada (y la confirmación
   de que se aplicó), y los números de cada control. Más lo que NO se pudo verificar. Y como
   PRIMERA sección, el reporte en lenguaje llano (Paso 5).
6. La última puerta (Paso 5): se presenta UNA sola vez, terminado, con los controles en verde
   y la revisión de seguridad hecha. Tu mensaje final en el chat es ese mismo reporte llano: qué hace
   el cambio, hallazgos numerados (Debe, Conviene, Opcional), veredicto y lo que no se revisó.
   Antes de presentar, siempre \`/revision-independiente\`: un revisor que no vio la
   conversación (dos si toca plata, datos o permisos); si es sólo docs, anotalo en el reporte.
   Si sumaste, copiaste, actualizaste o escribiste una skill:
   \`/seguridad-de-skills\`.

La persona que pide esto probablemente no lee código, y otra persona audita después: la prueba
de que algo funciona tiene que quedar ESCRITA, no demostrada en la conversación.

LAS SKILLS: proponé y ejecutá. La persona no sabe qué skills hay: cuando una sirve para lo que
pide, proponela vos, por su nombre y con una frase de para qué. Y cuando se habla de una skill,
EJECUTALA con su comando. NUNCA leas la skill para interpretarla y hacer vos lo que dice.

Ofrecé \`/no-entendi\` al cerrar cualquier mensaje largo (una tanda de preguntas, la propuesta
de controles, el reporte final): la persona no sabe que existe.`;

// ── El guardrail de git (PreToolUse) ──────────────────────────────────────────
//
//  Frena los comandos de git que borran trabajo sin vuelta atrás, o que lo publican, antes de
//  que corran. La persona que trabaja con esto probablemente no lee código: un `reset --hard`
//  le borra lo que hizo y no se entera de que existía.
//
//  🔑 Decide por el SUBCOMANDO real, no buscando palabras en el texto. "git push" adentro de un
//  mensaje de commit, de un `echo` o de un `--grep` no es un push — y un guardrail que bloquea
//  eso se vuelve ruido, y el ruido se desinstala. Por eso parte el comando en tramos, respeta
//  las comillas, y después de `git` saltea las opciones globales hasta llegar al subcomando.
//
//  ⚠️ No es un sandbox: un comando disfrazado lo esquiva. Es una red contra el error, no contra
//  alguien que quiere romper algo a propósito.

const HERRAMIENTAS_DE_COMANDOS = new Set(['Bash', 'PowerShell']);

/**
 * Parte un comando en tramos (`;`, `&&`, `||`, `|`, salto de línea, paréntesis y comilla
 * invertida: `(cmd)`, `$(cmd)` y `cmd` son comandos aparte) y cada tramo en palabras.
 */
function tramos(comando) {
  const salida = [];
  let palabras = [];
  let palabra = '';
  let enPalabra = false;
  let comilla = null;
  const cerrarPalabra = () => {
    if (enPalabra) palabras.push(palabra);
    palabra = '';
    enPalabra = false;
  };
  const cerrarTramo = () => {
    cerrarPalabra();
    if (palabras.length) salida.push(palabras);
    palabras = [];
  };
  for (let i = 0; i < comando.length; i++) {
    const c = comando[i];
    if (comilla) {
      if (c === comilla) comilla = null;
      else palabra += c;
      continue;
    }
    if (c === '"' || c === "'") { comilla = c; enPalabra = true; continue; }
    if (';|&\n()`'.includes(c)) { cerrarTramo(); continue; }
    if (/\s/.test(c)) { cerrarPalabra(); continue; }
    palabra += c;
    enPalabra = true;
  }
  cerrarTramo();
  return salida;
}

/** Opciones globales de git que se comen la palabra siguiente. */
const OPCION_CON_VALOR = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace']);

/** Si el tramo es un comando destructivo de git, el motivo; si no, null. */
function peligro(palabras) {
  const i = palabras.findIndex((p) => /(^|[\\/])git(\.exe)?$/i.test(p));
  if (i < 0) return null;
  let j = i + 1;
  while (j < palabras.length && palabras[j].startsWith('-')) {
    j += OPCION_CON_VALOR.has(palabras[j]) ? 2 : 1;
  }
  const sub = palabras[j];
  const args = palabras.slice(j + 1);
  const tiene = (...xs) => args.some((a) => xs.includes(a));

  if (sub === 'push') return 'publica el trabajo';
  if (sub === 'reset' && tiene('--hard')) return 'borra los cambios sin guardar';
  if (sub === 'clean' && args.some((a) => /^-[^-]*f/.test(a) || a === '--force')) {
    return 'borra los archivos que todavía no se guardaron nunca';
  }
  if (sub === 'branch' && (tiene('-D') || (tiene('-d', '--delete') && tiene('-f', '--force')))) {
    return 'borra una rama aunque tenga trabajo sin integrar';
  }
  if ((sub === 'checkout' || sub === 'restore') && args.filter((a) => a !== '--').includes('.')) {
    return 'descarta todos los cambios sin guardar';
  }
  return null;
}

const NOMBRE = (p) => p.split(/[\\/]/).pop().toLowerCase();

/** Comandos que sólo muestran o buscan texto: lo que llevan de argumento no se ejecuta. */
const SOLO_TEXTO = new Set(['echo', 'printf', 'grep', 'egrep', 'fgrep', 'rg', 'findstr', 'select-string', 'write-output', 'write-host']);
const PALABRAS_DE_CONTROL = new Set(['if', 'then', 'else', 'elif', 'do', 'while', 'until', '!', '{', '}']);

/** El nombre de un programa sin ruta, sin `@versión` y sin `.exe`/`.cmd`/`.ps1`. */
const PROGRAMA = (w) => NOMBRE(w).replace(/@[^@]*$/, '').replace(/\.(exe|cmd|ps1)$/, '');

/** El primer comando de verdad de un tramo: se saltean las asignaciones `VAR=valor` y las palabras de control. */
function inicioDelComando(palabras) {
  let i = 0;
  while (i < palabras.length && (/^[A-Za-z_]\w*=/.test(palabras[i]) || PALABRAS_DE_CONTROL.has(palabras[i]))) i++;
  return i;
}

/** Si `sub` aparece como palabras consecutivas en `palabras` (con opciones antes o después). */
const contiene = (palabras, sub) =>
  palabras.some((_, k) => sub.every((x, j) => palabras[k + j] === x));

/**
 * Comandos que escriben en la base de producción. Lista fija a propósito: que cada proyecto
 * declare los suyos obliga a parsear su archivo de reglas, y eso se suma cuando alguien lo pida.
 *
 * Se mira por palabras sueltas, no por el texto. La regla está al revés de lo que parecería: no
 * se enumeran los envoltorios que pueden llevar el comando (`npx`, `sudo`, `time`, `timeout`,
 * `xargs`, `pnpm`, `cmd /c`, `{ }`, `if…then`: la lista nunca termina) sino los comandos de SÓLO
 * TEXTO (`echo`, `grep`, `rg`…), que no ejecutan lo que reciben. Si el tramo no empieza con uno,
 * el programa se busca en cualquier lugar. El subcomando se busca como secuencia consecutiva,
 * así una opción con valor antes (`--workdir x`) no lo esquiva; `prisma@5`, `.exe`, `.cmd` y
 * `.ps1` tampoco. `--linked=lo-que-sea` cuenta como `--linked`. `--dry-run`, `--help` y `-h` no
 * escriben nada, y no se frenan.
 *
 * ⚠️ Techos conocidos, todos del lado seguro o de "no es un sandbox": la línea de un heredoc que
 * es literalmente `supabase db push` se lee como un comando y bloquea (de más, nunca de menos);
 * `echo … | sh`, la expansión de una variable y un `bash -c` anidado a más de tres niveles lo
 * esquivan.
 */
function produccion(palabras) {
  const i = inicioDelComando(palabras);
  if (i >= palabras.length || SOLO_TEXTO.has(PROGRAMA(palabras[i]))) return null;
  for (let k = i; k < palabras.length; k++) {
    const programa = PROGRAMA(palabras[k]);
    if (programa !== 'supabase' && programa !== 'prisma') continue;
    const resto = palabras.slice(k + 1);
    if (resto.some((w) => ['--dry-run', '--help', '-h'].includes(w))) return null;
    const linked = resto.some((w) => w === '--linked' || w.startsWith('--linked='));
    if (programa === 'supabase') {
      if (contiene(resto, ['db', 'push'])) return 'aplica las migraciones pendientes en la base de producción';
      if (linked && contiene(resto, ['db', 'query'])) return 'ejecuta SQL contra la base de producción';
      if (linked && contiene(resto, ['migration', 'repair'])) return 'reescribe el historial de migraciones de producción';
    } else if (contiene(resto, ['migrate', 'deploy'])) {
      return 'aplica las migraciones en la base de producción';
    }
  }
  return null;
}

/**
 * Los tramos de un comando, y los de lo que corre un `bash -c "..."` (también sh, zsh, dash) o un
 * `eval "..."`, hasta tres niveles. Un salto de línea con barra al final es un espacio, no un corte.
 */
function* segmentos(comando, nivel = 0) {
  for (const palabras of tramos(comando.replace(/\\\r?\n/g, ' '))) {
    yield palabras;
    if (nivel >= 3) continue;
    const i = inicioDelComando(palabras);
    if (NOMBRE(palabras[i] ?? '') === 'eval') {
      yield* segmentos(palabras.slice(i + 1).join(' '), nivel + 1);
      continue;
    }
    const sh = palabras.findIndex((w) => /^(ba|z|da)?sh$/.test(NOMBRE(w)));
    const c = sh < 0 ? -1 : palabras.findIndex((w, k) => k > sh && /^-[a-z]*c$/.test(w));
    if (c >= 0 && palabras[c + 1]) yield* segmentos(palabras[c + 1], nivel + 1);
  }
}

function guardrail(entrada) {
  if (!HERRAMIENTAS_DE_COMANDOS.has(entrada.tool_name)) return callarse();
  const comando = String(entrada.tool_input?.command ?? '');
  for (const palabras of segmentos(comando)) {
    const motivo = peligro(palabras);
    const deProduccion = motivo ? null : produccion(palabras);
    if (deProduccion) {
      process.stderr.write(
        `Bloqueado por flujo-loop: "${palabras.join(' ')}" ${deProduccion}.\n\n` +
          `Esto necesita la autorización explícita del dueño del proyecto, cada vez: no alcanza ` +
          `con que los tests estén verdes. Explicale a la persona qué hace y esperá su ` +
          `autorización. Para probar, usá una copia local, nunca producción.\n`,
      );
      process.exit(2);
    }
    if (!motivo) continue;
    process.stderr.write(
      `Bloqueado por flujo-loop: "${palabras.join(' ')}" ${motivo}, y eso no tiene vuelta atrás.\n\n` +
        `Si de verdad hace falta, explicale a la persona qué hace y que lo corra ella. Para ` +
        `presentar el trabajo, usá lo que declara el proyecto: nunca un push suelto.\n`,
    );
    process.exit(2);
  }
  return callarse();
}

async function main() {
  let entrada = {};
  try {
    entrada = JSON.parse(await leerEntrada()) ?? {};
  } catch {
    return callarse(); // entrada mal formada: no es asunto del hook arreglarla
  }
  const evento = entrada.hook_event_name ?? '';

  const raiz = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  if (!existsSync(join(raiz, MARCADOR))) return callarse();

  if (evento === 'PreToolUse') return guardrail(entrada);

  if (evento === 'UserPromptSubmit') {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'UserPromptSubmit',
          additionalContext: RECORDATORIO,
        },
      }),
    );
    return callarse();
  }

  if (evento !== 'Stop') return callarse();

  //  El único punto de falla-abierto del Stop: si no se pudo saber en qué rama estamos o qué
  //  cambió, no hay forma de decidir y no se bloquea.
  const estado = estadoGit(raiz);
  if (estado === null) return callarse();

  const { rastro } = estado;
  //  Sólo lo que escribió esta sesión, si se sabe; si no, todo lo pendiente (ver tocadosPorLaSesion).
  const tocados = tocadosPorLaSesion(entrada.transcript_path, raiz);
  const pendientes = tocados === null ? estado.pendientes : estado.pendientes.filter((r) => tocados.esPropio(r));
  if (pendientes.length === 0) return callarse(); // no hay trabajo que respaldar
  if (existsSync(join(raiz, rastro))) {
    //  Falla abierto: si existe pero no se puede leer, no es asunto del hook decidir nada.
    let texto;
    try {
      texto = readFileSync(join(raiz, rastro), 'utf8');
    } catch {
      return callarse();
    }
    const faltan = encabezadosFaltantes(texto);
    if (faltan.length === 0) return callarse();
    process.stderr.write(
      `El rastro existe (${rastro}) pero le faltan encabezados, y todavía no se puede dar por ` +
        `terminado.\n\nAgregá estas líneas, tal cual (se acepta otro nivel de #, mayúsculas, ` +
        `tildes y algo de texto después del título):\n${faltan.map((l) => `  ${l}`).join('\n')}\n\n` +
        `Tienen que ser encabezados de markdown con # al principio de la línea, y fuera de un ` +
        `bloque de código. El título subrayado con === o --- (setext) no se reconoce. Invocá la skill ` +
        `\`flujo-loop\` para ver qué lleva cada sección.\n`,
    );
    process.exit(2);
  }

  const muestra = pendientes.slice(0, 5);
  const resto = pendientes.length - muestra.length;
  process.stderr.write(
    `Hay trabajo sin rastro y todavía no se puede dar por terminado.\n\n` +
      `Cambió:\n${muestra.map((r) => `  - ${r}`).join('\n')}` +
      `${resto > 0 ? `\n  ... y otros archivos` : ''}\n\n` +
      `Falta el archivo de rastro: ${rastro}\n\n` +
      `Ahí van el objetivo, las decisiones y POR QUÉ se tomaron, y las tres pruebas: el mensaje ` +
      `textual del test fallando antes de implementar, qué se rompió a propósito y qué se cayó ` +
      `(con la confirmación de que la mutación se aplicó de verdad), y los números que devolvió ` +
      `cada control. Más lo que no se pudo verificar, que es obligatorio.\n\n` +
      `Sin eso, auditar este trabajo obliga a re-derivarlo. Invocá la skill \`flujo-loop\`.\n`,
  );
  process.exit(2);
}

main().catch(() => {
  //  Último recurso: nunca romper el turno por algo que no se anticipó.
  callarse();
});
