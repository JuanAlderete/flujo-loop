---
name: revision-independiente
description: "La revisión de corrección de un cambio, hecha por alguien que no vio cómo se hizo: busca lo que está mal o se rompe, no lo inseguro. Usala SIEMPRE antes de presentar un cambio que toque algo más que documentación. No la uses para la seguridad: para eso está la revisión de seguridad del Paso 5."
user-invocable: true
---

# Revisión independiente

Quien escribió un cambio es el peor para revisarlo: ya sabe qué quiso decir, así que lee lo que
quiso y no lo que quedó. Esta revisión la hace **otro**, que sólo ve el resultado.

Es aparte de la revisión de seguridad. Ésa busca cómo atacar el cambio; ésta busca **qué se
rompe o da un resultado incorrecto** cuando alguien lo usa normalmente.

## Cuándo corre

**Siempre**, antes de presentar. La única excepción es un cambio de **documentación pura**:
archivos de documentación (un `.md` de explicación, el README) o comentarios del código, que
ninguna herramienta, skill, hook ni configuración lee como instrucción. En ese caso no se corre
y el reporte llano lo dice con todas las letras en "Lo que no se revisó":
**"revisión no aplicada: cambio de sólo docs"**. Así quien audita ve que se salteó y por qué.

⚠️ Aunque sean texto, **no son documentación** las skills, las instrucciones o prompts de un
agente, el archivo de reglas del proyecto, las plantillas, el texto de pantalla, los mensajes
de error y los mails: se comportan como código, y un error ahí cambia lo que hace el sistema.
**En la duda, se corre.**

⚠️ No es "sólo en cambios grandes". Decidir si el cambio es lo bastante grande lo decide el
mismo agente que lo escribió: sería juzgarse a sí mismo. Con esta regla, si clasifica mal, el
peor caso es un revisor en vez de dos, nunca cero.

## Quién revisa

- **Un revisor**, en un subagente nuevo (u otra sesión del agente)
  que no vio la conversación. Recibe el cambio, lo que se pidió y
  acceso de lectura al repositorio (para buscar a quién más usa lo que se tocó): "el cambio"
  no es sólo el diff. **No** recibe tu razonamiento ni tus explicaciones: si las lee, las cree.
- Si el cambio toca **plata, datos o permisos**, se suma un **segundo revisor**, también ciego,
  que **no ve lo que dijo el primero**. Se lanzan por separado. Por "datos" se entiende:
  escrituras a la base, migraciones, consultas que filtran por usuario o empresa, roles y
  permisos, y cálculos de importes. **En la duda, dos.**
- Al juntar los resultados, unificá los hallazgos repetidos en uno solo; si dos hallazgos se
  contradicen, no elijas: marcalo y lo decide la persona.

## Qué le pedís al revisor

1. **Que lea también a quienes usan el código tocado**, no sólo lo que cambió. Un cambio puede
   estar bien en sí mismo y romper a quien lo llama. Quién más lo usa se busca, no se supone.
2. **Sin un caso concreto no hay hallazgo.** Cada hallazgo trae una entrada o un estado
   específicos y el resultado equivocado que producen. "Podría fallar" no alcanza.
3. **No inflar la prioridad.** Una duda de estilo no es un "Debe". Mejor un hallazgo bien
   puesto que cinco exagerados: la persona decide con ese orden.
4. **Nombrar siete riesgos que el resto del flujo no mira:**
   - romper el **entorno de desarrollo**: variables de entorno, puertos, secretos que ahora
     hacen falta y no estaban;
   - **fugas de una función que está detrás de un flag**: lo que se ve o se ejecuta aunque el
     flag esté apagado;
   - **lo que se pidió romper no es un hallazgo**: si el pedido era cambiar ese
     comportamiento, que cambie no se reporta;
   - **en los datos** (los ejemplos son de PostgreSQL; en otro motor, buscá el equivalente):
     - **reintentar una escritura con otra clave**: el reintento de un cobro, un pedido o lo
       que mueva plata o stock lleva la **misma clave de idempotencia** que el primero, y el
       sistema tiene que rechazar el duplicado por esa clave; con una clave nueva la operación
       se aplica dos veces;
     - **`EXPLAIN ANALYZE` ejecuta la consulta**: no es una lectura. Escribe de verdad con un
       `UPDATE`, `DELETE` o `INSERT`, y con un `SELECT` que llama a una función con efectos. Va
       dentro de `BEGIN … ROLLBACK` (que no deshace secuencias ni llamadas externas), y nunca
       contra producción sin autorización;
     - **crear un índice sin `CONCURRENTLY`** en una tabla en uso bloquea las escrituras, no
       las lecturas. `CREATE INDEX CONCURRENTLY` no puede ir dentro de una transacción (y casi
       toda herramienta de migraciones envuelve cada una en una), así que va afuera; si falla a
       mitad deja un índice INVALID que se borra a mano. `REINDEX … CONCURRENTLY` pide
       PostgreSQL 12 o más;
     - **`VACUUM FULL` no es mantenimiento de rutina**: bloquea lecturas y escrituras y
       reescribe la tabla; el `VACUUM` común no.

## Qué devuelve y qué hacés con eso

Los hallazgos entran **directo** al reporte en lenguaje llano del Paso 5, ya clasificados en
**Debe**, **Conviene** u **Opcional**, y con las cuatro partes de siempre: **qué es**,
**el problema**, **el arreglo** y **qué pasa si no se arregla**.

Después arreglás lo que corresponda, releés el resultado entero, y en el rastro anotás los
hallazgos **y qué se arregló de cada uno**. Un hallazgo no se acepta a ciegas: verificalo antes
de tocar nada, porque un revisor también se equivoca. Cada hallazgo que verificaste y
descartaste también va al rastro, con el motivo: si no, quien audita no puede distinguirlo de
uno que se olvidó.

## Cuántas vueltas

**Hasta 2 vueltas** de arreglar y volver a revisar, y no más. Sin un tope, el agente da vueltas
sin fin o declara resuelto lo que no lo está.

1. **Primera vuelta:** la revisión devuelve hallazgos, vos arreglás lo que corresponda y se
   vuelve a revisar.
2. **Segunda vuelta:** lo mismo, una sola vez más.

Lo que el revisor sigue encontrando después de la segunda vuelta **no se vuelve a arreglar**: va
al reporte llano en **Debe**, marcado "no se pudo resolver", con las cuatro partes de siempre.
Eso lo decide la persona, no vos.
