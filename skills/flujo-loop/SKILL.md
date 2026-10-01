---
name: flujo-loop
description: "El procedimiento de trabajo del equipo de Loop — en qué orden se hacen las cosas y qué prueba hay que dejar en cada paso. Usala al empezar cualquier tarea que vaya a cambiar el proyecto (feature, bug, refactor o cambio de datos). No la uses para responder una pregunta ni para leer código sin tocarlo."
user-invocable: true
---

# El flujo de Loop

Esto es **el procedimiento**: en qué orden se hacen las cosas y qué prueba queda de cada paso.
No son las reglas del proyecto ni su arquitectura — eso lo declara cada proyecto por su cuenta.

## Con quién estás trabajando

La persona que te pide esto **probablemente no lee código**. Va a probar la app, mirar lo que le
contás, y aprobar o rechazar. Después **otra persona audita el trabajo**.

Eso cambia dos cosas en cómo trabajás, y no son cosméticas:

1. **No podés delegarle una decisión técnica disfrazada de pregunta.** "¿Uso un índice parcial o
   compuesto?" no es una pregunta que pueda contestar. Decidilo y explicá la consecuencia en
   términos de lo que va a pasar en la app. Las decisiones **del negocio** sí son suyas, y esas
   se preguntan de una en una.
2. **Nadie va a revisar tu trabajo mirando el diff, al menos no en el momento.** Así que la
   prueba de que algo funciona **tiene que quedar escrita**, no demostrada en el aire. Ese es el
   punto de este procedimiento entero.

🔑 **El objetivo de todo esto es que auditar tu trabajo sea LEER en vez de RE-DERIVAR.** Si el
que audita tiene que reconstruir por su cuenta lo que hiciste para saber si está bien, no dejaste
evidencia: dejaste tarea.

## El piso: la plata y los datos

Antes de cualquier orden de pasos, esto no se negocia.

- **No se toca ningún dato real para "probar".** Si la única forma de probar algo es contra datos
  de alguien, se pide autorización explícita y se decide con la persona. No se elige el dato que
  está a mano porque está a mano.
- **Un cambio sobre datos reales no siempre se deshace.** Un revert arregla el código, no las
  filas. Y hay registros que ni borrándolos se deshacen, porque el borrado se propaga a cosas
  que no ves.
- **Si el proyecto declara qué no se toca, eso gana sobre cualquier cosa que digas acá.**

Y una consecuencia práctica que la gente resuelve mal: **si no tenés credenciales, puede ser a
propósito.** Antes de conseguirlas para "poner en marcha el entorno", averiguá si el proyecto
tiene una forma de trabajar sin ellas. Casi siempre la tiene, y arrancar el proyecto contra datos
reales sin saberlo es el accidente más fácil de cometer.

---

## Paso 0 · ¿Este proyecto declara sus controles?

Antes de escribir nada, mirá si el proyecto tiene un `CLAUDE.md` que diga **cuáles son sus
controles** — el comando que corre los tests, el que revisa tipos, el que revisa estilo, lo que
sea que este proyecto use para saber que no rompió nada.

**Si los declara**: leelo y seguí al paso 1. Esos son los controles, no los que vos supongas.

**Si no los declara, o no hay `CLAUDE.md`**, construilo antes de seguir:

1. Corré **`/init`**, que genera un `CLAUDE.md` leyendo el proyecto.
2. Buscá los candidatos a control: los comandos que el proyecto ya define para sí mismo, qué
   herramienta de tests hay, si hay revisión de estilo o de tipos.
3. **Proponelos y esperá confirmación**, una sola pregunta: *"encontré estos comandos, ¿son los
   controles de este proyecto?"*. No inventes la lista y sigas: si la persona no lee código, no
   va a poder corregirte después.
4. Escribí la respuesta en el `CLAUDE.md`.

⚠️ **Por qué esto es un paso y no una nota al pie**: "el proyecto no declara controles" se lee
igual que "el proyecto no tiene controles". Si arrancás sin resolverlo, vas a terminar reportando
que todo pasó **sin que nada se haya medido** — y eso es peor que reportar que no pudiste medir.

---

## Paso 1 · Antes de escribir una línea: `/grilling`

**Ejecutá el comando `/grilling`** y charlá el tema antes de tener la solución pensada.

El modo de falla que esto evita es fino, y por eso hay que nombrarlo: no es "no pensarlo". Es una
charla larga, razonada y con evidencia, **conducida por vos**. Sale bien y por eso engaña —
porque estás explorando el espacio que ya tenías en la cabeza. La skill pregunta lo que a vos no
se te habría ocurrido preguntar. Sin ejecutarla, esa diferencia se pierde y **nadie la nota**,
porque el resultado igual se ve prolijo.

⚠️ **Se ejecuta el comando. No se lee la skill para después hacer uno mismo lo que la skill
haría.** Leer la referencia y actuar "según lo que dice" es hacer de memoria lo que la skill hace
con un procedimiento, y te saltea justamente las preguntas que no se te ocurren.

Esta regla no está acá por prolijidad: es el error que más veces se repitió, y lo cometió la
persona que la escribió, con dos skills distintas, en dos días.

## Paso 2 · Al empezar a implementar: `/test-driven-development`

**Ejecutá el comando `/test-driven-development`.** Antes de escribir el código, no después.

Por qué el orden importa tanto: un test escrito **detrás** de la implementación deja de ser una
prueba y pasa a ser una descripción. Confirma lo que el código ya hace en vez de definir lo que
tiene que hacer — y las dos cosas **se ven exactamente iguales cuando alguien lee el diff**. La
única forma de distinguirlas es **haber visto el test fallar**.

De ahí sale la primera de las tres pruebas que tenés que dejar.

## Paso 3 · Mientras implementás

- **Los casos que no son el camino feliz.** "No explota" es un piso muy bajo. Y hay un modo de
  falla peor que el que explota: **el que devuelve algo que parece bien.** Ese no lo atrapa
  envolver la llamada en un manejo de errores — lo atrapa **mirar el resultado**. Si nada lanza
  un error, "no lanzó error" no prueba nada: verificá que el trabajo se haya hecho de verdad, con
  qué contenido y sobre qué.
- **Verificá antes de afirmar.** Un buscador de texto o el nombre de una función no son
  evidencia: se lee la fuente. Y ojo con los controles que **no** cubren lo que parece: una
  revisión de tipos limpia no prueba que exista lo que estás llamando del otro lado de un límite
  que el sistema de tipos no cruza.
- **Buscá lo que ya existe antes de escribirlo.** Casi todo proyecto tiene su propia biblioteca
  de piezas repetidas. Duplicar una es deuda que después alguien tiene que unificar, y no la ve
  ningún control automático.
- **Arreglá la causa, no el síntoma.** Antes de editar, mirá **quién más** llama a lo que vas a
  tocar. Un arreglo en la función compartida es un cambio más chico que uno en cada llamador — y
  parchear sólo el camino que el pedido nombra deja a todos los hermanos roto, en silencio.

## Paso 4 · Antes de decir que terminaste: los controles

Corré los controles que el proyecto declara, **en el orden que los declara**, y reportá **los
números que devolvieron**. No "pasa todo".

⚠️ **Y no te confíes de los controles que corren en un servidor.** Un control que no corrió no es
un control — y su resultado puede verse igual que un fracaso real. Si un control falla en pocos
segundos, o no deja registro, sospechá de que nunca arrancó antes de sospechar de tu código. Lo
que vale es lo que corriste vos y viste.

🔑 **Y cuando una cadena de controles se corta en el primero que falla, los que venían después no
corrieron.** Si el que se cortó era ajeno a tu cambio, corré a mano los que quedaron colgados. Un
reporte que dice "los controles fallaron" cuando en realidad **cuatro de seis nunca se
ejecutaron** es un reporte falso, aunque suene pesimista.

---

## Las tres pruebas

Esto es lo que convierte tu trabajo en auditable. Son baratas de escribir y **carísimas de
falsificar**, que es exactamente lo que se le pide a un control.

Van en el archivo de rastro (abajo), no sueltas en la conversación.

### 1 · El fallo observado, textual

Pegá el **mensaje exacto** del test fallando, de antes de implementar.

Nadie inventa el mensaje textual de un fallo que no vio. Es la única prueba de que el test se
escribió primero — y sin ella, un test escrito después es indistinguible de uno escrito antes.

En idioma de auditoría: **es la prueba de que el control se probó antes de que hubiera algo que
controlar.**

### 2 · La mutación verificada

Rompé el código a propósito, corré los tests, y anotá **qué se cayó**. Después restauralo.

Un test que nadie rompió a propósito es un control **documentado pero no probado**. Que exista no
dice nada sobre si detectaría un error: eso se averigua metiéndole uno. Es exactamente una
**prueba de controles**, con el mismo razonamiento que se le aplica a cualquier otro control.

Tres cosas que anotar, y las tres importan:

- **Qué rompiste.**
- **Qué se cayó** — y que se haya caído **sólo** eso. Si al romper una cosa se cae medio
  proyecto, tus tests no están midiendo lo que creés.
- **Que la mutación se aplicó de verdad.** Confirmá que el archivo cambió antes y después, y que
  al restaurarlo volvió a ser el original.

⚠️ **Lo tercero no es burocracia, y hay una razón concreta.** Hubo una mutación que "sobrevivió"
—los tests siguieron en verde— y que en realidad **nunca se había aplicado**: el cambio no
coincidió con nada, el archivo quedó idéntico, y el verde no significaba absolutamente nada.
O sea: **un falso verde adentro del detector de falsos verdes.** Si no confirmás que el archivo
cambió, esta prueba puede mentirte igual que la que viene a cazar.

### 3 · Los números de los controles

Cada control con **lo que devolvió**. Cuántos tests, cuántos fallaron, qué código de salida.

Un conteo exacto es caro de falsificar y trivial de re-verificar: el que audita corre el mismo
comando y compara. "Revisado OK" no es un papel de trabajo.

### Y lo que no pudiste verificar

**Obligatorio**, y es lo primero que el que audita va a buscar.

Ser honesto acá vale más que un checklist todo tildado. Hay cosas que genuinamente no se pueden
verificar con lo que tenés a mano — un comportamiento que sólo aparece en un dispositivo real,
un caso que depende de un servicio que no podés apagar. **Eso se declara, no se tilda.**

Un "no pude probar esto" te cuesta una línea. Un tilde falso le cuesta a otro una auditoría
entera, y la próxima vez no te va a creer ninguno de los otros tildes.

---

## El rastro

Todo lo de arriba va a **un archivo commiteado**, no a la conversación.

Se llama `flujo/<nombre-de-la-rama>.md`, con las barras de la rama cambiadas por guiones. Lo
escribís al empezar y lo vas actualizando; **no se escribe al final de memoria.**

Está commiteado a propósito, y por dos razones:

1. **Aparece solo en el cambio que presentás.** El que audita lo lee donde ya está mirando, sin
   que nadie copie nada de un lado al otro — y sin que haya dos versiones del mismo relato que se
   separen.
2. **Sobrevive a que te interrumpan.** Si la sesión se corta, el trabajo se retoma leyendo el
   archivo, no reconstruyendo de memoria.

Qué lleva:

| sección | qué va |
|---|---|
| **objetivo** | qué se quiere lograr, en una o dos líneas |
| **decisiones** | lo que se decidió y **por qué**. El cambio muestra el qué, nunca el por qué |
| **las tres pruebas** | el fallo textual, la mutación, los números |
| **lo que no pude verificar** | obligatorio |
| **estado** | qué falta. Se tilda sólo lo que se vio funcionar |

⚠️ **Un tilde no es una aprobación.** Marcar algo como hecho no lo valida: lo valida la prueba
que dejaste al lado. Un archivo de rastro todo tildado y sin pruebas es peor que uno a medias con
pruebas, porque el primero parece terminado.

---

## Cuando alguien encuentra algo

Si la persona, una revisión o un control encuentran un problema, **el rastro se actualiza**: se
reabre lo que dejó de ser cierto, con el motivo, y se agregan las tareas nuevas.

🔑 **Arreglá TODO en una sola pasada, releé el resultado completo, y recién entonces guardá el
trabajo.** No arregles un hallazgo, guardes, y pares a esperar la próxima revisión.

Esto no es prolijidad, es la diferencia entre dos vueltas y cinco, y está medido. En una tarea
real: la primera revisión encontró dos defectos que importaban, y las tres siguientes encontraron
cosas **en el texto escrito para arreglar la vuelta anterior** — cada vez una versión más chica
del mismo error. Dos causas, las dos evitables:

1. **Cada arreglo guardado por separado es un trabajo nuevo que se revisa de nuevo.** Cuatro
   arreglos guardados sueltos son cuatro revisiones.
2. **Un arreglo escrito rápido, bajo la presión de "arreglalo ya", es el próximo hallazgo.** El
   que corrige va con el hallazgo en la cabeza y no vuelve a leer el párrafo entero.

La revisión no estaba siendo superficial: lo superficial era el arreglo.

Y dos cosas que no cambian:

- **Un hallazgo no autoriza ampliar el alcance.** Si aparece algo que hay que arreglar y no era
  parte de esto, se dice y se decide — no se arregla de paso.
- **Un hallazgo no se acepta automáticamente.** Verificalo antes de actuar: una revisión también
  se equivoca, y un arreglo sobre un diagnóstico falso deja dos problemas.

---

## Si tocás pantallas

Antes de dibujar, averiguá **qué fuerza ya el proyecto** — mínimos de tamaño, tipografías,
colores, espaciados que ya están definidos en algún lado. Un diseño que viola lo que el sistema
ya impone no es un diseño optimista: **miente sobre el espacio disponible**, y todas las
decisiones que se toman mirándolo salen mal.

Y si el proyecto tiene más de un lenguaje visual conviviendo —porque está en medio de un
rediseño, por ejemplo— averiguá a cuál responde **esa** pantalla antes de tocarla. Aplicarle el
nuevo a una que todavía responde al viejo **no lo atrapa ningún control automático**: no es un
valor prohibido, es el sistema equivocado.

---

## Lo que esta skill NO dice, a propósito

- **Las reglas, los comandos y las trampas del proyecto** → su `CLAUDE.md`. Si es largo, vale
  leerlo: las reglas que traen escrito el incidente que las originó son las que te van a servir
  cuando te toque una situación que nadie escribió.
- **Dónde va la lógica y cómo está armado** → la documentación del proyecto.
- **Ningún número.** Ni umbrales, ni cantidades de controles, ni medidas. 🔑 **Los números
  vencen** — y cuando vencen, el documento que los afirma pasa a mentir con total confianza. Ya
  pasó: un proyecto declaró por escrito una cantidad de controles que dejó de ser cierta, y un
  mínimo de diseño que había cambiado. Si necesitás un valor, leelo en su fuente. Si esta skill
  te lo dijera, tarde o temprano te lo diría mal.
