# Skill desenredar-codigo

## Reporte en lenguaje llano

**Qué hace este cambio**

Suma una skill nueva, `/desenredar-codigo`, que ordena el código sin cambiar lo que hace. Tiene
dos modos. El **completo** lo pedís vos: el agente hace un diagnóstico sin tocar nada, te lo
muestra, espera tu OK y recién ahí arregla de a una cosa, cada una con pruebas que fijan el
comportamiento actual y su propio commit. El **acotado** corre solo al final de cada tarea que
cambió código, sólo sobre los archivos de esa tarea, sin pedir OK; si algo falla, deshace toda
la pasada. En ningún modo borra tests. El flujo principal (Paso 4) y el recordatorio del hook ya
lo piden antes de correr los controles finales.

**Debe**

Ninguno.

**Conviene**

1. **Qué es:** el modo acotado depende de que el agente lo ejecute y de que revierta bien.
   **El problema:** los chequeos verifican que el texto lo pida, no que el agente lo cumpla.
   **El arreglo:** mirar el rastro de las próximas tareas: tiene que decir si corrió o se salteó.
   **Qué pasa si no se arregla:** un agente distraído puede saltearlo sin dejar constancia.

**Opcional**

2. **Qué es:** no se pudo correr el escáner de skills (`scan_skill.py`). **El problema:** falta
   el módulo `yaml` en este Python. **El arreglo:** instalarlo y correr el escáner. **Qué pasa si
   no se arregla:** la revisión de la skill queda sólo con la lectura manual.

**Veredicto**

Se puede presentar. Es texto de skill, chequeos y un párrafo del recordatorio; no toca cómo
funcionan los hooks de seguridad.

**Lo que no se revisó**

- Que un agente real use los dos modos como están escritos.
- Revisión independiente y revisión de seguridad del Paso 5: las corre quien coordina.
- El escáner de skills (ver Opcional 2).

## Objetivo

Sumar una skill propia, adaptada de `untangle-codebase` (caldoai/skills, MIT), en dos modos, y
engancharla al Paso 4 de `flujo-loop`.

## Decisiones

| decisión | por qué |
|---|---|
| 1 · Una sola skill en `skills/desenredar-codigo/` | `instalar.mjs` la descubre sola; `ai-workflow` sólo la nombra |
| 2 · Skill propia, sin `ORIGEN.json`, con `LICENSE` MIT de Maze y crédito con el commit | Está muy adaptada: no es copia fija. La licencia obliga a conservar el aviso |
| 3 · Nombre `desenredar-codigo`, cuerpo en español con voseo | Igual que las otras skills propias |
| 4 · Dos fases en modo completo: diagnóstico de sólo lectura, esperar OK, y recién ahí arreglar de a una con pruebas de caracterización y commit propio | Reemplaza el "arreglá todo de una y verificá al final" original |
| 5 · Frontmatter con `argument-hint` y `user-invocable: true`, **sin** `disable-model-invocation` | Corregida: el agente tiene que poder invocarla en el modo acotado |
| 6 · Extras Comentarios y Tests en una sola pregunta; nunca se borran tests | Un test que no atraparía un error sólo se señala; lo decide la persona |
| 7 · Hasta 2 vueltas de re-chequeo con subagentes; un hallazgo no amplía el alcance | Reemplaza "repetir hasta que no quede nada"; regla de `flujo-loop` |
| 8 · Mapea las tres pruebas de `flujo-loop` | Fallo = pruebas de caracterización en verde + línea base; mutación = romper una costura; números = mismos conteos |
| 9 · Ya no es un punto del Paso 3 | Reemplazada por la 17: va en el Paso 4 |
| 10 · Requisitos en `pruebas/check.mjs` y la skill en la lista de `instalar.test.mjs`, con RED observado antes | TDD del repo |
| 11 · Rama `feat/desenredar-codigo` y este rastro como documento de tareas | Precedente de `flujo/feat-reporte-llano.md` |
| 12 · Fila en el README con crédito al origen | El README lista todas las skills |
| 13 · Mutación de esta prueba: quitar "Nunca borrás tests" | Es la invariante más cara de perder |
| 14 · Dos modos: completo (a pedido) y acotado (fin de tarea, sólo archivos tocados, sin pedir OK) | El orden preventivo en cada tarea evita deuda sin esperar a una limpieza grande |
| 15 · El acotado se saltea si la tarea no cambió código o el cambio es trivial; el salteo y su motivo van al rastro | Sin código que ordenar sería costo sin beneficio; que quede anotado para auditar |
| 16 · Red de seguridad del acotado: sólo reorganizar, pruebas de caracterización si faltan, controles completos, revertir la pasada entera si algo falla, commit `refactor:` aparte, nunca borrar tests | Es la única forma de sumar un cambio sin pedir OK sin arriesgar la tarea |
| 17 · Se engancha en el Paso 4 de `flujo-loop` (antes de los controles) y en el recordatorio del hook; `ai-workflow` lo referencia por nombre entre TDD y verificación | El agente lo recibe en cada mensaje; el recordatorio ya tenía casos de prueba, así que se sumó otro |

## Las tres pruebas

### 1 · El fallo observado, textual

Antes de escribir la skill (requisitos, caso del hook y lista del instalador ya agregados):

```
FALLA  11 de 188 chequeos:
  - desenredar-codigo: falta la carpeta        (10 veces)
  - flujo-loop: el Paso 4 corre /desenredar-codigo en modo acotado sobre lo que tocó la tarea, antes de los controles, y anota el salteo — falta /Antes de correr los controles[\s\S]{0,500}`\/desenredar-codigo`[\s\S]{0,200}modo acotado[\s\S]{0,300}archivos que tocó la tarea/, /se saltea[\s\S]{0,300}rastro/
FALLA  1 de 114 casos:
  - el recordatorio manda desenredar en modo acotado antes de los controles: el contexto no nombra /desenredar-codigo en modo acotado
FALLA  1 de 17 casos:
  - configuración limpia: copia las skills y escribe los dos enganches: no copió desenredar-codigo
```

Una primera ronda de RED (con el diseño anterior, de un solo modo y con la bandera de invocación
manual) dio `FALLA 8 de 185 chequeos` y se descartó al cambiar el diseño; ésta es la vigente.
Tras escribir el texto, tres patrones se corrigieron por mayúsculas y saltos de línea (no el
texto): `vínculos ocultos`, `su propio commit` y `Esperá el OK`.

### 2 · La mutación verificada

| qué se rompió | hash antes / durante / restaurado | qué se cayó |
|---|---|---|
| en `skills/desenredar-codigo/SKILL.md`, "Nunca borrás tests" pasó a "Borrás tests" (2 apariciones) | `052cc1774f102f59` / `7f9992b7b2e58999` / `052cc1774f102f59` | 2 de 195: el requisito de los extras y el de la red de seguridad del modo acotado, ambos `falta /Nunca borrás tests/` |

Hash = 16 primeros caracteres de sha256. Restaurado desde una copia; la suite volvió a verde.

### 3 · Los números de los controles

| control | resultado |
|---|---|
| `node pruebas/check.mjs` | `OK  195 chequeos, sin fallas.` (177 antes) |
| `node pruebas/check.mjs --self-test` | `OK  40 casos del verificador, sin fallas.` (40 antes) |
| `node pruebas/hook.test.mjs` | `OK  114 casos, sin fallas.` (113 antes) |
| `node pruebas/instalar.test.mjs` | `OK  17 casos, sin fallas.` (17 antes) |
| `node instalar.mjs --simular` | lista `desenredar-codigo` entre las skills; no se instaló nada |

## Lo que NO se pudo verificar

- **Que un agente real ejecute los dos modos como están escritos.** Los chequeos verifican que el
  texto pida cada invariante, no que se cumpla.
- **El escáner de skills.** `scan_skill.py` falla con `ModuleNotFoundError: No module named 'yaml'`
  y no se instaló nada. En su lugar: lectura completa, sin caracteres invisibles ni comandos
  ejecutables al cargar, sin enlaces salvo el crédito.
- **Mutaciones del resto de los patrones.** Se rompió una invariante, no cada una.
- **Revisión independiente y de seguridad del Paso 5**: pendientes de quien coordina.

## Estado

| tarea | ruta | evidencia | commit |
|---|---|---|---|
| T1 · RED: requisitos, caso del hook y lista del instalador | inline | fallos textuales arriba | incluido en T2 y T3 (tests junto al comportamiento) |
| T2 · Skill, `LICENSE`, fila del README y sus requisitos | inline (un solo escritor) | `check.mjs` 194, `instalar.test.mjs` 17 | `3c8eeeb` feat(desenredar-codigo): add skill with full and scoped modes |
| T3 · Paso 4, recordatorio del hook y sus pruebas | inline | `check.mjs` 195, `hook.test.mjs` 114 | `bb7179e` feat(flujo-loop): run desenredar-codigo scoped mode before the final controls |
| T4 · Este rastro | inline | los cuatro controles en verde | ver `git log` (docs(flujo)) |

- [x] T1  - [x] T2  - [x] T3  - [x] T4
- Pendiente: `ai-workflow` lo cambia quien coordina, fuera de este repo.
