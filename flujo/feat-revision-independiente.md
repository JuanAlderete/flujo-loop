# Revisión independiente de corrección

## Reporte en lenguaje llano

**Qué hace este cambio**

Suma una skill nueva, `/revision-independiente`. Antes de presentar un cambio, otro revisor que
no vio cómo se hizo (un subagente nuevo, con acceso de lectura al repositorio) lo mira buscando
qué se rompe o da un resultado incorrecto. Si el cambio toca plata, datos o permisos, se suma un
segundo revisor que tampoco ve lo que dijo el primero. Lo que encuentran entra al reporte llano,
ordenado en Debe, Conviene y Opcional. Sólo se saltea con documentación pura (un `.md` de
explicación, comentarios); las skills, los prompts, las plantillas y el texto de pantalla no
cuentan como documentación, y en la duda se corre. Cuando se saltea, el reporte lo dice en
"Lo que no se revisó".

**Debe**

Ninguno. (La revisión independiente de este cambio encontró uno, que ya se arregló: ver la
sección "La revisión de este cambio".)

**Conviene**

1. **Qué es:** nada obliga todavía al agente a lanzar la revisión. **El problema:** depende de
   que siga el texto del Paso 5 y el recordatorio. **El arreglo:** que el hook que corta el
   "listo" revise que el rastro mencione la revisión o su omisión (mejora ya decidida, en otro
   cambio). **Qué pasa si no se arregla:** un agente distraído puede presentar sin revisión.

**Opcional**

2. **Qué es:** el límite de vueltas de arreglar y revisar no está. **El problema:** el paso
   "arreglar" no tiene tope. **El arreglo:** el cambio ya decidido del límite de 2 vueltas.
   **Qué pasa si no se arregla:** un hallazgo que persiste puede dar vueltas.

**Veredicto**

Se puede presentar. Es texto y chequeos; no cambia cómo corren los hooks ni el instalador.

**Lo que no se revisó**

- Que un agente real lance de verdad un subagente ciego: se ve en el rastro de la próxima tarea.
- Si la skill detecta bien errores reales: no se corrió sobre un cambio con defectos conocidos.
- La revisión independiente **sí se corrió** sobre este cambio (lo tocan una skill, un prompt y
  chequeos: no es documentación pura). Fue un solo revisor ciego; no tocó plata ni datos.
  Lo que dijo está abajo, hallazgo por hallazgo. No se volvió a revisar el arreglo.

## Objetivo

Mejora 2.2 de `docs/plan-de-mejoras.md`: una skill propia de revisión de corrección, separada de
la de seguridad, que corre en el Paso 5 antes de presentar.

## Decisiones

Vienen de `docs/plan-de-mejoras.md`, sección 6 ("Decidido"), que gana sobre lo anterior.

| decisión | por qué |
|---|---|
| Corre **siempre**, salvo documentación pura (no skills, prompts, plantillas ni texto de pantalla; en la duda se corre), que se anota "revisión no aplicada" en "Lo que no se revisó" | "Sólo en cambios grandes" haría que el agente se juzgue a sí mismo; así, si clasifica mal, el peor caso es un revisor en vez de dos, nunca cero |
| Un revisor en un subagente nuevo que no vio la conversación; segundo revisor ciego si toca plata, datos o permisos | Quien lo escribió lee lo que quiso decir, no lo que quedó |
| El revisor lee también a quienes usan el código tocado | Gana el Paso 3 de flujo-loop sobre la regla de Thermos de mirar sólo el diff (sección 2.2) |
| "Sin un caso concreto no hay hallazgo" y no inflar la prioridad | Viene de ponytail/Thermos; evita ruido que la persona no puede juzgar |
| Tres riesgos nuevos: entorno de desarrollo, fugas detrás de un flag, "lo que se pidió romper no es un hallazgo" | Son los que flujo-loop no nombra |
| No se toma la regla de 1000 líneas, el empuje a abstraer ni el tono duro | Sección 3 del plan |
| Sin tope de vueltas, sin chequeo del `Stop`, sin guardrail de producción | Son cambios posteriores ya decididos |
| La skill no nombra herramientas concretas ("subagente nuevo / otra sesión del agente") | Tiene que servir igual en Claude Code y OpenCode |
| Nombre `revision-independiente`; el instalador copia toda carpeta de `skills/`, no hizo falta tocarlo | Mismo estilo que `seguridad-de-skills` y `no-entendi` |

## Las tres pruebas

### 1 · El fallo observado, textual

Con los requisitos ya agregados a `pruebas/check.mjs` y antes de crear la skill ni tocar el Paso 5:

```
FALLA  4 de 153 chequeos:
  - flujo-loop: el Paso 5 corre la revisión independiente: siempre, con segundo revisor en plata/datos/permisos, y docs-only se anota — falta /revision-independiente/, /segundo revisor[\s\S]{0,300}(plata|datos|permisos)|(plata|datos|permisos)[\s\S]{0,300}segundo revisor/
  - revision-independiente: falta la carpeta
  - revision-independiente: falta la carpeta
  - revision-independiente: falta la carpeta
```

Para el recordatorio del hook (aserción agregada antes de editarlo):

```
FALLA  1 de 25 casos:
  - el recordatorio nombra el Paso 0, la última puerta y /seguridad-de-skills: el contexto no nombra /revision-independiente
```

Notas de honestidad:

- En esa primera corrida el patrón "docs/documentación/texto cerca de 'revisión no aplicada'"
  estaba mal escrito (alternancia sin paréntesis) y pasaba solo con "documentación"; se
  corrigieron los patrones y se volvió a correr antes de escribir el texto. El mensaje
  pegado arriba es el de esa primera corrida (dos patrones del Paso 5); la corrida ya corregida
  también dio 4 de 153 y listaba además el patrón de docs.
- Después de crear la skill, dos chequeos siguieron en rojo por saltos de línea y negritas dentro
  de la frase buscada; se reacomodó el texto, no los patrones. El patrón `\b` quedó mal escrito
  (carácter de control) por mi script de edición y se corrigió dos veces.
- El caso del instalador (`revision-independiente` en la lista de skills copiadas) no tuvo fallo
  previo: el instalador ya copiaba toda carpeta, así que ese caso nace verde y sólo protege.

### 2 · La mutación verificada

| qué se rompió | hash antes / durante / restaurado | qué se cayó |
|---|---|---|
| en la skill nueva, "Sin un caso concreto no hay hallazgo" pasó a "Con una sospecha alcanza" | `be6ce039bc8fbb65` / `7a1e89be85090bb9` / `be6ce039bc8fbb65` | sólo "revision-independiente: exige caso concreto…", patrón `/sin un caso concreto no hay hallazgo/i` (1 de 159) |

Hash = 16 primeros caracteres de sha256. Restaurado desde una copia fuera del repo, no con
`git checkout`; la suite volvió a verde.

### 3 · Los números de los controles

| control | resultado |
|---|---|
| `node pruebas/check.mjs` | `OK  159 chequeos, sin fallas.` (149 antes) |
| `node pruebas/check.mjs --self-test` | `OK  40 casos del verificador, sin fallas.` |
| `node pruebas/hook.test.mjs` | `OK  25 casos, sin fallas.` |
| `node pruebas/instalar.test.mjs` | `OK  11 casos, sin fallas.` |

### Segunda pasada: los arreglos de la revisión

RED, con los chequeos ya endurecidos y antes de tocar los textos:

```
FALLA  4 de 161 chequeos:
  - flujo-loop: el Paso 5 limita la excepción a la documentación pura y la anota en "Lo que no se revisó" — falta /En la duda, se corre/, /skills[\s\S]{0,300}no son documentación|…/, /Lo que no se revisó\*\*:[\s\S]{0,400}revisión no aplicada: cambio de sólo docs/
  - revision-independiente: corre siempre; la excepción es sólo documentación pura, y en la duda se corre — falta /En la duda, se corre/, …
  - revision-independiente: el revisor es nuevo, no vio la conversación y puede leer el repo; el segundo es ciego — falta /acceso de lectura al repositorio/, /En la duda, dos/, …, /unificá/, …
  - revision-independiente: entrega hallazgos … — falta /descart[\s\S]{0,300}rastro|rastro[\s\S]{0,300}descart/
FALLA  1 de 25 casos:
  - el recordatorio nombra el Paso 0, la última puerta y /seguridad-de-skills: el contexto no nombra el segundo revisor (plata, datos o permisos)
```

Mutaciones de esta pasada (sha256, 16 caracteres; restauradas desde copia, no con `git checkout`):

| qué se rompió | antes / durante / restaurado | qué se cayó |
|---|---|---|
| en `flujo-loop/SKILL.md`, "Corre **siempre**" pasó a "Corre a veces" | `e9b032a2424d6977` / `eadfacc3811df767` / `e9b032a2424d6977` | sólo el chequeo del Paso 5 anclado a "Corre **siempre**" (1 de 161). El patrón viejo `/siempre/i` **no** lo habría visto: sobre el texto mutado da `true`, porque "Se reporta siempre" vive en el mismo Paso 5 |
| en la skill nueva, "En la duda, dos." pasó a "En la duda, uno." | `d70b7b503a84c09a` / `e36ca0da0fdc4e96` / `d70b7b503a84c09a` | sólo "revision-independiente: el revisor es nuevo…" (1 de 161) |

Controles al final de esta pasada:

| control | resultado |
|---|---|
| `node pruebas/check.mjs` | `OK  161 chequeos, sin fallas.` |
| `node pruebas/check.mjs --self-test` | `OK  40 casos del verificador, sin fallas.` |
| `node pruebas/hook.test.mjs` | `OK  25 casos, sin fallas.` |
| `node pruebas/instalar.test.mjs` | `OK  11 casos, sin fallas.` |

## La revisión de este cambio

Un revisor ciego (sin la conversación) revisó el commit 42eb8b0. Siete hallazgos, ninguno descartado:

| # | grupo | hallazgo | qué se hizo |
|---|---|---|---|
| 1 | Debe | La excepción "sólo documentación o texto" dejaba saltear la revisión en skills, prompts, reglas del agente, texto de pantalla, mensajes y mails | Arreglado: la excepción es documentación pura que nada lee como instrucción; se sacó "o texto"; se nombra qué no es documentación; "en la duda, se corre" (skill y Paso 5). Este cambio no es sólo docs: la revisión corrió |
| 2 | Conviene | El chequeo de "siempre" en el Paso 5 era vacuo (`/siempre/i` pega en "Se reporta siempre") | Arreglado: anclado a `/revision-independiente` cerca de "Corre **siempre**" y, en la skill, a la sección "Cuándo corre". Mutación arriba |
| 3 | Conviene | Patrones vagos (`usan\|llaman`, `prioridad`, `flag`, docs/texto) | Arreglado: exigen las frases reales ("a quienes usan el código tocado", "No inflar la prioridad", "detrás de un flag", "lo que se pidió romper no es un hallazgo", "sólo docs") |
| 4 | Conviene | "Datos" sin definir para el segundo revisor | Arreglado: ejemplos (escrituras a la base, migraciones, consultas por usuario o empresa, roles y permisos, importes) y "en la duda, dos" |
| 5 | Conviene | El recordatorio del hook decía "siempre" sin excepción ni segundo revisor | Arreglado: un revisor; dos si toca plata, datos o permisos; sólo docs se anota. Aserciones nuevas en `hook.test.mjs` |
| 6 | Opcional | Los hallazgos descartados no quedaban en el rastro | Arreglado: skill y Paso 5 piden anotar cada descartado con su motivo |
| 7 | Opcional | Faltaba cómo se juntan dos revisores, y dónde va "revisión no aplicada" | Arreglado: unificar repetidos, marcar contradictorios para la persona; la frase va en "Lo que no se revisó" |

Además: el revisor recibe el cambio, lo pedido y acceso de lectura al repositorio ("el cambio" no
es sólo el diff). Quedó escrito en la skill y con un chequeo.

## Lo que NO se pudo verificar

- **Que un agente real lance el subagente ciego.** Se verifica que el texto lo pida.
- **Que la revisión encuentre errores reales.** No se corrió sobre un cambio con defectos.
- **Mutaciones del resto de los patrones.** Se rompió una parte; no cada una por separado.
- **Que la skill sea clara para quien no programa.** Los chequeos miran estructura.

## Estado

- [x] Requisitos en `pruebas/check.mjs`, aserción en `pruebas/hook.test.mjs`, lista en `pruebas/instalar.test.mjs`.
- [x] Skill `revision-independiente`.
- [x] Paso 5 de `flujo-loop`, recordatorio del hook, README.
- [ ] Pendientes en otros cambios: límite de vueltas, `Stop` que revisa encabezados, guardrail de producción.
