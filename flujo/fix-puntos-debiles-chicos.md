# Los cuatro puntos débiles chicos

## Objetivo

Cerrar cuatro huecos del propio flujo-loop (plan de mejoras, sección 4, puntos 2 a 5): el
recordatorio del hook desfasado, "cuándo corre cada skill suelta", el Paso 0 que sólo escribe en
`CLAUDE.md`, y el idioma de `grilling` y `test-driven-development`.

## Decisiones

Todas vienen de `docs/plan-de-mejoras.md`, sección 6 ("Decidido"), que gana sobre lo anterior.

| decisión | por qué |
|---|---|
| El recordatorio del hook suma el Paso 0, el Paso 5 y `/seguridad-de-skills` | Se inyecta en cada mensaje; si no nombra el resto del procedimiento, la persona nunca se entera de que existe |
| Los disparadores de las tres skills sueltas van en el Paso 5, por archivo o contenido | Un disparador por archivo se puede verificar; "cuando haga falta" lo decide el agente (sección 6) |
| `skill-scanner` corre dentro de `/seguridad-de-skills` y su salida se declara "pistas, no un aprobado" | Coincide con lo que ya dice el README sobre esa skill; no se tocó el README |
| El Paso 0 mira `AGENTS.md` y `CLAUDE.md` y escribe en el que ya tenga las reglas; `/init` sólo si no hay ninguno | Dos archivos de reglas, cada uno leído por una herramienta distinta, es el error que esto evita (sección 6) |
| Una línea en inglés al principio de `grilling` y `test-driven-development` | Son copias propias (sin `ORIGEN.json`) y `/grilling` se invoca suelto: ponerlo sólo en `flujo-loop` no alcanza (sección 6) |
| Los chequeos nuevos son estructurales (`faltantes()` en `pruebas/check.mjs`), acotados a la sección | Verifican que esté el disparador o la regla, no la prosa. Acotar a la sección evita que "AGENTS.md" en cualquier parte dé por bueno el Paso 0 |

## Las tres pruebas

### 1 · El fallo observado, textual

Antes de tocar ningún texto de las skills ni el hook:

```
FALLA  5 de 147 chequeos:
  - flujo-loop: el Paso 0 busca los controles en AGENTS.md y CLAUDE.md — falta /AGENTS\.md/
  - flujo-loop: el Paso 5 dice cuándo corre cada skill suelta — falta /gha-security-review[\s\S]{0,300}\.github\/workflows|\.github\/workflows[\s\S]{0,300}gha-security-review/, /secret-serialization[\s\S]{0,400}credencial|credencial[\s\S]{0,400}secret-serialization/, /skill-scanner/
  - seguridad-de-skills: pide skill-scanner cada vez que entra o se actualiza una skill de afuera — falta /skill-scanner/
  - grilling: le habla a la persona en su idioma — falta /(person's|their) (own )?language|language of the person/i
  - test-driven-development: le habla a la persona en su idioma — falta /(person's|their) (own )?language|language of the person/i
```

```
FALLA  1 de 24 casos:
  - el recordatorio nombra el Paso 0, la última puerta y /seguridad-de-skills: el contexto no nombra el Paso 0 (declarar los controles)
```

El auto-test del verificador (`--self-test`) corrió en verde con 40 casos desde el primer momento
porque prueba a `faltantes()` en sí (texto vacío, patrón fuera de la sección, patrón fuera de las
primeras líneas, lista parcial), no los textos reales.

### 2 · La mutación verificada

Cada una con el hash (16 primeros caracteres de sha256) antes, durante y después.

| qué se rompió | hash antes / durante / restaurado | qué se cayó |
|---|---|---|
| en `SKILL.md` se cambió `.github/workflows/` por `ci` en el Paso 5 | `f7d6b5800a397403` / `46e3f5d6932cd0e2` / `f7d6b5800a397403` | sólo "flujo-loop: el Paso 5 dice cuándo corre cada skill suelta", y sólo el patrón de `gha-security-review` |
| en `hook.mjs` el ítem 5 pasó de "La última puerta" a "Cierre" | `82656faaa9b64b18` / `d95c02d1f96e427c` / `82656faaa9b64b18` | sólo "el recordatorio nombra el Paso 0, la última puerta y /seguridad-de-skills", por el Paso 5 |

Restaurado desde una copia en `/tmp` (no con `git checkout`); la suite volvió a verde.

### 3 · Los números de los controles

| control | resultado |
|---|---|
| `node pruebas/check.mjs` | `OK  147 chequeos, sin fallas.` (142 antes) |
| `node pruebas/check.mjs --self-test` | `OK  40 casos del verificador, sin fallas.` (35 antes) |
| `node pruebas/hook.test.mjs` | `OK  24 casos, sin fallas.` (23 antes) |
| `node pruebas/instalar.test.mjs` | `OK  11 casos, sin fallas.` |

## Lo que NO se pudo verificar

- **Que un agente real cumpla los disparadores.** Se verifica que el texto los diga, no que el
  agente corra `gha-security-review` al tocar un workflow; eso se ve en el rastro de la próxima
  tarea que lo toque.
- **Que `grilling` y `test-driven-development` hagan hablar en el idioma de la persona.** Se
  verifica que la línea esté; el efecto depende del modelo.
- **Las otras dos mutaciones posibles** (sacar `AGENTS.md` del Paso 0, sacar la línea de idioma) no
  se probaron una por una: el verificador tiene un patrón por cada una y el auto-test prueba que el
  mecanismo puede fallar, pero no se rompió cada texto.

## Estado

- [x] Débil 2: recordatorio del hook.
- [x] Débil 3: disparadores en el Paso 5 y `skill-scanner` en `seguridad-de-skills`.
- [x] Débil 4: Paso 0 en `AGENTS.md` o `CLAUDE.md`.
- [x] Débil 5: línea de idioma.
- [ ] Publicar: no se pushea ni se abre PR; lo decide el dueño.
