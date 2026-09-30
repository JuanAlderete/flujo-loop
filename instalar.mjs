#!/usr/bin/env node
/**
 * INSTALADOR DE `flujo-loop`.
 *
 * Hace las dos cosas que no conviene hacer a mano:
 *
 *   1. Copia las tres skills a la configuración de Claude Code.
 *   2. Escribe los dos enganches en el archivo de configuración, **conservando** lo que ya
 *      hubiera ahí.
 *
 * Lo segundo es el motivo de que esto sea un script y no una instrucción. El archivo de
 * configuración es estructurado: editarlo a mano y equivocarse en una coma deja la herramienta
 * sin arrancar, y el error no dice qué pasó.
 *
 * 🔑 LA REGLA DE ORO: ante un archivo de configuración que no puede leer, **no escribe**. Es
 * mejor no instalar que dejar a alguien sin herramienta.
 *
 * Uso:
 *   node instalar.mjs             instala
 *   node instalar.mjs --simular   dice qué haría, sin tocar nada
 *
 * Para probarlo sin tocar la configuración real, el destino se puede cambiar con la variable
 * de entorno FLUJO_LOOP_DESTINO.
 */

import {
  mkdirSync, readdirSync, readFileSync, writeFileSync, copyFileSync, existsSync, statSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const AQUI = dirname(fileURLToPath(import.meta.url));
const ORIGEN = join(AQUI, 'skills');
const DESTINO = process.env.FLUJO_LOOP_DESTINO || join(homedir(), '.claude');
const SIMULAR = process.argv.includes('--simular') || process.argv.includes('--dry-run');

const HOOK_INSTALADO = join(DESTINO, 'skills', 'flujo-loop', 'hook.mjs');
const EVENTOS = ['UserPromptSubmit', 'Stop'];

/** Marca por la que se reconoce nuestro enganche, para no duplicarlo ni pisar otros. */
const MARCA = 'flujo-loop';

const hechos = [];
const avisos = [];

function copiarCarpeta(desde, hacia) {
  mkdirSync(hacia, { recursive: true });
  for (const n of readdirSync(desde)) {
    const a = join(desde, n);
    const b = join(hacia, n);
    if (statSync(a).isDirectory()) copiarCarpeta(a, b);
    else copyFileSync(a, b);
  }
}

// ── 1 · Las skills ────────────────────────────────────────────────────────────

const skills = existsSync(ORIGEN)
  ? readdirSync(ORIGEN).filter((n) => statSync(join(ORIGEN, n)).isDirectory())
  : [];

if (skills.length === 0) {
  console.error(`No hay skills en ${ORIGEN}. ¿Estás corriendo esto desde la copia del repo?`);
  process.exit(1);
}

for (const s of skills) {
  const destinoSkill = join(DESTINO, 'skills', s);
  if (existsSync(destinoSkill)) {
    avisos.push(
      `ya tenías una skill llamada "${s}" y se reemplaza. Si era tuya y la querés conservar, ` +
        `renombrala antes de seguir.`,
    );
  }
  if (!SIMULAR) copiarCarpeta(join(ORIGEN, s), destinoSkill);
  hechos.push(`skill "${s}" -> ${destinoSkill}`);
}

// ── 2 · Los enganches ─────────────────────────────────────────────────────────

const rutaAjustes = join(DESTINO, 'settings.json');
let ajustes = {};

if (existsSync(rutaAjustes)) {
  const texto = readFileSync(rutaAjustes, 'utf8');
  try {
    ajustes = JSON.parse(texto);
  } catch (e) {
    //  🔑 Acá se para. Escribir encima de una configuración mal escrita la destruiría, y el que
    //  la tenía a medio editar perdería lo que estaba haciendo.
    console.error(
      `No se pudo leer ${rutaAjustes}: está mal escrito como JSON (${e.message}).\n` +
        `No se tocó nada. Arreglalo o movelo a un lado y volvé a correr esto.`,
    );
    process.exit(1);
  }
  if (ajustes === null || typeof ajustes !== 'object' || Array.isArray(ajustes)) {
    console.error(`${rutaAjustes} no contiene un objeto de configuración. No se tocó nada.`);
    process.exit(1);
  }
}

ajustes.hooks ??= {};

for (const evento of EVENTOS) {
  const grupos = Array.isArray(ajustes.hooks[evento]) ? ajustes.hooks[evento] : [];

  //  Se saca cualquier enganche nuestro anterior y se vuelve a poner uno solo. Así correr el
  //  instalador dos veces da lo mismo que una, y una ruta vieja queda corregida.
  const limpios = grupos
    .map((g) => ({
      ...g,
      hooks: (g.hooks ?? []).filter((c) => !String(c.command || '').includes(MARCA)),
    }))
    .filter((g) => (g.hooks ?? []).length > 0);

  limpios.push({
    hooks: [{ type: 'command', command: `node "${HOOK_INSTALADO.replace(/\\/g, '/')}"` }],
  });

  ajustes.hooks[evento] = limpios;
  hechos.push(`enganche de ${evento}`);
}

if (!SIMULAR) {
  mkdirSync(DESTINO, { recursive: true });
  writeFileSync(rutaAjustes, JSON.stringify(ajustes, null, 2) + '\n', 'utf8');
}

// ── Salida ────────────────────────────────────────────────────────────────────

console.log(SIMULAR ? 'SIMULACIÓN — no se tocó nada. Se haría:' : 'Instalado:');
for (const h of hechos) console.log(`  - ${h}`);

if (avisos.length > 0) {
  console.log('\nAvisos:');
  for (const a of avisos) console.log(`  ! ${a}`);
}

if (!SIMULAR) {
  console.log(
    `\nFalta un paso, y es por proyecto: creá un archivo \`.flujo-loop\` en la raíz de cada ` +
      `repo donde quieras que esto actúe. Sin ese archivo, no hace absolutamente nada.\n` +
      `\nPara comprobarlo: abrí Claude Code en un repo con el marcador, escribí "/" y tiene que ` +
      `aparecer flujo-loop.`,
  );
}
