# Los tres puntos débiles grandes

## Reporte en lenguaje llano

**Qué hace este cambio**

Cierra tres huecos del propio flujo-loop, y una segunda pasada corrige lo que dos revisores
ciegos le encontraron al primer intento (ver "La revisión de este cambio"). Uno: el aviso de "falta el rastro" ahora también salta
si el rastro existe pero está vacío de lo importante, y dice exactamente qué títulos faltan. Dos:
el agente ya no puede correr, sin que el dueño lo autorice, los cuatro comandos que escriben en
la base de producción (`supabase db push`, `supabase db query --linked`,
`supabase migration repair --linked`, `prisma migrate deploy`); los parecidos que no tocan
producción siguen pasando. Tres: la revisión independiente tiene un tope de 2 vueltas de arreglar
y revisar, y lo que siga sin resolverse va a **Debe** como "no se pudo resolver".

Tras la revisión: el aviso del cierre ya no se equivoca con títulos decorados (`## 📋 …`,
`## 1. …`, `## **…**`, "Decisiones y por qué"), con un BOM, ni se deja engañar por un ejemplo
dentro de un bloque de código; y dice qué líneas exactas agregar. El guardrail de producción ya
no se esquiva con opciones antes del subcomando, `npx prisma@5`, `bash -c "…"`, `$(…)`, o un
comando partido con `\` y salto de línea, y no frena `echo supabase db push`, `--dry-run` ni
`--help`.

**Debe**

Ninguno.

**Conviene**

1. **Qué es:** el plan hablaba de "cuatro encabezados" pero nombraba tres. **El problema:** tuve
   que elegir el cuarto. **El arreglo:** elegí "Decisiones" (la tabla del rastro lo marca como el
   por qué, lo que el cambio solo no muestra); si querías otro, es una línea en `ENCABEZADOS` de
   `hook.mjs` más los casos del test. **Qué pasa si no se arregla:** nada grave; sólo exige un
   título que quizá no era el que pensabas.

**Opcional**

2. **Qué es:** los rastros viejos de esta carpeta (`feat-ultima-puerta-y-seguridad.md`,
   `fix-puntos-debiles-chicos.md`, `docs-plan-de-mejoras.md`) no traen todos los encabezados.
   **El problema:** si alguien los tocara con cambios pendientes, el `Stop` los frenaría.
   **El arreglo:** completarlos si se retoman. **Qué pasa si no se arregla:** nada, hoy son
   historia y no están pendientes.

**Veredicto**

Se puede presentar. La ronda 1 de arreglos no se volvió a revisar con revisores ciegos (ver
"La revisión de este cambio").

**Lo que no se revisó**

- La ronda 1 de arreglos no pasó por un revisor nuevo.
- Que un agente real obedezca el tope de 2 vueltas: los chequeos miran el texto.

## Objetivo

Los puntos débiles 1 (Stop acepta un rastro vacío), 6 (el guardrail no frena producción) y 7 (sin
límite de vueltas), con lo decidido en la sección 6 de `docs/plan-de-mejoras.md`.

## Decisiones

- **Los cuatro encabezados del Stop:** reporte en lenguaje llano, decisiones, las tres pruebas, y
  lo que no se pudo verificar. La sección 6 dice "cuatro" pero enumera tres; sumé "Decisiones" por
  ser el por qué que la tabla del rastro exige. El hook sólo mira la forma, nunca el contenido.
- **Qué cuenta como encabezado:** una línea que empieza con 1 a 6 `#`, cuyo texto (sin tildes, sin
  mayúsculas) es **entero** el título pedido. Así una palabra en prosa, en una lista, o dentro de un
  título más largo ("## Mis decisiones") no cuenta. Tolera el nivel, mayúsculas, tildes y
  "no pude verificar" además de "no se pudo verificar" (es como lo llama la tabla de `SKILL.md`).
- **Falla abierto:** si el rastro existe pero no se puede leer, el `Stop` se calla.
- **Guardrail de producción:** reusa `tramos` (corta por `;`, `&&`, `|`, saltos) y mira las
  palabras sueltas de cada tramo, así `npx`/`bunx` delante, `cd x &&` antes y las opciones en
  cualquier orden no lo esquivan, y una cadena entre comillas no lo dispara. Sólo mira los dos
  primeros argumentos que no son opciones (`db push`, `db query`, `migration repair`,
  `migrate deploy`) y `--linked` en cualquier lugar del tramo. Lista fija, como se decidió.
- **Tope de vueltas:** sección nueva "Cuántas vueltas" en `revision-independiente` y un puntero en
  el Paso 4 del Paso 5 de `flujo-loop`. El "Debe / no se pudo resolver" ya existía en el Paso 5.

## Las tres pruebas

### 1 · El fallo observado, textual

Hook, con los casos nuevos escritos antes de tocar `hook.mjs`:

```
FALLA  20 de 50 casos:
  - 🔑 Stop con el rastro sin "Reporte en lenguaje llano" BLOQUEA y lo nombra: esperaba 2 y dio 0
  - 🔑 Stop con el rastro sin "Decisiones" BLOQUEA y lo nombra: esperaba 2 y dio 0
  - 🔑 Stop con las palabras sólo en prosa BLOQUEA: la prosa no es un encabezado y dio 0
  - 🔑 PreToolUse bloquea producción: supabase db push: tenía que bloquearse y dio 0
  - 🔑 PreToolUse bloquea producción: prisma migrate deploy: tenía que bloquearse y dio 0
  ... (20 en total)
```

(Los casos de "NO bloquea lo parecido" y "ilegible falla abierto" ya pasaban antes: son los que
impiden pasarse de largo.)

Chequeos de texto, con los requisitos agregados antes de escribir el texto:

```
FALLA  3 de 171 chequeos:
  - revision-independiente: tope de 2 vueltas ... — falta no está la sección ## Cuántas vueltas
  - flujo-loop: el Paso 5 apunta al tope de 2 vueltas y a "no se pudo resolver" en Debe — falta /2 vueltas[\s\S]{0,300}revisión|.../
  - flujo-loop: el rastro exige cuatro encabezados y avisa que el Stop los verifica — falta /Stop[\s\S]{0,200}encabezados|.../
```

Nota de honestidad: el primer patrón del Paso 5 usaba `Debe` + "no se pudo resolver", que ya
estaban a 200 caracteres en el párrafo de abajo (de otra pasada) y por eso no fallaba: era
vacuo. Lo reanclé a "2 vueltas" cerca de "no se pudo resolver". Además, tres patrones llegaron
rotos por el escapado del shell (`**` sin barras, que ni compilaba) y se corrigieron antes de
confiar en ningún resultado.

**Ronda 1 de arreglos** (casos escritos antes de tocar `hook.mjs`, suite en 88 casos):

```
FALLA  27 de 88 casos:
  - Stop acepta el encabezado decorado: ## 📋 Reporte en lenguaje llano: esperaba 0 y dio 2
  - Stop acepta el encabezado decorado: ## Decisiones, y por qué: esperaba 0 y dio 2
  - Stop acepta el encabezado decorado: ## Las 3 pruebas: esperaba 0 y dio 2
  - 🔑 Stop con los cuatro encabezados sólo dentro de un bloque de código BLOQUEA: ... dio 0
  - el mensaje del Stop imprime las líneas exactas aceptadas ...: no imprime la línea "## Reporte en lenguaje llano"
  - 🔑 PreToolUse bloquea (ronda 1): supabase --workdir x db push: tenía que bloquearse y dio 0
  - 🔑 PreToolUse bloquea (ronda 1): npx prisma@5 migrate deploy: tenía que bloquearse y dio 0
  - 🔑 PreToolUse bloquea (ronda 1): bash -c "supabase db push": tenía que bloquearse y dio 0
  - 🔑 PreToolUse bloquea (ronda 1): echo $(supabase db push): tenía que bloquearse y dio 0
  - 🔑 PreToolUse NO bloquea lo que no es el comando (ronda 1): "echo supabase db push" no tenía que bloquearse
  ... (27 en total)
```

Nota de honestidad: el caso del BOM **no estaba rojo** en esa corrida, porque el BOM iba delante
de `# rastro`, que no es un encabezado pedido: no probaba nada. Lo moví al primer encabezado
pedido y lo comprobé por mutación (abajo). Además, el BOM no necesitaba un `replace`: `\s` ya
lo cuenta como espacio, así que no agregué código para eso.

### 2 · Las mutaciones verificadas

Hash = 16 primeros caracteres de sha256, antes / durante / restaurado desde una copia.

| qué se rompió | hashes | qué se cayó |
|---|---|---|
| `revision-independiente`: "Hasta 2 vueltas" pasó a "Hasta 3" | `31e89c61ddd890a4` / `a240d84411d1b4d9` / `31e89c61ddd890a4` | sólo el chequeo del tope (1 de 171) |
| `revision-independiente`: `marcado "no se pudo resolver"` pasó a `marcado como pendiente` | `31e89c61ddd890a4` / `54e57a4af125d1ff` / `31e89c61ddd890a4` | sólo el chequeo del tope (1 de 171) |
| `flujo-loop` SKILL: "Tope: 2 vueltas" pasó a "Tope: 3 vueltas" | `d4032aa6e0b8fde9` / `8dc7499ff75e85bd` / `d4032aa6e0b8fde9` | sólo el puntero del Paso 5 (1 de 171) |
| `flujo-loop` SKILL: "cuatro **encabezados**" pasó a "cuatro **secciones**" | `d4032aa6e0b8fde9` / `2a6e56d133bf7a10` / `d4032aa6e0b8fde9` | sólo el chequeo del rastro (1 de 171) |
| `hook.mjs`: `db query` dejó de exigir `--linked` | `8d0d0c4962bed22a` / `e71164043f5742da` / `8d0d0c4962bed22a` | el caso de lo parecido (1 de 50) |
| `hook.mjs`: `prisma migrate deploy` desactivado | `8d0d0c4962bed22a` / `ca0b72b54efb9621` / `8d0d0c4962bed22a` | 3 casos de producción de 50 |
| `hook.mjs`: el patrón de encabezado sin anclar (`^…$`) | `8d0d0c4962bed22a` / `287ae754240ed3a1` / `8d0d0c4962bed22a` | primero **sobrevivió** (50 de 50 verdes): faltaba un caso. Agregué "encabezado más largo" y entonces cayó (1 de 51) |
| `hook.mjs`: archivo ilegible pasó de callarse a seguir con texto vacío | `8d0d0c4962bed22a` / `9e5de445066c14a6` / `8d0d0c4962bed22a` | el caso de falla abierto (1 de 51). Un primer intento no aplicó (el archivo tiene CRLF y mi texto de búsqueda no): el hash no cambió y lo descarté |

Ronda 1 (corrida con `SOLO=<texto>`, que filtra los casos por nombre: la suite entera tarda
minutos). Mismo formato de hashes; todas se restauraron desde una copia.

| qué se rompió | hashes | qué se cayó |
|---|---|---|
| el patrón del encabezado sin `\s` (sólo espacios) | `1be5a4c00fa95f7a` / `e2e4ee27773a4830` / `1be5a4c00fa95f7a` | el caso del BOM |
| se ignora el cerco de código | `695e7b1555ab7304` / `6cc505511282943c` / `695e7b1555ab7304` | el caso del bloque de código |
| sin `(?![a-z])` | `695e7b1555ab7304` / `ff01a9f639b4c453` / `695e7b1555ab7304` | "Decisionesx" |
| sin quitar la decoración inicial | `695e7b1555ab7304` / `80e048fe75528afa` / `695e7b1555ab7304` | 3 de 8 decorados |
| `(tres\|3)` pasó a `(tres)` | `695e7b1555ab7304` / `2c038d1a82eb59cf` / `695e7b1555ab7304` | "Las 3 pruebas" |
| `--dry-run/--help/-h` ya no exceptúan | `695e7b1555ab7304` / `1389eee5bc7bb6ef` / `695e7b1555ab7304` | el caso de lo que no bloquea |
| `bash -c` ya no se re-lee | `695e7b1555ab7304` / `89ec03203d16c4cc` / `695e7b1555ab7304` | 4 de 22 |
| `.ps1` fuera de la lista | `1be5a4c00fa95f7a` / `a1dc2027443a474e` / `1be5a4c00fa95f7a` | `supabase.ps1 db push`. Un primer intento buscaba "ps1" suelto, que aparece dos veces: no aplicó (mismo hash) y se rehízo |
| `--linked=` ya no cuenta | `695e7b1555ab7304` / `38a15b3cd13f4c98` / `695e7b1555ab7304` | 2 de 22 |
| barra + salto de línea ya no es espacio | `695e7b1555ab7304` / `c8909ce69f84f1a0` / `695e7b1555ab7304` | 1 de 22 |
| `npx`/`sudo`/`env`/`bunx` ya no se saltean | `695e7b1555ab7304` / `7dfabf688c13b3f4` / `695e7b1555ab7304` | 5 de 22 |
| `VAR=valor` ya no se saltea | `695e7b1555ab7304` / `1f8f1fc5c5fa1e67` / `695e7b1555ab7304` | 2 de 22 |
| `prisma@5` ya no pierde la versión | `695e7b1555ab7304` / `bb1e6ca0126051f7` / `695e7b1555ab7304` | 2 de 22 |

Un primer intento de quitar el `replace` del BOM **sobrevivió** (el caso del BOM siguió en verde): ahí se vio que
`\s` ya lo cubre, el `replace` sobraba y se borró; la mutación que vale es la de la primera fila.

### 3 · Los números de los controles

| control | resultado |
|---|---|
| `node pruebas/check.mjs` | `OK  171 chequeos, sin fallas.` |
| `node pruebas/check.mjs --self-test` | `OK  40 casos del verificador, sin fallas.` |
| `node pruebas/hook.test.mjs` | `OK  88 casos, sin fallas.` (26 al empezar el PR) |
| `node pruebas/instalar.test.mjs` | `OK  11 casos, sin fallas.` |

## Lo que NO se pudo verificar

- Que un agente real escriba los cuatro encabezados o respete el tope de 2 vueltas: los controles
  miran el texto de las skills y el comportamiento del hook, no a un agente.
- Que el `Stop` y el guardrail anden instalados en Claude Code de verdad (cableado de eventos):
  los casos corren el script con la entrada que Claude Code manda, pero no dentro de Claude Code.
- Que `supabase`/`prisma` sin esos subcomandos exactos no tengan otras formas de llegar a
  producción (por ejemplo `supabase db push` por una variable o un alias): el guardrail no es un
  sandbox, igual que el de git.
- Un envoltorio que no está en la lista (`xargs`, `time`, `nohup`, `eval`, `bash -c` con una
  variable) delante del comando lo esquiva: el guardrail no es un sandbox.
- Los finales de línea: el árbol de trabajo está en CRLF (autocrlf) y el índice en LF. El diff
  contra el índice quedó chico (276 líneas), sin reescribir archivos enteros.

## La revisión de este cambio

El cambio toca permisos (un guardrail que bloquea comandos), así que corrieron **dos revisores
ciegos** sobre `43bded9`. Hallazgos de la ronda 1 y qué se hizo:

| hallazgo | resultado |
|---|---|
| BOM al principio del rastro bloqueaba con los cuatro encabezados | arreglado (el patrón admite espacios delante y `\s` incluye el BOM); caso nuevo |
| títulos decorados (emoji, `1.`, `**`, `:`, "Decisiones y por qué", "Decisiones, y por qué", "Las 3 pruebas") bloqueaban | arreglado; un caso por variante |
| los encabezados de un bloque de código contaban | arreglado (se ignoran los cercos de ``` y ~~~); caso nuevo, y otro que fija que lo de después del cerco vuelve a contar |
| el mensaje no decía qué escribir | arreglado: imprime las líneas exactas (`## Decisiones`…) y avisa que son de `#` |
| opciones con valor antes del subcomando (`--workdir x db push`) | arreglado: el subcomando se busca como secuencia consecutiva |
| binarios con versión, `pnpm dlx`, `.ps1` | arreglado |
| `bash -c "…"`, `(…)`, `$(…)`, comilla invertida, `\` + salto de línea | arreglado (`bash -c` también protege a git) |
| `echo supabase db push` y `grep supabase db push docs` bloqueaban | arreglado: el programa tiene que estar en posición de comando |
| `--dry-run`, `--help`, `-h` bloqueaban | arreglado: no bloquean |
| `--linked=true` no contaba como `--linked` | arreglado |

**Descartados, con motivo:**

- **Títulos subrayados (setext, `===` / `---`):** no se reconocen. Se sumaría un segundo parser
  para una forma que ningún rastro del repo usa; el mensaje de bloqueo dice que no se aceptan.
- **Una línea de heredoc que es literalmente `supabase db push`:** sigue bloqueando. Falla del
  lado seguro (bloquea de más, nunca de menos), parsear heredocs es caro, y quedó anotado como
  techo en el código y fijado en un test.
- **`stop_hook_active`:** el hook no lo mira hoy. Mientras haya trabajo sin rastro completo,
  bloquea en cada `Stop`. No se cambió, a pedido; queda dicho acá.

Decisión del dueño: el cuarto encabezado sigue siendo "Decisiones".

## Estado

- [x] Stop exige los cuatro encabezados (punto 1)
- [x] Guardrail de producción que bloquea (punto 6)
- [x] Tope de 2 vueltas (punto 7)
- [x] Plan y README actualizados
- [x] Revisión independiente, ronda 1 (dos revisores ciegos); ronda 1 de arreglos hecha, sin segunda revisión
- [ ] Push, PR y merge: no los hago yo
