#!/usr/bin/env node
/**
 * LOS CASOS DEL INSTALADOR.
 *
 * ── MODOS DE FALLA ─────────────────────────────────────────────────────────────
 *   🔑 PISA LA CONFIGURACIÓN QUE YA TENÍAN → si el archivo de configuración queda mal escrito,
 *      la herramienta no arranca. Es la falla más cara y la que el instalador tiene que volver
 *      imposible: ante un archivo que no puede leer, NO ESCRIBE.
 *   🔑 DUPLICA lo que ya instaló → correrlo dos veces tiene que dar lo mismo que una.
 *   Absent      → no existe la carpeta de destino: se crea
 *   Absent      → no existe el archivo de configuración: se crea
 *   Wrong shape → configuración mal escrita: se niega y no toca nada
 *   Duplicate   → ya hay otros enganches configurados: se conservan
 *   Duplicate   → ya hay una skill con el mismo nombre: se avisa
 *   Boundary    → modo simulación: no cambia absolutamente nada
 *
 * ⚠️ El destino se pasa por variable de entorno a propósito. Una prueba que corre contra la
 * configuración real del que instala **la modifica** — ya pasó en este proyecto: un intento de
 * probar contra una carpeta falsa terminó escribiendo en la de verdad porque la variable que se
 * quiso redefinir era de sólo lectura en ese intérprete.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const AQUI = dirname(fileURLToPath(import.meta.url));
const INSTALADOR = join(AQUI, '..', 'instalar.mjs');
const BASE = join(tmpdir(), 'flujo-loop-instalar-test');

const fallas = [];
let corridos = 0;

function caso(nombre, fn) {
  corridos++;
  try {
    fn();
  } catch (e) {
    fallas.push(`${nombre}: ${e.message}`);
  }
}

function afirmar(cond, msg) {
  if (!cond) throw new Error(msg);
}

/** Corre el instalador contra un destino de prueba. */
function instalar(destino, ...args) {
  const r = spawnSync(process.execPath, [INSTALADOR, ...args], {
    env: { ...process.env, FLUJO_LOOP_DESTINO: destino },
    encoding: 'utf8',
  });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

function destinoLimpio(nombre) {
  const d = join(BASE, nombre);
  rmSync(d, { recursive: true, force: true });
  return d;
}

function ajustes(destino) {
  return JSON.parse(readFileSync(join(destino, 'settings.json'), 'utf8'));
}

/** Cuántas veces aparece el hook de flujo-loop en un evento. */
function cuantos(destino, evento) {
  const h = ajustes(destino).hooks?.[evento] ?? [];
  return h
    .flatMap((g) => g.hooks ?? [])
    .filter((c) => String(c.command || '').includes('flujo-loop')).length;
}

if (!existsSync(INSTALADOR)) {
  console.log(`FALLA  no existe el instalador en ${INSTALADOR}`);
  process.exit(1);
}

rmSync(BASE, { recursive: true, force: true });

// ── Los casos ─────────────────────────────────────────────────────────────────

caso('configuración limpia: copia las skills y escribe los dos enganches', () => {
  const d = destinoLimpio('limpia');
  const r = instalar(d);
  afirmar(r.code === 0, `esperaba 0 y dio ${r.code}: ${r.out}`);

  for (const s of ['flujo-loop', 'grilling', 'test-driven-development']) {
    afirmar(existsSync(join(d, 'skills', s, 'SKILL.md')), `no copió ${s}`);
  }
  afirmar(existsSync(join(d, 'skills', 'flujo-loop', 'hook.mjs')), 'no copió el hook');
  afirmar(cuantos(d, 'UserPromptSubmit') === 1, 'falta el enganche de entrada');
  afirmar(cuantos(d, 'Stop') === 1, 'falta el enganche de cierre');
});

caso('🔑 correrlo dos veces no duplica nada', () => {
  const d = destinoLimpio('dos-veces');
  instalar(d);
  const r = instalar(d);
  afirmar(r.code === 0, `la segunda vez dio ${r.code}: ${r.out}`);
  afirmar(cuantos(d, 'UserPromptSubmit') === 1, `duplicó el de entrada`);
  afirmar(cuantos(d, 'Stop') === 1, `duplicó el de cierre`);
});

caso('conserva las otras claves de la configuración', () => {
  const d = destinoLimpio('otras-claves');
  mkdirSync(d, { recursive: true });
  writeFileSync(
    join(d, 'settings.json'),
    JSON.stringify({ model: 'algo', env: { UNA: 'cosa' } }, null, 2),
  );
  instalar(d);
  const a = ajustes(d);
  afirmar(a.model === 'algo', 'se perdió "model"');
  afirmar(a.env?.UNA === 'cosa', 'se perdió "env"');
  afirmar(cuantos(d, 'Stop') === 1, 'no agregó el enganche');
});

caso('🔑 conserva los enganches ajenos que ya estaban', () => {
  const d = destinoLimpio('enganches-ajenos');
  mkdirSync(d, { recursive: true });
  writeFileSync(
    join(d, 'settings.json'),
    JSON.stringify(
      {
        hooks: {
          Stop: [{ hooks: [{ type: 'command', command: 'otra-herramienta --algo' }] }],
          PostToolUse: [{ hooks: [{ type: 'command', command: 'tercera-cosa' }] }],
        },
      },
      null,
      2,
    ),
  );
  instalar(d);
  const texto = readFileSync(join(d, 'settings.json'), 'utf8');
  afirmar(texto.includes('otra-herramienta --algo'), 'borró un enganche ajeno de Stop');
  afirmar(texto.includes('tercera-cosa'), 'borró el evento ajeno entero');
  afirmar(cuantos(d, 'Stop') === 1, 'no agregó el propio');
});

caso('🔑 configuración mal escrita: se niega y NO la toca', () => {
  const d = destinoLimpio('mal-escrita');
  mkdirSync(d, { recursive: true });
  const roto = '{ "model": "algo",, }';
  writeFileSync(join(d, 'settings.json'), roto);
  const r = instalar(d);
  afirmar(r.code !== 0, 'tenía que negarse y salió en 0');
  afirmar(readFileSync(join(d, 'settings.json'), 'utf8') === roto, '¡pisó la configuración!');
  afirmar(/no se pudo leer|mal escrit/i.test(r.out), `el motivo no se entiende: ${r.out}`);
});

//  ⚠️ La primera versión de este caso afirmaba que la salida mencionara "grilling" — y la salida
//  la menciona SIEMPRE, porque lista cada skill que copia. O sea que la aserción coincidía con
//  texto que está siempre presente, y sacarle el aviso al instalador no la hacía caer. Lo cazó la
//  mutación. Ahora se afirma sobre el aviso en sí, y contra un destino sin choques se exige que
//  NO esté: sin esa segunda mitad, cualquier texto suelto lo haría pasar.
caso('avisa si ya hay una skill con el mismo nombre', () => {
  const d = destinoLimpio('skill-repetida');
  mkdirSync(join(d, 'skills', 'grilling'), { recursive: true });
  writeFileSync(join(d, 'skills', 'grilling', 'SKILL.md'), '---\nname: grilling\n---\nla mía\n');
  const r = instalar(d);
  afirmar(/Avisos:/.test(r.out), `no hubo sección de avisos: ${r.out}`);
  afirmar(/ya ten[íi]as una skill llamada "grilling"/.test(r.out), `no nombró el choque: ${r.out}`);
});

caso('sin choques NO avisa nada', () => {
  const d = destinoLimpio('sin-choques');
  const r = instalar(d);
  afirmar(!/Avisos:/.test(r.out), `avisó sin motivo: ${r.out}`);
});

caso('modo simulación no cambia nada', () => {
  const d = destinoLimpio('simulacion');
  const r = instalar(d, '--simular');
  afirmar(r.code === 0, `esperaba 0 y dio ${r.code}: ${r.out}`);
  afirmar(!existsSync(join(d, 'settings.json')), 'escribió la configuración');
  afirmar(!existsSync(join(d, 'skills', 'flujo-loop')), 'copió las skills');
});

// ── Salida ────────────────────────────────────────────────────────────────────

rmSync(BASE, { recursive: true, force: true });

if (fallas.length > 0) {
  console.log(`FALLA  ${fallas.length} de ${corridos} casos:`);
  for (const f of fallas) console.log(`  - ${f}`);
  process.exit(1);
}
console.log(`OK  ${corridos} casos, sin fallas.`);
