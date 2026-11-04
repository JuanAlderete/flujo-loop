# Plan de automatización de flujo-loop

Armado el 2026-11-04. Es un plan, no está implementado.

**Objetivo:** que el flujo pida intervención humana sólo donde hace falta, tarde menos y deje
menos errores. Sin CI en GitHub: los minutos se agotan rápido. Los controles corren en la máquina
de quien trabaja.

**La intervención humana queda en tres momentos:** el `/grilling` del principio, el merge del
final, y cuando un control frena algo peligroso o falta una decisión de la persona.

> Las decisiones salen del `/grilling` del 2026-11-04, en tres rondas (Q1 a Q16). Todas se
> aceptaron como estaban recomendadas.

---

## Por qué: lo que pasó en la sesión del 2026-11-04

Cada punto sale de algo que pasó trabajando en la mejora 2.9, no de una idea suelta.

| qué pasó | punto del plan |
|---|---|
| Se trabajó sobre un `main` local 23 commits atrás de `origin/main`, y se mergeó encima antes de verlo | 1 |
| `skill-scanner` no pudo correr: no hay `uv` ni Python en la máquina, y se supo a mitad de la tarea | 1 |
| Se pidió permiso para cada push y cada PR. El control real es el merge | 2 |
| Las cuatro suites se corrieron enteras unas 8 veces, varias sobre código que no había cambiado | 3 |
| Los números del rastro se copiaron a mano y quedaron viejos después de un rebase | 3 |
| 3 de 8 mutaciones fallaron al aplicarse (`sed` con CRLF, escapado en `node -e`, un comando colgado). Una pareció sobrevivir sin haberse aplicado | 5 |
| `hook.test.mjs` tarda 45 s de los ~50 s de una corrida completa: arma 32 repos y lanza el hook 35 veces, en serie | 6 |
| El mismo cambio se revisó dos veces: judgment-day (2 jueces) y `/revision-independiente` (2 vueltas), entre 30 s y 4 min y medio cada agente | 7 |
| flujo-loop no estaba instalado en la máquina que lo desarrolla, así que ni el guardrail ni el `Stop` corrieron | 0 |

Tiempos medidos el 2026-11-04 en Windows: `check.mjs` 1 s, `check.mjs --self-test` menos de
1 s, `hook.test.mjs` 45 s, `instalar.test.mjs` 4 s.

---

## 0. Antes de empezar: instalar flujo-loop en la máquina que lo desarrolla

Hoy `~/.claude/settings.json` no tiene los enganches y `~/.claude/skills/flujo-loop` no existe.
Hay que correr `node instalar.mjs` antes del punto 1, para que cada cambio de este plan pase por
el flujo que modifica.

## 1. Chequeo de arranque · avisa, no bloquea

- **Cuándo:** al empezar cada sesión, en un repo con `.flujo-loop`.
- **Qué mira:**
  - con `git fetch`, si la rama base está atrás de `origin`;
  - si falta una herramienta que el flujo usa, por ejemplo Python o `uv` para `skill-scanner`.
- **Qué hace:** avisa. No bloquea, porque una rama atrasada no siempre es un problema y lo decide
  la persona. Si algo falla (sin red, sin git), no dice nada, como el resto del hook.

## 2. Push y PR automáticos · el merge sigue siendo humano

- **El guardrail deja pasar** el push a ramas de trabajo.
- **Sigue frenando** el push a la rama principal, con `--force` y con `--delete`.
- **El PR lo abre el agente** con `gh pr create`, al terminar el Paso 5 y sólo con todo en verde:
  la constancia al día (punto 3), las revisiones hechas y el rastro completo. Si algo falta, no se
  abre y el agente dice qué falta.
- **La descripción del PR** es el reporte en lenguaje llano, el mismo texto del rastro.
- **El merge lo hace siempre la persona.** El equipo instala desde `main`.

## 3. CI local con constancia · para cualquier proyecto

- **Dónde se declaran los controles:** en el marcador `.flujo-loop`, uno por línea:

  ```
  control: npm run lint
  control: npm test
  ```

  `AGENTS.md` (o `CLAUDE.md`) sólo dice que los controles están en `.flujo-loop`, para que no
  haya dos listas que se desfasen. El Paso 0 los escribe ahí.
- **Cómo corren:** un comando que se instala con la skill, al lado del hook. Corre los controles
  en el orden declarado, uno atrás de otro, y **no se corta** en el primero que falla: corren todos
  y se reporta cada uno (es lo que ya exige el Paso 4). En paralelo no: un control puede depender
  de otro.
- **La constancia:**
  - Es una huella de todos los archivos versionados y nuevos, sin los ignorados por git y sin
    `flujo/`, más el resultado de cada control.
  - Queda en un archivo ignorado por git, porque es de esa máquina.
  - Si el código no cambió desde la última corrida en verde, no vuelve a correr: muestra la
    constancia.
- **Los números al rastro:** el comando escribe la huella y los números **sólo** dentro de un
  bloque marcado en "Los números de los controles":

  ```
  <!-- controles -->
  …
  <!-- /controles -->
  ```

  Si el bloque no existe, lo agrega al final de esa sección. Nunca toca nada fuera del bloque.
- **El cierre la exige:** el `Stop` bloquea si hay cambios de código posteriores a la última
  corrida en verde. Si el proyecto no declara controles, no se exige nada. Ante un error propio,
  el hook no bloquea.

## 4. Sólo la suite tocada mientras se trabaja · regla, sin automatizar

Una regla nueva en el Paso 4: mientras trabajás, corré sólo el test de lo que tocaste, que
cualquier herramienta de tests sabe hacer; y todos los controles juntos una sola vez, al final,
con el punto 3. Qué control corresponde a cada archivo depende de cada proyecto, y automatizarlo
agrega complejidad que no paga.

## 5. Script de mutaciones · para cualquier proyecto

Se instala con la skill, al lado del hook:

```
node mutar.mjs <archivo> "<texto>" "<reemplazo>" -- <comando del test>
```

- Exige que el texto aparezca **exactamente una vez**. Si no, no toca nada.
- Corre el comando.
- **Restaura el archivo siempre**, aunque el comando falle o se corte.
- Comprueba que el archivo quedó idéntico al original.
- Imprime una línea lista para pegar en el rastro: qué se cambió y qué cayó. No escribe el
  rastro: tiene forma libre, y un script que lo edita se rompe fácil.

## 6. `hook.test.mjs` más rápido

Los casos corren en paralelo. Aceptación: los mismos 113 casos con el mismo resultado, y el
tiempo medido antes y después. No se promete un número.

## 7. Una sola revisión por cambio

Queda `/revision-independiente`, que es del flujo y la recibe todo el equipo. En los repos con
`.flujo-loop`, el `ai-workflow` personal del dueño saltea judgment-day. Ese cambio es en
`~/.claude/skills/ai-workflow`, fuera de este repo.

---

## Orden de entrega

Un PR por punto. Cada merge lo hace el dueño.

0. Instalar flujo-loop en la máquina (no es un PR).
1. Chequeo de arranque.
2. Push y PR automáticos.
3. CI local con constancia.
4. Regla de la suite tocada.
5. Script de mutaciones.
6. `hook.test.mjs` más rápido.
7. Una sola revisión (fuera del repo).

Push y PR van segundos porque sacan intervención desde ya. Cada uno con TDD sobre `pruebas/`,
su rastro y `/revision-independiente`. Las correcciones de la primera vuelta de revisión quedan
pre-autorizadas; lo que quede después de la segunda va al reporte, en Debe.

## Decidido (`/grilling` del 2026-11-04)

| tema | decisión | por qué |
|---|---|---|
| Alcance (Q1) | CI local, suite tocada y mutaciones son para cualquier proyecto | El tiempo que molesta está en los proyectos; las suites de flujo-loop tardan ~50 s |
| Push (Q2) | Libre a ramas de trabajo; frenado a la principal, `--force` y `--delete` | El control que importa es el merge |
| Revisión (Q3) | Sólo `/revision-independiente`; `ai-workflow` saltea judgment-day en repos con `.flujo-loop` | Dos revisiones del mismo cambio fueron lo más lento de la sesión |
| Arranque (Q4) | Avisa, no bloquea | Una rama atrasada no siempre es un problema |
| `hook.test` (Q5) | Paralelo, mismos casos, tiempo medido | Sin número prometido |
| Entrega (Q6) | Plan en su PR, después un PR por punto | Cada merge lo decide el dueño |
| Correcciones (Q7) | Primera vuelta pre-autorizada | Menos interrupciones |
| Dónde se declaran (Q8) | En `.flujo-loop`, `control: <comando>` | Reusa un archivo que ya existe y que el hook ya lee |
| Cómo corren (Q9) | En orden, en serie, sin cortarse | Lo exige el Paso 4; el ahorro está en la constancia |
| Huella (Q10) | Versionados y nuevos, sin ignorados y sin `flujo/`; archivo ignorado por git | Escribir el rastro no obliga a volver a correr |
| Cierre (Q11) | El `Stop` bloquea si hay código cambiado después del último verde | Es lo que reemplaza a la CI de GitHub |
| Suite tocada (Q12) | Regla, sin automatizar | El mapeo depende de cada proyecto |
| Mutaciones (Q13) | Script que restaura siempre e imprime la línea | Los fallos manuales de la sesión |
| Números (Q14) | Sólo dentro de un bloque marcado | Automatizar sin que un script edite el rastro libre |
| PR (Q15) | Al final del Paso 5, todo en verde, con el reporte llano | Quien no programa lee el PR |
| Documento (Q16) | Plan nuevo; el anterior queda como registro | Mezclarlos confunde qué está hecho |
