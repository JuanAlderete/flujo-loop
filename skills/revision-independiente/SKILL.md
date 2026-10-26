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

**Siempre**, antes de presentar, salvo un cambio de sólo documentación o texto: ahí no se
corre y el reporte llano lo dice con todas las letras, **"revisión no aplicada: cambio de sólo
docs"**, para que quien audita vea que se salteó y por qué.

⚠️ No es "sólo en cambios grandes". Decidir si el cambio es lo bastante grande lo decide el
mismo agente que lo escribió: sería juzgarse a sí mismo. Con esta regla, si clasifica mal, el
peor caso es un revisor en vez de dos, nunca cero.

## Quién revisa

- **Un revisor**, en un subagente nuevo (u otra sesión del agente)
  que no vio la conversación. Recibe el cambio y lo que se pidió. **No** recibe tu razonamiento ni tus
  explicaciones: si las lee, las cree.
- Si el cambio toca **plata, datos o permisos**, se suma un **segundo revisor**, también ciego,
  que **no ve lo que dijo el primero**. Se lanzan por separado y se comparan después.

## Qué le pedís al revisor

1. **Que lea también a quienes usan el código tocado**, no sólo lo que cambió. Un cambio puede
   estar bien en sí mismo y romper a quien lo llama. Quién más lo usa se busca, no se supone.
2. **Sin un caso concreto no hay hallazgo.** Cada hallazgo trae una entrada o un estado
   específicos y el resultado equivocado que producen. "Podría fallar" no alcanza.
3. **No inflar la prioridad.** Una duda de estilo no es un "Debe". Mejor un hallazgo bien
   puesto que cinco exagerados: la persona decide con ese orden.
4. **Nombrar tres riesgos que el resto del flujo no mira:**
   - romper el **entorno de desarrollo**: variables de entorno, puertos, secretos que ahora
     hacen falta y no estaban;
   - **fugas de una función que está detrás de un flag**: lo que se ve o se ejecuta aunque el
     flag esté apagado;
   - y al revés, **lo que se pidió romper no es un hallazgo**: si el pedido era cambiar ese
     comportamiento, que cambie no se reporta.

## Qué devuelve y qué hacés con eso

Los hallazgos entran **directo** al reporte en lenguaje llano del Paso 5, ya clasificados en
**Debe**, **Conviene** u **Opcional**, y con las cuatro partes de siempre: **qué es**,
**el problema**, **el arreglo** y **qué pasa si no se arregla**.

Después arreglás lo que corresponda, releés el resultado entero, y en el rastro anotás los
hallazgos **y qué se arregló de cada uno**. Un hallazgo no se acepta a ciegas: verificalo antes
de tocar nada, porque un revisor también se equivoca.
