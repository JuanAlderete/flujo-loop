# flujo-loop · el paquete inicial

Este es el archivo de rastro de este repo, y sirve de ejemplo: **así se ve uno terminado.**

## Objetivo

Empaquetar el procedimiento de trabajo del equipo para que aplique en cualquier proyecto y **se
haga cumplir solo**, en vez de depender de que alguien se acuerde de invocar una skill.

## El problema

La versión anterior vivía dentro de un proyecto y nombraba sus comandos, su base de datos y sus
reglas. No servía en otro repo. Y su activación era "está disponible, acordate de usarla" — un
mecanismo que **ya había fallado dos veces en dos días, con dos skills distintas**, y lo rompió la
persona que escribió la regla.

## Decisiones, y por qué

| decisión | por qué |
|---|---|
| **Hook global + marcador por repo** | Una skill disponible no se ejecuta sola. El marcador deja que los enganches vivan una vez y que **cada repo decida** si juega. |
| **Sólo dos eventos: entrada y cierre** | Bloquear ediciones exige llevar estado y pelea en cada cambio de una línea. Un control que se aprende a esquivar es peor que no tenerlo, porque además da sensación de cobertura. |
| **El hook FALLA ABIERTO** | El peor modo de falla de un hook no es dejar pasar algo: es **bloquear cuando no debe**. Eso vuelve la herramienta inusable en todos los proyectos a la vez, y lo primero que hace cualquiera es desinstalarlo — con lo cual el control no protege nada nunca más. |
| **El marcador no contiene ningún dato** | Un archivo que afirma algo sobre el proyecto se desincroniza del proyecto. Uno que sólo se explica a sí mismo no puede quedar viejo. |
| **El rastro es un archivo commiteado** | Restricción técnica, no gusto: el hook sólo puede exigir lo que ve local y barato, y en el momento del "listo" **todavía no existe ningún pedido de revisión que mirar**. Commiteado, además aparece solo en el cambio que se presenta. |
| **Las skills de las dos fases van intactas** | Ya existen y son las fases. Escribir fases propias las duplicaría, y dos documentos sobre lo mismo se separan. |
| **El instalador es un script; la copia de carpetas no lo sería** | El archivo de configuración es estructurado: una coma mal puesta editándolo a mano deja la herramienta sin arrancar. Ante un archivo que no puede leer, el instalador **no escribe**. |
| **Ni un número en la skill** | Los números vencen, y un documento que afirma un número vencido miente con total confianza. Ya pasó: un proyecto declaró por escrito una cantidad de controles que había cambiado. |

## Las tres pruebas

### 1 · El fallo observado, textual

Las dos suites se escribieron antes que su código, y estos son los mensajes que dieron:

```
FALLA  no existe el hook en C:\tmp\flujo-loop\hooks\flujo-loop-hook.mjs
```

```
FALLA  no existe el instalador en C:\tmp\flujo-loop\instalar.mjs
```

⚠️ El primer intento del fallo del hook **no salió así**: el chequeo de existencia estaba al final
del archivo, así que un hook faltante producía trece fallas de casos y había que leerlas todas
para descubrir el motivo. Se movió arriba. Correr el RED sirvió para eso, además de para lo obvio.

### 2 · La mutación verificada

Cada control se rompió a propósito, con confirmación por hash de que el cambio se aplicó y de que
al restaurarlo el archivo volvió al original.

**El hook — 5 mutaciones, las 5 caen:**

| qué se rompió | qué cayó |
|---|---|
| que falle **cerrado** cuando no puede preguntarle a git | `Stop sin control de versiones FALLA ABIERTO` |
| que ignore el marcador y actúe en todos los repos | `sin marcador no dice nada` y `Stop sin marcador no bloquea` |
| que no mire si el rastro existe | `Stop con cambios y con rastro no bloquea` |
| que el marcador cuente como trabajo | `el marcador solo no cuenta como cambio` |
| que responda a cualquier evento | `PostToolUse no bloquea nunca` |

**El instalador — 5 mutaciones, las 5 caen:**

| qué se rompió | qué cayó |
|---|---|
| que pise una configuración mal escrita | `configuración mal escrita: se niega y NO la toca` |
| que agregue sin limpiar el propio anterior | `correrlo dos veces no duplica nada` |
| que reemplace los enganches en vez de conservarlos | `conserva los enganches ajenos que ya estaban` |
| que el modo simulación escriba igual | `modo simulación no cambia nada` |
| que no avise de una skill que ya existía | `avisa si ya hay una skill con el mismo nombre` |

**El verificador de las skills — 4 mutaciones, las 4 caen:** frontmatter mal escrito, nombre de
tecnología en la skill genérica, medida afirmada, y archivo nombrado que no existe.

🔑 **Y acá está lo que esta disciplina compró de verdad. Tres mutaciones SOBREVIVIERON al primer
intento, y las tres eran casos que pasaban por la razón equivocada** — exactamente la falla que
este paquete existe para atajar, cometida al construirlo:

1. **La rama de falla-abierto del hook estaba duplicada**, y una de las dos era **inalcanzable
   desde los tests**: cuando el control de versiones no está, la primera pregunta ya salía en 0 y
   la segunda nunca se evaluaba. Se colapsaron en un solo punto, y ahora el caso lo cubre.
2. **Ningún caso probaba un evento fuera de los dos diseñados.** Sacarle el filtro de evento
   sobrevivía a los 13 casos — con el hook tratando cualquier evento como el de cierre. Si alguien
   lo cableara a un evento que dispara a mitad del turno, cortaría el turno.
3. **Un caso afirmaba que la salida mencionara el nombre de una skill** — y la salida lo menciona
   **siempre**, porque lista cada skill que copia. La aserción coincidía con texto presente en
   todos los casos. Ahora afirma sobre el aviso en sí, y exige que **no** aparezca cuando no
   corresponde.

### 3 · Los números de los controles

| control | resultado |
|---|---|
| `pruebas/check.mjs` | 20 chequeos, sin fallas |
| `pruebas/check.mjs --self-test` | 32 casos, sin fallas |
| `pruebas/hook.test.mjs` | 18 casos, sin fallas |
| `pruebas/instalar.test.mjs` | 8 casos, sin fallas |
| sintaxis de los tres scripts | sin errores |
| instalación de punta a punta en configuración limpia | las 3 skills y los 2 enganches, y el hook responde desde donde queda instalado |

## Lo que NO se pudo verificar

- **Que Claude Code registre las skills desde la instalación nueva.** Se verificó que los archivos
  queden donde van y que el hook responda invocado exactamente como Claude Code lo invoca, pero
  el registro lo hace la herramienta al arrancar, fuera del alcance de estas pruebas. Lo comprueba
  el que instala: abre Claude Code y escribe `/`.
- **Un solo sistema operativo.** Todo se probó en Windows. Los scripts usan únicamente lo que trae
  el intérprete y arman las rutas con sus funciones, así que no hay motivo para que fallen en otro
  lado — pero **no está medido**, y esa suposición ya salió mal antes: una instalación anterior
  estaba rota en macOS y la prueba pasó porque la herramienta de copiar del autor era la variante
  que sí funcionaba. **Conviene que el primero que lo instale en macOS lo confirme.**
- **El caso de un repo sin control de versiones instalado** se probó vaciando la variable de
  entorno que lo busca; no se probó desinstalándolo.

## Estado

- [x] Las tres skills, con las dos existentes copiadas sin tocar (hashes idénticos al fuente).
- [x] La skill genérica: sin una tecnología, sin un comando, sin un número. Verificado por un
      control que lo mide, y ese control verificado por mutación.
- [x] El hook, con sus 18 casos y sus 5 mutaciones.
- [x] El instalador, con sus 8 casos y sus 5 mutaciones.
- [x] El README, con la instalación probada en una configuración limpia.
- [x] Este archivo de rastro.
- [ ] Confirmar la instalación en macOS. Queda para el primero que la haga ahí.
