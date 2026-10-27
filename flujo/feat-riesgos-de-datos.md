# Tres riesgos de datos en la revisión independiente

## Reporte en lenguaje llano

**Qué hace este cambio**

La revisión independiente ya le pedía al revisor nombrar tres riesgos que el resto del flujo no
mira. Ahora son siete: se suman cuatro de datos, agrupados bajo "en los datos" (los ejemplos son
de PostgreSQL; en otro motor se busca el equivalente). Tras la revisión de dos revisores ciegos,
las reglas dicen además: el sistema tiene que rechazar el duplicado por esa clave; `EXPLAIN
ANALYZE` también escribe con un `SELECT` que llama a una función con efectos, y el `ROLLBACK`
no deshace secuencias ni llamadas externas; `CREATE INDEX CONCURRENTLY` no puede ir dentro de
una transacción y, si falla, deja un índice INVALID; y `VACUUM FULL` es aparte.
Las tres originales de datos: Uno: reintentar una escritura (un cobro, un pedido,
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

1. **Qué es:** `docs/plan-de-mejoras.md` (líneas 77-80) todavía cita la lista original de tres.
   **El problema:** es un documento histórico del plan. **El arreglo:** ninguno; no se tocó.
   **Qué pasa si no se arregla:** nada.

**Veredicto**

Se puede presentar. La ronda 1 de arreglos no se volvió a revisar con revisores ciegos.

**Lo que no se revisó**

- Que un revisor real nombre estos riesgos: los chequeos miran el texto.

## Objetivo

Sumar a `revision-independiente` tres riesgos de datos que salieron de revisar cuatro skills
externas de wshobson/agents: `error-handling-patterns` reintentaba sin idempotencia, y
`sql-optimization-patterns` recomendaba `VACUUM FULL`, `REINDEX` y `CREATE INDEX` sin
`CONCURRENTLY` como rutina y presentaba `EXPLAIN ANALYZE` como lectura. El dueño eligió escribir
reglas propias en vez de incorporar esas skills.

## Decisiones

- **Ronda 1: los datos van agrupados** bajo una viñeta "en los datos (los ejemplos son de
  PostgreSQL; en otro motor, buscá el equivalente)", sin repetir el prefijo en cada una.
- **Siete, no seis:** partí la viñeta de índices y mantenimiento en dos (índices; `VACUUM FULL`)
  para que cada una quepa en unas tres líneas. El encabezado dice "siete" y cuenta las viñetas
  hoja (3 + 4).
- **Reescribí la viñeta "y al revés, lo que se pidió romper"** como "lo que se pidió romper",
  porque ya no es la última de la lista y el "y al revés" quedaba colgado. Mismo contenido.
- **README no cambia:** describe la skill en una línea y no la lista de riesgos.
- **No se tocó `docs/plan-de-mejoras.md`:** es historia del plan original.

## Las tres pruebas

### 1 · El fallo observado, textual

Ronda 0: requisito agregado antes de tocar el texto (patrones con `CERCA`):

```
FALLA  1 de 172 chequeos:
  - revision-independiente: nombra los tres riesgos de datos (...) — falta /Nombrar seis riesgos/,
    /reintent[\s\S]{0,300}misma clave|.../, /EXPLAIN ANALYZE[\s\S]{0,300}ROLLBACK|.../, ...
```

Ronda 1: los revisores mostraron que ese requisito seguía en verde con la regla **invertida**
("tiene que llevar una clave nueva, no la misma", "es mantenimiento de rutina", "es una
lectura", etc.): `CERCA` sólo mira que dos palabras estén cerca, no la polaridad. Se reemplazó
por frases enteras (`FRASE`, que tolera saltos de línea) y se escribió antes del texto:

```
FALLA  1 de 172 chequeos:
  - revision-independiente: nombra siete riesgos, tres de ellos de datos, con la polaridad de cada regla anclada a la frase entera — falta /Nombrar\s+siete\s+riesgos/, /en\s+otro\s+motor,\s+buscá\s+el\s+equivalente/, /lleva\s+la\s+\*\*misma\s+clave\s+de\s+idempotencia\*\*\s+que\s+el\s+primero/, /rechazar\s+el\s+duplicado\s+por\s+esa\s+clave/, /un\s+`SELECT`\s+que\s+llama\s+a\s+una\s+función\s+con\s+efectos/, /no\s+deshace\s+secuencias\s+ni\s+llamadas\s+externas/, /sin\s+`CONCURRENTLY`\*\*\s+en\s+una\s+tabla\s+en\s+uso\s+bloquea\s+las\s+escrituras,\s+no\s+las\s+lecturas/, /`CREATE\s+INDEX ...
```

Tras editar `SKILL.md`: primero `FALLA 1 de 172` por un patrón mío mal escrito ("escribe de
verdad" en minúscula, y el texto dice "Escribe de verdad" al inicio de oración); se corrigió el
patrón, no el texto, y quedó `OK  172 chequeos, sin fallas.`

### 2 · Las mutaciones verificadas

Hash = 12 primeros caracteres de sha256 de `SKILL.md`; original y restaurado: `1e545d2f46ff`.
Todas cayeron con "FALLA 1 de 172".

| qué se invirtió o rompió | hash durante |
|---|---|
| "lleva la misma clave de idempotencia" pasó a "lleva una clave nueva, no la misma" | `5c89a1e10de9` |
| "se aplica dos veces" pasó a "se aplica una vez" | `f0035e966e42` |
| "la operación" pasó a "la misma operación" (rompe "con una clave nueva la operación se aplica dos veces") | `b66179a4816c` |
| "rechazar el duplicado por esa clave" pasó a "aceptar el duplicado" | `aa4be79ff6d1` |
| "no es una lectura" pasó a "es una lectura" | `177986c50ae8` |
| "Escribe de verdad con un" pasó a "No escribe de verdad con un" | `29937876e85c` |
| "que no deshace secuencias" pasó a "que deshace secuencias" | `0bb28b3853a3` |
| "dentro de `BEGIN" pasó a "fuera de `BEGIN" | `9f27e3458d21` |
| "y nunca" pasó a "y siempre" (contra producción) | `e9759074e61f` |
| "crear un índice sin `CONCURRENTLY`" pasó a "con `CONCURRENTLY`" | `a82f6a52d164` |
| "no puede ir dentro de una transacción" pasó a "puede ir…" | `7829a7cbc140` |
| "no es mantenimiento de rutina" pasó a "es mantenimiento de rutina" | `e5f20451af53` |

Cuatro intentos no se aplicaron (el texto buscado partía la línea, o el argumento llegó con la
codificación rota): el `assert` del script los cortó antes de correr el check, y se rehicieron
con fragmentos de una sola línea.

Ronda 0 (SKILL de 6 riesgos, ya superada): sus mutaciones eran cambios de palabra, no
inversiones; por eso la ronda 1.

### 3 · Los controles

- `node pruebas/check.mjs`: OK 172 chequeos.
- `node pruebas/check.mjs --self-test`: OK 40 casos.
- `node pruebas/hook.test.mjs`: OK 113 casos.
- `node pruebas/instalar.test.mjs`: OK 11 casos.

## Lo que no se pudo verificar

- Que un agente revisor realmente nombre estos riesgos al revisar: los chequeos miran el texto.
- Que el patrón `CERCA` no coincida por casualidad con otra parte del ítem: se probó por
  mutación de cada frase, no exhaustivamente.

## La revisión de este cambio

Dos revisores ciegos sobre 3150fc7. Ronda 1 de arreglos (de máximo 2):

- **Debe, arreglado:** los riesgos de datos pasaron a un grupo "en los datos" con la aclaración
  de que los ejemplos son de PostgreSQL. Y la viñeta de índices omitía que
  `CREATE INDEX CONCURRENTLY` no puede ir dentro de una transacción (casi toda herramienta de
  migraciones envuelve cada una en una) y que un fallo deja un índice INVALID; ahora lo dice,
  junto con "bloquea las escrituras, no las lecturas", `REINDEX … CONCURRENTLY` desde
  PostgreSQL 12, y que `VACUUM FULL` bloquea lecturas y escrituras y reescribe la tabla.
- **Conviene, arreglado:** `EXPLAIN ANALYZE` también escribe con un `SELECT` que llama a una
  función con efectos, y el `ROLLBACK` no deshace secuencias ni llamadas externas; la
  idempotencia exige que el sistema rechace el duplicado por esa clave.
- **Conviene, arreglado:** el chequeo seguía en verde con la regla invertida (siete inversiones
  probadas por un revisor); ahora ancla frases enteras con su polaridad (ver pruebas).
- **Descartado, con motivo:** `docs/plan-de-mejoras.md:77-80` sigue listando tres riesgos. Es un
  documento histórico del plan original, no la skill; reescribirlo falsearía la historia.

La ronda 1 no se volvió a revisar con revisores ciegos.
