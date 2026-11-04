# Skill dolarapi: cotizaciones iguales en todos los proyectos

## Reporte en lenguaje llano

**Qué hace este cambio.** Suma la skill `dolarapi`: un archivo `cotizaciones.ts` que cualquier
proyecto copia tal cual para mostrar, comparar o graficar el dólar y otros índices argentinos, con
las menos llamadas posibles, con caché, y mostrando siempre fecha y fuente. Si la API falla,
muestra el último valor con su fecha o un error claro; nunca un número inventado.

**Hallazgos.** Las revisiones (independiente, seguridad, judgment-day) corren después, desde el
flujo que presenta el cambio; este rastro registra lo hecho hasta acá.

**Lo que no se revisó.** Ver "Lo que no se pudo verificar".

## Objetivo

Una skill propia, `dolarapi`, para que cualquier proyecto de la consultora que necesite
cotizaciones del dólar, gráficos o comparaciones lo resuelva al instante: sin investigar, igual
en todos los proyectos, rápido y con las menos llamadas posibles a la API.

## Decisiones (aprobadas por el dueño)

| decisión | por qué |
|---|---|
| `skills/dolarapi/` con `SKILL.md` + **un solo archivo** `cotizaciones.ts`, sin dependencias | El instalador copia cada carpeta de `skills/` solo: no hay nada que registrar |
| Se copia el archivo tal cual al proyecto; nunca se reescribe | Si cada proyecto lo reimplementa, dejan de ser iguales. Lo que falte se agrega a la skill, no a la copia |
| Sólo sintaxis borrable de TypeScript (sin `enum`, `namespace` ni propiedades en el constructor) | Node 22.23 lo corre con *type stripping*, sin compilar |
| Dólares actuales: **una** llamada a `/v1/dolares` (todas las casas) | Nunca una llamada por casa |
| Historia: sólo la casa pedida (`/cotizaciones/dolares/{casa}`); nunca el volcado completo (~3 MB) | Peso y cuota |
| Caché en memoria: 15 min lo actual, 12 h historia e índices; las consultas simultáneas comparten una promesa | Los términos de DolarApi piden cachear |
| Si la API falla: último valor guardado con su fecha; si no hay, error claro. Nunca un número inventado | Un número sin fecha miente con total confianza |
| `brecha` se define sobre `venta`: `(a.venta / b.venta - 1) * 100` | Una sola convención en todos los proyectos |
| "Últimos N días" se corta con la fecha de Argentina, no con UTC | A la noche UTC ya es "mañana" en Buenos Aires |
| La fecha `YYYY-MM-DD` de la historia nunca se parsea como medianoche UTC | En UTC-3 se corre un día |
| Series para gráficos: `{ fecha: 'YYYY-MM-DD', valor: number }`, sin nulos | Sirve a cualquier librería |
| Citar la fuente junto al dato | Los términos de uso de DolarApi (<https://dolarapi.com/docs/uso>) piden citarla con su URL |

## Tareas

- [x] T1 · este rastro
- [x] T2 · `cotizaciones.ts` + `pruebas/dolarapi.test.mjs` (commit 4ebbfd9)
- [x] T3 · `SKILL.md` + fila en el README + comando de prueba en el README (commit 547034d)
- [x] T4 · prueba en vivo (un script fuera del repo)
- [x] T5 · todos los controles

## Supuestos

- La inflación sale de ArgentinaDatos **hasta que el PR de la skill INDEC decida** si ésa pasa a
  ser la fuente oficial. Seguimiento conocido, no se resuelve acá.
- `oficial` en DolarApi es la cotización minorista; `mayorista` es otra casa. **No pude
  confirmarlo en la documentación** (el sitio es una página que se arma en el navegador y no
  la pude leer con `curl`): se documenta como "no verificado".
- La historia no tiene endpoint por rango: es una llamada por casa y se recorta en el cliente.
- CORS abierto (`*`) y sin clave en las dos APIs: se pueden llamar desde el navegador.
- Fecha de hoy en los pasos de verificación: 2026-11-04.

## Series de ArgentinaDatos

Verificadas en vivo el 2026-11-04. Tamaño de la serie completa entre paréntesis.

| serie | camino | se incluye |
|---|---|---|
| inflación mensual | `/finanzas/indices/inflacion` (53 KB) | sí |
| inflación interanual | `/finanzas/indices/inflacionInteranual` (53 KB) | sí |
| riesgo país, último | `/finanzas/indices/riesgo-pais/ultimo` | sí |
| riesgo país, serie | `/finanzas/indices/riesgo-pais` (413 KB, desde 1999) | sí |
| UVA | `/finanzas/indices/uva` (215 KB, desde 2016-03-31) | sí: sirve para comparar contra el dólar |
| plazo fijo | `/finanzas/tasas/plazoFijo` (21 KB) | sí |
| feriados | `/feriados/{año}` | sí |
| otras monedas | `/cotizaciones/{moneda}` (EUR: 137 KB, desde 2023-10-22) | sí |

Quedaron afuera las demás series de la documentación (fondos, rendimientos, etc.): no
las pidió el dueño y no sirven para comparar con el dólar.

## Las tres pruebas

### 1 · El fallo observado, textual

Las pruebas se escribieron antes del código, una tanda por comportamiento:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../skills/dolarapi/cotizaciones.ts' imported from .../pruebas/dolarapi.test.mjs
```

Con el mínimo (una llamada sin caché), la tanda de caché cayó:

```
FALLA  6 de 11 casos:
  - dolar(casa): sale de la misma llamada, para cualquier casa: llamadas: esperaba 1 y dio 2
  - caché: dentro de los 15 min no vuelve a llamar; justo a los 15 min sí: a los 15 min menos 1 ms: esperaba 1 y dio 2
  - duplicados: llamadas simultáneas comparten una sola consulta: llamadas: esperaba 1 y dio 3
  - falla de la API con valor guardado: devuelve el último, con su fecha, marcado como viejo: sin red
  - falla con HTTP de error: también devuelve el guardado: HTTP 503 en https://dolarapi.com/v1/dolares
  - falla sin nada guardado: error claro, nunca un número:  el error no dice lo esperado: sin red
```

Tanda de historia, fechas y series:

```
FALLA  12 de 23 casos:
  - historiaDolar: pide sólo la casa pedida, nunca el volcado completo: c.historiaDolar is not a function
  - cotizacionDolarEn: arma /casa/AAAA/MM/DD: c.cotizacionDolarEn is not a function
  - hoyAR: la fecha de Argentina, no la de UTC: c.hoyAR is not a function
  - ultimosDias: el corte es la fecha argentina; incluye el día de corte; no corre días: c.ultimosDias is not a function
  (y 8 más: monedas, historiaMoneda, serie x2, historiaDolar x2, cotizacionDolarEn x2)
```

Tanda de índices y cuentas: `FALLA  20 de 43 casos`, por `is not a function` (brecha, variacion,
promedio, ajustarPorInflacion, pesosADolaresAjustado, formatoARS, fechaAR, fechaCorta, fuente, los
seis índices y feriados).

### 2 · Las mutaciones verificadas

Cada una aplicada sobre `cotizaciones.ts` y revertida (después, 43 de 43 otra vez).

| mutación | qué cayó |
|---|---|
| M1 · `hoyAR` en UTC | 2 de 43 |
| M2 · sin compartir la consulta en vuelo | 1 de 43 |
| M3 · sin devolver el último valor al fallar | 2 de 43 |
| M4 · el caché vence un instante tarde (`<=`) | 8 de 43 |
| M5 · inflación `/ 10` en vez de `/ 100` | 2 de 43 |
| M6 · brecha sin el `- 1` | 1 de 43 |
| M7 · sin chequear `desde > hasta` | 1 de 43 |

⚠️ El primer intento de M6 no se aplicó: el texto también aparece en un comentario y se reemplazó
ahí. Se repitió apuntando a la línea del `return`.

### 3 · Los números de los controles

| control | resultado |
|---|---|
| `node pruebas/check.mjs` | 183 chequeos, sin fallas |
| `node pruebas/check.mjs --self-test` | 40 casos, sin fallas |
| `node pruebas/hook.test.mjs` | 113 casos, sin fallas |
| `node pruebas/instalar.test.mjs` | 17 casos, sin fallas |
| `node pruebas/dolarapi.test.mjs` | 43 casos, sin fallas |

Además, `node instalar.mjs` con un destino de prueba copió `skills/dolarapi` (SKILL.md y
cotizaciones.ts) sin registrar nada.

## Revisión de la skill nueva (`/seguridad-de-skills`)

| chequeo | resultado |
|---|---|
| 1 · lectura | skill propia, 2 archivos escritos acá. Sin comandos para correr |
| 2 · fuente | propia: no hay commit de afuera |
| 3 · privilegios | sin `allowed-tools`, sin enganches |
| 4 · encabezado | parsea (`check.mjs`), el nombre coincide con la carpeta, la descripción dice cuándo NO usarla |
| 5 · instrucciones de afuera | los links son de documentación; nada se lee de afuera al correr |
| 6 · aislamiento | `cotizaciones.ts` sólo hace GET a dos dominios fijos, sin credenciales, con 10 s de tope. Las pruebas no usan red |
| 7 · fijada | se copia tal cual; la regla de no editarla está en el encabezado del archivo y en la skill |
| 8 · revisión | leída entera. `skill-scanner` no corrió (ver abajo) |
| 9 · registro | este rastro |
| 10 · ¿anda acá? | `pruebas/check.mjs` la carga; el instalador la copia sin registrar nada |

El chequeo de "la genérica no nombra tecnología" sólo se le exige a `flujo-loop`.

## Prueba en vivo (2026-11-04, script fuera del repo)

Un script tirable importó `cotizaciones.ts` y llamó una vez cada función contra las APIs reales.
**16 de 16 pasan.** Muestras:

| llamada | resultado |
|---|---|
| `dolares()` | 7 casas; blue 1540/1560, actualizado 2026-11-04T20:55Z |
| `dolar('cripto')` | 1659.63/1667.14 |
| `historiaDolar('blue')` | 5785 días, último 2026-11-04 (venta 1570); `ultimosDias(…, 7)` dio 8 puntos |
| `historiaDolar('solidario')` | 1442 días |
| `cotizacionDolarEn('blue','2024-05-10')` | 1020/1040 |
| `monedas()` | USD EUR BRL CLP UYU |
| `historiaMoneda('EUR')` | 1102 días, desde 2023-10-22 |
| `inflacionMensual()` | 1003 meses, último 2026-09-30 (1.9) |
| `inflacionInteranual()` | 993 meses, último 2026-09-30 (33.4) |
| `riesgoPaisUltimo()` / `riesgoPais()` | 831 al 2026-11-03 / 7737 días |
| `uva()` | 3872 días, último **2026-11-05** (fecha futura) |
| `plazoFijo()` | 33 bancos |
| `feriados(2026)` | 20 |
| `pesosADolaresAjustado(1000, 2025-01, 2025-06, …)` | 0.7216 |

Salió de ahí y quedó en la skill: la inflación llega hasta septiembre (se publica con retraso) y
la UVA trae fechas futuras.

## Seguimientos conocidos

- Cuando llegue la skill de INDEC, decidir si pasa a ser la fuente de la inflación y cambiar
  `inflacionMensual` e `inflacionInteranual` en esta skill.
- Si algún proyecto necesita Ámbito (`/v1/ambito/dolares`) u otro país, sumarlo al archivo de la
  skill.

## Lo que no se pudo verificar

- Qué significa `oficial` en DolarApi según su documentación (ver Supuestos).
- `skill-scanner` no corrió (necesita `uv` o Python).
- Que `cotizaciones.ts` compile con `tsc`: no hay TypeScript instalado. Sí se verificó que Node
  22.23 lo corre quitando los tipos.
- Cómo anda desde un navegador: las cabeceras dicen CORS `*`, pero no se probó desde uno.
- Las revisiones (independiente, seguridad, judgment-day) no corrieron en este paso.
