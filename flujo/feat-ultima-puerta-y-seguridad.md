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
| `pruebas/check.mjs` | 52 chequeos, sin fallas |
| `pruebas/check.mjs --self-test` | 35 casos, sin fallas |
| `pruebas/hook.test.mjs` | 18 casos, sin fallas |
| `pruebas/instalar.test.mjs` | 11 casos, sin fallas |

## Lo que NO se pudo verificar

- **Que Claude Code registre las dos skills nuevas** desde la instalación. Se verificó que los
  archivos queden donde van; el registro lo hace la herramienta al arrancar.
- **Que el agente efectivamente cargue `owasp-top-10` en la última puerta.** El paso está escrito
  y es obligatorio, pero que un agente lo cumpla se ve en el rastro de la próxima tarea, no acá.
- **El checkout en otra máquina con `core.autocrlf`.** El `.gitattributes` está para eso, y en
  este clon se verificó que los archivos quedan con fin de línea de Unix — pero no se probó un
  clon nuevo en otra computadora.

## Estado

- [x] La última puerta en la skill genérica, sin acoplamiento (guard en verde).
- [x] `owasp-top-10` copiada byte a byte, revisada, con `ORIGEN.json`.
- [x] El instalador verifica las skills de afuera antes de copiar nada.
- [x] `seguridad-de-skills`.
- [x] El guard sin los dos rojos falsos.
- [x] El README.
- [ ] Publicar: lo decide el dueño.
