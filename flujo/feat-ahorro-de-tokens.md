# Ahorro de tokens: caveman y rtk en el instalador

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
| 10 · ¿anda acá? | `pruebas/check.mjs` la carga sin fallas. ⚠️ Nombra tres skills que flujo-loop **no** instala: `ultracave`, `megacave` y `/caveman-compress`. Pedir `/caveman ultra` no va a encontrar nada |

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

### 3 · Los números de los controles

| control | resultado |
|---|---|
| `pruebas/check.mjs` | 147 chequeos, sin fallas (142 antes de sumar caveman) |
| `pruebas/check.mjs --self-test` | 35 casos, sin fallas |
| `pruebas/hook.test.mjs` | 23 casos, sin fallas |
| `pruebas/instalar.test.mjs` | 16 casos, sin fallas (11 antes) |

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
- [ ] Marcar la 2.9 como hecha en el plan (vive en la rama `docs/plan-de-mejoras`).
- [ ] Publicar: lo decide el dueño.
