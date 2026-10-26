# Pantallas, Paso 3 y oferta de /no-entendi

## Reporte en lenguaje llano

**Qué hace este cambio**

Le agrega a flujo-loop seis reglas nuevas. Para las pantallas: una cuarta prueba (el agente usa
cada botón, enlace y campo y anota qué hizo, qué pasó y qué errores salieron) y una lista corta de
accesibilidad y celular. Para el Paso 3: nada de datos inventados en pantalla (si falta el dato
real, un placeholder que diga que lo es), un registro de atajos (cada uno con su límite y cuándo
mejorarlo) y una escalera de "¿hace falta que exista?" con lo que nunca se recorta. Y al final de
cualquier mensaje largo el agente ofrece `/no-entendi` solo. El rastro suma dos secciones
nuevas, y "uso de la pantalla" lleva una línea por cada punto del checklist, aunque todo
cumpla.

**Debe**

Ninguno.

**Conviene**

Ninguno de los hallazgos de la revisión quedó abierto (ver "La revisión de este cambio"). Queda:

1. **Qué es:** el marcador `atajo:` y la marca "sin cuándo" no los verifica ningún control sobre
   el código del proyecto. **El problema:** dependen de que el agente los siga. **El arreglo:**
   un chequeo del `Stop` o un detector de comentarios, si algún día hace falta. **Qué pasa si no
   se arregla:** un atajo puede quedar sin marcar.

**Opcional**

2. **Qué es:** la cuarta prueba no se puede verificar por máquina. **El problema:** el rastro
   dice "usé cada elemento" y sólo el que audita puede creerlo o no. **El arreglo:** pedir
   capturas o grabación cuando el proyecto las permita. **Qué pasa si no se arregla:** queda a
   la honestidad del agente, igual que el resto de las pruebas.

**Veredicto**

Se puede presentar. Es texto, un renglón en el recordatorio y chequeos; no cambia cómo corren los
hooks ni el instalador.

**Lo que no se revisó**

- Que un agente real siga las reglas nuevas en una tarea de pantallas: se ve en el rastro de la
  próxima.
- La revisión independiente la corrió un revisor ciego sobre el primer commit (`3843c97`); sus
  hallazgos se arreglaron en un segundo commit. **El arreglo no se volvió a revisar.**
- Los chequeos de texto verifican que estén las reglas, no que estén bien escritas ni que se
  entiendan; eso es trabajo de la revisión.

## Objetivo

Mejoras 2.3 a 2.8 de `docs/plan-de-mejoras.md`, en un solo cambio (pasos 5 y 6 de la sección 5
del plan: pantallas y Paso 3, juntas).

## Decisiones

Todo viene de `docs/plan-de-mejoras.md`; donde hay duda, gana la sección 6 ("Decidido").

| decisión | por qué |
|---|---|
| 2.3 La cuarta prueba va como subsección de "Si tocás pantallas", y su registro es una sección nueva del rastro, "uso de la pantalla" | Las tres pruebas son de tests: una pantalla puede pasarlas sin que nadie la haya usado |
| 2.4 Checklist propio de ocho puntos (contraste, foco, teclado, estados, zoom, desbordes, botones, navegación); sin script de contraste | Sección 6: sólo checklist, el script sumaría Python y un `ORIGEN.json` |
| El tamaño de los botones dice "el que el proyecto declara", sin número | La skill no declara números (sección "Lo que esta skill NO dice") |
| 2.5 Es una viñeta del Paso 3 | Nada inventado en pantalla ni en datos de ejemplo; si falta el real, un placeholder que lo diga |
| 2.6 Marcador en español: `atajo:` con "qué, límite y cuándo mejorarlo". Sección del rastro "atajos conocidos", sólo si hay. Un atajo sin «cuándo» se marca "sin cuándo" y va al reporte en **Conviene** | El plan pide "se marca" sin decir dónde; elegí rastro + Conviene porque ya existen y no inventan mecanismo nuevo (ver "Lo que no se pudo verificar") |
| 2.7 Escalera de cuatro escalones y lista "nunca se recorta" (validación en los límites, seguridad, accesibilidad, manejo de errores que evita perder datos). Se aclara que el Paso 2 no se negocia | Sección 3 del plan: no se toma la regla de tests de ponytail porque contradice el Paso 2 |
| 2.8 Va en dos lugares: el Paso 5 (junto al reporte llano, sólo en el chat) y el recordatorio del hook, una línea | El agente ve el recordatorio en cada mensaje; el Paso 5 explica el porqué. `/no-entendi` no se puede invocar por el agente (`disable-model-invocation`), por eso lo *ofrece* |
| Los patrones de los chequeos van anclados a su subsección o fila y toleran saltos de línea (`\s+`) | Un patrón suelto sobre toda una sección pasa en vacío si la palabra aparece en otro lado; ya mordió en el cambio anterior |
| README: una frase | Dice que el agente ofrece `/no-entendi` solo |

## La revisión de este cambio

Un revisor ciego, sin ver la conversación, miró el commit `3843c97`: ningún **Debe**. Los seis
hallazgos y qué pasó con cada uno (el 3 lo verificó el padre antes de pasármelo):

| # | grupo | hallazgo | resultado |
|---|---|---|---|
| 1 | Conviene | Un atajo puede ser justo lo que "nunca se recorta" (ej. `atajo: sin validar el campo`) y cumplir la regla de atajos | **Arreglado.** El Paso 3 dice que lo que está en "lo que nunca se recorta" nunca puede ser un atajo: es un hallazgo en **Debe**, no una entrada de "atajos conocidos". Chequeo anclado |
| 2 | Conviene | El checklist no deja rastro cuando no encuentra nada | **Arreglado.** "uso de la pantalla" lleva una línea por cada punto (cumple / no cumple / no lo pude mirar); si el proyecto no declara tamaño de botones, va a "lo que no pude verificar". Chequeos anclados, y la fila del rastro actualizada |
| 3 | Conviene | El Paso 5 decía "el mismo texto" y a la vez sumaba una línea sólo del chat; en el hook la oferta colgaba del punto 5 ("sólo al final") | **Arreglado.** "El mismo texto, más la línea final de `/no-entendi`, que va sólo en el chat" (Paso 5 y fila del rastro). En el hook es un párrafo propio, para cualquier mensaje largo; el test verifica que no cuelgue de un punto numerado ni de la última puerta |
| 4 | Opcional | Un placeholder honesto puede salir sin que nadie lo note | **Arreglado.** Cada placeholder que quede va a "lo que no pude verificar" o al reporte |
| 5 | Opcional | El chequeo decía "sin script de contraste" y no lo verificaba | **Arreglado.** Se le sacó la afirmación al nombre; no se agregó un chequeo negativo |
| 6 | Opcional | Contar los atajos con "cuándo" en "Qué hace este cambio" | **Descartado.** El reporte llano se queda corto y sin jerga; los atajos sin "cuándo" (Conviene) y todo lo de "nunca se recorta" (Debe) ya llegan al reporte, y el resto queda en el rastro a propósito |

## Las tres pruebas

### 1 · El fallo observado, textual

Con los 7 requisitos nuevos en `pruebas/check.mjs` y el caso nuevo del hook, antes de tocar la
skill ni el recordatorio:

```
FALLA  7 de 168 chequeos:
  - flujo-loop: pantallas: la cuarta prueba usa cada elemento y anota acción, resultado y errores de consola — falta no está la sección ### La cuarta prueba
  - flujo-loop: pantallas: el checklist propio cubre accesibilidad y celular, sin script de contraste — falta no está la sección ### Checklist de accesibilidad
  - flujo-loop: el rastro lista el uso de la pantalla y los atajos conocidos (sólo si los hay) — falta /\| \*\*uso de la pantalla\*\* \|[^\n]*elemento por elemento/, /\| \*\*atajos conocidos\*\* \|[^\n]*sólo si hay/
  - flujo-loop: el Paso 3 pide contenido real o un placeholder que diga que lo es — falta /\*\*Contenido real o un placeholder honesto\.\*\*[\s\S]{0,400}testimonios/, /placeholder que diga que lo es/
  - flujo-loop: el Paso 3 marca los atajos con su límite y cuándo mejorarlos, y marca el que no tiene cuándo — falta /\*\*Los atajos se marcan\.\*\*[\s\S]{0,300}`atajo:`/, /límite[\s\S]{0,200}cuándo mejorarlo/, /atajos conocidos/, /atajo sin «cuándo»[\s\S]{0,200}se marca/
  - flujo-loop: el Paso 3 trae la escalera de decisión y lo que nunca se recorta — falta /¿Hace falta que exista\?[\s\S]{0,300}¿Ya existe en el proyecto\?[\s\S]{0,300}plataforma[\s\S]{0,300}lo mínimo/, /Lo que nunca se recorta[\s\S]{0,300}validación en los límites[\s\S]{0,200}seguridad[\s\S]{0,200}accesibilidad[\s\S]{0,200}perder datos/, /Paso 2 no se negocia/
  - flujo-loop: el Paso 5 hace que el agente ofrezca /no-entendi al cerrar un mensaje largo — falta /Ofrecé `\/no-entendi`[\s\S]{0,300}mensaje largo[\s\S]{0,300}sólo en el chat/
FALLA  1 de 26 casos:
  - el recordatorio manda ofrecer /no-entendi al cerrar un mensaje largo: el contexto no manda ofrecer /no-entendi
```

Por ítem: 2.3 y 2.4 = las dos primeras líneas; el rastro de 2.3 y 2.6 = la tercera; 2.5 = la
cuarta; 2.6 = la quinta; 2.7 = la sexta; 2.8 = la séptima y el caso del hook.

Notas de honestidad:

- Tras escribir el texto, tres chequeos siguieron en rojo porque los patrones no toleraban que
  una frase quedara partida en dos renglones (o tenía un "mensaje largo" que mi texto no decía).
  Se corrigieron los patrones para tolerar saltos (`\s+`) y se ajustó una frase de la skill.
  No se aflojó el alcance: siguen anclados a su subsección.
- Los chequeos de las secciones del rastro y de la excepción de atajos nacieron con el texto
  recién escrito en la misma pasada; el fallo pegado arriba es el de antes del texto.

### 2 · La mutación verificada

sha256, 16 primeros caracteres. Restauradas desde una copia fuera del repo, no con `git checkout`.

| qué se rompió | antes / durante / restaurado | qué se cayó |
|---|---|---|
| en la skill, "se marca como "sin cuándo" en el rastro" pasó a "se ignora en el rastro" (primer patrón, el flojo) | `7d15427b2e8179d0` / `74a82b5aafd673d3` / `7d15427b2e8179d0` | sólo el chequeo de atajos (1 de 168) |
| lo mismo, ya con el patrón endurecido: se quitó "y va al reporte en **Conviene**" | `7d15427b2e8179d0` / `29456ba3ea62fa2a` / `7d15427b2e8179d0` | sólo el chequeo de atajos (1 de 168). Antes del endurecimiento esta mutación **no** se habría visto: probé primero "no es una decisión" → "es una decisión" y sobrevivió, por eso anclé el patrón a la regla de verdad |
| en la skill, se sacó "la accesibilidad" de la lista "nunca se recorta" | `7d15427b2e8179d0` / `71961cc264d9d754` / `7d15427b2e8179d0` | sólo el chequeo de la escalera y lo que nunca se recorta (1 de 168) |
| en el hook, "Ofrecé" pasó a "Mencioná" | `5dc66aad56276a66` / `bc265e28bb36471d` / `5dc66aad56276a66` | sólo el caso nuevo del recordatorio (1 de 26) |

(Un primer intento de mutar el hook con un `sed` mal escrito cambió el hash pero no el texto
que importaba, y los tests siguieron en verde: es el falso verde que esta prueba existe para
cazar. Se descartó y se rehizo con el cambio comprobado en la línea 117.)

### 3 · Los números de los controles

| control | resultado |
|---|---|
| `node pruebas/check.mjs` | `OK  168 chequeos, sin fallas.` (161 antes) |
| `node pruebas/check.mjs --self-test` | `OK  40 casos del verificador, sin fallas.` |
| `node pruebas/hook.test.mjs` | `OK  26 casos, sin fallas.` (25 antes) |
| `node pruebas/instalar.test.mjs` | `OK  11 casos, sin fallas.` |

### Segunda pasada: los arreglos de la revisión

RED, con los chequeos ya endurecidos y antes de tocar los textos:

```
FALLA  5 de 168 chequeos:
  - flujo-loop: pantallas: el checklist propio cubre accesibilidad y celular, deja constancia y declara lo no verificable — falta /una\s+línea\s+por\s+cada\s+punto[\s\S]{0,200}cumple[\s\S]{0,40}no\s+cumple[\s\S]{0,40}no\s+lo\s+pude\s+mirar/, /no\s+declara\s+un\s+tamaño[\s\S]{0,200}lo\s+que\s+no\s+pude\s+verificar/
  - flujo-loop: el rastro lista el uso de la pantalla y los atajos conocidos (sólo si los hay) — falta /\| \*\*uso de la pantalla\*\* \|[^\n]*una\s+línea\s+por\s+cada\s+punto\s+del\s+checklist/, /\*\*reporte (en lenguaje )?llano\*\* \|[^\n]*línea de `\/no-entendi`[^\n]*sólo/
  - flujo-loop: el Paso 3 pide contenido real o un placeholder que diga que lo es — falta /\*\*Contenido real o un placeholder honesto\.\*\*[\s\S]{0,700}cada\s+placeholder\s+que\s+quede[\s\S]{0,200}lo\s+que\s+no\s+pude\s+verificar[\s\S]{0,100}reporte/
  - flujo-loop: el Paso 3 marca los atajos con su límite y cuándo mejorarlos, y marca el que no tiene cuándo — falta /\*\*Los atajos se marcan\.\*\*[\s\S]{0,900}nunca\s+puede\s+ser\s+un\s+atajo[\s\S]{0,200}\*\*Debe\*\*[\s\S]{0,100}atajos\s+conocidos/
  - flujo-loop: el Paso 5 hace que el agente ofrezca /no-entendi al cerrar un mensaje largo — falta /cualquier\s+mensaje\s+largo/, /el\s+mismo\s+texto,\s+más\s+la\s+línea\s+final\s+de\s+`\/no-entendi`,\s+que\s+va\s+sólo\s+en\s+el\s+chat/
FALLA  1 de 26 casos:
  - el recordatorio manda ofrecer /no-entendi al cerrar un mensaje largo: la oferta de /no-entendi cuelga de un punto numerado
```

Hallazgo 5 (el nombre del chequeo) no tiene RED: es un nombre, no un patrón.

Mutaciones de esta pasada (sha256, 16 caracteres; restauradas desde una copia fuera del repo). Las tres primeras **no las habría visto** el chequeo de la pasada anterior, porque ninguno de esos patrones existía:

| qué se rompió | antes / durante / restaurado | qué se cayó |
|---|---|---|
| en la skill, "es un hallazgo en **Debe**" pasó a **Opcional** (hallazgo 1) | `f4478ae450008457` / `b97237b7c378204c` / `f4478ae450008457` | sólo el chequeo de atajos (1 de 168) |
| en la skill, "Si el proyecto no declara un tamaño" pasó a "declara" (hallazgo 2) | `f4478ae450008457` / `8b48b76dfa7e7c9d` / `f4478ae450008457` | sólo el chequeo del checklist (1 de 168) |
| en el hook, "cualquier mensaje largo" pasó a "un mensaje largo" (hallazgo 3) | `9611ccdd1e664051` / `b5f8d5f7dbd3a0af` / `9611ccdd1e664051` | sólo el caso del recordatorio (1 de 26) |
| en el hook, el párrafo de la oferta pasó a empezar con "6. " (hallazgo 3, el punto numerado) | `9611ccdd1e664051` / `c7670ff0a1f4c67a` / `9611ccdd1e664051` | sólo el caso del recordatorio (1 de 26). Un primer intento con `sed` mal escrito cambió el hash sin cambiar el texto y dio verde: se descartó y se rehízo |

Controles al final de esta pasada: `node pruebas/check.mjs` → `OK  168 chequeos, sin fallas.`; `--self-test` → `OK  40 casos del verificador, sin fallas.`; `node pruebas/hook.test.mjs` → `OK  26 casos, sin fallas.`; `node pruebas/instalar.test.mjs` → `OK  11 casos, sin fallas.` (los conteos no cambian: los patrones nuevos entraron en requisitos que ya existían).

## Lo que no se pudo verificar

- Que un agente real use la cuarta prueba o el marcador `atajo:`: los chequeos miran el texto
  de la skill, no el comportamiento.
- **Hueco de decisión (2.6):** el plan dice que un atajo sin "cuándo" "se marca", pero no
  dónde. Elegí el rastro ("sin cuándo") y el reporte (**Conviene**). Si querías otro lugar,
  cambia una frase.
- Que el arreglo de la revisión esté bien: no se volvió a revisar.
- Que `/no-entendi` aparezca de verdad al final de los mensajes largos de un agente: sólo se
  verificó que el recordatorio y el Paso 5 lo pidan.

## Estado

- [x] 2.3 cuarta prueba
- [x] 2.4 checklist
- [x] 2.5 contenido real
- [x] 2.6 atajos
- [x] 2.7 escalera y "nunca se recorta"
- [x] 2.8 ofrecer `/no-entendi`
- [x] Revisión independiente del primer commit; hallazgos 1 a 5 arreglados, 6 descartado
- [ ] Push, PR y merge: no los hago yo
