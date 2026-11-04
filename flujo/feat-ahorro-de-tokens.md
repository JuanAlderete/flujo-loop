# Ahorro de tokens: caveman y rtk en el instalador

## Reporte en lenguaje llano

**Qué hace este cambio.** Quien instala el flujo ahora recibe dos herramientas para gastar menos
tokens. caveman hace que el agente escriba respuestas más cortas, y sólo se prende si la persona
la pide con `/caveman`. rtk achica lo que devuelven los comandos antes de que el agente lo lea;
como es un programa aparte, el instalador no lo instala: avisa si falta y explica cómo ponerlo.

**Hallazgos**

*Debe*

1. **La descripción de caveman y su regla 8 no dicen lo mismo sobre el reporte final.** *No se
   pudo resolver: lo encontró la segunda vuelta de la revisión, y el tope son 2 vueltas.* El
   revisor lo puso como opcional; va acá porque así lo pide el flujo para lo que queda abierto.
   - **El problema:** la descripción dice que caveman no se usa en ningún reporte final. La regla
     8 del cuerpo sólo exceptúa el reporte para quien no lee código. Con caveman prendido, un
     reporte final pedido por alguien que programa puede salir en un estilo o en el otro.
   - **El arreglo:** alinear las dos frases. Por ejemplo, dejar la regla 8 como "Final report or
     summary", sin la condición.
   - **Si no se arregla:** a quien no programa no le cambia nada, porque las dos frases coinciden
     para ese caso. A quien programa, el reporte final le puede llegar comprimido.

*Conviene*

Ninguno.

*Opcional*

2. **El enganche de rtk se reconoce por la forma del comando.** El instalador reconoce `rtk hook
   …` (rtk 1.1.0) y `rtk-rewrite.sh` (versiones anteriores, según el revisor; no se pudo
   comprobar). Si otra versión de rtk lo escribe distinto, el instalador diría que falta el
   enganche aunque esté.
   - **El arreglo:** sumar la forma nueva cuando aparezca.
   - **Si no se arregla:** un consejo de más en la instalación. No rompe nada.

**Veredicto:** se puede presentar. El hallazgo 1 es de redacción y no afecta a quien no programa.

**Lo que no se revisó**

- `skill-scanner` no corrió: necesita `uv` o Python, y en esta máquina no hay ninguno de los dos.
  caveman se revisó leyéndola entera con `/seguridad-de-skills`.
- La detección de rtk en Linux y macOS: las pruebas corrieron sólo en Windows.
- Si rtk conserva los conteos de `pytest`, `cargo test` y `go test`: no hay ninguno en este repo.
- Si Claude Code deja de cargar caveman sola ante "sé breve": depende de cómo el modelo lee la
  descripción, y eso no se puede probar.

## Objetivo

Mejora 2.9 de `docs/plan-de-mejoras.md`. Que quien instala flujo-loop reciba también las dos
herramientas de ahorro de tokens: **caveman** (respuestas más cortas) y **rtk** (salida de
comandos comprimida). Hasta ahora sólo estaban en la máquina de quien armó el flujo.

## Decisiones

Todas salen del `/grilling` del 2026-11-04 (respuesta del dueño: "si a todo").

| decisión | por qué |
|---|---|
| La rama sale de `feat/ultima-puerta-y-seguridad`, no de `main` | El control de hashes (`ORIGEN.json`) sólo existe ahí. Desde `main` habría conflictos después |
| caveman es skill **propia**, copiada de la versión local y sin `ORIGEN.json` | La copia local no dice de qué repo viene. Sin repo y commit no se puede armar un `ORIGEN.json` honesto |
| caveman no se activa sola: cada persona la pide con `/caveman` | El equipo en su mayoría no programa. Un estilo telegráfico permanente le cuesta a quien lee |
| El instalador sólo **detecta** rtk y recomienda | rtk es un ejecutable distinto por sistema operativo. Su enganche es de `rtk init -g`: escribirlo desde acá ataría el instalador a una versión de rtk que no controla |
| La recomendación va en una sección `Recomendado:`, no en `Avisos:` | rtk es opcional. Un aviso dice que algo puede salir mal; esto no |
| Si rtk ya tiene su enganche, no se dice nada de rtk | No hay nada que recomendar |
| Paso 4: "si una herramienta te resumió la salida y el número no aparece, volvé a correr el control sin resumir" | El rastro exige los números de cada control, y rtk resume la salida de algunos comandos de tests. La skill genérica no nombra herramientas; el README da el comando (`rtk bypass <comando>`) |

### Supuestos tomados sin preguntar

- **Sólo se sugiere `rtk init -g` si falta el enganche.** En el grilling se acordó "si está,
  sugiere `rtk init -g`". Si ya está enganchado, sugerirlo sería ruido. El enganche se
  reconoce por un comando de la forma `rtk hook …` o `rtk.exe" hook …` en cualquier evento.
- **Se le agregó una frase a la descripción de caveman**, aunque se acordó copiarla tal cual.
  El chequeo 4 de `/seguridad-de-skills` exige que la descripción diga cuándo NO usarla, y "si
  un chequeo da no, es un hueco a resolver antes de instalar". Frase agregada: "Not for final
  reports, questions to the user, or anything persisted (code, commits, docs)."
- **Detección de rtk en Windows**: se busca `rtk` más cada extensión de `PATHEXT` en cada
  carpeta del `PATH`. En el resto, `rtk` con permiso de ejecución.

## Revisión de caveman (`/seguridad-de-skills`)

| chequeo | resultado |
|---|---|
| fuente y commit | **desconocidos**. Copia de `~/.claude/skills/caveman/SKILL.md` de la máquina del dueño, el 2026-11-04 (sha256 de esa copia empieza en `415d43518f2b1a94`) |
| qué se leyó | 1 archivo, entero: `SKILL.md`, 89 líneas |
| 1 · ¿actúa en vez de informar? | No. Sólo cambia el estilo de las respuestas. Sin scripts, sin comandos, sin instrucciones de ignorar otras reglas. 0 caracteres invisibles, 0 caracteres fuera de ASCII |
| 2 · fuente | Sin repo ni commit: queda como skill propia (ver decisiones) |
| 3 · privilegios | No declara `allowed-tools` ni enganches. 0 apariciones de un `!` seguido de acento grave |
| 4 · encabezado | Parsea y el nombre coincide con la carpeta. **No decía cuándo NO usarla: se agregó** |
| 5 · instrucciones de afuera | No tiene links |
| 6 · aislamiento | No ejecuta nada |
| 7 · fijada | Copiada al repo. Sin `ORIGEN.json`, como las demás propias |
| 8 · revisión | Leída entera, con intención |
| 9 · registro | Este rastro |
| 10 · ¿anda acá? | `pruebas/check.mjs` la carga sin fallas. Nombraba tres skills que flujo-loop **no** instala: `ultracave`, `megacave` y `/caveman-compress`. **Se sacaron** esas dos referencias (los alias `/caveman ultra` y `/caveman wenyan`, y la excepción de `/caveman-compress`), a pedido del dueño después de judgment-day |

**Veredicto:** se instala.

## Revisión de seguridad del cambio (`/sentry-security-review` + `owasp-top-10`)

El dato que entra: el `PATH`, el `PATHEXT` y el `settings.json` del propio usuario. Los controla
la misma persona que corre el instalador, así que no hay atacante del otro lado.

| categoría | qué se encontró |
|---|---|
| A01 control de acceso | nada: no hay usuarios ni permisos |
| A02 configuración insegura | nada: no escribe nada nuevo en la configuración |
| A03 cadena de suministro | caveman sin fuente ni commit. Es una decisión, registrada arriba. rtk no se baja |
| A04 criptografía | nada |
| A05 inyección | nada: las carpetas del `PATH` sólo se unen con `rtk` y se consultan con `accessSync`. No se ejecuta ningún comando |
| A06 diseño inseguro | nada |
| A07 autenticación | nada |
| A08 integridad | caveman no tiene hash fijado, igual que las otras skills propias |
| A09 registro | nada |
| A10 condiciones excepcionales | `accessSync` que falla da "no está". Un evento de enganches que no es una lista, o un grupo sin `hooks`, se saltea. La expresión regular es lineal |

## Las tres pruebas

### 1 · El fallo observado, textual

Antes de implementar, `node pruebas/instalar.test.mjs`:

```
FALLA  5 de 16 casos:
  - instala caveman como una skill más: no copió caveman
  - sin rtk: lo recomienda con el link, y no como un aviso: no hubo sección de recomendaciones: Instalado:
  - con rtk y sin su enganche: sugiere rtk init -g y no lo escribe él: no sugirió el comando: Instalado:
  - con rtk y su enganche puesto: no dice nada de rtk, y conserva su enganche: habló de rtk sin motivo: Instalado:
  - en simulación también recomienda rtk, sin tocar nada: no recomendó rtk: SIMULACIÓN — no se tocó nada. Se haría:
```

⚠️ El cuarto fallaba **por la razón equivocada**: el nombre de la carpeta de prueba
(`rtk-con-enganche`) aparecía en la salida, y la aserción "no habla de rtk" lo encontraba ahí.
Se renombraron las carpetas de destino (`ahorro-…`). Después del arreglo, el RED quedó en 4 de
16, cada uno por lo que faltaba:

```
FALLA  4 de 16 casos:
  - instala caveman como una skill más: no copió caveman
  - sin rtk: lo recomienda con el link, y no como un aviso: no hubo sección de recomendaciones: Instalado:
  - con rtk y sin su enganche: sugiere rtk init -g y no lo escribe él: no sugirió el comando: Instalado:
  - en simulación también recomienda rtk, sin tocar nada: no recomendó rtk: SIMULACIÓN — no se tocó nada. Se haría:
```

La primera implementación dejó 1 fallo: el enganche de rtk no se reconocía. Causa: se recorría
la lista de cada evento como si fuera un grupo. Se arregló aplanando con `.flat()`.

### 2 · Las mutaciones verificadas

Cada una aplicada sobre `instalar.mjs` (o moviendo la carpeta de caveman) y revertida después.
Después de revertir, el archivo es idéntico al respaldo (`cmp`).

| mutación | qué cayó |
|---|---|
| M1 · sacar el `.flat()` | 1 de 16: "con rtk y su enganche puesto" |
| M2 · cambiar el link de rtk | 2 de 16: "sin rtk" y "en simulación" |
| M3 · invertir la detección del `PATH` | 4 de 16: los cuatro casos de rtk |
| M4 · no sugerir nunca `rtk init -g` | 1 de 16: "con rtk y sin su enganche" |
| M5 · imprimir la recomendación bajo `Avisos:` | 2 de 16: "sin choques NO avisa nada" y "sin rtk" |
| M6 · sacar `skills/caveman` | 1 de 16: "instala caveman como una skill más" |

⚠️ El primer intento de M5 con `sed` **no se aplicó**: sólo cambió los fines de línea (el
archivo tiene CRLF), y el chequeo "el archivo cambió" lo dio por aplicado. Los tests pasaron y
parecía que la mutación sobrevivía. Se repitió con un reemplazo exacto que falla si no
encuentra el texto: ahí cayó. M1 a M4 sí se aplicaron: cada una tiró justo los casos esperados.

Después de la revisión independiente, con 17 casos:

| mutación | qué cayó |
|---|---|
| M7 · sacar `\|\brtk-rewrite\b` de la expresión | 1 de 17: "con rtk y el enganche viejo (rtk-rewrite.sh)" |

El primer intento de M7 (un reemplazo dentro de `node -e`) tampoco se aplicó: el script avisó
"NO APLICÓ" y se repitió desde un archivo, con el texto exacto.

### 3 · Los números de los controles

Después del rebase sobre `origin/main` y de los arreglos de la revisión:

| control | resultado |
|---|---|
| `pruebas/check.mjs` | 177 chequeos, sin fallas |
| `pruebas/check.mjs --self-test` | 40 casos, sin fallas |
| `pruebas/hook.test.mjs` | 113 casos, sin fallas |
| `pruebas/instalar.test.mjs` | 17 casos, sin fallas |

Antes del rebase eran 147, 35, 23 y 16. La diferencia la traen los cambios que ya estaban en
`origin/main`.

## Revisiones del cambio

**judgment-day** (antes del rebase, sobre `f39bb3f`): 2 jueces ciegos, 0 críticos. Los dos
coincidieron en dos advertencias: caveman nombraba skills que no se instalan (se sacaron, a pedido
del dueño), y la forma del enganche de rtk (ver la revisión independiente). Veredicto: aprobado.

**`/revision-independiente`** (después del rebase), con un revisor. El cambio no toca plata,
datos ni permisos.

- **Vuelta 1:** 0 Debe, 1 Conviene, 2 Opcional. Todos verificados antes de tocar nada:
  - *Conviene — caveman se podía prender sola* con "be brief" o "less tokens". **Arreglado**: se
    sacaron esas frases de la descripción. Se descartó el arreglo propuesto
    (`disable-model-invocation: true`) porque bloquea que el agente la cargue con la herramienta
    de skills, y el flujo personal del dueño la ejecuta así.
  - *Opcional — el enganche viejo de rtk* (`rtk-rewrite.sh`) no se reconocía. **Arreglado**, con
    un test primero (RED: "habló de rtk sin motivo") y la mutación M7.
  - *Opcional — el cuerpo de caveman no exceptuaba el reporte final.* **Arreglado**: regla 8.
- **Vuelta 2** (sobre `50659b7`): 0 Debe, 0 Conviene, 1 Opcional: la descripción y la regla 8
  no dicen lo mismo. Se llegó al tope: va al reporte, en Debe, marcado "no se pudo resolver".

**`skill-scanner`**: no corrió. Necesita `uv` o Python, y en esta máquina sólo está el atajo de la
Microsoft Store, que no ejecuta nada.

**`gha-security-review`** y **`secret-serialization`**: no aplican. El cambio no toca
`.github/workflows/`, no agrega campos con credenciales y no convierte objetos enteros a texto.

## Lo que NO se pudo verificar

- **Que `rtk bypass` exista en otras versiones de rtk.** Se verificó en rtk 1.1.0: `rtk proxy`
  quedó como alias viejo de `bypass`.
- **Que rtk conserve los conteos de los tests.** Con rtk 1.1.0, `rtk rewrite` no toca
  `node pruebas/*.mjs` ni `npm test`, pero sí reescribe `pytest`, `cargo test` y `go test`. No
  se midió si esas salidas resumidas traen el conteo: no hay ningún proyecto de esos acá.
- **La detección de rtk en Linux y macOS.** Los casos corrieron en Windows. El camino que exige
  permiso de ejecución no corrió.
- **Que Claude Code registre caveman** desde la instalación. Se verificó que el archivo quede
  donde va; el registro lo hace la herramienta al arrancar.
- **El caso "sin choques NO avisa nada" depende de la máquina**: usa el `PATH` real. Pasa con y
  sin rtk, porque la recomendación va en otra sección.

## Estado

- [x] caveman en `skills/`, revisada con `/seguridad-de-skills`.
- [x] El instalador recomienda rtk sin instalarlo ni escribir su enganche.
- [x] Paso 4: volver a correr sin resumir si falta el número.
- [x] README.
- [x] La 2.9 sumada al plan y marcada como hecha (`docs/plan-de-mejoras.md`).
- [x] Rebase sobre `origin/main`, sin conflictos de texto. Las reglas nuevas del Paso 5 se
  cumplieron después: el reporte llano y la revisión independiente.
- [ ] Hallazgo 1 del reporte (descripción vs. regla 8 de caveman): lo decide el dueño.
- [ ] Publicar: lo decide el dueño.
