// ORIGEN: skill `dolarapi` de flujo-loop (skills/dolarapi/cotizaciones.ts).
// ⚠️ NO SE EDITA EN LOS PROYECTOS. Se copia tal cual (p. ej. a src/lib/cotizaciones.ts). Si falta
// algo, se cambia el archivo de la skill y se vuelve a copiar, para que todos queden iguales.
// Sin dependencias; sólo sintaxis borrable de TypeScript (Node 22.18+ lo corre sin compilar).

const DOLARAPI = 'https://dolarapi.com/v1';

export type Casa = 'oficial' | 'blue' | 'bolsa' | 'contadoconliqui' | 'tarjeta' | 'mayorista' | 'cripto';

export type Cotizacion = {
  moneda: string;
  casa: string;
  nombre: string;
  compra: number | null;
  venta: number | null;
  fechaActualizacion: string;
};

/** Todo lo que devuelve la skill: el dato, cuándo se bajó (ISO) y si es el último guardado. */
export type Resultado<T> = { datos: T; actualizado: string; obsoleto: boolean };

/** Sólo para pruebas: reemplazar el `fetch` y el reloj. */
export const entorno = {
  fetch: globalThis.fetch as (url: string, init?: object) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>,
  ahora: () => Date.now(),
};

const ACTUAL = 15 * 60_000; // cotizaciones actuales: 15 min
const HISTORIA = 12 * 60 * 60_000; // historia e índices: 12 h

const guardado = new Map<string, { datos: unknown; en: number }>();
const enVuelo = new Map<string, Promise<Resultado<unknown>>>();

export function limpiarCache(): void {
  guardado.clear();
  enVuelo.clear();
}

/** GET con caché (`ttl` ms), consultas simultáneas compartidas y, si falla, el último valor guardado. */
function pedir<T>(url: string, ttl: number): Promise<Resultado<T>> {
  const g = guardado.get(url);
  if (g && entorno.ahora() - g.en < ttl) return Promise.resolve(resultado<T>(g, false));
  const previa = enVuelo.get(url);
  if (previa) return previa as Promise<Resultado<T>>;
  const p = (async () => {
    try {
      const r = await entorno.fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const nuevo = { datos: await r.json(), en: entorno.ahora() };
      guardado.set(url, nuevo);
      return resultado<T>(nuevo, false);
    } catch (e) {
      const motivo = e instanceof Error ? e.message : String(e);
      if (g) return resultado<T>(g, true); // el último valor, con su fecha, marcado como viejo
      throw new Error(`No se pudo obtener ${url} y no hay valor guardado: ${motivo}`);
    } finally {
      enVuelo.delete(url);
    }
  })();
  enVuelo.set(url, p);
  return p;
}

function resultado<T>(g: { datos: unknown; en: number }, obsoleto: boolean): Resultado<T> {
  return { datos: g.datos as T, actualizado: new Date(g.en).toISOString(), obsoleto };
}

export async function dolares(): Promise<Resultado<Cotizacion[]>> {
  const r = await pedir<Cotizacion[]>(`${DOLARAPI}/dolares`, ACTUAL);
  if (!Array.isArray(r.datos)) throw new Error('La respuesta de /dolares no es una lista');
  return r;
}

export async function dolar(casa: Casa): Promise<Resultado<Cotizacion>> {
  const r = await dolares();
  const datos = r.datos.find((d) => d.casa === casa);
  if (!datos) throw new Error(`No hay cotización para la casa "${casa}"`);
  return { ...r, datos };
}

// ── Historia (ArgentinaDatos) ─────────────────────────────────────────────────
// No hay endpoint por rango: una llamada por casa o moneda, y se recorta acá con ultimosDias().
// Nunca se pide /cotizaciones/dolares sin casa: es el volcado de todas, ~3 MB.

const ARGENTINADATOS = 'https://api.argentinadatos.com/v1';

/** `solidario` existe sólo en la historia (2020-01-02 a 2023-12-13). */
export type CasaHistoria = Casa | 'solidario';

/** Un día de la historia. La fecha es texto 'AAAA-MM-DD', sin zona horaria. */
export type PuntoDolar = { casa: string; compra: number | null; venta: number | null; fecha: string };
export type PuntoMoneda = { moneda: string; compra: number | null; venta: number | null; fecha: string };

function validar(valor: string, patron: RegExp, que: string): string {
  if (!patron.test(valor)) throw new Error(`${que} inválida: "${valor}"`);
  return valor;
}

export function historiaDolar(casa: CasaHistoria): Promise<Resultado<PuntoDolar[]>> {
  validar(casa, /^[a-z]+$/, 'Casa');
  return pedir(`${ARGENTINADATOS}/cotizaciones/dolares/${casa}`, HISTORIA);
}

/** La cotización de un día ('AAAA-MM-DD'). Fines de semana y feriados también tienen dato. */
export function cotizacionDolarEn(casa: CasaHistoria, fecha: string): Promise<Resultado<PuntoDolar>> {
  validar(casa, /^[a-z]+$/, 'Casa');
  const [a, m, d] = validar(fecha, /^\d{4}-\d{2}-\d{2}$/, 'Fecha').split('-');
  if (new Date(Date.UTC(+a, +m - 1, +d)).toISOString().slice(0, 10) !== fecha) throw new Error(`Fecha inválida: "${fecha}"`);
  return pedir(`${ARGENTINADATOS}/cotizaciones/dolares/${casa}/${a}/${m}/${d}`, HISTORIA);
}

// ── Otras monedas ─────────────────────────────────────────────────────────────

/** USD, EUR, BRL, CLP y UYU, de una sola llamada. */
export function monedas(): Promise<Resultado<Cotizacion[]>> {
  return pedir(`${DOLARAPI}/cotizaciones`, ACTUAL);
}

/** Desde 2023-10-22. */
export function historiaMoneda(moneda: string): Promise<Resultado<PuntoMoneda[]>> {
  validar(moneda, /^[A-Za-z]{3}$/, 'Moneda');
  return pedir(`${ARGENTINADATOS}/cotizaciones/${moneda.toLowerCase()}`, HISTORIA);
}

// ── Series para gráficos ──────────────────────────────────────────────────────

export type Punto = { fecha: string; valor: number };

/** { fecha, valor } por cada ítem donde `campo` es un número; los nulos se saltean. */
export function serie(items: Array<Record<string, unknown>>, campo: string): Punto[] {
  return items.flatMap((i) => {
    const v = i[campo];
    return typeof v === 'number' && Number.isFinite(v) ? [{ fecha: String(i.fecha), valor: v }] : [];
  });
}

/** 'AAAA-MM-DD' de hoy en Argentina (no en UTC). */
export function hoyAR(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(entorno.ahora());
}

/** Los puntos de los últimos `n` días, contando hoy en Argentina. Incluye el día de corte. */
export function ultimosDias(puntos: Punto[], n: number): Punto[] {
  const [a, m, d] = hoyAR().split('-').map(Number);
  const corte = new Date(Date.UTC(a, m - 1, d - n)).toISOString().slice(0, 10);
  return puntos.filter((p) => p.fecha >= corte);
}

// ── Índices, tasas y feriados (ArgentinaDatos) ────────────────────────────────

/** Mensual, en %. Un ítem por mes, con la fecha del último día del mes. */
export const inflacionMensual = () => pedir<Punto[]>(`${ARGENTINADATOS}/finanzas/indices/inflacion`, HISTORIA);
/** Interanual, en %. */
export const inflacionInteranual = () => pedir<Punto[]>(`${ARGENTINADATOS}/finanzas/indices/inflacionInteranual`, HISTORIA);
/** El último valor del riesgo país, en puntos básicos. */
export const riesgoPaisUltimo = () => pedir<Punto>(`${ARGENTINADATOS}/finanzas/indices/riesgo-pais/ultimo`, HISTORIA);
/** Toda la serie del riesgo país (desde 1999, ~400 KB). */
export const riesgoPais = () => pedir<Punto[]>(`${ARGENTINADATOS}/finanzas/indices/riesgo-pais`, HISTORIA);
/** Valor diario de la UVA en pesos (desde 2016-03-31, ~200 KB). */
export const uva = () => pedir<Punto[]>(`${ARGENTINADATOS}/finanzas/indices/uva`, HISTORIA);

export type TasaPlazoFijo = {
  entidad: string;
  tnaClientes: number | null;
  tnaNoClientes: number | null;
  tasas: Array<{ plazoMinDias: number | null; plazoMaxDias: number | null; tna: number | null }>;
};
/** Tasas (TNA como fracción: 0.2 = 20 %) por banco. */
export const plazoFijo = () => pedir<TasaPlazoFijo[]>(`${ARGENTINADATOS}/finanzas/tasas/plazoFijo`, HISTORIA);

export type Feriado = { fecha: string; tipo: string; nombre: string };
export function feriados(anio: number | string): Promise<Resultado<Feriado[]>> {
  validar(String(anio), /^\d{4}$/, 'Año');
  return pedir(`${ARGENTINADATOS}/feriados/${anio}`, HISTORIA);
}

// ── Cuentas ───────────────────────────────────────────────────────────────────

type ConVenta = { venta: number | null };

/** Brecha en %, sobre la VENTA: (a.venta / b.venta - 1) * 100. Ej.: brecha(blue, oficial). */
export function brecha(a: ConVenta, b: ConVenta): number {
  if (a.venta == null || b.venta == null || b.venta === 0) throw new Error('La brecha necesita la venta de las dos cotizaciones');
  return (a.venta / b.venta - 1) * 100;
}

/** Variación en % entre dos valores: (hasta / desde - 1) * 100. */
export function variacion(desde: number, hasta: number): number {
  if (desde === 0) throw new Error('No hay variación desde 0');
  return (hasta / desde - 1) * 100;
}

/** (compra + venta) / 2; null si falta alguna. */
export function promedio(c: { compra: number | null; venta: number | null }): number | null {
  return c.compra == null || c.venta == null ? null : (c.compra + c.venta) / 2;
}

/**
 * Pesos de `desde` expresados en pesos de `hasta` (fechas 'AAAA-MM-DD'):
 *   monto * Π (1 + inflación_mes / 100)
 * sobre los meses COMPLETOS posteriores al mes de `desde`, hasta el mes de `hasta` inclusive.
 * Mismo mes = sin cambio. Si falta la inflación de algún mes, error: no se inventa.
 * `inflacion` es lo que devuelve inflacionMensual().datos.
 */
export function ajustarPorInflacion(monto: number, desde: string, hasta: string, inflacion: Punto[]): number {
  const d = desde.slice(0, 7);
  const h = hasta.slice(0, 7);
  if (d > h) throw new Error('"desde" es posterior a "hasta"');
  let total = monto;
  for (let [a, m] = d.split('-').map(Number); `${a}-${String(m).padStart(2, '0')}` < h; ) {
    m === 12 ? (a++, (m = 1)) : m++;
    const mes = `${a}-${String(m).padStart(2, '0')}`;
    const p = inflacion.find((x) => x.fecha.startsWith(mes));
    if (!p) throw new Error(`Falta la inflación de ${mes}`);
    total *= 1 + p.valor / 100;
  }
  return total;
}

/** Dólares de `hasta` que equivalen a `monto` pesos de `desde`: ajustarPorInflacion(...) / ventaHasta. */
export function pesosADolaresAjustado(monto: number, desde: string, hasta: string, inflacion: Punto[], ventaHasta: number): number {
  return ajustarPorInflacion(monto, desde, hasta, inflacion) / ventaHasta;
}

// ── Mostrar ───────────────────────────────────────────────────────────────────

/** 1234.5 → "$ 1.234,50" */
export const formatoARS = (n: number): string =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n);

/** Un instante ISO (UTC) como "03/11/2026 22:30" en hora argentina. */
export function fechaAR(iso: string): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires', hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]),
  );
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

/** 'AAAA-MM-DD' → "DD/MM/AAAA", como texto: nunca pasa por Date, así no se corre un día. */
export function fechaCorta(fecha: string): string {
  const [a, m, d] = validar(fecha, /^\d{4}-\d{2}-\d{2}$/, 'Fecha').split('-');
  return `${d}/${m}/${a}`;
}

/** Hay que citar la fuente junto al dato (términos de uso de DolarApi: dolarapi.com/docs/uso). */
export const fuente = {
  dolarapi: 'Fuente: DolarApi (dolarapi.com)',
  argentinadatos: 'Fuente: ArgentinaDatos (argentinadatos.com)',
};
