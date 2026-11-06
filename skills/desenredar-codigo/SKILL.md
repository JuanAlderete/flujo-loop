---
name: desenredar-codigo
description: "Desenredar el código: encuentra las piezas que cambian juntas sin que se note, las atadas de más y lo sobrante, y las arregla sin cambiar lo que el código hace. Modo completo cuando la persona lo pide (con un área opcional); modo acotado, sólo sobre los archivos tocados, al terminar una tarea que cambió código. No la uses para arreglar bugs ni sumar funciones."
user-invocable: true
argument-hint: "[área o preocupación opcional]"
---

# Desenredar el código

Un código enredado cuesta de tres maneras: el agente lee de más para cada cambio, rompe cosas sin
enterarse y tarda en llegar a la causa de un error. Esta skill lo ordena **sin cambiar lo que
hace**.

Todo sale de una pregunta: **¿estas piezas deberían cambiar juntas?** Cada lugar donde el código
contesta mal es un enredo.

## Dos modos

- **Modo completo**: `/desenredar-codigo [área]`. Lo pide la persona. Todo el código, o el área
  que indique. Primero diagnóstico, después el OK de la persona, después los arreglos.
- **Modo acotado**: lo corrés vos al terminar una tarea que cambió código (Paso 4 de
  `flujo-loop`). Sólo los archivos de la tarea, sin pedir OK. Ver [Modo acotado](#modo-acotado).

## Los extras

Sólo en modo completo. Hacé **una sola pregunta** con estos dos extras y hacé únicamente los que
la persona elija:

| Extra | Qué hace |
|---|---|
| **Comentarios** | Saca los comentarios que sólo repiten lo que dice el código. Quedan los que explican algo de afuera del código (por ejemplo, un servicio que se comporta raro). |
| **Tests** | Señala los tests que no atraparían un error real, y los que fallan sin que haya un error. |

⚠️ **Nunca borrás tests**, en ningún modo ni con ningún extra. Un test que no atraparía un error
real se anota en el diagnóstico con el motivo, y **lo decide la persona**.

## Fase A · Diagnóstico (sólo lectura)

**No cambiás ningún archivo.** Recorré el código y anotá cada enredo, con archivo y línea. Hay
tres clases:

**Vínculos ocultos**: piezas que deben cambiar juntas y el código no lo muestra.
- Copias de una lógica o de un valor: si cambia una, las otras también, y nada lo dice.
- Un módulo que lee algo global o un archivo que escribe otro.
- Una función repartida en carpetas por capa, o código relacionado en carpetas distintas.
- Un orden de llamadas o una convención que los que llaman tienen que saber de memoria.

**Vínculos de más**: piezas atadas que cambian por motivos distintos.
- Quien llama depende de los detalles internos de otro.
- Código estable que importa algo que cambia más seguido.
- Una función general con un parámetro que sólo entiende un flujo.
- Un módulo chato: su interfaz cambia cada vez que cambia su interior.

**Sobrante**: piezas sin motivo propio para cambiar.
- Envoltorios que sólo delegan.
- Puntos de extensión y configuración para cosas que nunca varían.
- Código muerto.

Anotá también los **casos especiales**: un `if` para un solo valor, un parámetro para un solo
llamador, una excepción tragada, un reintento o una espera, un test desactivado. Cada uno es un
requisito que el diseño no contempló: usalos para entender qué necesita el sistema.

Después **rediseñá desde cero**, como si hoy se conocieran los requisitos: buscá el arreglo único
que resuelve varios problemas a la vez (suele no parecerse a ninguno). Que cada arreglo cumpla
tres cosas: lo que cambia junto queda junto, lo que no, queda desatado, y todo depende de lo que
menos cambia. No arregles los casos especiales de a uno.

Escribí el **registro de decisiones**: cada arreglo, con los problemas que resuelve debajo.

```md
- Que el `Dialog` general devuelva el foco a quien lo tenía antes de abrirse.
  - `ui/LogoutDialog.tsx:30` espera un rato y confía en que el campo pueda tomar el foco.
  - `ui/SettingsDialog.tsx:61` prende una bandera global para que el diálogo que abre no robe el foco.
```

Presentale a la persona el diagnóstico y el registro, en lenguaje llano. **Esperá el OK de la
persona** (puede recortar la lista) antes de pasar a la Fase B.

## Fase B · Arreglar de a uno

Cada arreglo del registro aprobado es **una unidad**:

1. **Pruebas de caracterización**: tests que fijan lo que el código hace hoy en lo que vas a
   tocar. Corrélas: tienen que estar en verde antes de tocar el código. Si ya hay tests que lo
   cubren, usalos.
2. El cambio. Las pruebas de caracterización siguen en verde.
3. Los controles del proyecto.
4. Su propio commit, con un mensaje `refactor: ...` que nombra el arreglo.

Los casos especiales que el rediseño vuelve innecesarios se sacan; los que el sistema todavía
necesita se quedan. No busques bugs aparte: si un arreglo estructural arregla uno de paso, bien,
y lo anotás.

## Re-chequeo

Terminados los arreglos, lanzá subagentes nuevos a buscar vínculos ocultos, vínculos de más,
sobrante y casos especiales. **Hasta 2 vueltas** de arreglar y volver a revisar con subagentes;
lo que quede después va al reporte, no a una tercera vuelta.

**Un hallazgo no autoriza ampliar el alcance.** Lo nuevo que caiga fuera del registro aprobado
se anota y lo decide la persona.

Terminaste cuando: quedan los menos casos especiales posibles, un cambio típico cae en un solo
lugar, ningún import apunta a algo que cambia más que quien importa, y el comportamiento es el
mismo que al empezar.

## Modo acotado

Corre al final de cada tarea que cambió código, **después** de que los tests de la tarea están en
verde y **antes** de los controles finales.

**Sólo los archivos que tocó la tarea.** Buscá en ellos las mismas tres clases de enredo y
arreglalos **sin pedir OK**. Lo que encuentres afuera de esos archivos sólo se anota en el
reporte y en el rastro; no se arregla.

**Se saltea** (y el rastro anota que se salteó y por qué) si la tarea no cambió código (sólo
documentación, configuración o texto) o si el cambio es trivial (una línea, o sólo un cambio de
nombre).

**Red de seguridad**:
1. Reorganizás, no cambiás el comportamiento.
2. Si el código tocado no tiene tests, primero escribí pruebas de caracterización que fijen lo
   que hace hoy, y recién entonces cambiás.
3. Corré los controles completos del proyecto.
4. Si algo falla, **revertís la pasada entera** y no la parchees: la tarea queda como estaba
   antes de la pasada, y el rastro anota qué falló.
5. Va en un commit aparte, `refactor: ...`, separado del commit de la tarea.
6. Nunca borrás tests.

## Las tres pruebas

Mapeadas a las tres pruebas de `flujo-loop`:

1. **El fallo observado**: las pruebas de caracterización corridas en verde **antes** de tocar el
   código, más una **línea base** anotada de los controles del proyecto.
2. **La mutación**: rompé a propósito una costura que reorganizaste, anotá qué tests se caen y
   restaurala. Si no se cae ninguno, la costura no está fijada.
3. **Los números**: los controles dan los mismos conteos antes y después.

---

Basada en `untangle-codebase` de caldoai/skills (<https://github.com/caldoai/skills>, MIT,
Copyright (c) 2026 Maze), commit f3cf47774975a7d9fca45730babf4ff7ad765ada. Ésta es propia, en
español, con dos fases, un modo acotado y pruebas antes de cada cambio. La licencia original
está en `LICENSE`.
