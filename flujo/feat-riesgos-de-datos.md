# Tres riesgos de datos en la revisión independiente

## Reporte en lenguaje llano

**Qué hace este cambio**

La revisión independiente ya le pedía al revisor nombrar tres riesgos que el resto del flujo no
mira. Ahora son seis: se suman tres de datos. Uno: reintentar una escritura (un cobro, un pedido,
lo que mueva plata o stock) con una clave nueva la aplica dos veces; el reintento lleva la misma
clave. Dos: `EXPLAIN ANALYZE` ejecuta la consulta, así que sobre un `UPDATE`/`DELETE`/`INSERT`
escribe; va dentro de `BEGIN … ROLLBACK` y nunca contra producción sin autorización. Tres: crear
o reconstruir un índice en una tabla en uso va con `CONCURRENTLY`, y `VACUUM FULL` bloquea la
tabla y no es mantenimiento de rutina. Las reglas son genéricas, no atadas a un proyecto.

**Debe**

Ninguno.

**Conviene**

Ninguno.

**Opcional**

1. **Qué es:** `docs/plan-de-mejoras.md` (línea 78) todavía cita la lista original de tres.
   **El problema:** es un documento histórico del plan. **El arreglo:** ninguno; no se tocó.
   **Qué pasa si no se arregla:** nada.

**Veredicto**

Se puede presentar, sujeto a la revisión pendiente (ver "La revisión de este cambio").

**Lo que no se revisó**

- Que un revisor real nombre estos riesgos: los chequeos miran el texto.

## Objetivo

Sumar a `revision-independiente` tres riesgos de datos que salieron de revisar cuatro skills
externas de wshobson/agents: `error-handling-patterns` reintentaba sin idempotencia, y
`sql-optimization-patterns` recomendaba `VACUUM FULL`, `REINDEX` y `CREATE INDEX` sin
`CONCURRENTLY` como rutina y presentaba `EXPLAIN ANALYZE` como lectura. El dueño eligió escribir
reglas propias en vez de incorporar esas skills.

## Decisiones

- **Lista plana de seis**, no un subtítulo "datos": el ítem sigue siendo una lista corta y cada
  viñeta nueva empieza con "en los datos," para que se lea el grupo sin otro nivel.
- **El encabezado dice "seis"** para que el conteo siga siendo verdad.
- **Reescribí la viñeta "y al revés, lo que se pidió romper"** como "lo que se pidió romper",
  porque ya no es la última de la lista y el "y al revés" quedaba colgado. Mismo contenido.
- **README no cambia:** describe la skill en una línea y no la lista de riesgos.
- **No se tocó `docs/plan-de-mejoras.md`:** es historia del plan original.

## Las tres pruebas

### 1 · El fallo observado, textual

Requisito agregado a `pruebas/check.mjs` antes de tocar el texto, anclado con `CERCA` al ítem
(`desde: '## Qué le pedís al revisor'`, `hasta: '## Qué devuelve'`):

```
FALLA  1 de 172 chequeos:
  - revision-independiente: nombra los tres riesgos de datos (...) — falta /Nombrar seis riesgos/,
    /reintent[\s\S]{0,300}misma clave|.../, /clave[\s\S]{0,300}dos veces|.../,
    /EXPLAIN ANALYZE[\s\S]{0,300}ROLLBACK|.../, /EXPLAIN ANALYZE[\s\S]{0,300}producción|.../,
    /CONCURRENTLY[\s\S]{0,200}[íi]ndice|.../, /VACUUM FULL[\s\S]{0,200}rutina|.../
```

Tras editar `SKILL.md`: `OK  172 chequeos, sin fallas.`

### 2 · Las mutaciones verificadas

Hash = 16 primeros caracteres de sha256 de `SKILL.md`. Original y restaurado: `27ad8330026fa946`.

| qué se rompió | hash durante | qué se cayó |
|---|---|---|
| "Nombrar seis" pasó a "Nombrar tres" | `6350d00b8c2a981d` | el requisito (1 de 172) |
| "misma clave" pasó a "mismo código" | `42609e146a36e851` | el requisito (1 de 172) |
| "se aplica dos veces" pasó a "se aplica bien" | `3d86570d0a92778a` | el requisito (1 de 172) |
| "dentro de `BEGIN … ROLLBACK`" pasó a "una transacción" | `ae8dc21f3b010cbb` | el requisito (1 de 172) |
| "contra producción sin autorización" pasó a "contra nada…" | `f1035e819a9fcd82` | el requisito (1 de 172) |
| "va con `CONCURRENTLY`" pasó a "va con cuidado" | `cde740ae329e8987` | el requisito (1 de 172) |
| "no es mantenimiento de rutina" pasó a "es mantenimiento normal" | `b5d580af7ab1dd49` | el requisito (1 de 172) |

Un primer intento de la mutación de producción no se aplicó (el texto de búsqueda partía la
línea y no coincidía; el hash no cambió y daba verde): se descartó y se rehízo con una frase de
una sola línea.

### 3 · Los controles

- `node pruebas/check.mjs`: OK 172 chequeos (base 171 + 1).
- `node pruebas/check.mjs --self-test`: OK 40 casos.
- `node pruebas/hook.test.mjs`: OK 113 casos.
- `node pruebas/instalar.test.mjs`: OK 11 casos.

## Lo que no se pudo verificar

- Que un agente revisor realmente nombre estos riesgos al revisar: los chequeos miran el texto.
- Que el patrón `CERCA` no coincida por casualidad con otra parte del ítem: se probó por
  mutación de cada frase, no exhaustivamente.

## La revisión de este cambio

Pendiente. No se hizo revisión independiente de este cambio.
