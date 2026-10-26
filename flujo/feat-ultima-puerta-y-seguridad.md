# La última puerta y las dos skills de seguridad

## Objetivo

1. Que el trabajo se presente **una sola vez, terminado**: los controles del servidor se
   agotaron en días por presentar de a pedacitos.
2. Que la seguridad entre en el procedimiento: el código de la app contra el **OWASP Top
   10:2025**, y las skills mismas contra el **OWASP Agentic Skills Top 10**.

## Decisiones

| decisión | por qué |
|---|---|
| La última puerta va en la skill genérica, sin nombrar herramientas | Es un principio del procedimiento; cómo se corren los controles lo declara cada proyecto. El guard de acoplamiento lo verifica |
| Para la app, copia fija de `owasp-top-10` de microsoft/hve-core | Está alineada a la edición vigente (2025), trae la atribución de OWASP escrita, y no hay que mantener diez documentos propios |
| Copia **byte a byte**, fijada a un commit, con `ORIGEN.json` y hashes | Una instalación en vivo o una actualización automática es justo lo que AST02 y AST07 describen: texto ajeno que entra sin que nadie lo lea |
| El instalador verifica TODO antes de copiar NADA | Una instalación a medias es peor que ninguna |
| También rechaza un archivo que el origen no lista | AST01: un script agregado al lado de una skill legítima es la forma más simple de meter uno malicioso |
| `.gitattributes` con `-text` para la copia | Con `core.autocrlf` en Windows git convierte los fines de línea al hacer checkout, los hashes dejan de coincidir y el instalador se niega. Rojo falso garantizado en la máquina de cualquiera del equipo |
| `seguridad-de-skills` escrita por nosotros | No existe ninguna skill para AST10 — ni de OWASP ni de Microsoft. Es la checklist de 72 chequeos resumida en diez preguntas, con palabras propias y los IDs citados |
| `owasp-agentic` de Microsoft NO se usó | Es el *OWASP Top 10 for Agentic Applications*, otro proyecto: riesgos de agentes en producción, no de skills |
| La revisión de seguridad es un paso obligatorio de la última puerta | `owasp-top-10` es `user-invocable: false`: si nadie la pide, el agente la carga sólo si se le ocurre |
| Se arreglaron dos rojos falsos del guard, no la copia | La copia no se toca. `metadata:` con campos sangrados es YAML válido, y un nombre de archivo sin ruta dentro de la descripción de una subcarpeta existe ahí |

## Revisión de la skill copiada (`/seguridad-de-skills`)

| chequeo | resultado |
|---|---|
| fuente y commit | `microsoft/hve-core`, `.github/skills/security/owasp-top-10`, commit `1bf0c2bf858692f9122807f59b20b4f7d9d5b677` |
| byte a byte | los 12 archivos comparados contra el blob del árbol de ese commit (`git hash-object --no-filters` contra la API): 12 idénticos, 0 distintos |
| qué se leyó | los 12 archivos enteros, por un revisor aparte que los trató como datos |
| instrucciones de actuar | ninguna. Lo único con forma de comando son ejemplos de ataque dentro de los escenarios (referencias 01 y 05) |
| contenido escondido | ninguno: sin comentarios ocultos, sin caracteres invisibles, sin bloques codificados, sin líneas larguísimas |
| privilegios | no declara herramientas, enganches ni scripts. `user-invocable: false` |
| instrucciones externas | ninguna se trae al correr; los links son a OWASP y a la licencia |
| licencia | contenido CC BY-SA 4.0 de OWASP, atribución en su `SKILL.md`; repo MIT |
| veredicto | se instala como base de consulta |

## Revisión de `sentry-security-review` (`/seguridad-de-skills`)

`owasp-top-10` dice **contra qué** revisar; le faltaba **cómo**. La de Sentry es el
procedimiento: seguir el dato desde donde entra y reportar sólo lo confirmado.

| chequeo | resultado |
|---|---|
| fuente y commit | `getsentry/skills`, `skills/security-review`, commit `3482d8dd35315adf34607f1c12bf793e14890bfe` |
| byte a byte | 22 archivos comparados contra el blob de ese commit: 22 idénticos, 0 distintos |
| qué se leyó | los 22 enteros, por un revisor aparte que los trató como datos |
| instrucciones de actuar | ninguna en el `SKILL.md`. Las referencias traen comandos de ejemplo (`npm ci`, `pip install`, escaneos) como documentación |
| contenido escondido | un comentario oculto, inofensivo: la atribución a OWASP. Dos letras cirílicas, que son el ejemplo de un ataque por homoglifos |
| privilegios | pedía `Bash` y `Task` sin usarlos nunca → **modificado a `Read Grep Glob`** |
| nombre | `security-review` reemplaza en silencio al comando que trae Claude Code (docs oficiales: *"Your skill replaces the bundled command"*) → **modificado a `sentry-security-review`** |
| archivos que nombra y no tiene | 7 guías (Go, Rust, Java, Kubernetes, Terraform, CI/CD, cloud) que **tampoco existen en su fuente**. Declaradas en `faltan_en_origen` |
| licencia | Apache-2.0; referencias derivadas del OWASP Cheat Sheet Series, CC BY-SA 4.0 |
| reglas peligrosas para una app multi-empresa | tres: no reportar lo que exige estar autenticado, dar por segura una búsqueda por ID sin limitar por empresa, y confiar en datos firmados de la sesión. **El paso 5 de `flujo-loop` las contradice y gana** |
| veredicto | se instala, con las dos modificaciones y la corrección del paso 5 |

Las dos modificaciones van en su `ORIGEN.json` con el hash del original: deshaciendo esas dos
líneas, el archivo da exactamente ese hash. Verificado.

## Revisión de `gha-security-review`, `secret-serialization` y `skill-scanner`

Las tres de `getsentry/skills`, cada una fijada al último commit de su carpeta; 20 archivos
comparados contra su blob: 20 idénticos. Leídas enteras por un revisor aparte, sin correr nada.

| skill | commit | hallazgos | qué se hizo |
|---|---|---|---|
| `gha-security-review` | `b11ee516` | pide `Bash` y `Task`, no los usa. Falso negativo: `${{ }}` en `with:` "seguro", que en `github-script` `script:` es inyección | `allowed-tools` → `Read Grep Glob`; el falso negativo, en `advertencias` |
| `secret-serialization` | `473d2594` | ninguno; pide sólo `Read Grep Glob` | se copia sin cambios |
| `skill-scanner` | `d18b7aa8` | pide `Bash` para `uv run`, que baja `pyyaml` de PyPI. El script: sin red, sin `exec`, sin escrituras; sigue enlaces e imprime secretos sin enmascarar; no mira `references/` y confía en `github.com` | `allowed-tools` → `Read Grep Glob`; lo demás, en `advertencias` |

Un `` !`command` `` en `skill-scanner/SKILL.md:109` parecía ejecutarse al cargar la skill. **No
se ejecuta**: la regla oficial es que sólo corre si el `!` va al principio de la línea o después
de un espacio, y acá va después de un acento grave.

🔑 **Regla general que salió de acá**, escrita en `seguridad-de-skills`: la lista de
herramientas pre-aprobadas de una copia de afuera queda en lo mínimo que de verdad usa, con el
cambio registrado. Lo que necesite más, pasa por el pedido de permiso normal.

## El guardrail de git y `/no-entendi` (propias, no copias)

Se evaluaron `git-guardrails-claude-code` y `wait-what` de mattpocock/skills (MIT). **No se
copiaron**, por dos defectos verificados:

- **El guardrail no protege nada en Windows.** Su script lee el comando con `jq`, que no está
  instalado: con `git reset --hard` de entrada dio `jq: command not found` y **salió en 0**, o
  sea que lo dejó pasar en silencio. Además mira sólo la herramienta Bash —por PowerShell pasa
  todo— y le pide al agente editar la configuración a mano, que es lo que el instalador existe
  para evitar.
- **`wait-what` pide re-explicar en inglés técnico simplificado** (ASD-STE100). Para quien no lee
  código y habla español, es lo contrario de lo que hace falta.

Se escribieron propias: el guardrail como un tercer evento del mismo hook (Node, sin `jq`, Bash
y PowerShell, con el instalador cableándolo), y `no-entendi` en español, sólo invocable por la
persona, con crédito a la idea original.

## Proponer y ejecutar las skills

Orden del dueño (2026-10-20), textual: *"siempre que se pueda propongas ejecutar una skill, ya
que los chicos al no tener conocimientos de programacion si vos los orientas con esas cosas
podriamos mejorar mucho el desarrollo. Y siempre que se hable de esa skill que la ejecutes
directamente, NUNCA tomes el contexto de esa skill y la interpretes vos"*.

Va en dos lugares a propósito: en el procedimiento (`flujo-loop`, "Con quién estás
trabajando", puntos 3 y 4) y en el recordatorio que el hook mete en **cada mensaje**. El modo de
falla que corrige es justamente no abrir la skill, así que la regla no puede vivir sólo adentro
de una skill. Fijado por el caso "con marcador inyecta el procedimiento"; sacar la prohibición
de interpretar del recordatorio lo tumba (mutación verificada, archivo restaurado).

## Las tres pruebas

### 1 · El fallo observado, textual

Instalador, antes de implementar la verificación de origen:

```
FALLA  4 de 11 casos:
  - configuración limpia: copia las skills y escribe los dos enganches: no copió owasp-top-10
  - una skill de afuera con sus hashes intactos se instala: no copió la ajena
  - 🔑 una skill de afuera modificada: se niega y NO instala nada: tenía que negarse y salió en 0
  - 🔑 una skill de afuera con un archivo que su origen no tiene: se niega: tenía que negarse y salió en 0
```

Guard, con la copia ya adentro y antes de arreglarlo:

```
FALLA  2 de 47 chequeos:
  - owasp-top-10: el campo "metadata" está mal escrito (vacío)
  - owasp-top-10: nombra "00-vulnerability-index.md" y no existe
```

### 2 · Las mutaciones verificadas

Cada una se aplicó comparando el archivo antes y después, y se restauró con la misma
comparación.

| qué se rompió | qué se cayó |
|---|---|
| el instalador deja de rechazar archivos fuera del origen | sólo "una skill de afuera con un archivo que su origen no tiene" |
| el instalador deja de comparar hashes | sólo "una skill de afuera modificada" |
| el instalador no corta cuando hay diferencias | exactamente los dos casos de skill alterada |
| el guard busca un nombre sin ruta sólo en la raíz | sólo el chequeo de `00-vulnerability-index.md` |
| se saca un archivo de `faltan_en_origen` | sólo los dos chequeos de ese archivo (con ruta y sin ruta) |
| aparece un archivo que estaba declarado como faltante | sólo "declara que falta ... pero existe" |
| el guardrail deja de tratar `push` como peligroso | sólo el caso de los comandos destructivos, en `git push` |
| el guardrail deja de saltear las opciones globales | sólo `git -C otra/carpeta push` |
| el guardrail deja de respetar las comillas | sólo `git commit -m "primero esto; git push despues"`, que pasó a bloquearse |
| `clean` se bloquea con cualquier opción | sólo `git clean -n`, que pasó a bloquearse |
| el guardrail deja de mirar PowerShell | sólo el caso de PowerShell |
| el instalador engancha el guardrail sin `matcher` | sólo la configuración limpia, que exige Bash y PowerShell |

Del guardrail también quedaron dos cosas anotadas:

- **La de las comillas sobrevivió en el primer intento**: ningún caso dependía de ellas
  (`echo "git push"` sale seguro igual, porque la palabra `"git` con la comilla no es git). Se
  sumó el caso del separador adentro de un mensaje de commit, y ahí cae.
- **Una mutación rompió los 22 casos**, y no era una mutación: la consola convirtió el argumento
  `/^-/` en una ruta de Windows y el archivo quedó sin compilar. Se repitió desactivando esa
  conversión y verificando que el archivo compile antes de correr la suite.

⚠️ **Dos cosas que pasaron y quedan anotadas:**

- La tercera mutación **no se aplicó** en el primer intento: el archivo está con fines de línea de
  Windows y el patrón no coincidía. El detector de "la mutación no se aplicó" lo cazó; se repitió
  con un patrón de una línea.
- Una mutación del guard **sobrevivió**: sacar `debajo.length === 0 ||`. Era una condición
  redundante —con nada debajo, la expresión siguiente ya da falso—, así que se sacó del código en
  vez de inventarle un test.

### 3 · Los números de los controles

| control | resultado |
|---|---|
| `pruebas/check.mjs` | 142 chequeos, sin fallas (52 con la primera copia, 103 con la de Sentry) |
| `pruebas/check.mjs --self-test` | 35 casos, sin fallas |
| `pruebas/hook.test.mjs` | 23 casos, sin fallas (18 antes del guardrail) |
| `pruebas/instalar.test.mjs` | 11 casos, sin fallas |

## Lo que NO se pudo verificar

- **Que Claude Code registre las dos skills nuevas** desde la instalación. Se verificó que los
  archivos queden donde van; el registro lo hace la herramienta al arrancar.
- **Que el agente efectivamente cargue `owasp-top-10` en la última puerta.** El paso está escrito
  y es obligatorio, pero que un agente lo cumpla se ve en el rastro de la próxima tarea, no acá.
- **El checkout en OTRA computadora.** En esta se verificó con un clon nuevo y
  `core.autocrlf=true`: las skills propias salieron con fines de línea de Windows, la copia
  conservó los de Unix, y el instalador copió las cinco. En otra máquina y otro sistema
  operativo, no está medido.

## Estado

- [x] La última puerta en la skill genérica, sin acoplamiento (guard en verde).
- [x] `owasp-top-10` copiada byte a byte, revisada, con `ORIGEN.json`.
- [x] El instalador verifica las skills de afuera antes de copiar nada.
- [x] `seguridad-de-skills`.
- [x] El guard sin los dos rojos falsos.
- [x] El README.
- [ ] Publicar: lo decide el dueño.
