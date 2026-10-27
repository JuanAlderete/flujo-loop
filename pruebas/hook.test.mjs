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

//  SOLO=texto corre únicamente los casos cuyo nombre lo contiene: la suite entera tarda minutos
//  (cada caso arma un repo con git) y para probar una mutación alcanza con el caso que la ve.
function caso(nombre, fn) {
  if (process.env.SOLO && !nombre.includes(process.env.SOLO)) return;
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

/** Un rastro con los cuatro encabezados que el Stop exige. Sólo la forma: el hook no lee el contenido. */
const RASTRO_COMPLETO = [
  '# rastro', '## Reporte en lenguaje llano', 'x', '## Decisiones', 'x',
  '## Las tres pruebas', 'x', '## Lo que NO se pudo verificar', 'x', '',
].join('\n');

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
  //  Orden del dueño: las skills se PROPONEN (la persona no sabe que existen) y se EJECUTAN,
  //  nunca se leen para hacer a mano lo que dicen. Tiene que estar en cada mensaje, no sólo en
  //  la skill, porque el modo de falla es justamente no abrirla.
  afirmar(/propon[eé]/i.test(ctx), 'el contexto no pide proponer skills');
  afirmar(/nunca/i.test(ctx) && /interpret/i.test(ctx), 'el contexto no prohíbe interpretar una skill');
});

caso('el recordatorio nombra el Paso 0, la última puerta y /seguridad-de-skills', () => {
  const d = repo('recordatorio-completo');
  const ctx = JSON.parse(correr('UserPromptSubmit', d).out).hookSpecificOutput?.additionalContext ?? '';
  //  Estaba desfasado: enumeraba 1 a 4 y la persona nunca se enteraba del resto del procedimiento.
  afirmar(/^0\. .*controles/m.test(ctx), 'el contexto no nombra el Paso 0 (declarar los controles)');
  afirmar(/^5\. .*última puerta/m.test(ctx), 'el contexto no nombra el Paso 5 (la última puerta)');
  afirmar(ctx.includes('/seguridad-de-skills'), 'el contexto no nombra /seguridad-de-skills');
  afirmar(ctx.includes('/revision-independiente'), 'el contexto no nombra /revision-independiente');
  afirmar(/plata, datos o permisos/.test(ctx), 'el contexto no nombra el segundo revisor (plata, datos o permisos)');
  afirmar(/sólo docs/.test(ctx), 'el contexto no nombra la excepción de sólo docs');
});

caso('el recordatorio dice que el rastro abre con el reporte llano, también como mensaje final', () => {
  const d = repo('recordatorio-reporte');
  const ctx = JSON.parse(correr('UserPromptSubmit', d).out).hookSpecificOutput?.additionalContext ?? '';
  afirmar(/reporte (en lenguaje )?llano/i.test(ctx), 'el contexto no nombra el reporte en lenguaje llano');
  afirmar(/mensaje final/i.test(ctx), 'el contexto no dice que el reporte es el mensaje final');
});

caso('el recordatorio manda ofrecer /no-entendi al cerrar un mensaje largo', () => {
  const d = repo('recordatorio-no-entendi');
  const ctx = JSON.parse(correr('UserPromptSubmit', d).out).hookSpecificOutput?.additionalContext ?? '';
  afirmar(/ofrec[eé][\s\S]{0,80}\/no-entendi[\s\S]{0,120}mensaje largo/i.test(ctx), 'el contexto no manda ofrecer /no-entendi');
  //  Tiene que ser un párrafo propio: colgado del punto 5 (la última puerta) se lee como "sólo al final",
  //  y los mensajes largos que más lo necesitan son el grilling y la propuesta de controles.
  const parrafo = ctx.split(/\n\s*\n/).find((p) => p.includes('/no-entendi')) ?? '';
  afirmar(!/^\s*\d+\. /.test(parrafo), 'la oferta de /no-entendi cuelga de un punto numerado');
  afirmar(!/última puerta/.test(parrafo), 'la oferta de /no-entendi está dentro del párrafo de la última puerta');
  afirmar(/cualquier mensaje largo/.test(parrafo), 'la oferta de /no-entendi no dice cualquier mensaje largo');
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
  writeFileSync(join(d, 'flujo', 'trabajo.md'), RASTRO_COMPLETO);
  const r = correr('Stop', d);
  afirmar(r.code === 0, `esperaba 0 y dio ${r.code}`);
});

caso('Stop con el rastro ya commiteado no bloquea', () => {
  const d = repo('stop-rastro-commiteado');
  mkdirSync(join(d, 'flujo'), { recursive: true });
  writeFileSync(join(d, 'flujo', 'trabajo.md'), RASTRO_COMPLETO);
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

// ── Stop: el rastro tiene que traer sus encabezados ───────────────────────────
//
//  Sólo mira que los encabezados ESTÉN, nunca lo que dicen: juzgar el contenido es trabajo de la
//  revisión independiente. Los cuatro: reporte en lenguaje llano, decisiones, las tres pruebas, y
//  lo que no se pudo verificar.

/** Un repo con cambios sin commitear y un rastro con el texto dado. */
function repoConRastro(nombre, texto) {
  const d = repo(nombre);
  writeFileSync(join(d, 'fuente.txt'), 'cambio\n');
  mkdirSync(join(d, 'flujo'), { recursive: true });
  writeFileSync(join(d, 'flujo', 'trabajo.md'), texto);
  return d;
}

const ENCABEZADOS = {
  'Reporte en lenguaje llano': '## Reporte en lenguaje llano',
  Decisiones: '## Decisiones',
  'Las tres pruebas': '## Las tres pruebas',
  'Lo que no se pudo verificar': '## Lo que no se pudo verificar',
};

Object.keys(ENCABEZADOS).forEach((falta, n) => {
  caso(`🔑 Stop con el rastro sin "${falta}" BLOQUEA y lo nombra`, () => {
    const texto = Object.entries(ENCABEZADOS).filter(([k]) => k !== falta).map(([, v]) => `${v}\nx\n`).join('\n');
    const d = repoConRastro(`stop-falta-${n}`, texto);
    const r = correr('Stop', d);
    afirmar(r.code === 2, `esperaba 2 y dio ${r.code}`);
    afirmar(r.err.includes(`  ${ENCABEZADOS[falta]}\n`), `el mensaje no pide la línea de "${falta}": ${r.err}`);
    for (const otro of Object.keys(ENCABEZADOS).filter((k) => k !== falta)) {
      afirmar(!r.err.includes(`  ${ENCABEZADOS[otro]}\n`), `pide "${otro}" que sí está: ${r.err}`);
    }
  });
});

caso('🔑 Stop con el rastro sin ningún encabezado BLOQUEA y los nombra todos', () => {
  const d = repoConRastro('stop-sin-encabezados', '# rastro\nnada más\n');
  const r = correr('Stop', d);
  afirmar(r.code === 2, `esperaba 2 y dio ${r.code}`);
  for (const k of Object.keys(ENCABEZADOS)) afirmar(r.err.includes(`  ${ENCABEZADOS[k]}\n`), `no pide la línea de "${k}": ${r.err}`);
});

caso('🔑 Stop con las palabras sólo en prosa BLOQUEA', () => {
  const prosa = 'Acá va el reporte en lenguaje llano, las decisiones, las tres pruebas y lo que no se pudo verificar.\n';
  const d = repoConRastro('stop-prosa', `# rastro\n${prosa}- Decisiones: ninguna\n`);
  const r = correr('Stop', d);
  afirmar(r.code === 2, `la prosa no es un encabezado y dio ${r.code}`);
});

caso('Stop acepta otro nivel de encabezado, mayúsculas, tildes y la variante "no pude verificar"', () => {
  const texto = [
    '# Reporte En Lenguaje Llano', '### DECISIONES', '#### las TRES pruebas', '## Lo que no pude verificar',
  ].join('\nx\n') + '\n';
  const d = repoConRastro('stop-tolerante', texto);
  const r = correr('Stop', d);
  afirmar(r.code === 0, `esperaba 0 y dio ${r.code}: ${r.err}`);
});

caso('🔑 Stop con las palabras dentro de un encabezado más largo BLOQUEA', () => {
  //  Que la palabra esté en un título no lo vuelve el título pedido.
  const texto = ['## Notas sobre el reporte en lenguaje llano', '## Mis decisiones', '## Las tres pruebas viejas',
    '## Lo que no se pudo verificar nunca'].map((h) => `${h}\nx\n`).join('\n');
  const d = repoConRastro('stop-titulo-largo', texto);
  const r = correr('Stop', d);
  afirmar(r.code === 2, `esperaba 2 y dio ${r.code}`);
});

caso('🔑 Stop con el rastro ilegible FALLA ABIERTO', () => {
  //  Una carpeta donde debería haber un archivo: existe, pero leerlo tira EISDIR.
  const d = repo('stop-ilegible');
  writeFileSync(join(d, 'fuente.txt'), 'cambio\n');
  mkdirSync(join(d, 'flujo', 'trabajo.md'), { recursive: true });
  const r = correr('Stop', d);
  afirmar(r.code === 0, `si no puede leerlo no bloquea, dio ${r.code}: ${r.err}`);
});

// ── PreToolUse: el guardrail de producción ────────────────────────────────────

const PRODUCCION = [
  'supabase db push',
  'supabase db query --linked "select 1"',
  'supabase db query -f x.sql --linked',
  'supabase --linked db query -f x.sql',
  'supabase migration repair --status applied 123 --linked',
  'supabase migration repair --linked --status applied 123',
  'prisma migrate deploy',
  'npx prisma migrate deploy',
  'bunx supabase db push',
  'npx --yes supabase db push',
  'cd app && supabase db push',
  'echo listo; prisma migrate deploy | tee log',
  'supabase db query --linked -f x.sql && echo ok',
];

const PRODUCCION_SEGURA = [
  'supabase db query "select 1"',
  'supabase db query -f x.sql',
  'supabase migration list --linked',
  'supabase migration repair --status applied 123',
  'prisma migrate dev',
  'supabase db reset',
  'git commit -m "documenta supabase db push"',
  'echo "prisma migrate deploy"',
];

for (const c of PRODUCCION) {
  caso(`🔑 PreToolUse bloquea producción: ${c}`, () => {
    const d = repo('prod-bloquea');
    const r = herramienta(d, c);
    afirmar(r.code === 2, `tenía que bloquearse y dio ${r.code}`);
    afirmar(/autorizaci[oó]n/i.test(r.err), `el mensaje no pide autorización: ${r.err}`);
  });
}

caso('🔑 PreToolUse NO bloquea lo que sólo se parece a producción', () => {
  const d = repo('prod-seguros');
  for (const c of PRODUCCION_SEGURA) {
    const r = herramienta(d, c);
    afirmar(r.code === 0, `"${c}" no tenía que bloquearse y dio ${r.code}: ${r.err}`);
  }
});

caso('PreToolUse de producción por PowerShell también bloquea', () => {
  const d = repo('prod-powershell');
  afirmar(herramienta(d, 'supabase db push', 'PowerShell').code === 2, 'por PowerShell tenía que bloquearse');
});

caso('PreToolUse de producción sin marcador no bloquea', () => {
  const d = repo('prod-sin-marcador', { marcador: false });
  afirmar(herramienta(d, 'supabase db push').code === 0, 'sin marcador no tiene que actuar');
});

// ── Ronda 1 de la revisión: encabezados con decoración, BOM, bloques de código ──

/** Un rastro completo donde el encabezado `quien` (índice) se escribe con la línea dada. */
function rastroCon(quien, linea) {
  const base = Object.values(ENCABEZADOS);
  return base.map((h, i) => `${i === quien ? linea : h}\nx\n`).join('\n');
}

caso('Stop con el rastro guardado con BOM no bloquea', () => {
  //  El BOM tiene que quedar pegado al PRIMER encabezado: delante de '# rastro' no probaría nada.
  const d = repoConRastro('stop-bom', '\uFEFF' + RASTRO_COMPLETO.replace('# rastro\n', ''));
  const r = correr('Stop', d);
  afirmar(r.code === 0, `un BOM al principio no cambia los encabezados, dio ${r.code}: ${r.err}`);
});

const DECORADOS = [
  [0, '## 📋 Reporte en lenguaje llano'],
  [0, '## 1. Reporte en lenguaje llano'],
  [0, '## **Reporte en lenguaje llano**'],
  [0, '## Reporte en lenguaje llano:'],
  [1, '## Decisiones y por qué'],
  [1, '## Decisiones, y por qué'],
  [3, '## Lo que NO se pudo verificar ⚠️'],
  [2, '## Las 3 pruebas'],
];
DECORADOS.forEach(([quien, linea], n) => {
  caso(`Stop acepta el encabezado decorado: ${linea}`, () => {
    const d = repoConRastro(`stop-decorado-${n}`, rastroCon(quien, linea));
    const r = correr('Stop', d);
    afirmar(r.code === 0, `esperaba 0 y dio ${r.code}: ${r.err}`);
  });
});

caso('🔑 Stop con "Decisionesx" (la palabra pegada a otra) BLOQUEA', () => {
  const d = repoConRastro('stop-pegada', rastroCon(1, '## Decisionesx'));
  const r = correr('Stop', d);
  afirmar(r.code === 2, `esperaba 2 y dio ${r.code}`);
  afirmar(r.err.includes('  ## Decisiones\n'), `no pide Decisiones: ${r.err}`);
});

caso('🔑 Stop con "Mis decisiones" (el título no arranca con lo pedido) BLOQUEA', () => {
  const d = repoConRastro('stop-mis', rastroCon(1, '## Mis decisiones'));
  afirmar(correr('Stop', d).code === 2, 'tenía que bloquear');
});

caso('🔑 Stop con los cuatro encabezados sólo dentro de un bloque de código BLOQUEA', () => {
  const dentro = '```\n' + Object.values(ENCABEZADOS).join('\nx\n') + '\n```\n';
  const d = repoConRastro('stop-cercado', `# rastro\n${dentro}`);
  const r = correr('Stop', d);
  afirmar(r.code === 2, `un ejemplo dentro de un cerco no es un encabezado, dio ${r.code}`);
});

caso('Stop vuelve a mirar los encabezados después de cerrar el bloque de código', () => {
  const texto = '```\n## ejemplo\n```\n' + RASTRO_COMPLETO;
  const d = repoConRastro('stop-despues-del-cerco', texto);
  afirmar(correr('Stop', d).code === 0, 'los encabezados de después del cerco cuentan');
});

caso('el mensaje del Stop imprime las líneas exactas aceptadas y avisa que son de #', () => {
  const d = repoConRastro('stop-mensaje', '# rastro\n');
  const r = correr('Stop', d);
  for (const linea of Object.values(ENCABEZADOS)) {
    afirmar(r.err.includes(linea), `no imprime la línea "${linea}": ${r.err}`);
  }
  afirmar(/setext/i.test(r.err), `no avisa que el subrayado con === no se acepta: ${r.err}`);
});

// ── Ronda 1: el guardrail de producción, más difícil de esquivar ──────────────

const PRODUCCION_RONDA_1 = [
  'supabase --workdir x db push',
  'supabase -p x db push',
  'prisma --schema x.prisma migrate deploy',
  'npx prisma@5 migrate deploy',
  'npx supabase@latest db push',
  'pnpm dlx supabase db push',
  'yarn dlx prisma migrate deploy',
  'supabase.ps1 db push',
  'bash -c "supabase db push"',
  "sh -c 'prisma migrate deploy'",
  'sudo bash -lc "supabase db push"',
  '(supabase db push)',
  'echo $(supabase db push)',
  'echo `supabase db push`',
  'supabase db \\\npush',
  'FOO=1 supabase db push',
  'env FOO=1 supabase db push',
  'sudo supabase db push',
  'supabase db query --linked=true "select 1"',
  'supabase migration repair --linked=si --status applied 1',
  //  Fijado a propósito: una línea de un heredoc que ES el comando se lee como comando. Falla
  //  del lado seguro (bloquea de más, nunca de menos); el techo está dicho en el código.
  'cat <<EOF\nsupabase db push\nEOF',
  //  El mismo envoltorio vale para git.
  'bash -c "git push"',
];

const PRODUCCION_SEGURA_RONDA_1 = [
  'echo supabase db push',
  'grep -rn supabase db push docs',
  'supabase db push --dry-run',
  'supabase db push --help',
  'supabase db push -h',
  'prisma migrate deploy --help',
  'bash -c "echo supabase db push"',
  'git log --grep "supabase db push"',
];

PRODUCCION_RONDA_1.forEach((c, n) => {
  caso(`🔑 PreToolUse bloquea (ronda 1): ${c.replace(/\n/g, '⏎')}`, () => {
    const d = repo(`prod-r1-${n}`);
    const r = herramienta(d, c);
    afirmar(r.code === 2, `tenía que bloquearse y dio ${r.code}`);
  });
});

caso('🔑 PreToolUse NO bloquea lo que no es el comando (ronda 1)', () => {
  const d = repo('prod-r1-seguros');
  for (const c of PRODUCCION_SEGURA_RONDA_1) {
    const r = herramienta(d, c);
    afirmar(r.code === 0, `"${c}" no tenía que bloquearse y dio ${r.code}: ${r.err}`);
  }
});


// ── Ronda 2: el guardrail busca el programa en cualquier lugar, salvo en comandos de sólo texto ──

const PRODUCCION_RONDA_2 = [
  'if true; then supabase db push; fi',
  'for f in a; do supabase db push; done',
  '{ supabase db push; }',
  '! supabase db push',
  'pnpm supabase db push',
  'yarn prisma migrate deploy',
  'npm exec -- supabase db push',
  'npm run supabase -- db push',
  'time supabase db push',
  'timeout 5 supabase db push',
  'nohup supabase db push',
  'xargs supabase db push',
  'sudo -u me supabase db push',
  'env -u X supabase db push',
  'npx.cmd supabase db push',
  'cmd /c supabase db push',
  '>out supabase db push',
  'eval "supabase db push"',
  "eval 'prisma migrate deploy'",
];

const SEGURA_RONDA_2 = [
  'echo supabase db push',
  'grep -rn supabase db push docs',
  'rg "supabase db push"',
  'rg supabase db push',
  "printf 'supabase db push'",
  'FOO=1 echo supabase db push',
  'Write-Host supabase db push',
  'if true; then echo supabase db push; fi',
  'eval "echo supabase db push"',
  //  Ronda 2, punto 5: los paréntesis ya separan comandos; que no frenen a git por eso.
  'git log --format=(%h)',
  'git commit -m "fix (x)"',
];

PRODUCCION_RONDA_2.forEach((c, n) => {
  caso(`🔑 PreToolUse bloquea (ronda 2): ${c}`, () => {
    const d = repo(`prod-r2-${n}`);
    const r = herramienta(d, c);
    afirmar(r.code === 2, `tenía que bloquearse y dio ${r.code}`);
  });
});

caso('🔑 PreToolUse NO bloquea lo de sólo texto ni a git con paréntesis (ronda 2)', () => {
  const d = repo('prod-r2-seguros');
  for (const c of SEGURA_RONDA_2) {
    const r = herramienta(d, c);
    afirmar(r.code === 0, `"${c}" no tenía que bloquearse y dio ${r.code}: ${r.err}`);
  }
});

// ── Ronda 2: cercos de código y límite del título ──

caso('🔑 Stop: un cerco de 4 comillas no lo cierra una línea de 3 (ronda 2)', () => {
  const texto = '````\n```\n## Decisiones\nx\n````\n' + rastroCon(1, '## Mis notas');
  const d = repoConRastro('stop-cerco-largo', texto);
  const r = correr('Stop', d);
  afirmar(r.code === 2, `el ## Decisiones de dentro del cerco no cuenta, y dio ${r.code}`);
  afirmar(r.err.includes('  ## Decisiones\n'), `no pide Decisiones: ${r.err}`);
});

caso('🔑 Stop: una línea ```js dentro de un cerco no lo cierra (ronda 2)', () => {
  //  Los otros tres encabezados van ANTES del cerco: si fueran después, el cerco mal cerrado
  //  se tragaría todo lo que sigue y el caso bloquearía por casualidad.
  const otros = Object.entries(ENCABEZADOS).filter(([k]) => k !== 'Decisiones').map(([, v]) => `${v}\nx\n`).join('\n');
  const texto = otros + '```\n```js\n## Decisiones\nx\n```\n';
  const d = repoConRastro('stop-cerco-js', texto);
  afirmar(correr('Stop', d).code === 2, 'el ## Decisiones sigue dentro del cerco');
});

caso('Stop: el cerco se cierra con una línea del mismo carácter y largo igual o mayor (ronda 2)', () => {
  const texto = '```\nejemplo\n`````\n' + RASTRO_COMPLETO;
  const d = repoConRastro('stop-cerco-cierra', texto);
  afirmar(correr('Stop', d).code === 0, 'tras cerrar el cerco los encabezados cuentan');
});

for (const [n, titulo] of [['Decisiones2', '## Decisiones2'], ['Decisiones_x', '## Decisiones_x']]) {
  caso(`🔑 Stop: "${n}" no es "Decisiones" (ronda 2)`, () => {
    const d = repoConRastro(`stop-limite-${n}`, rastroCon(1, titulo));
    afirmar(correr('Stop', d).code === 2, 'tenía que bloquear');
  });
}


// ── Salida ────────────────────────────────────────────────────────────────────

rmSync(BASE, { recursive: true, force: true });

if (fallas.length > 0) {
  console.log(`FALLA  ${fallas.length} de ${corridos} casos:`);
  for (const f of fallas) console.log(`  - ${f}`);
  process.exit(1);
}
console.log(`OK  ${corridos} casos, sin fallas.`);
