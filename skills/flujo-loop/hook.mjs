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

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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
  let cerco = null; // la marca que abrió el bloque de código, si hay uno abierto
  //  Un BOM al principio no hace falta quitarlo: `\s` ya lo cuenta como espacio, y el patrón del
  //  encabezado admite espacios delante. Lo fija el caso del BOM.
  for (const linea of texto.split(/\r?\n/)) {
    const marca = /^\s{0,3}(```+|~~~+)/.exec(linea)?.[1];
    if (marca) {
      if (!cerco) cerco = marca[0];
      else if (marca[0] === cerco) cerco = null;
      continue;
    }
    if (cerco) continue;
    const m = /^\s{0,3}#{1,6}[ \t]+(.*)$/.exec(linea);
    if (m) salida.push(sinTildes(m[1]).replace(/^[^a-z]+/, ''));
  }
  return salida;
}

/** Las líneas de los encabezados que no están en el rastro. Sólo mira la forma, no el contenido. */
function encabezadosFaltantes(texto) {
  const ts = titulos(texto);
  return ENCABEZADOS.filter(([, re]) => {
    const r = new RegExp(`^(${re})(?![a-z])`);
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

  const estado = git(raiz, 'status', '--porcelain');
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
    const diff = git(raiz, 'diff', '--name-only', `${arriba}...HEAD`);
    if (diff !== null) for (const r of diff.split('\n')) if (r.trim()) rutas.add(r.trim());
  }

  const pendientes = [...rutas].filter(
    (r) => r !== MARCADOR && !r.replace(/\\/g, '/').startsWith(`${CARPETA_RASTRO}/`),
  );

  //  Con barra normal a proposito: es como lo escribe el control de versiones y como se lee
  //  en cualquier sistema. La ruta igual sirve para buscar el archivo en disco.
  return { rastro: `${CARPETA_RASTRO}/${rama.replace(/\//g, '-')}.md`, pendientes };
}

const RECORDATORIO = `Este proyecto sigue el flujo de Loop (hay un archivo ${MARCADOR} en la raíz).

Antes de cambiar nada, invocá la skill \`flujo-loop\` y seguí su orden. En resumen:

0. Los controles del proyecto: si su AGENTS.md o CLAUDE.md no los declara, se buscan y se
   confirman con la persona antes de seguir (Paso 0).
1. \`/grilling\` ANTES de tener la solución pensada. Se ejecuta el comando, no se lee la skill.
2. \`/test-driven-development\` al EMPEZAR a implementar, no al terminar.
3. Los controles que declara el proyecto, reportando los números que dieron.
4. El rastro en \`${CARPETA_RASTRO}/<rama>.md\`, commiteado, con las tres pruebas:
   el fallo textual observado antes de implementar, la mutación verificada (y la confirmación
   de que se aplicó), y los números de cada control. Más lo que NO se pudo verificar. Y como
   PRIMERA sección, el reporte en lenguaje llano (Paso 5).
5. La última puerta: se presenta UNA sola vez, terminado, con los controles en verde y la
   revisión de seguridad hecha. Tu mensaje final en el chat es ese mismo reporte llano: qué hace
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

/**
 * Dónde está el comando de verdad en un tramo: se saltean las asignaciones (`VAR=valor`) y los
 * envoltorios (`env`, `sudo`, `npx`, `bunx`, `pnpm dlx`, `yarn dlx`) con sus opciones. Devuelve el
 * índice, o el largo si no queda nada. Así `echo supabase db push` no cuenta: el comando es echo.
 */
function posicionDelComando(palabras) {
  let i = 0;
  while (i < palabras.length) {
    const w = palabras[i];
    if (/^[A-Za-z_]\w*=/.test(w)) { i++; continue; }
    const n = NOMBRE(w);
    if (['env', 'sudo', 'npx', 'bunx'].includes(n)) { i++; }
    else if (['pnpm', 'yarn'].includes(n) && ['dlx', 'exec'].includes(palabras[i + 1])) { i += 2; }
    else break;
    while (i < palabras.length && palabras[i].startsWith('-')) i++;
  }
  return i;
}

/** Si `sub` aparece como palabras consecutivas en `palabras` (con opciones antes o después). */
const contiene = (palabras, sub) =>
  palabras.some((_, k) => sub.every((x, j) => palabras[k + j] === x));

/**
 * Comandos que escriben en la base de producción. Lista fija a propósito: que cada proyecto
 * declare los suyos obliga a parsear su archivo de reglas, y eso se suma cuando alguien lo pida.
 *
 * Se mira por palabras sueltas, no por el texto, y sólo si el programa está EN POSICIÓN DE
 * COMANDO (ver `posicionDelComando`): `echo supabase db push` o `grep supabase db push docs` no
 * disparan. El subcomando se busca como secuencia consecutiva entre lo que sigue al programa,
 * así una opción con valor antes (`--workdir x`) no lo esquiva; `npx prisma@5` y los `.exe`,
 * `.cmd`, `.ps1` tampoco. `--linked=lo-que-sea` cuenta como `--linked`. `--dry-run`, `--help`
 * y `-h` no escriben nada, y no se frenan.
 *
 * ⚠️ Techo conocido: la línea de un heredoc que es literalmente `supabase db push` se lee como un
 * comando y bloquea. Falla del lado seguro (de más, nunca de menos) y está fijado en un test.
 */
function produccion(palabras) {
  const i = posicionDelComando(palabras);
  if (i >= palabras.length) return null;
  const programa = NOMBRE(palabras[i]).replace(/@[^@]*$/, '').replace(/\.(exe|cmd|ps1)$/, '');
  const resto = palabras.slice(i + 1);
  if (resto.some((w) => ['--dry-run', '--help', '-h'].includes(w))) return null;
  const linked = resto.some((w) => w === '--linked' || w.startsWith('--linked='));

  if (programa === 'supabase') {
    if (contiene(resto, ['db', 'push'])) return 'aplica las migraciones pendientes en la base de producción';
    if (linked && contiene(resto, ['db', 'query'])) return 'ejecuta SQL contra la base de producción';
    if (linked && contiene(resto, ['migration', 'repair'])) return 'reescribe el historial de migraciones de producción';
  }
  if (programa === 'prisma' && contiene(resto, ['migrate', 'deploy'])) {
    return 'aplica las migraciones en la base de producción';
  }
  return null;
}

/**
 * Los tramos de un comando, y los de lo que corre un `bash -c "..."` (también sh, zsh, dash),
 * hasta tres niveles. Un salto de línea con barra al final es un espacio, no un corte.
 */
function* segmentos(comando, nivel = 0) {
  for (const palabras of tramos(comando.replace(/\\\r?\n/g, ' '))) {
    yield palabras;
    const i = posicionDelComando(palabras);
    if (nivel < 3 && /^(ba|z|da)?sh$/.test(NOMBRE(palabras[i] ?? ''))) {
      const c = palabras.findIndex((w, k) => k > i && /^-[a-z]*c$/.test(w));
      if (c >= 0 && palabras[c + 1]) yield* segmentos(palabras[c + 1], nivel + 1);
    }
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

  const { rastro, pendientes } = estado;
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
