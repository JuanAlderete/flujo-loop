#!/usr/bin/env node
/**
 * LOS CASOS DEL HOOK.
 *
 * Sin framework a propósito: el hook es un script y se prueba corriéndolo, con la entrada que
 * Claude Code le manda de verdad.
 *
 * ── MODOS DE FALLA ─────────────────────────────────────────────────────────────
 *   🔑 BLOQUEA CUANDO NO DEBE → rompe cada turno de cada proyecto y te lo arrancan. Es la peor,
 *      y por eso el hook FALLA ABIERTO: ante cualquier error, duda o dato que no pudo obtener,
 *      sale en 0. Sólo bloquea cuando determinó POSITIVAMENTE que hay cambios sin rastro.
 *   Absent  → sin marcador no hace nada, en ningún evento
 *   Absent  → sin la variable de la raíz del proyecto, cae a donde está corriendo
 *   Wrong shape → entrada mal formada, sin el nombre del evento, o vacía: no revienta
 *   Dependency down → sin control de versiones disponible no puede saber qué cambió: sale en 0
 *   Boundary → repo sin ningún commit, o sin rama
 *   Duplicate → corre dos veces y da lo mismo: es de sólo lectura
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const AQUI = dirname(fileURLToPath(import.meta.url));
const HOOK = join(AQUI, '..', 'skills', 'flujo-loop', 'hook.mjs');
const BASE = join(tmpdir(), 'flujo-loop-hook-test');

const fallas = [];
let corridos = 0;

function correr(evento, dir, { sinGit = false } = {}) {
  const env = { ...process.env, CLAUDE_PROJECT_DIR: dir };
  if (sinGit) env.PATH = join(BASE, 'vacio');
  if (dir === null) delete env.CLAUDE_PROJECT_DIR;
  const r = spawnSync(process.execPath, [HOOK], {
    input: evento === null ? 'no es json {' : JSON.stringify({ hook_event_name: evento }),
    cwd: dir || process.cwd(),
    env,
    encoding: 'utf8',
  });
  return { code: r.status, out: r.stdout || '', err: r.stderr || '' };
}

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

// ── Repos de prueba ───────────────────────────────────────────────────────────

function git(dir, ...args) {
  return spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
}

/** Un repo con un commit base y, opcionalmente, el marcador. */
function repo(nombre, { marcador = true, rama = 'trabajo' } = {}) {
  const dir = join(BASE, nombre);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  git(dir, 'init', '-q', '-b', 'principal');
  git(dir, 'config', 'user.email', 't@t');
  git(dir, 'config', 'user.name', 'T');
  writeFileSync(join(dir, 'algo.txt'), 'base\n');
  if (marcador) writeFileSync(join(dir, '.flujo-loop'), 'este repo sigue el flujo de Loop\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'base');
  if (rama) git(dir, 'switch', '-q', '-c', rama);
  return dir;
}

//  Primero y sin rodeos: sin el hook no hay nada que probar. Si esto viviera al final, un hook
//  faltante daría trece fallas de casos y habría que leerlas todas para descubrir el motivo.
if (!existsSync(HOOK)) {
  console.log(`FALLA  no existe el hook en ${HOOK}`);
  process.exit(1);
}

rmSync(BASE, { recursive: true, force: true });
mkdirSync(join(BASE, 'vacio'), { recursive: true });

// ── UserPromptSubmit ──────────────────────────────────────────────────────────

caso('sin marcador no dice nada', () => {
  const d = repo('sin-marcador', { marcador: false });
  const r = correr('UserPromptSubmit', d);
  afirmar(r.code === 0, `esperaba 0 y dio ${r.code}`);
  afirmar(r.out.trim() === '', `esperaba salida vacía y dijo: ${r.out}`);
});

caso('con marcador inyecta el procedimiento', () => {
  const d = repo('con-marcador');
  const r = correr('UserPromptSubmit', d);
  afirmar(r.code === 0, `esperaba 0 y dio ${r.code}`);
  const j = JSON.parse(r.out);
  const ctx = j.hookSpecificOutput?.additionalContext ?? '';
  afirmar(ctx.includes('flujo-loop'), 'el contexto no nombra la skill');
  afirmar(/grilling/.test(ctx), 'el contexto no nombra el primer paso');
});

caso('entrada mal formada no revienta', () => {
  const d = repo('mal-formada');
  const r = correr(null, d);
  afirmar(r.code === 0, `esperaba 0 y dio ${r.code}`);
});

caso('sin la variable de la raíz cae a donde corre', () => {
  const d = repo('sin-variable');
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ hook_event_name: 'UserPromptSubmit' }),
    cwd: d,
    env: (() => { const e = { ...process.env }; delete e.CLAUDE_PROJECT_DIR; return e; })(),
    encoding: 'utf8',
  });
  afirmar(r.status === 0, `esperaba 0 y dio ${r.status}`);
  afirmar((r.stdout || '').includes('flujo-loop'), 'no encontró el marcador desde el cwd');
});

// ── Stop ──────────────────────────────────────────────────────────────────────

caso('Stop sin marcador no bloquea', () => {
  const d = repo('stop-sin-marcador', { marcador: false });
  writeFileSync(join(d, 'nuevo.txt'), 'cambio\n');
  const r = correr('Stop', d);
  afirmar(r.code === 0, `esperaba 0 y dio ${r.code}`);
});

caso('Stop sin cambios no bloquea', () => {
  const d = repo('stop-sin-cambios');
  const r = correr('Stop', d);
  afirmar(r.code === 0, `esperaba 0 y dio ${r.code}`);
});

caso('🔑 Stop con cambios y sin rastro BLOQUEA', () => {
  const d = repo('stop-sin-rastro');
  writeFileSync(join(d, 'fuente.txt'), 'cambio\n');
  const r = correr('Stop', d);
  afirmar(r.code === 2, `esperaba 2 y dio ${r.code}`);
  const texto = r.err + r.out;
  afirmar(/flujo[/\\]trabajo\.md/.test(texto), `el mensaje no nombra el rastro: ${texto}`);
});

caso('Stop con cambios y con rastro no bloquea', () => {
  const d = repo('stop-con-rastro');
  writeFileSync(join(d, 'fuente.txt'), 'cambio\n');
  mkdirSync(join(d, 'flujo'), { recursive: true });
  writeFileSync(join(d, 'flujo', 'trabajo.md'), '# rastro\n');
  const r = correr('Stop', d);
  afirmar(r.code === 0, `esperaba 0 y dio ${r.code}`);
});

caso('Stop con el rastro ya commiteado no bloquea', () => {
  const d = repo('stop-rastro-commiteado');
  mkdirSync(join(d, 'flujo'), { recursive: true });
  writeFileSync(join(d, 'flujo', 'trabajo.md'), '# rastro\n');
  writeFileSync(join(d, 'fuente.txt'), 'cambio\n');
  git(d, 'add', '-A');
  git(d, 'commit', '-q', '-m', 'trabajo con rastro');
  const r = correr('Stop', d);
  afirmar(r.code === 0, `esperaba 0 y dio ${r.code}`);
});

caso('🔑 Stop sin control de versiones FALLA ABIERTO', () => {
  const d = repo('stop-sin-git');
  writeFileSync(join(d, 'fuente.txt'), 'cambio\n');
  const r = correr('Stop', d, { sinGit: true });
  afirmar(r.code === 0, `sin git tiene que salir en 0 y dio ${r.code}`);
});

//  🔑 Ningún evento que no sea de los dos que el hook atiende puede bloquear. La primera versión
//  de la suite sólo probaba esos dos, así que sacarle el filtro de evento SOBREVIVÍA a los 13
//  casos — con el hook tratando cualquier evento como si fuera el de cierre. Si alguien lo
//  cableara a un evento que dispara a mitad del turno, cortaría el turno.
//
//  PreToolUse sigue en la lista aunque ahora atiende el guardrail de git: lo que se fija acá es
//  que NO bloquee por trabajo sin rastro, como si fuera el cierre. Lo que sí bloquea lo prueban
//  los casos del guardrail, más abajo.
for (const evento of ['PostToolUse', 'PreToolUse', 'SessionStart', 'SubagentStop', 'Notification']) {
  caso(`🔑 ${evento} no bloquea por trabajo sin rastro`, () => {
    const d = repo(`evento-${evento}`);
    writeFileSync(join(d, 'fuente.txt'), 'cambio\n');
    const r = correr(evento, d);
    afirmar(r.code === 0, `${evento} no puede bloquear y dio ${r.code}`);
    afirmar(r.out.trim() === '', `${evento} no tiene que decir nada y dijo: ${r.out}`);
  });
}

caso('Stop en un repo sin commits no bloquea', () => {
  const d = join(BASE, 'stop-vacio');
  rmSync(d, { recursive: true, force: true });
  mkdirSync(d, { recursive: true });
  git(d, 'init', '-q', '-b', 'principal');
  writeFileSync(join(d, '.flujo-loop'), 'marcador\n');
  writeFileSync(join(d, 'fuente.txt'), 'cambio\n');
  const r = correr('Stop', d);
  afirmar(r.code === 0, `esperaba 0 y dio ${r.code}`);
});

caso('Stop dos veces da lo mismo', () => {
  const d = repo('stop-dos-veces');
  writeFileSync(join(d, 'fuente.txt'), 'cambio\n');
  const a = correr('Stop', d);
  const b = correr('Stop', d);
  afirmar(a.code === b.code, `dio ${a.code} y después ${b.code}`);
});

caso('el marcador solo no cuenta como cambio', () => {
  const d = repo('solo-marcador', { marcador: false });
  writeFileSync(join(d, '.flujo-loop'), 'marcador\n');
  const r = correr('Stop', d);
  afirmar(r.code === 0, `agregar el marcador no es trabajo sin rastro, dio ${r.code}`);
});

// ── PreToolUse: el guardrail de git ───────────────────────────────────────────
//
//  🔑 Los dos modos de falla, al revés que en el Stop: dejar pasar un `reset --hard` le borra el
//  trabajo a alguien que no lee código y no sabe que existía; y bloquear de más —un mensaje de
//  commit que dice "push"— lo vuelve ruido, y el ruido se desinstala. Por eso hay tantos casos
//  de lo que NO se bloquea como de lo que sí.

function herramienta(dir, comando, tool = 'Bash') {
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: tool, tool_input: { command: comando } }),
    cwd: dir,
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir },
    encoding: 'utf8',
  });
  return { code: r.status, err: r.stderr || '' };
}

const PELIGROSOS = [
  'git push',
  'git push --force origin principal',
  'git -C otra/carpeta push',
  'git reset --hard',
  'git reset --hard HEAD~1',
  'git clean -fd',
  'git clean -f',
  'git branch -D vieja',
  'git branch --delete --force vieja',
  'git checkout .',
  'git checkout -- .',
  'git restore .',
  'git status && git reset --hard',
];

const SEGUROS = [
  'git status',
  'git commit -m "arregla el boton de push"',
  //  Un separador ADENTRO de las comillas no corta el comando: sin respetarlas, esto se leería
  //  como dos comandos y el segundo sería un push.
  'git commit -m "primero esto; git push despues"',
  'git log --grep push',
  'git checkout -b nueva',
  'git restore algo.txt',
  'git branch -d mergeada',
  'git clean -n',
  'echo "git push"',
  'npm run entregar',
];

caso('🔑 PreToolUse bloquea cada comando destructivo de git', () => {
  const d = repo('guardrail-bloquea');
  for (const c of PELIGROSOS) {
    const r = herramienta(d, c);
    afirmar(r.code === 2, `"${c}" tenía que bloquearse y dio ${r.code}`);
    afirmar(r.err.includes(c.split(' && ').pop()), `el mensaje no nombra el comando: ${r.err}`);
  }
});

caso('🔑 PreToolUse bloquea igual por PowerShell', () => {
  const d = repo('guardrail-powershell');
  const r = herramienta(d, 'git reset --hard', 'PowerShell');
  afirmar(r.code === 2, `por PowerShell tenía que bloquearse y dio ${r.code}`);
});

caso('🔑 PreToolUse NO bloquea lo que sólo se parece', () => {
  const d = repo('guardrail-seguros');
  for (const c of SEGUROS) {
    const r = herramienta(d, c);
    afirmar(r.code === 0, `"${c}" no tenía que bloquearse y dio ${r.code}: ${r.err}`);
  }
});

caso('PreToolUse sin marcador no bloquea nada', () => {
  const d = repo('guardrail-sin-marcador', { marcador: false });
  const r = herramienta(d, 'git reset --hard');
  afirmar(r.code === 0, `sin marcador no tiene que actuar, dio ${r.code}`);
});

caso('PreToolUse de otra herramienta no se mira', () => {
  const d = repo('guardrail-otra');
  const r = herramienta(d, 'git reset --hard', 'Read');
  afirmar(r.code === 0, `no es un comando, dio ${r.code}`);
});

// ── Salida ────────────────────────────────────────────────────────────────────

rmSync(BASE, { recursive: true, force: true });

if (fallas.length > 0) {
  console.log(`FALLA  ${fallas.length} de ${corridos} casos:`);
  for (const f of fallas) console.log(`  - ${f}`);
  process.exit(1);
}
console.log(`OK  ${corridos} casos, sin fallas.`);
