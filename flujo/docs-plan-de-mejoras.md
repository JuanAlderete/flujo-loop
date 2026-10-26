# El plan de mejoras, con lo decidido

## Objetivo

Dejar en `main` el plan de mejoras (`docs/plan-de-mejoras.md`) con las decisiones del
`/grilling` del 2026-10-26, para que cada pasada que siga parta de ahí y no de la memoria
de una conversación.

## Qué cambió

- **Sección 0**: el merge de la rama de seguridad ya está hecho (PR #1, `c1cfbce`).
- **Sección 5**: el paso 1 tachado, y cómo se entrega: un PR por paso, con el OK del dueño
  antes de cada merge.
- **Sección 6**: las preguntas abiertas pasan a ser una tabla de decisiones con su porqué.
  Donde contradice a las secciones de arriba, gana la sección 6.

## Las tres pruebas

### 1 · El fallo observado, textual

No aplica: es un cambio de sólo documentación, sin código ni comportamiento nuevo que
pueda fallar.

### 2 · La mutación confirmada

No aplica, por lo mismo.

### 3 · Los números de cada control

Corridos el 2026-10-26 sobre esta rama, ya mezclada con `main`:

| control | resultado |
|---|---|
| `node pruebas/check.mjs` | 142 chequeos, sin fallas |
| `node pruebas/check.mjs --self-test` | 35 casos, sin fallas |
| `node pruebas/hook.test.mjs` | 23 casos, sin fallas |
| `node pruebas/instalar.test.mjs` | 11 casos, sin fallas |

## Lo que no se pudo verificar

- Las referencias `archivo:línea` del plan se tomaron de la rama de seguridad antes de su
  merge. Se verificó que entre esa rama y `main` (`c1cfbce`) el único cambio es el final del
  `README.md`, así que las líneas citadas siguen valiendo. No se re-leyó cada cita una por una.
