# Los tres puntos débiles grandes

## Reporte en lenguaje llano

**Qué hace este cambio**

Cierra tres huecos del propio flujo-loop. Uno: el aviso de "falta el rastro" ahora también salta
si el rastro existe pero está vacío de lo importante, y dice exactamente qué títulos faltan. Dos:
el agente ya no puede correr, sin que el dueño lo autorice, los cuatro comandos que escriben en
la base de producción (`supabase db push`, `supabase db query --linked`,
`supabase migration repair --linked`, `prisma migrate deploy`); los parecidos que no tocan
producción siguen pasando. Tres: la revisión independiente tiene un tope de 2 vueltas de arreglar
y revisar, y lo que siga sin resolverse va a **Debe** como "no se pudo resolver".

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

Se puede presentar, sujeto a la revisión ciega que corre el padre (ver "La revisión de este
cambio").

**Lo que no se revisó**

- La revisión independiente de este cambio todavía no corrió.
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

### 3 · Los números de los controles

| control | resultado |
|---|---|
| `node pruebas/check.mjs` | `OK  171 chequeos, sin fallas.` (168 antes) |
| `node pruebas/check.mjs --self-test` | `OK  40 casos del verificador, sin fallas.` |
| `node pruebas/hook.test.mjs` | `OK  51 casos, sin fallas.` (26 antes) |
| `node pruebas/instalar.test.mjs` | `OK  11 casos, sin fallas.` |

## Lo que NO se pudo verificar

- Que un agente real escriba los cuatro encabezados o respete el tope de 2 vueltas: los controles
  miran el texto de las skills y el comportamiento del hook, no a un agente.
- Que el `Stop` y el guardrail anden instalados en Claude Code de verdad (cableado de eventos):
  los casos corren el script con la entrada que Claude Code manda, pero no dentro de Claude Code.
- Que `supabase`/`prisma` sin esos subcomandos exactos no tengan otras formas de llegar a
  producción (por ejemplo `supabase db push` por una variable o un alias): el guardrail no es un
  sandbox, igual que el de git.
- `supabase --workdir x db push` o una opción con valor delante del subcomando (`-p x db push`)
  no se resuelve bien: tomaría `x` como primer argumento y se escaparía. Es el techo de mirar sólo
  los primeros dos argumentos sin opciones.
- Los finales de línea: el árbol de trabajo está en CRLF (autocrlf) y el índice en LF. El diff
  contra el índice quedó chico (276 líneas), sin reescribir archivos enteros.

## La revisión de este cambio

Pendiente: la corre el padre, con un revisor ciego.

## Estado

- [x] Stop exige los cuatro encabezados (punto 1)
- [x] Guardrail de producción que bloquea (punto 6)
- [x] Tope de 2 vueltas (punto 7)
- [x] Plan y README actualizados
- [ ] Revisión independiente (pendiente, la corre el padre)
- [ ] Push, PR y merge: no los hago yo
