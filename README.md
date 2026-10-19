# flujo-loop

El procedimiento de trabajo del equipo de Loop, empaquetado para que **se aplique solo** en
cualquier proyecto.

No es una guía para leer una vez. Es una skill que conduce el trabajo, más dos enganches que la
traen sin que nadie tenga que acordarse de invocarla.

## Para qué existe

El equipo le pide features a un agente y después **otra persona audita el resultado**. Este
paquete está armado para una sola cosa:

> **que auditar el trabajo sea LEER en vez de RE-DERIVAR.**

Si el que audita tiene que reconstruir por su cuenta lo que hizo el agente para saber si está
bien, no recibió evidencia: recibió tarea.

Y ataja una falla específica, la única que es **invisible**: verificaciones que existen, corren y
pasan **por la razón equivocada**. Un verde falso se ve exactamente igual que un verde bueno.

## Instalación

Se hace **una vez por computadora**.

### La forma más corta: pedíselo a Claude

Abrí Claude Code en cualquier carpeta y pegale esto:

> Cloná https://github.com/JuanAlderete/flujo-loop e instalalo siguiendo su README.

No hace falta terminal ni saber dónde va nada: lo hace él y te dice qué quedó.

### O a mano, si preferís

Cloná el repo y corré:

```bash
node instalar.mjs
```

Y si querés ver qué va a hacer antes de que lo haga:

```bash
node instalar.mjs --simular
```

El instalador hace dos cosas: copia las skills a tu configuración de Claude Code, y escribe
los dos enganches en tu archivo de configuración **conservando lo que ya tuvieras ahí**.

| skill | qué es |
|---|---|
| `flujo-loop` | el procedimiento: en qué orden se hacen las cosas y qué prueba queda |
| `grilling` | se ejecuta antes de empezar: pregunta lo que no se te ocurre |
| `test-driven-development` | se ejecuta al empezar a implementar |
| `owasp-top-10` | base de consulta del **OWASP Top 10:2025** para revisar el código de la app antes de presentarlo. Copia fija de [microsoft/hve-core](https://github.com/microsoft/hve-core) |
| `sentry-security-review` | el **procedimiento** de la revisión de seguridad: seguir el dato antes de acusar, reportar sólo lo confirmado. Copia fija de [getsentry/skills](https://github.com/getsentry/skills), con **una** línea cambiada: el nombre, porque el original (`security-review`) reemplaza en silencio al `/security-review` que trae Claude Code. El cambio está registrado y es verificable en su `ORIGEN.json` |
| `gha-security-review` | revisa los workflows de CI buscando cómo explotarlos. Copia fija de getsentry/skills, con `allowed-tools` recortado. ⚠️ Da por seguro `${{ }}` dentro de `with:`, y en `actions/github-script` `script:` eso es inyección: ver su `ORIGEN.json` |
| `secret-serialization` | busca secretos que se filtran al serializar (logs, `JSON.stringify`, `repr`). Copia fija de getsentry/skills, sin cambios |
| `skill-scanner` | escanea una skill de afuera. Copia fija de getsentry/skills, con `allowed-tools` recortado: su script se corre pasando por el pedido de permiso. **Su salida son pistas, no un aprobado** |
| `seguridad-de-skills` | qué revisar antes de sumar, actualizar o escribir una skill, según el **OWASP Agentic Skills Top 10** |

> 🔑 **Las skills copiadas de otro repo se instalan sólo si siguen idénticas a su fuente.** Cada
> una trae un `ORIGEN.json` con el commit exacto y el hash de cada archivo. Si algo no coincide,
> o aparece un archivo que la fuente no tiene, el instalador **no instala nada** y te dice qué
> cambió. Una skill es comportamiento, no documentación: lo que dice, el agente lo hace con tus
> credenciales. Para actualizarla se lee el diff entero contra el commit nuevo y recién ahí se
> regenera su `ORIGEN.json` — ver `seguridad-de-skills`.

> ⚠️ **Por qué esto es un script y no "copiá esta carpeta y pegá este texto".** Lo primero —copiar
> carpetas— se podría hacer a mano sin problema. Lo segundo no: el archivo de configuración es
> estructurado, y equivocarse en una coma editándolo a mano deja Claude Code **sin arrancar**, con
> un error que no explica qué pasó. El instalador ante un archivo que no puede leer **no escribe**:
> prefiere no instalar antes que dejarte sin herramienta.

### El segundo paso, y es por proyecto

En la raíz de cada repo donde quieras que esto actúe, creá un archivo llamado **`.flujo-loop`**.
Adentro poné una línea cualquiera que lo explique, por ejemplo:

```
este repo sigue el flujo de Loop — corré /flujo-loop
```

**Sin ese archivo no pasa absolutamente nada**, y eso es a propósito: así los enganches viven en
tu configuración una sola vez y **cada repo decide** si juega.

### Comprobar que quedó

Abrí Claude Code en un repo que tenga el marcador, escribí `/` y tiene que aparecer `flujo-loop`
en la lista. Si no aparece, revisá que la carpeta se llame exactamente así y que adentro esté el
`SKILL.md`.

## Qué hace, una vez instalado

| cuándo | qué |
|---|---|
| en cada mensaje tuyo | mete el procedimiento en contexto, así el agente lo tiene sin que nadie lo invoque |
| cuando el agente va a decir "listo" | no lo deja si hay trabajo sin su archivo de rastro |
| antes de que el agente corra un comando | frena los de git que **borran trabajo sin vuelta atrás o lo publican**: `push`, `reset --hard`, `clean -f`, `branch -D`, `checkout .`, `restore .`. Por Bash y por PowerShell. Decide por el subcomando real: un mensaje de commit que dice "push" no se bloquea |

> ⚠️ **El guardrail no es un sandbox.** Un comando disfrazado lo esquiva. Es una red contra el
> error —el `reset --hard` que borra lo que alguien hizo sin que sepa que existía—, no contra
> alguien que quiere romper algo a propósito. Si de verdad hace falta uno de esos comandos, lo
> corre la persona, sabiendo qué hace.

Y si un mensaje del agente no se entiende: **`/no-entendi`**. Le pide que lo vuelva a explicar
más simple, con el contexto que falta y diciendo qué cambia en la app, no en el código.

El archivo de rastro se llama **`flujo/<nombre-de-la-rama>.md`** y va commiteado. Ahí viven el
objetivo, las decisiones **con su por qué**, y las tres pruebas:

1. **El mensaje textual del test fallando**, de antes de implementar. Nadie inventa el texto de un
   fallo que no vio, así que es la única prueba de que el test se escribió primero.
2. **La mutación verificada**: qué se rompió a propósito, qué se cayó, y la confirmación de que el
   cambio se aplicó de verdad. Es una **prueba de controles**: que un control exista no dice nada
   sobre si detectaría un error — eso se averigua metiéndole uno.
3. **Los números que devolvió cada control.** Un conteo exacto es caro de falsificar y trivial de
   re-verificar.

Más **lo que no se pudo verificar**, que es obligatorio y es lo primero que busca el que audita.

Y **una sola presentación por tarea, con la tarea terminada**: no se presenta un cambio a medias
por cada punto resuelto. Cada presentación dispara los controles que corren en el servidor, que
se pagan y se acaban — y se agotaron en días por presentar de a pedacitos. Antes de presentar
corren, en local, los controles del proyecto y la revisión de seguridad contra el OWASP Top 10.

## Qué NO hace

- **No bloquea ediciones.** Un control que pelea en cada cambio de una línea se aprende a
  esquivar, y un control que se esquiva es peor que no tenerlo porque además da sensación de
  cobertura.
- **No actúa en repos sin el marcador.** Ni un mensaje.
- **No contiene ningún número, umbral, comando ni tecnología de ningún proyecto.** Eso lo declara
  cada proyecto en su propio `CLAUDE.md`. Los números vencen, y un documento que afirma un número
  vencido miente con total confianza.

## Si bloquea cuando no debería

Primero: **el hook falla abierto a propósito.** Ante cualquier error, duda o dato que no pudo
obtener, sale sin decir nada. Sólo bloquea cuando determinó positivamente que hay cambios sin
rastro.

Si igual te bloquea de más, el mensaje dice qué archivo falta. Creá ese archivo con lo que hiciste
y listo. Y si algo está mal en el hook, abrí un issue acá — **no lo desinstales**: un control
desinstalado no protege nada nunca más.

## Actualizar

```bash
git pull
node instalar.mjs
```

El instalador se puede correr las veces que quieras: reemplaza lo que instaló antes y **no
duplica** los enganches.

## Desarrollo

Tres suites, sin framework a propósito:

```bash
node pruebas/check.mjs              # que las skills carguen y que la genérica siga siendo genérica
node pruebas/check.mjs --self-test  # que el verificador rechace lo que tiene que rechazar
node pruebas/hook.test.mjs          # el hook, incluido que FALLE ABIERTO
node pruebas/instalar.test.mjs      # el instalador, incluido que NO pise una config mal escrita
```

⚠️ **Si tocás algo de acá, verificalo por mutación**: rompé lo que acabás de proteger y mirá que
la suite se caiga. Tres de las fallas que estas suites encontraron durante su propio desarrollo
eran **casos que pasaban por la razón equivocada** — exactamente lo que este paquete existe para
atajar. Un test que nunca se vio fallar no es un control probado.
