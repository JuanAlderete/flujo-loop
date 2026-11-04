# El plan de mejoras, al día

## Reporte en lenguaje llano

**Qué hace este cambio.** El plan de mejoras decía que casi nada estaba hecho, aunque todo ya
estaba en `main`. Ahora cada punto dice que está hecho y en qué PR. Además se tildaron, en los
archivos de rastro, los pendientes que ya se habían cumplido, como "publicar", con el PR que lo
cumplió. Lo único que queda abierto es probar la instalación en una Mac.

**Hallazgos**

*Debe*

Ninguno.

*Conviene*

Ninguno.

*Opcional*

Ninguno.

**Veredicto:** se puede presentar.

**Lo que no se revisó**

- Revisión no aplicada: cambio de sólo docs. Son el plan y los archivos de rastro, que ninguna
  skill, hook ni configuración lee como instrucción. El hook de cierre sólo mira los encabezados
  del rastro de la rama actual, y esos encabezados no se tocaron.

## Objetivo

Que el plan y los rastros digan la verdad sobre lo que ya está hecho.

## Decisiones

| decisión | por qué |
|---|---|
| Cada punto dice en qué PR se hizo | Quien audita lo puede comprobar abriendo el PR, sin reconstruirlo |
| El texto original de cada punto se conserva, tachado o con "Original:" | Es el registro de qué se quería resolver |
| El pendiente de macOS (`flujo/main.md`) queda sin tildar | No se hizo: hace falta una Mac |
| A los rastros viejos sólo se les cambian los casilleros, con la referencia al PR | El resto es evidencia de su momento y no se reescribe |

Los PR salen de `git log --merges main`: #1 seguridad, #3 puntos débiles chicos, #4 reporte
llano, #5 revisión independiente, #6 pantallas y Paso 3 (con el 2.8), #7 puntos débiles grandes,
#8 riesgos de datos y #9 ahorro de tokens. Que cada rastro corresponda a su punto se comprobó
leyendo su objetivo.

## Las tres pruebas

### 1 · El fallo observado, textual

No aplica: no hay comportamiento que probar. El equivalente es el chequeo de los casilleros
antes del cambio, que en `flujo/*.md` encontró 8 sin tildar:

```
flujo/feat-ahorro-de-tokens.md:242:- [ ] Publicar: lo decide el dueño.
flujo/feat-pantallas-y-paso-3.md:189:- [ ] Push, PR y merge: no los hago yo
flujo/feat-puntos-debiles-grandes.md:295:- [ ] Push, PR y merge: no los hago yo
flujo/feat-reporte-llano.md:117:- [ ] Pendientes en otros cambios: …
flujo/feat-revision-independiente.md:178:- [ ] Pendientes en otros cambios: …
flujo/feat-ultima-puerta-y-seguridad.md:198:- [ ] Publicar: lo decide el dueño.
flujo/fix-puntos-debiles-chicos.md:83:- [ ] Publicar: no se pushea ni se abre PR; lo decide el dueño.
flujo/main.md:125:- [ ] Confirmar la instalación en macOS. Queda para el primero que la haga ahí.
```

Después del cambio queda 1 sin tildar, el de macOS.

### 2 · La mutación verificada

No aplica: no hay un control nuevo que romper. Los reemplazos se hicieron con un script que
exige que cada texto aparezca **exactamente una vez** y no escribe nada si alguno falla. El
primer intento falló así ("NO APLICÓ (0 veces)"), porque el plan usa CRLF y los patrones de
varias líneas tenían LF, y el archivo quedó sin tocar (`git diff --quiet`). Se repitió con el fin
de línea del archivo: 23 cambios en el plan y 7 en los rastros.

### 3 · Los números de los controles

| control | resultado |
|---|---|
| `pruebas/check.mjs` | 177 chequeos, sin fallas |
| `pruebas/check.mjs --self-test` | 40 casos, sin fallas |
| `pruebas/hook.test.mjs` | 113 casos, sin fallas |
| `pruebas/instalar.test.mjs` | 17 casos, sin fallas |

Iguales que en `main`: el cambio no toca nada de lo que prueban.

## Lo que no se pudo verificar

- La instalación en macOS: sigue pendiente, como antes.
