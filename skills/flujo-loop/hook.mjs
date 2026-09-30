#!/usr/bin/env node
/**
 * EL HOOK DE `flujo-loop`.
 *
 * Dos trabajos, y nada más:
 *
 *   `UserPromptSubmit` → mete el procedimiento en contexto. Así no depende de que alguien se
 *                        acuerde de invocar la skill, que es el mecanismo que ya falló.
 *   `Stop`             → no deja declarar "listo" si hay trabajo sin rastro.
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
 * y se calla.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const MARCADOR = '.flujo-loop';
const CARPETA_RASTRO = 'flujo';

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

1. \`/grilling\` ANTES de tener la solución pensada. Se ejecuta el comando, no se lee la skill.
2. \`/test-driven-development\` al EMPEZAR a implementar, no al terminar.
3. Los controles que declara el CLAUDE.md de este proyecto, reportando los números que dieron.
4. El rastro en \`${CARPETA_RASTRO}/<rama>.md\`, commiteado, con las tres pruebas:
   el fallo textual observado antes de implementar, la mutación verificada (y la confirmación
   de que se aplicó), y los números de cada control. Más lo que NO se pudo verificar.

La persona que pide esto probablemente no lee código, y otra persona audita después: la prueba
de que algo funciona tiene que quedar ESCRITA, no demostrada en la conversación.`;

async function main() {
  let evento = '';
  try {
    evento = JSON.parse(await leerEntrada())?.hook_event_name ?? '';
  } catch {
    return callarse(); // entrada mal formada: no es asunto del hook arreglarla
  }

  const raiz = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  if (!existsSync(join(raiz, MARCADOR))) return callarse();

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
  if (existsSync(join(raiz, rastro))) return callarse();

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
