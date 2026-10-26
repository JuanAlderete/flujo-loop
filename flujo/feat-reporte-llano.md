# Reporte final en lenguaje llano

## Reporte en lenguaje llano

**Qué hace este cambio**

Ahora, cuando el agente termina un trabajo, tiene que explicarte el resultado en palabras
comunes: qué cambió, qué problemas encontró, qué conviene arreglar y qué no revisó. Ese mismo
texto es la primera parte del archivo de rastro y también el último mensaje que ves en el chat.
Los hallazgos vienen numerados, así que alcanza con contestar "arreglá el 2 y el 5".

**Debe**

Ninguno.

**Conviene**

1. **Qué es:** las reglas nuevas viven sólo como texto en la skill y en el recordatorio del hook.
   **El problema:** nada obliga todavía al agente a escribir ese reporte; depende de que lo
   siga. **El arreglo:** que el hook que corta el "listo" revise que el rastro tenga el
   encabezado del reporte (es otra mejora ya decidida, viene en un cambio aparte).
   **Qué pasa si no se arregla:** un agente distraído puede cerrar sin reporte y nadie se entera
   hasta auditar.

**Opcional**

2. **Qué es:** los chequeos verifican que el texto nombre cada parte del reporte, no que esté
   bien escrito. **El problema:** una redacción confusa pasaría igual. **El arreglo:** la
   revisión independiente (otra mejora ya decidida) es quien juzga el contenido.
   **Qué pasa si no se arregla:** el reporte puede existir y ser poco claro.

**Veredicto**

Se puede presentar. Es un cambio sólo de texto y de chequeos; no toca cómo funcionan los hooks
ni nada que corra con datos reales.

**Lo que no se revisó**

- Que un agente real escriba el reporte bien al terminar una tarea: se ve en el rastro de la
  próxima tarea que lo use.
- El límite de vueltas de arreglar y revisar: es un cambio posterior y acá no se implementó.

## Objetivo

Mejora 2.1 de `docs/plan-de-mejoras.md`: que quien audita sin leer código reciba, al cierre del
Paso 5, un reporte en lenguaje llano, y que ese reporte sea la primera sección del rastro y el
mensaje final del agente en el chat.

## Decisiones

Todas vienen de `docs/plan-de-mejoras.md`, sección 6 ("Decidido"), que gana sobre lo anterior.

| decisión | por qué |
|---|---|
| El reporte se **suma** como primera sección del rastro; no reemplaza nada | Quien no programa lee el chat, no el rastro; quien sí lee código necesita la evidencia que el rastro ya tiene (sección 6) |
| Es el mismo texto en el rastro y en el mensaje final del chat | Dos versiones del mismo relato se separan; una sola no puede |
| Un hallazgo que no se pudo resolver va en "Debe", marcado "no se pudo resolver" | Lo decide la persona, no el agente (sección 6). El límite de vueltas en sí queda para otro cambio |
| Se tocó el recordatorio del hook, con dos líneas | Se inyecta en cada mensaje: si no nombra el reporte, la persona nunca se entera de que existe |
| Dos requisitos nuevos en `REQUISITOS` (`faltantes()`), acotados a la sección | Estructural: que estén las partes, no la prosa exacta. El segundo exige que la fila del reporte sea la primera de la tabla del rastro |
| No se tocó el README | No describe lo que la persona recibe al final de una tarea, sólo el contenido del rastro |

## Las tres pruebas

### 1 · El fallo observado, textual

Antes de tocar `SKILL.md` ni `hook.mjs` (los dos requisitos y el caso del hook ya agregados):

```
FALLA  2 de 149 chequeos:
  - flujo-loop: el Paso 5 cierra con el reporte en lenguaje llano, que es también el mensaje final — falta /reporte (en lenguaje )?llano/i, /Qué hace este cambio/, /Debe/, /Conviene/, /Opcional/, /numerad/i, /qué pasa si no se arregla/i, /veredicto/i, /Lo que no se revis/i, /mensaje final[\s\S]{0,200}chat|chat[\s\S]{0,200}mensaje final/
  - flujo-loop: el rastro lista el reporte llano como su primera sección — falta /\|---\|---\|\r?\n\| \*\*reporte (en lenguaje )?llano\*\*/i
```

```
FALLA  1 de 25 casos:
  - el recordatorio dice que el rastro abre con el reporte llano, también como mensaje final: el contexto no nombra el reporte en lenguaje llano
```

Nota de honestidad: la primera versión de los patrones `Debe`, `Conviene` y `Opcional` quedó
mal escrita (un carácter de control en lugar de `\b`) y, después de escribir el texto, dos de
sus chequeos siguieron en rojo por eso y por un salto de línea; se corrigieron los patrones, no
el texto. El mensaje de arriba es el de la primera corrida, con los patrones ya escritos como
se esperaba.

### 2 · La mutación verificada

| qué se rompió | hash antes / durante / restaurado | qué se cayó |
|---|---|---|
| en `SKILL.md`, "**Lo que no se revisó**" pasó a "**Lo que quedó afuera**" | `290713ad12da6fc9` / `1b5ff23616daae37` / `290713ad12da6fc9` | sólo "flujo-loop: el Paso 5 cierra con el reporte en lenguaje llano…", y sólo el patrón `/Lo que no se revis/i` (1 de 149) |

Hash = 16 primeros caracteres de sha256. Restaurado desde una copia en `/tmp`, no con
`git checkout`; la suite volvió a verde.

### 3 · Los números de los controles

| control | resultado |
|---|---|
| `node pruebas/check.mjs` | `OK  149 chequeos, sin fallas.` (147 antes) |
| `node pruebas/check.mjs --self-test` | `OK  40 casos del verificador, sin fallas.` |
| `node pruebas/hook.test.mjs` | `OK  25 casos, sin fallas.` (24 antes) |
| `node pruebas/instalar.test.mjs` | `OK  11 casos, sin fallas.` |

## Lo que NO se pudo verificar

- **Que un agente real escriba el reporte al terminar.** Se verifica que el texto lo pida, no
  que el agente lo cumpla; nada lo obliga todavía (ver el hallazgo 1).
- **Que el reporte sea comprensible para quien no programa.** Los chequeos miran estructura, no
  claridad.
- **Mutaciones del resto de los patrones.** Se rompió una parte; no se rompió cada una por
  separado.

## Estado

- [x] Chequeos nuevos en `pruebas/check.mjs` y caso nuevo en `pruebas/hook.test.mjs`.
- [x] Paso 5 y sección "El rastro" de `SKILL.md`.
- [x] Recordatorio del hook.
- [ ] Pendientes en otros cambios: el `Stop` que revisa encabezados, la revisión independiente y el límite de vueltas.
