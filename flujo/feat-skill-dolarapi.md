# Skill dolarapi: cotizaciones iguales en todos los proyectos

## Reporte en lenguaje llano

Pendiente: se completa al cerrar el cambio.

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
- [ ] T2 · `cotizaciones.ts` + `pruebas/dolarapi.test.mjs`
- [ ] T3 · `SKILL.md` + fila en el README + comando de prueba en el README
- [ ] T4 · prueba en vivo (un script fuera del repo)
- [ ] T5 · todos los controles

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

(se completan durante T2 a T5)

## Lo que no se pudo verificar

- Qué significa `oficial` en DolarApi según su documentación (ver Supuestos).
