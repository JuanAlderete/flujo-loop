# Plan de automatización

## Reporte en lenguaje llano

**Qué hace este cambio.** Agrega un plan nuevo para que el flujo pida menos permisos, tarde menos
y deje menos errores: los controles corren en la máquina y no se repiten si el código no cambió,
el agente sube la rama y abre el PR solo, y cada cambio pasa por una sola revisión. El merge sigue
siendo de la persona. Todavía no implementa nada: es el plan.

**Hallazgos**

*Debe*

Ninguno.

*Conviene*

Ninguno.

*Opcional*

Ninguno.

**Veredicto:** se puede presentar.

**Lo que no se revisó**

- Revisión no aplicada: cambio de sólo docs. Es un plan que ninguna skill, hook ni configuración
  lee como instrucción.

## Objetivo

Dejar escrito el plan acordado en el `/grilling` del 2026-11-04, en `docs/plan-de-automatizacion.md`.

## Decisiones

| decisión | por qué |
|---|---|
| Plan nuevo, separado del anterior | Decisión Q16: el anterior está terminado y queda como registro |
| Cada punto dice qué pasó en la sesión que lo motiva | Que el plan se pueda auditar contra hechos, no contra ideas |
| Se sumó un paso 0: instalar flujo-loop en la máquina | Se encontró mientras se escribía: `~/.claude/settings.json` no tiene los enganches y `~/.claude/skills/flujo-loop` no existe. Por eso los pushes de la sesión pasaron y el `Stop` nunca corrió |

## Las tres pruebas

### 1 · El fallo observado, textual

No aplica: no hay comportamiento nuevo. Lo que se verificó para escribir el plan:

```
$ grep -n "flujo-loop" ~/.claude/settings.json
(sin resultados)
$ ls ~/.claude/skills/flujo-loop
ls: cannot access 'C:/Users/Alderete/.claude/skills/flujo-loop': No such file or directory
```

### 2 · La mutación verificada

No aplica: no hay un control nuevo.

### 3 · Los números de los controles

| control | resultado |
|---|---|
| `pruebas/check.mjs` | 177 chequeos, sin fallas |
| `pruebas/check.mjs --self-test` | 40 casos, sin fallas |
| `pruebas/hook.test.mjs` | 113 casos, sin fallas |
| `pruebas/instalar.test.mjs` | 17 casos, sin fallas |

## Lo que no se pudo verificar

- Cuánto se acelera `hook.test.mjs` en paralelo: se mide cuando se implemente.
- Que el `Stop` con constancia no moleste en tareas sin código: se ve al implementarlo.
