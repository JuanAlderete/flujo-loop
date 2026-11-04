#!/usr/bin/env node
/**
 * LOS CASOS DE `skills/dolarapi/cotizaciones.ts`.
 *
 * ── MODOS DE FALLA ─────────────────────────────────────────────────────────────
 *   🔑 UN NÚMERO SIN FECHA O INVENTADO → si la API falla, se devuelve el último valor guardado
 *      CON su fecha y marcado como viejo; si no hay ninguno, error. Nunca un número de relleno.
 *   🔑 UN DÍA CORRIDO → '2024-05-10' parseado como medianoche UTC es el 9 en Buenos Aires.
 *      Las fechas de la historia se tratan como texto, y "hoy" se calcula en hora argentina.
 *   Boundary    → el caché vence justo a los 15 min (actual) y a las 12 h (historia)
 *   Duplicate   → llamadas simultáneas comparten una sola consulta a la API
 *   Empty/null  → compra o venta nulas se saltean en las series
 *   Wrong shape → casa inexistente, respuesta que no es lista, HTTP con error
 *
 * Sin red: el `fetch` y el reloj se reemplazan por los de la prueba.
 */

import * as c from '../skills/dolarapi/cotizaciones.ts';

const fetchPorDefecto = c.entorno.fetch; // el de verdad, antes de que los casos lo reemplacen

const fallas = [];
let corridos = 0;
const cola = [];

/** Registra un caso (puede ser asíncrono). Se corren en orden al final. */
function caso(nombre, fn) {
  cola.push([nombre, fn]);
}

function afirmar(cond, msg) {
  if (!cond) throw new Error(msg);
}

function igual(real, esperado, msg = '') {
  const a = JSON.stringify(real);
  const b = JSON.stringify(esperado);
  if (a !== b) throw new Error(`${msg} esperaba ${b} y dio ${a}`);
}

async function falla(fn, patron, msg = '') {
  try {
    await fn();
  } catch (e) {
    if (!patron.test(e.message)) throw new Error(`${msg} el error no dice lo esperado: ${e.message}`);
    return;
  }
  throw new Error(`${msg} esperaba un error y no lo hubo`);
}

// ── El entorno falso ──────────────────────────────────────────────────────────

const MIN = 60_000;
const HORA = 60 * MIN;
let llamadas = [];
let reloj = Date.UTC(2026, 10, 4, 15, 0);

/** Instala un fetch que responde según la URL. `rutas[url]` es el cuerpo, o una función. */
function entorno(rutas) {
  llamadas = [];
  c.entorno.ahora = () => reloj;
  c.entorno.fetch = async (url) => {
    llamadas.push(String(url));
    const r = typeof rutas === 'function' ? rutas(String(url)) : rutas[String(url)];
    if (r instanceof Error) throw r;
    if (r === undefined) return { ok: false, status: 404, json: async () => ({}) };
    if (r && r.__status) return { ok: false, status: r.__status, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => structuredClone(r) };
  };
  c.limpiarCache();
}

const U = 'https://dolarapi.com/v1';
const A = 'https://api.argentinadatos.com/v1';

const DOLARES = [
  { moneda: 'USD', casa: 'oficial', nombre: 'Oficial', compra: 1520, venta: 1570, fechaActualizacion: '2026-11-04T18:00:00.000Z' },
  { moneda: 'USD', casa: 'blue', nombre: 'Blue', compra: 1540, venta: 1560, fechaActualizacion: '2026-11-04T20:55:00.000Z' },
  { moneda: 'USD', casa: 'bolsa', nombre: 'Bolsa', compra: 1550, venta: 1555, fechaActualizacion: '2026-11-04T20:50:00.000Z' },
];

// ── Dólares actuales ──────────────────────────────────────────────────────────

caso('dolares: una sola llamada trae todas las casas', async () => {
  entorno({ [`${U}/dolares`]: DOLARES });
  const r = await c.dolares();
  igual(llamadas, [`${U}/dolares`]);
  igual(r.datos.map((d) => d.casa), ['oficial', 'blue', 'bolsa']);
  afirmar(r.obsoleto === false, 'no debería estar marcado como viejo');
});

caso('dolar(casa): sale de la misma llamada, para cualquier casa', async () => {
  entorno({ [`${U}/dolares`]: DOLARES });
  const b = await c.dolar('blue');
  const o = await c.dolar('oficial');
  igual([b.datos.venta, o.datos.venta], [1560, 1570]);
  igual(llamadas.length, 1, 'llamadas:');
});

caso('dolar(casa): una casa que no existe es un error claro', async () => {
  entorno({ [`${U}/dolares`]: DOLARES });
  await falla(() => c.dolar('inventada'), /inventada/);
  await falla(() => c.dolar('cripto'), /cripto/, 'casa válida pero ausente en la respuesta:');
});

caso('dolares: una respuesta que no es una lista es un error', async () => {
  entorno({ [`${U}/dolares`]: { mensaje: 'x' } });
  await falla(() => c.dolares(), /forma esperada/);
});


// ── Caché, duplicados y fallas de la API ──────────────────────────────────────

caso('caché: dentro de los 15 min no vuelve a llamar; justo a los 15 min sí', async () => {
  entorno({ [`${U}/dolares`]: DOLARES });
  await c.dolares();
  reloj += 15 * MIN - 1;
  await c.dolares();
  igual(llamadas.length, 1, 'a los 15 min menos 1 ms:');
  reloj += 1;
  await c.dolares();
  igual(llamadas.length, 2, 'a los 15 min justos:');
});

caso('caché: el segundo dato guardado también vence (otro valor, otra hora)', async () => {
  const nuevo = [{ ...DOLARES[1], venta: 1600 }];
  let n = 0;
  entorno(() => (++n === 1 ? DOLARES : nuevo));
  const a = await c.dolar('blue');
  reloj += 16 * MIN;
  const b = await c.dolar('blue');
  igual([a.datos.venta, b.datos.venta], [1560, 1600]);
});

caso('duplicados: llamadas simultáneas comparten una sola consulta', async () => {
  entorno({ [`${U}/dolares`]: DOLARES });
  const [a, b, d] = await Promise.all([c.dolares(), c.dolar('blue'), c.dolar('oficial')]);
  igual(llamadas.length, 1, 'llamadas:');
  igual([a.datos.length, b.datos.casa, d.datos.casa], [3, 'blue', 'oficial']);
});

caso('falla de la API con valor guardado: devuelve el último, con su fecha, marcado como viejo', async () => {
  entorno({ [`${U}/dolares`]: DOLARES });
  const a = await c.dolares();
  reloj += 20 * MIN;
  c.entorno.fetch = async () => { throw new Error('sin red'); };
  const b = await c.dolares();
  igual(b.datos, a.datos);
  afirmar(b.obsoleto === true, 'debería estar marcado como viejo');
  igual(b.actualizado, a.actualizado, 'la fecha es la de cuando se bajó:');
});

caso('falla con HTTP de error: también devuelve el guardado', async () => {
  let n = 0;
  entorno(() => (++n === 1 ? DOLARES : { __status: 503 }));
  await c.dolares();
  reloj += HORA;
  const b = await c.dolares();
  afirmar(b.obsoleto === true && b.datos.length === 3, 'no devolvió el guardado');
});

caso('falla sin nada guardado: error claro, nunca un número', async () => {
  entorno(() => new Error('sin red'));
  await falla(() => c.dolares(), /no hay valor guardado/i);
  entorno(() => ({ __status: 500 }));
  await falla(() => c.dolares(), /500/);
});

caso('tras una falla se vuelve a intentar en la llamada siguiente (no se cachea el error)', async () => {
  let n = 0;
  entorno(() => (++n === 1 ? new Error('x') : DOLARES));
  await falla(() => c.dolares(), /x/);
  reloj += 60_000; // pasado el enfriamiento
  const r = await c.dolares();
  afirmar(r.datos.length === 3 && r.obsoleto === false, 'no se recuperó');
});

// ── Historia, una fecha y otras monedas ───────────────────────────────────────

const HIST = [
  { casa: 'blue', compra: 4, venta: 4.1, fecha: '2011-01-03' },
  { casa: 'blue', compra: null, venta: 4.2, fecha: '2011-01-04' },
  { casa: 'blue', compra: 4.3, venta: null, fecha: '2011-01-05' },
];

caso('historiaDolar: pide sólo la casa pedida, nunca el volcado completo', async () => {
  entorno({ [`${A}/cotizaciones/dolares/blue`]: HIST, [`${A}/cotizaciones/dolares/oficial`]: HIST });
  const r = await c.historiaDolar('blue');
  igual(llamadas, [`${A}/cotizaciones/dolares/blue`]);
  igual(r.datos.length, 3);
  await c.historiaDolar('oficial');
  igual(llamadas[1], `${A}/cotizaciones/dolares/oficial`, 'la segunda casa:');
  afirmar(llamadas.every((u) => !u.endsWith('/cotizaciones/dolares')), 'pidió el volcado completo');
});

caso('historiaDolar: se cachea 12 h (a las 12 h menos 1 ms no llama, a las 12 h sí)', async () => {
  entorno({ [`${A}/cotizaciones/dolares/blue`]: HIST });
  await c.historiaDolar('blue');
  reloj += 12 * HORA - 1;
  await c.historiaDolar('blue');
  igual(llamadas.length, 1, 'antes de las 12 h:');
  reloj += 1;
  await c.historiaDolar('blue');
  igual(llamadas.length, 2, 'a las 12 h:');
});

caso('historiaDolar: acepta solidario (sólo historia) y rechaza una casa mal escrita sin llamar', async () => {
  entorno({ [`${A}/cotizaciones/dolares/solidario`]: HIST });
  await c.historiaDolar('solidario');
  igual(llamadas.length, 1);
  for (const mala of ['../finanzas', 'Blue', '', 'blue/2024']) {
    await falla(() => c.historiaDolar(mala), /casa/i, `"${mala}":`);
  }
  igual(llamadas.length, 1, 'llamadas con casa mala:');
});

caso('cotizacionDolarEn: arma /casa/AAAA/MM/DD', async () => {
  entorno(() => ({ casa: 'blue', compra: 1020, venta: 1040, fecha: '2024-05-10' }));
  const r = await c.cotizacionDolarEn('blue', '2024-05-10');
  igual(llamadas, [`${A}/cotizaciones/dolares/blue/2024/05/10`]);
  igual(r.datos.venta, 1040);
  await c.cotizacionDolarEn('oficial', '2024-02-29');
  igual(llamadas[1], `${A}/cotizaciones/dolares/oficial/2024/02/29`, 'bisiesto:');
});

caso('cotizacionDolarEn: una fecha que no existe o mal escrita es un error, sin llamar', async () => {
  entorno(() => ({}));
  for (const mala of ['2024-5-10', '2024-02-30', '2023-02-29', '10/05/2024', '2024-13-01', '']) {
    await falla(() => c.cotizacionDolarEn('blue', mala), /fecha/i, `"${mala}":`);
  }
  igual(llamadas.length, 0, 'llamadas:');
});

caso('cotizacionDolarEn: una fecha sin dato (404) es un error claro, no un número', async () => {
  entorno(() => ({ __status: 404 }));
  await falla(() => c.cotizacionDolarEn('blue', '2011-01-01'), /404/);
});

caso('monedas: una llamada a /cotizaciones con USD EUR BRL CLP UYU', async () => {
  const M = ['USD', 'EUR', 'BRL', 'CLP', 'UYU'].map((m) => ({ moneda: m, casa: 'oficial', nombre: m, compra: 1, venta: 2, fechaActualizacion: '2026-11-04T10:00:00.000Z' }));
  entorno({ [`${U}/cotizaciones`]: M });
  const r = await c.monedas();
  igual(llamadas, [`${U}/cotizaciones`]);
  igual(r.datos.map((m) => m.moneda), ['USD', 'EUR', 'BRL', 'CLP', 'UYU']);
});

caso('historiaMoneda: /cotizaciones/{moneda} en minúscula; rechaza lo que no es un código', async () => {
  entorno({ [`${A}/cotizaciones/eur`]: [{ moneda: 'EUR', compra: 370, venta: 371, fecha: '2023-10-22' }] });
  const r = await c.historiaMoneda('EUR');
  igual(llamadas, [`${A}/cotizaciones/eur`]);
  igual(r.datos[0].fecha, '2023-10-22');
  await falla(() => c.historiaMoneda('../x'), /moneda/i);
  await falla(() => c.historiaMoneda('EURO'), /moneda/i);
  igual(llamadas.length, 1, 'llamadas con moneda mala:');
});

// ── Series para gráficos ──────────────────────────────────────────────────────

caso('serie: {fecha, valor}, sin nulos, y la fecha queda como texto', () => {
  igual(c.serie(HIST, 'venta'), [{ fecha: '2011-01-03', valor: 4.1 }, { fecha: '2011-01-04', valor: 4.2 }]);
  igual(c.serie(HIST, 'compra'), [{ fecha: '2011-01-03', valor: 4 }, { fecha: '2011-01-05', valor: 4.3 }]);
  igual(c.serie([{ fecha: '2026-11-03', valor: 831 }], 'valor'), [{ fecha: '2026-11-03', valor: 831 }]);
});

caso('serie: vacía da vacía; un 0 es un valor, no un nulo; ignora NaN y texto', () => {
  igual(c.serie([], 'venta'), []);
  igual(c.serie([{ fecha: '2020-01-01', venta: 0 }], 'venta'), [{ fecha: '2020-01-01', valor: 0 }]);
  igual(c.serie([{ fecha: '2020-01-01', venta: NaN }, { fecha: '2020-01-02', venta: '5' }, { fecha: '2020-01-03' }], 'venta'), []);
});

caso('hoyAR: la fecha de Argentina, no la de UTC', () => {
  entorno({});
  reloj = Date.UTC(2026, 10, 5, 1, 0); // 01:00 UTC del 5 = 22:00 del 4 en Buenos Aires
  igual(c.hoyAR(), '2026-11-04');
  reloj = Date.UTC(2026, 10, 5, 3, 0); // 00:00 del 5 en Buenos Aires
  igual(c.hoyAR(), '2026-11-05');
  reloj = Date.UTC(2026, 10, 4, 15, 0);
});

caso('ultimosDias: exactamente n días de calendario hasta hoy en Argentina; sin fechas futuras', () => {
  entorno({});
  const s = ['2026-10-27', '2026-10-28', '2026-10-29', '2026-11-03', '2026-11-04', '2026-11-05'].map((fecha) => ({ fecha, valor: 1 }));
  reloj = Date.UTC(2026, 10, 5, 1, 0); // en UTC ya es el 5, en Buenos Aires todavía el 4
  igual(c.ultimosDias(s, 7).map((p) => p.fecha), ['2026-10-29', '2026-11-03', '2026-11-04'], 'N=7 con hoy=4 (29/10 a 4/11):');
  igual(c.ultimosDias(s, 6).map((p) => p.fecha), ['2026-11-03', '2026-11-04'], 'N=6 (30/10 a 4/11):');
  igual(c.ultimosDias(s, 1).map((p) => p.fecha), ['2026-11-04'], 'N=1:');
  igual(c.ultimosDias(s, 0).map((p) => p.fecha), [], 'N=0:');
  reloj = Date.UTC(2026, 10, 4, 15, 0);
});

// ── Índices, tasas y feriados ─────────────────────────────────────────────────

const INDICES = [
  ['inflacionMensual', `${A}/finanzas/indices/inflacion`],
  ['inflacionInteranual', `${A}/finanzas/indices/inflacionInteranual`],
  ['riesgoPaisUltimo', `${A}/finanzas/indices/riesgo-pais/ultimo`],
  ['riesgoPais', `${A}/finanzas/indices/riesgo-pais`],
  ['uva', `${A}/finanzas/indices/uva`],
  ['plazoFijo', `${A}/finanzas/tasas/plazoFijo`],
];

for (const [fn, url] of INDICES) {
  caso(`${fn}: una llamada a ${url.replace(A, '')}, cacheada 12 h`, async () => {
    const punto = { fecha: '2026-10-31', valor: 2.5, entidad: 'Banco X' }; // `entidad` es la clave de plazoFijo
    entorno({ [url]: fn === 'riesgoPaisUltimo' ? punto : [punto] }); // el "último" es un objeto, no una lista
    const r = await c[fn]();
    igual(llamadas, [url]);
    igual([r.datos].flat()[0].valor, 2.5);
    reloj += 12 * HORA - 1;
    await c[fn]();
    igual(llamadas.length, 1, 'antes de las 12 h:');
    reloj += 1;
    await c[fn]();
    igual(llamadas.length, 2, 'a las 12 h:');
  });
}

caso('feriados: /feriados/{año}, un año por llamada; rechaza lo que no es un año', async () => {
  entorno({ [`${A}/feriados/2026`]: [{ fecha: '2026-01-01', tipo: 'inamovible', nombre: 'Año nuevo' }], [`${A}/feriados/2025`]: [{ fecha: '2025-01-01', tipo: 'inamovible', nombre: 'Año nuevo' }] });
  const r = await c.feriados(2026);
  igual(llamadas, [`${A}/feriados/2026`]);
  igual(r.datos[0].nombre, 'Año nuevo');
  await c.feriados(2025);
  igual(llamadas[1], `${A}/feriados/2025`);
  await falla(() => c.feriados('../x'), /año/i);
  await falla(() => c.feriados(26), /año/i);
  igual(llamadas.length, 2, 'llamadas con año malo:');
});

caso('una falla de un índice sin valor guardado nombra la URL y no inventa nada', async () => {
  entorno(() => new Error('sin red'));
  await falla(() => c.uva(), /uva.*no hay valor guardado/i);
});

// ── Cuentas ───────────────────────────────────────────────────────────────────

function cerca(real, esperado, msg = '') {
  if (Math.abs(real - esperado) > 1e-9) throw new Error(`${msg} esperaba ${esperado} y dio ${real}`);
}

caso('brecha: sobre la venta, en %: (a.venta / b.venta - 1) * 100', () => {
  cerca(c.brecha({ venta: 2000 }, { venta: 1000 }), 100);
  cerca(c.brecha({ venta: 1560, compra: 1 }, { venta: 1570, compra: 9 }), (1560 / 1570 - 1) * 100, 'blue contra oficial:');
  cerca(c.brecha({ venta: 1000 }, { venta: 1000 }), 0);
});

caso('brecha: una venta nula o cero es un error, no un número', () => {
  for (const [a, b] of [[{ venta: null }, { venta: 1 }], [{ venta: 1 }, { venta: null }], [{ venta: 1 }, { venta: 0 }]]) {
    let error = null;
    try { c.brecha(a, b); } catch (e) { error = e; }
    afirmar(error && /venta/i.test(error.message), `no falló con ${JSON.stringify([a, b])}`);
  }
});

caso('variacion: % entre dos valores; sube, baja y sin cambio; desde 0 es error', () => {
  cerca(c.variacion(100, 150), 50);
  cerca(c.variacion(200, 150), -25);
  cerca(c.variacion(80, 80), 0);
  let error = null;
  try { c.variacion(0, 5); } catch (e) { error = e; }
  afirmar(error, 'desde 0 no falló');
});

caso('promedio: (compra + venta) / 2; si falta una de las dos, null', () => {
  cerca(c.promedio({ compra: 1540, venta: 1560 }), 1550);
  cerca(c.promedio({ compra: 10, venta: 11 }), 10.5);
  igual(c.promedio({ compra: null, venta: 1560 }), null);
  igual(c.promedio({ compra: 1540, venta: null }), null);
});

const INFLACION = [
  { fecha: '2024-01-31', valor: 20 },
  { fecha: '2024-02-29', valor: 2 },
  { fecha: '2024-03-31', valor: 3 },
];

caso('ajustarPorInflacion: acumula los meses completos DESPUÉS del mes de origen, hasta el mes de destino inclusive', () => {
  cerca(c.ajustarPorInflacion(1000, '2024-01-15', '2024-03-10', INFLACION), 1000 * 1.02 * 1.03, 'enero a marzo:');
  cerca(c.ajustarPorInflacion(500, '2024-01-31', '2024-02-01', INFLACION), 510, 'sólo febrero:');
});

caso('ajustarPorInflacion: mismo mes no cambia el monto; desde después de hasta es error', () => {
  cerca(c.ajustarPorInflacion(1000, '2024-02-03', '2024-02-27', INFLACION), 1000);
  let error = null;
  try { c.ajustarPorInflacion(1000, '2024-03-01', '2024-01-01', INFLACION); } catch (e) { error = e; }
  afirmar(error, 'no falló con las fechas al revés');
});

caso('ajustarPorInflacion: si falta la inflación de un mes, error que nombra el mes (no se inventa)', () => {
  let error = null;
  try { c.ajustarPorInflacion(1000, '2024-01-15', '2024-04-10', INFLACION); } catch (e) { error = e; }
  afirmar(error && /2024-04/.test(error.message), `no nombró el mes: ${error && error.message}`);
});

caso('pesosADolaresAjustado: pesos de hoy / venta de hoy', () => {
  cerca(c.pesosADolaresAjustado(1000, '2024-01-15', '2024-03-10', INFLACION, 1050.6), 1);
  cerca(c.pesosADolaresAjustado(500, '2024-01-31', '2024-02-01', INFLACION, 100), 5.1);
});

caso('formatoARS: es-AR, dos decimales, negativos y cero', () => {
  const f = (n) => c.formatoARS(n).replace(/\u00a0/g, ' ');
  igual(f(1234567.891), '$ 1.234.567,89');
  igual(f(1560), '$ 1.560,00');
  igual(f(0), '$ 0,00');
  igual(f(-1234.5), '-$ 1.234,50');
});

caso('fechaAR: un instante UTC se muestra en hora argentina (UTC-3)', () => {
  igual(c.fechaAR('2026-11-04T01:30:00.000Z'), '03/11/2026 22:30');
  igual(c.fechaAR('2026-11-04T20:55:00.000Z'), '04/11/2026 17:55');
});

caso('fechaCorta: "AAAA-MM-DD" se muestra igual, sin correrse un día', () => {
  igual(c.fechaCorta('2024-05-10'), '10/05/2024');
  igual(c.fechaCorta('2011-01-01'), '01/01/2011');
  igual(c.fechaCorta('2024-12-31'), '31/12/2024');
  let error = null;
  try { c.fechaCorta('2024-5-1'); } catch (e) { error = e; }
  afirmar(error, 'aceptó una fecha mal escrita');
});

caso('fuente: la frase exacta que piden los términos de uso', () => {
  igual(c.fuente.dolarapi, 'Fuente: DolarApi (dolarapi.com)');
  igual(c.fuente.argentinadatos, 'Fuente: ArgentinaDatos (argentinadatos.com)');
});

caso('fetch por defecto: se llama a globalThis.fetch en el momento, con globalThis como receptor', async () => {
  const original = globalThis.fetch;
  const guardadoEntorno = { fetch: c.entorno.fetch, ahora: c.entorno.ahora };
  let llamadasReales = 0;
  try {
    c.entorno.fetch = fetchPorDefecto;
    c.entorno.ahora = () => reloj;
    c.limpiarCache();
    // Como el del navegador: tira si no se lo llama con globalThis como receptor. Se instala DESPUÉS de importar.
    globalThis.fetch = function (url) {
      if (this !== globalThis && this !== undefined) throw new TypeError('Illegal invocation');
      llamadasReales++;
      return Promise.resolve({ ok: true, status: 200, json: async () => structuredClone(DOLARES) });
    };
    const r = await c.dolares();
    igual(llamadasReales, 1, 'llamadas al globalThis.fetch reemplazado:');
    igual(r.datos.length, 3);
  } finally {
    globalThis.fetch = original;
    c.entorno.fetch = guardadoEntorno.fetch;
    c.entorno.ahora = guardadoEntorno.ahora;
    c.limpiarCache();
  }
});

// ── Forma de la respuesta, carrera síncrona, enfriamiento, async ─────────────

const UVA = `${A}/finanzas/indices/uva`;
const PUNTOS = [{ fecha: '2026-11-03', valor: 1 }];

caso('forma: un 200 mal formado no pisa el último valor bueno (otro endpoint, no /dolares)', async () => {
  let cuerpo = PUNTOS;
  entorno(() => cuerpo);
  const bueno = await c.uva();
  cuerpo = { error: 'x' };
  reloj += 13 * HORA;
  const r = await c.uva();
  igual([r.obsoleto, r.datos, r.actualizado], [true, PUNTOS, bueno.actualizado], 'tras el 200 malo:');
});

caso('forma: un 200 mal formado en caché fría es un error claro y no se guarda', async () => {
  let cuerpo = { valor: 'mucho' };
  entorno(() => cuerpo);
  await falla(() => c.riesgoPaisUltimo(), /riesgo-pais\/ultimo.*no hay valor guardado/);
  cuerpo = { fecha: '2026-11-03', valor: 831 };
  reloj += 61_000;
  const r = await c.riesgoPaisUltimo();
  igual([r.datos.valor, r.obsoleto, llamadas.length], [831, false, 2], 'tras el cuerpo bueno:');
});

caso('carrera: si fetch tira síncrono, la consulta en vuelo se limpia y la siguiente vuelve a llamar', async () => {
  entorno({ [UVA]: PUNTOS });
  const bueno = c.entorno.fetch;
  let n = 0;
  c.entorno.fetch = (url, init) => {
    if (++n === 1) throw new Error('boom síncrono');
    return bueno(url, init);
  };
  await falla(() => c.uva(), /boom síncrono/, 'primera llamada:');
  reloj += 61_000;
  const r = await c.uva();
  igual([r.datos, n], [PUNTOS, 2], 'segunda llamada:');
});

caso('enfriamiento: tras una falla no se vuelve a llamar por 60 s (sin valor guardado: repite el error)', async () => {
  entorno({ [UVA]: new Error('caída') });
  await falla(() => c.uva(), /caída/);
  reloj += 60_000 - 1;
  await falla(() => c.uva(), /caída/, 'dentro del enfriamiento:');
  igual(llamadas.length, 1, 'llamadas dentro del enfriamiento:');
  reloj += 1;
  await falla(() => c.uva(), /caída/, 'a los 60 s:');
  igual(llamadas.length, 2, 'llamadas a los 60 s:');
});

caso('enfriamiento: con valor guardado y la API caída devuelve lo guardado, obsoleto, sin llamar', async () => {
  let cuerpo = PUNTOS;
  entorno(() => cuerpo);
  await c.uva();
  cuerpo = new Error('caída');
  reloj += 13 * HORA;
  const a = await c.uva();
  const b = await c.uva();
  igual([a.obsoleto, b.obsoleto, b.datos, llamadas.length], [true, true, PUNTOS, 2], 'durante la caída:');
  reloj += 60_000;
  await c.uva();
  igual(llamadas.length, 3, 'pasado el enfriamiento:');
});

caso('async: la validación de entrada rechaza la promesa, no tira síncrono', async () => {
  entorno({});
  const llamadasMalas = [
    () => c.historiaDolar('MAL!'),
    () => c.cotizacionDolarEn('blue', '2024-02-31'),
    () => c.historiaMoneda('EURO'),
    () => c.feriados('20x6'),
  ];
  for (const f of llamadasMalas) {
    let p;
    try {
      p = f();
    } catch (e) {
      throw new Error(`tiró síncrono: ${e.message}`);
    }
    await falla(() => p, /inválida/);
  }
  igual(llamadas.length, 0, 'llamadas:');
});

// ── Forma profunda: vacío o basura no pisa el último valor bueno ─────────────

for (const [nombre, malo] of [['[]', []], ['[null]', [null]], ['[{}]', [{}]], ['[1]', [1]]]) {
  caso(`forma profunda: /dolares ${nombre} después de uno bueno devuelve el anterior, obsoleto`, async () => {
    let cuerpo = DOLARES;
    entorno(() => cuerpo);
    const bueno = await c.dolares();
    cuerpo = malo;
    reloj += 16 * MIN;
    const r = await c.dolar('blue');
    igual([r.obsoleto, r.datos.casa, r.actualizado], [true, 'blue', bueno.actualizado], `tras ${nombre}:`);
  });
}

caso('forma profunda: una lista vacía en caché fría es un error claro', async () => {
  entorno({ [`${U}/dolares`]: [] });
  await falla(() => c.dolares(), /no hay valor guardado.*forma esperada/);
});

caso('forma profunda: un ítem con venta de texto invalida la lista; venta null es válida', async () => {
  let cuerpo = [{ moneda: 'USD', casa: 'x', venta: null }];
  entorno(() => cuerpo);
  igual((await c.dolares()).datos.length, 1, 'venta null:');
  cuerpo = [{ moneda: 'USD', casa: 'x', venta: '1500' }];
  reloj += 16 * MIN;
  igual((await c.dolares()).obsoleto, true, 'venta de texto:');
});

caso('forma profunda: cotizacionDolarEn {} y {message} en caché fría son un error claro', async () => {
  const url = `${A}/cotizaciones/dolares/blue/2024/05/10`;
  for (const cuerpo of [{}, { message: 'x' }]) {
    entorno({ [url]: cuerpo });
    await falla(() => c.cotizacionDolarEn('blue', '2024-05-10'), /no hay valor guardado.*forma esperada/, JSON.stringify(cuerpo));
  }
});

caso('forma profunda: cotizacionDolarEn {} después de uno bueno devuelve el anterior', async () => {
  const url = `${A}/cotizaciones/dolares/blue/2024/05/10`;
  const bueno = { casa: 'blue', compra: 1, venta: null, fecha: '2024-05-10' };
  let cuerpo = bueno;
  entorno(() => cuerpo);
  await c.cotizacionDolarEn('blue', '2024-05-10');
  cuerpo = {};
  reloj += 13 * HORA;
  const r = await c.cotizacionDolarEn('blue', '2024-05-10');
  igual([r.obsoleto, r.datos], [true, bueno], 'tras {}:');
  igual(llamadas, [url, url]);
});

caso('forma profunda: cada endpoint rechaza una lista vacía', async () => {
  const llamadasA = [
    [() => c.monedas(), `${U}/cotizaciones`],
    [() => c.historiaDolar('blue'), `${A}/cotizaciones/dolares/blue`],
    [() => c.historiaMoneda('EUR'), `${A}/cotizaciones/eur`],
    [() => c.inflacionMensual(), `${A}/finanzas/indices/inflacion`],
    [() => c.riesgoPais(), `${A}/finanzas/indices/riesgo-pais`],
    [() => c.plazoFijo(), `${A}/finanzas/tasas/plazoFijo`],
    [() => c.feriados(2026), `${A}/feriados/2026`],
  ];
  for (const [f, url] of llamadasA) {
    entorno({ [url]: [] });
    await falla(f, /forma esperada/, url);
    entorno({ [url]: [{}] });
    await falla(f, /forma esperada/, `${url} [{}]:`);
  }
});

// ── limpiarCache() con una consulta en vuelo ─────────────────────────────────

/** Un fetch que se queda esperando hasta que la prueba lo resuelve (`ok`) o lo rompe (`mal`). */
function fetchPendiente() {
  const p = { n: 0, ok: null, mal: null };
  c.entorno.ahora = () => reloj;
  c.entorno.fetch = () => {
    p.n++;
    return new Promise((res, rej) => {
      p.ok = (cuerpo) => res({ ok: true, status: 200, json: async () => structuredClone(cuerpo) });
      p.mal = rej;
    });
  };
  c.limpiarCache();
  return p;
}

caso('limpiarCache: lo que llega de una consulta anterior no vuelve a llenar la caché', async () => {
  const p = fetchPendiente();
  const vieja = c.dolares();
  c.limpiarCache();
  p.ok(DOLARES);
  await vieja;
  const nueva = c.dolares(); // si la vieja escribió, esto sale de la caché y no llama
  igual(p.n, 2, 'llamadas tras limpiar:');
  p.ok(DOLARES);
  await nueva;
});

caso('limpiarCache: una falla de una consulta anterior no deja enfriamiento', async () => {
  const p = fetchPendiente();
  const vieja = c.dolares().catch((e) => e);
  c.limpiarCache();
  p.mal(new Error('caída'));
  await vieja;
  const nueva = c.dolares(); // si la vieja dejó enfriamiento, repite el error sin llamar
  igual(p.n, 2, 'llamadas tras limpiar:');
  p.ok(DOLARES);
  igual((await nueva).datos.length, 3);
});

caso('limpiarCache: sin limpiar, la consulta en vuelo sí escribe la caché', async () => {
  const p = fetchPendiente();
  const a = c.dolares();
  p.ok(DOLARES);
  await a;
  await c.dolares();
  igual(p.n, 1, 'llamadas:');
});

// ── Falla compartida, enfriamiento y limpiarCache ────────────────────────────

caso('falla: los llamadores simultáneos comparten una llamada y reciben lo mismo (viejo)', async () => {
  let cuerpo = PUNTOS;
  entorno(() => cuerpo);
  const bueno = await c.uva();
  cuerpo = new Error('caída');
  reloj += 13 * HORA;
  const rs = await Promise.all([c.uva(), c.uva(), c.uva()]);
  igual(llamadas.length, 2, 'llamadas:');
  igual(rs.map((r) => [r.obsoleto, r.actualizado, r.datos]), Array(3).fill([true, bueno.actualizado, PUNTOS]));
});

caso('falla: los llamadores simultáneos sin valor guardado reciben el mismo error', async () => {
  entorno({ [UVA]: new Error('caída') });
  const errores = await Promise.all([c.uva().catch((e) => e), c.uva().catch((e) => e)]);
  igual(llamadas.length, 1, 'llamadas:');
  afirmar(errores[0] === errores[1] && /caída/.test(errores[0].message), 'no recibieron el mismo error');
});

caso('limpiarCache: también borra el enfriamiento', async () => {
  entorno({ [UVA]: new Error('caída') });
  await falla(() => c.uva(), /caída/);
  c.limpiarCache();
  await falla(() => c.uva(), /caída/);
  igual(llamadas.length, 2, 'llamadas tras limpiar:');
});

caso('enfriamiento: un éxito lo borra; una falla posterior empieza uno nuevo', async () => {
  let cuerpo = new Error('caída');
  entorno(() => cuerpo);
  await falla(() => c.uva(), /caída/);
  reloj += 60_000;
  cuerpo = PUNTOS;
  await c.uva(); // éxito: borra el enfriamiento
  cuerpo = new Error('otra vez');
  reloj += 13 * HORA;
  await c.uva(); // falla nueva, enfriamiento nuevo (llamada 3)
  await c.uva();
  igual(llamadas.length, 3, 'dentro del enfriamiento nuevo:');
  reloj += 60_000 - 1;
  await c.uva();
  igual(llamadas.length, 3, 'a 60 s menos 1 ms:');
  reloj += 1;
  await c.uva();
  igual(llamadas.length, 4, 'a los 60 s:');
});

// ── Salida ────────────────────────────────────────────────────────────────────

for (const [nombre, fn] of cola) {
  corridos++;
  try {
    await fn();
  } catch (e) {
    fallas.push(`${nombre}: ${e.message}`);
  }
}

if (fallas.length > 0) {
  console.log(`FALLA  ${fallas.length} de ${corridos} casos:`);
  for (const f of fallas) console.log(`  - ${f}`);
  process.exit(1);
}
console.log(`OK  ${corridos} casos, sin fallas.`);
