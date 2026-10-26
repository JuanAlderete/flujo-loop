# Plan de mejoras de flujo-loop

Armado el 2026-10-26, comparando flujo-loop con tres paquetes externos:
**ponytail**, **Anti-Slop** y **Thermos**. Es un plan, no está implementado.

**Para quién es flujo-loop**: el equipo de Loop, que en su mayoría no programa. Le
piden features a un agente, y otra persona audita el resultado. flujo-loop es la
única herramienta de desarrollo que tienen. Cada mejora se juzga contra eso:
**¿le hace más fácil auditar a alguien que no lee código?**

> El plan se charló con `/grilling` el 2026-10-26. Lo que se decidió está en la
> sección 6, y **donde contradice a las secciones de arriba, gana la sección 6**.

---

## 0. Lo primero: mergear la rama de seguridad · hecho

`feat/ultima-puerta-y-seguridad` (el Paso 5 y las skills de seguridad) se mergeó a
`main` el 2026-10-26, en el PR #1 (merge `c1cfbce`).

Las referencias `SKILL.md:NN` de este documento se tomaron de esa rama antes del
merge, y coinciden con `main` en `c1cfbce`.

---

## 1. Qué hace flujo-loop hoy

| Paso | Qué exige | Dónde |
|---|---|---|
| Piso | No tocar datos reales; lo que el proyecto prohíbe gana sobre la skill | `skills/flujo-loop/SKILL.md:40-55` |
| 0 | Encontrar los controles del proyecto; si no hay, proponerlos y esperar confirmación | `:59-79` |
| 1 | Ejecutar `/grilling` antes de tener la solución | `:83-98` |
| 2 | Ejecutar `/test-driven-development` antes de escribir código | `:100-109` |
| 3 | Casos no felices, verificar antes de afirmar, reutilizar, arreglar la causa | `:111-127` |
| 4 | Correr los controles en orden y reportar sus números | `:129-142` |
| 5 | Presentar una sola vez y terminado; antes, `/sentry-security-review` y `owasp-top-10` | `:144-190` |
| Pruebas | Fallo textual antes de implementar, mutación confirmada, números de cada control y lo que no se pudo verificar | `:194-249` |
| Rastro | `flujo/<rama>.md` commiteado | `:253-280` |
| Hook | Recordatorio en cada mensaje; el `Stop` bloquea si hay cambios sin rastro; frena `push`, `reset --hard` y similares; falla abierto | `skills/flujo-loop/hook.mjs` |
| Instalador | Las skills de afuera se instalan sólo si sus hashes coinciden con `ORIGEN.json` | `instalar.mjs:19-23` |

**Lo que no cubre:** interfaces y diseño (sólo un párrafo genérico, `SKILL.md:313-323`),
accesibilidad, calidad de código, una revisión independiente de corrección, los
textos de la app, un reporte final para quien no programa y un registro de atajos.

---

## 2. Mejoras, en orden de prioridad

Cada una dice de dónde sale, en qué paso entra y si se **adapta** (se reescribe en
castellano dentro de flujo-loop) o sólo se **toma la idea**. Ninguna se instala
tal cual: los tres paquetes chocan con flujo-loop en algo (ver sección 3).

### 2.1 Reporte final en lenguaje llano · adaptar

- **Fuente:** ponytail, `skills/ponytail-review/SKILL.md:69-96`.
- **Dónde:** al cierre del Paso 5, y como sección del rastro.
- **Formato:**
  - "**Qué hace este cambio**", en dos o tres frases sin jerga.
  - Hallazgos **numerados** en tres grupos: **Debe**, **Conviene**, **Opcional**.
  - Cada hallazgo tiene cuatro partes: qué es, el problema, el arreglo, y **qué pasa si no se arregla**.
  - Un veredicto.
  - "**Lo que no se revisó**".
- **Por qué primero:** es lo que más le sirve al auditor. La numeración le permite
  responder "arreglá el 2 y el 5" sin leer código.

### 2.2 Revisión independiente de corrección · skill propia

- **Fuentes:**
  - Thermos: dos revisores en paralelo, y no exagerar la prioridad (`thermo-nuclear-review/SKILL.md:25-51`).
  - ponytail: leer también a quien usa el código tocado, y "sin un caso concreto no hay hallazgo" (`ponytail-review/SKILL.md:16-28`, `:57-67`).
- **Dónde:** en el Paso 5, antes de presentar, separada de la de seguridad.
- **Cómo:** una skill nueva en flujo-loop, en castellano. No se copia Thermos,
  porque es formato Cursor (`.cursor-plugin`, agentes `shell`/`explore`).
- **Regla que gana:** Thermos sólo reporta lo que cambió (`:16-18`). flujo-loop
  exige mirar a quién más llama al código (Paso 3). **Gana flujo-loop.**
- Sumar los riesgos que flujo-loop no nombra (`thermo-nuclear-review/SKILL.md:25-36`):
  - romper el entorno de desarrollo (variables de entorno, puertos, secretos);
  - fugas de una feature que está detrás de un flag;
  - "lo que se pidió romper no es un hallazgo".

### 2.3 Cuarta prueba para pantallas · adaptar

- **Fuente:** Anti-Slop R-35 (`skills/antislop/SKILL.md:397-405`).
- **Dónde:** en "Si tocás pantallas" (`SKILL.md:313`).
- **Qué exige:** usar cada elemento interactivo y anotar en el rastro, elemento por
  elemento, la acción, el resultado y los errores de consola. Más lo que no se pudo
  probar, por ejemplo en un celular real.
- **Por qué:** hoy las tres pruebas son de tests y controles. Una pantalla puede
  pasar todo sin que nadie la haya usado.

### 2.4 Checklist corto de accesibilidad y celular · tomar la idea

- **Fuentes:** `antislop-human` (contraste, foco, teclado, estados, zoom) y
  `antislop-layoutmobile` (desbordes, tamaño de los botones, navegación).
- **Dónde:** en el mismo bloque de pantallas.
- **Cómo:** una lista corta, propia. No vendorizar Anti-Slop (ver sección 3).
- El verificador de contraste (`antislop-human/contrast-check.py`) **sí** se podría
  vendorizar con su `ORIGEN.json`, previa `/seguridad-de-skills`, porque ejecuta Python.

### 2.5 Contenido real o un placeholder honesto · tomar la idea

- **Fuente:** Anti-Slop R-36 y R-38 (`antislop/SKILL.md:407-430`).
- **Dónde:** Paso 3.
- **Regla:** nada de datos, testimonios ni números inventados en pantalla o en los
  datos de ejemplo que se ven. Si falta el dato real, un placeholder que diga que lo es.

### 2.6 Registro de atajos · adaptar

- **Fuente:** ponytail, los comentarios `shortcut:` y `/ponytail-debt`
  (`skills/ponytail-debt/SKILL.md:13-39`).
- **Dónde:** Paso 3 (marcar el atajo) y una sección del rastro, "atajos conocidos".
- **Formato:** cada atajo con su límite y **cuándo mejorarlo**. Un atajo sin "cuándo" se marca.

### 2.7 "¿Hace falta que exista?" y lo que nunca se recorta · tomar la idea

- **Fuente:** ponytail, `skills/ponytail/SKILL.md:23-44`: una escalera de decisión
  antes de escribir código, y la lista "Never cut" (validación en los límites,
  seguridad, accesibilidad).
- **Dónde:** Paso 3.
- **Lo que NO se toma:** la regla de tests de ponytail (`:41`, "un test chico sólo si
  la lógica no es trivial"). Contradice el Paso 2.

### 2.8 Que el agente ofrezca `/no-entendi` solo · mejora propia

- Hoy existe, pero la persona se tiene que acordar de pedirlo (`README.md:107-108`).
  Que el agente lo ofrezca al cerrar los mensajes largos.

---

## 3. Lo que NO se toma, y por qué

| Paquete | Qué no | Por qué |
|---|---|---|
| ponytail | El plugin entero | Hooks (`SessionStart`, `SubagentStart`, `UserPromptSubmit`), un proceso en segundo plano, un webhook opcional, y queda activo toda la sesión |
| ponytail | Su regla de tests | Contradice el TDD del Paso 2 |
| Anti-Slop | El paquete entero | Su núcleo pesa ~58 KB y dice "cargar siempre"; escribe un bloque en `CLAUDE.md` o `AGENTS.md` (`antislop/SKILL.md:42-64`); está en inglés |
| Anti-Slop | La prohibición del guion largo | flujo-loop, los `AGENTS.md` y los textos de las apps lo usan en todos lados |
| Anti-Slop | Marcar Lucide como "cosa de IA" | Pan Comido exige `lucide-react` |
| Anti-Slop | Exigir un `DESIGN.md` siempre | Sirve como idea, pero no como compuerta para todo proyecto |
| Thermos | La regla de 1000 líneas | Es un número fijo, y flujo-loop prohíbe declarar números (`SKILL.md:333-337`) |
| Thermos | El empuje a crear abstracciones | Choca con ponytail y con "reutilizá lo que existe" |
| Thermos | El tono "harsh" | No le sirve a quien no lee código |

**Seguridad de los paquetes (para `/seguridad-de-skills`):**
- **ponytail** ejecuta código (`ponytail-activate.js`, con `execFileSync`) y tiene
  un webhook https opcional.
- **Anti-Slop** declara un servidor MCP que lanza Python. Su script sólo usa `json`
  y `sys`. Su instalador baja código de npm (`npx antislop-ai`).
- **Thermos** no ejecuta código propio ni tiene hooks; sólo lee la PR con `gh`.

---

## 4. Puntos débiles del propio flujo-loop

1. **El `Stop` acepta un rastro vacío** (`hook.mjs:245`): sólo verifica que el
   archivo exista. Un chequeo barato: que tenga las secciones de las tres pruebas
   y "lo que no se pudo verificar", sin validar su contenido.
2. **El recordatorio está desfasado** (`hook.mjs:97-113`): enumera los pasos 1 a 4,
   y no nombra el Paso 0, el Paso 5 ni `/seguridad-de-skills`.
3. **Tres skills se instalan, pero ningún paso dice cuándo usarlas**:
   `gha-security-review`, `secret-serialization` y `skill-scanner` (`README.md:58-60`).
   Por ejemplo, `gha-security-review` cuando el cambio toca workflows.
4. **El Paso 0 escribe en `CLAUDE.md`** (`SKILL.md:75`). En repos como Pan Comido
   las reglas viven en `AGENTS.md`. Falta "escribilo donde el proyecto diga".
5. **`grilling` y `test-driven-development` están en inglés**, así que las preguntas
   pueden llegarle en inglés a quien no programa. Falta pedir que respondan en el
   idioma de la persona.
6. **El guardrail no frena las escrituras a producción** (`supabase db push`, SQL con
   credenciales). Sólo cubre git, aunque el piso (`SKILL.md:40-55`) dice que eso es
   lo más grave.
7. **"Arreglá todo en una pasada"** (`SKILL.md:289`) no pone un límite de vueltas
   ni dice qué hacer si un hallazgo persiste.

---

## 5. Orden de implementación sugerido

1. ~~Mergear `feat/ultima-puerta-y-seguridad` (sección 0).~~ Hecho: PR #1.
2. Arreglar los puntos débiles chicos: 2 (recordatorio), 3 (cuándo usar cada skill),
   4 (dónde escribe el Paso 0) y 5 (idioma).
3. **2.1, el reporte en lenguaje llano**: lo que más le cambia la vida al auditor.
4. **2.2, la revisión independiente**: la mejora más grande.
5. 2.3 y 2.4 (pantallas), juntas.
6. 2.5, 2.6 y 2.7 (Paso 3), juntas.
7. Los puntos débiles 1 (rastro vacío), 6 (producción) y 7 (límite de vueltas).

Cada uno con TDD sobre las pruebas de `pruebas/` y su rastro. El `/grilling` del
plan entero ya se hizo (sección 6); si una pasada abre una decisión que no está
ahí, se vuelve a charlar antes de seguir.

**Entrega:** un PR por paso de esta lista. Los pasos 5 a 7 se pueden agrupar si
tocan los mismos archivos. Ningún PR se mergea sin el OK del dueño: el equipo
instala desde `main`, así que lo que se mergea le llega a todos.

## 6. Decidido (`/grilling` del 2026-10-26)

| Tema | Decisión | Por qué |
|---|---|---|
| Idioma (débil 5) | Una línea al principio de las copias de `grilling` y `test-driven-development`: hablarle a la persona en su idioma | No tienen `ORIGEN.json`, así que son copias propias y se pueden editar. Ponerlo sólo en `flujo-loop` no alcanza: `/grilling` se invoca suelto |
| Dónde escribe el Paso 0 (débil 4) | Busca los controles en `AGENTS.md` y en `CLAUDE.md`, y escribe en el que ya tenga las reglas del proyecto. Si no hay ninguno, `/init` como hoy | Dos archivos de reglas, cada uno leído por una herramienta distinta, es el error que esto evita |
| Cuándo corre cada skill suelta (débil 3) | En el Paso 5, con disparadores por archivo o contenido: `gha-security-review` si el cambio toca `.github/workflows/`; `secret-serialization` si agrega un campo con credenciales o código que convierte objetos enteros a texto (logs, respuestas, errores); `skill-scanner` dentro de `/seguridad-de-skills`, cada vez que entra o se actualiza una skill de afuera | Un disparador por archivo se puede verificar; "cuando haga falta" lo decide el agente |
| Reporte llano (2.1) | Se **suma** como primera sección del rastro, y es también el mensaje final del agente | Quien no programa lee el chat, no el rastro. Y quien sí lee código necesita la evidencia que el rastro ya tiene |
| Revisión independiente (2.2) | Corre **siempre**, con un revisor en un subagente nuevo que no vio la conversación. Si el cambio toca plata, datos o permisos, se suma un segundo revisor ciego. En un cambio de sólo docs se anota "revisión no aplicada" en el reporte | "Sólo en cambios grandes" le pide al agente juzgarse a sí mismo. Así, si clasifica mal, el peor caso es un revisor en vez de dos, nunca cero |
| Límite de vueltas (débil 7) | Hasta **2 vueltas** de arreglar y revisar. Lo que persiste va al reporte en "Debe", marcado "no se pudo resolver", y decide la persona | Sin límite, el agente da vueltas o declara resuelto lo que no está |
| Guardrail de producción (débil 6) | **Bloquea**, igual que el de git. Falla abierto sólo ante un error del propio hook. Lista fija de comandos: `supabase db push`, `supabase db query --linked`, `supabase migration repair --linked`, `prisma migrate deploy` | Un aviso lo lee el agente, no la persona. Que cada proyecto declare sus comandos obliga a parsear su archivo de reglas; se suma cuando un proyecto lo pida |
| `Stop` y el rastro vacío (débil 1) | Exige cuatro encabezados: el reporte llano, las tres pruebas y "lo que no se pudo verificar". No juzga lo que dicen | Es barato y corta el rastro vacío. Juzgar el contenido es trabajo de la revisión independiente |
| Contraste (2.4) | Sólo el checklist propio; **no** se vendoriza el script de Anti-Slop | Sumaría Python, una revisión de seguridad y un `ORIGEN.json` para mantener. Se revisa si aparece un caso real |
| 2.3 a 2.8 | Tal como están escritos arriba | No tenían decisiones abiertas |

## Fuentes

- ponytail: https://github.com/dietrichgebert/ponytail
- Anti-Slop: https://github.com/miqdadbadjuber/Anti-Slop
- Thermos: https://github.com/cursor/plugins/tree/main/thermos
