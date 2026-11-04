---
name: dolarapi
description: "Cotizaciones del dólar y datos económicos argentinos, ya resueltos y iguales en todos los proyectos: dólar oficial, blue, MEP (bolsa), CCL, tarjeta, mayorista y cripto; historia y gráficos del dólar; brecha; otras monedas (euro, real, peso chileno y uruguayo); inflación, UVA, riesgo país, plazo fijo y feriados. Usala SIEMPRE que un proyecto muestre, compare o grafique una cotización o un índice, antes de buscar una API o escribir código propio. No la uses para cotizar acciones, bonos o cripto distinta del dólar, ni para operar con valores oficiales: son cotizaciones de referencia."
user-invocable: true
---

# Cotizaciones del dólar (DolarApi y ArgentinaDatos)

Un solo archivo, `cotizaciones.ts`, junto a esta skill. Resuelve de una vez lo que cada proyecto
hace distinto: qué API, cuántas llamadas, cuánto cachear, qué mostrar si falla. **No se
investiga ni se reimplementa: se copia.**

## Cómo se usa

1. **Copiá `cotizaciones.ts` tal cual** al proyecto (por ejemplo, en la carpeta de utilidades) e
   importalo desde ahí. Sin dependencias; Node 22.18 o más lo corre directo, y cualquier
   empaquetador de TypeScript lo toma como está.
2. **Nunca lo reescribas ni lo reimplementes a medias.** Si falta algo, se cambia el archivo de
   *esta skill* y se vuelve a copiar a los proyectos. Una copia editada deja de ser igual a las
   demás, que es todo el punto.
3. Todas las funciones devuelven `{ datos, actualizado, obsoleto }`: el dato, cuándo se bajó
   (ISO) y si es el último valor guardado porque la API falló.

## Reglas que no se negocian

- **Jamás inventes ni escribas a mano una cotización.** Ni de ejemplo, ni de relleno, ni en una
  prueba que llegue a pantalla.
- **Junto a cada valor que se muestre: su fecha y su fuente.** Fecha: `fechaAR(c.fechaActualizacion)`
  para lo actual, `fechaCorta(fecha)` para la historia. Fuente: `fuente.dolarapi` o
  `fuente.argentinadatos` (los términos de uso de DolarApi piden citarla con su URL).
- **Si la API falla**, la skill devuelve el último valor guardado con `obsoleto: true`: se muestra
  con su fecha y se avisa que está desactualizado. Si nunca hubo un valor, lanza un error: se
  muestra un mensaje claro. **Nunca un número sin fecha.**
- **Son cotizaciones de referencia**, no valores oficiales para operar ni liquidar. Decilo donde
  se muestran.

## Qué hace sola (no lo repitas en el proyecto)

- Dólares actuales: **una** llamada a `/v1/dolares` trae todas las casas. Nunca una por casa.
- Caché en memoria: 15 min lo actual, 12 h la historia y los índices. Las consultas simultáneas
  comparten una sola llamada.
- Historia: sólo la casa pedida. Nunca el volcado completo (~3 MB).
- Cada proceso tiene su caché. Con servidores sin estado (funciones que se apagan), cada arranque
  vuelve a llamar.
- Las dos APIs son abiertas: sin clave y con CORS `*`, así que se pueden llamar desde el
  navegador. Con mucho tráfico conviene llamar desde el servidor, para que el caché sea uno solo.

## Funciones

```ts
import * as cot from './cotizaciones.ts';

const blue = await cot.dolar('blue');            // blue.datos.venta, blue.datos.fechaActualizacion
const todos = await cot.dolares();               // 1 llamada, todas las casas
const hist = await cot.historiaDolar('blue');    // una llamada por casa
const dia = await cot.cotizacionDolarEn('blue', '2024-05-10');
const otras = await cot.monedas();               // USD EUR BRL CLP UYU
const euro = await cot.historiaMoneda('EUR');    // desde 2023-10-22
```

| función | devuelve |
|---|---|
| `dolares()` · `dolar(casa)` | actuales. Casas: `oficial` `blue` `bolsa` (MEP) `contadoconliqui` `tarjeta` `mayorista` `cripto` |
| `historiaDolar(casa)` | un ítem por día `{ casa, compra, venta, fecha }`. También `solidario` (2020-01-02 a 2023-12-13) |
| `cotizacionDolarEn(casa, 'AAAA-MM-DD')` | un solo día |
| `monedas()` · `historiaMoneda(moneda)` | otras monedas, actuales e historia |
| `inflacionMensual()` · `inflacionInteranual()` | `{ fecha, valor }`, `valor` en %, un ítem por mes |
| `riesgoPaisUltimo()` · `riesgoPais()` | último valor · serie completa desde 1999 |
| `uva()` | valor diario de la UVA en pesos, desde 2016-03-31 |
| `plazoFijo()` | tasas por banco; `tna` es una fracción (`0.2` = 20 %) |
| `feriados(año)` | `{ fecha, tipo, nombre }` |

Series de ArgentinaDatos que no se incluyen: las demás de su documentación (fondos y
rendimientos) no sirven para comparar con el dólar. Pedilas a quien mantiene esta skill.

### Gráficos

La salida es `{ fecha: 'AAAA-MM-DD', valor }[]`, sin nulos, y sirve a cualquier librería de gráficos.

```ts
const h = await cot.historiaDolar('blue');
const puntos = cot.ultimosDias(cot.serie(h.datos, 'venta'), 90);   // últimos 90 días
```

**La historia no tiene endpoint por rango**: es una llamada por casa y se recorta acá con
`ultimosDias`. No busques otro. El corte usa la fecha de Argentina, no la de UTC. Para comparar
dos casas, `serie` de cada una y se alinean por `fecha`.

### Cuentas

| función | fórmula |
|---|---|
| `brecha(a, b)` | **sobre la venta**: `(a.venta / b.venta - 1) * 100`. Ej.: `brecha(blue, oficial)`. Error si falta alguna venta |
| `variacion(desde, hasta)` | `(hasta / desde - 1) * 100` |
| `promedio(c)` | `(compra + venta) / 2`, o `null` si falta una |
| `ajustarPorInflacion(monto, desde, hasta, inflacion)` | pesos de `desde` en pesos de `hasta`: `monto × Π(1 + inflación_mes / 100)` sobre los meses completos **posteriores** al de `desde`, hasta el de `hasta` inclusive. Mismo mes, sin cambio. Si falta la inflación de un mes, error que lo nombra |
| `pesosADolaresAjustado(monto, desde, hasta, inflacion, ventaHasta)` | dólares de `hasta` equivalentes a `monto` pesos de `desde`: lo anterior dividido por `ventaHasta` |
| `formatoARS(n)` | `"$ 1.234,50"` |
| `fechaAR(iso)` · `fechaCorta(fecha)` | `"03/11/2026 22:30"` en hora argentina · `"10/05/2024"` |

`inflacion` es `(await cot.inflacionMensual()).datos`.

## Trampas de los datos

- **Cada casa tiene su propia hora de actualización** (`fechaActualizacion`, ISO en UTC). No
  muestres una sola fecha para todas.
- **Las fechas de la historia son texto sin zona horaria.** Nunca `new Date('2024-05-10')`: en
  Argentina da el día anterior. Usá `fechaCorta`.
- **`compra` o `venta` pueden ser `null`** en días de la historia. `serie` los saltea.
- **La historia incluye sábados, domingos y feriados.** Y su último día puede no coincidir con
  la cotización actual: son fuentes distintas.
- **La inflación se publica con retraso.** Pedir un ajuste hasta un mes todavía no publicado
  falla con "Falta la inflación de AAAA-MM": mostralo, no lo estimes.
- **La UVA trae fechas futuras** (se publica por adelantado).
- **`oficial` es la cotización minorista; `mayorista` es otra casa.** No está verificado contra la
  documentación de DolarApi: no lo presentes como el valor del BCRA.
- **`bolsa` es el dólar MEP.** En DolarApi el `nombre` dice "Bolsa".
- Cada casa tiene su rango de historia: `oficial`, `blue` y `mayorista` desde 2011-01-03;
  `contadoconliqui` 2013; `bolsa` 2018-10-29; `tarjeta` 2019-12-23; `cripto` 2023-02-07.

## Referencia (no está en `cotizaciones.ts`)

Otros países de DolarApi, mismo formato, base `https://{cc}.dolarapi.com/v1`:

| `cc` | país |
|---|---|
| `cl` · `uy` · `mx` · `ve` · `bo` · `br` · `co` | Chile · Uruguay · México · Venezuela · Bolivia · Brasil · Colombia |

Fuente alternativa de Argentina, sólo como referencia: `https://dolarapi.com/v1/ambito/dolares`
(cotizaciones de Ámbito). Si un proyecto la necesita, se suma al archivo de la skill.

Términos de uso: <https://dolarapi.com/docs/uso>. Piden cachear: una consulta por serie cada
unas 3 h alcanza, y ya lo cumple el caché de esta skill.
