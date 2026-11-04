# Licencia y procedencia de caveman, y un enganche nulo en el instalador

## Objetivo

`skills/caveman` es una copia modificada de [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman)
(Apache-2.0, commit `2e068f735253cce28256744804785f01887d9646`) y hoy se distribuye sólo con
`SKILL.md`: sin LICENSE, sin NOTICE, sin aviso de modificación y sin `ORIGEN.json`. Como el
instalador sólo verifica hashes cuando existe `ORIGEN.json`, caveman se salta esa puerta. Además,
`instalar.mjs` hace `c.command` sobre cada entrada de `hooks`, y un `settings.json` con una entrada
`null` rompe la instalación después de haber copiado las skills (instalación a medias).

## Alcance

- T1 · este documento.
- T2 · procedencia de caveman: LICENSE y NOTICE sin cambios, aviso de modificación en `SKILL.md`
  (Apache 2.0, sección 4(b)), `ORIGEN.json` con las modificaciones y los hashes, `.gitattributes`,
  pruebas del instalador.
- T3 · el instalador tolera entradas nulas en `hooks`, con su prueba.
- T4 · una línea en el README.
- T5 · correr los tres controles y registrar los resultados aquí.

Fuera de alcance: copiar el `README.md` de caveman, tocar `NOTICE`, cualquier otro cambio de
comportamiento del instalador.

## Tareas

- [x] T1 · documento de rastro
- [x] T2 · procedencia de caveman + pruebas
- [x] T3 · guardas de nulos en `instalar.mjs` + prueba
- [x] T4 · línea en el README
- [x] T5 · controles finales y rastro

## Controles

- `node pruebas/check.mjs --self-test`
- `node pruebas/hook.test.mjs`
- `node pruebas/instalar.test.mjs`

## Supuestos

- LICENSE y NOTICE se copian byte a byte de la rama `feat/rtk-y-caveman` (mismo commit de origen);
  sus hashes son los de la raíz del repo de origen.
- `NOTICE` no se modifica (su hash tiene que coincidir): las modificaciones se registran en
  `ORIGEN.json`.
- El hash de `SKILL.md` es el de lo que guarda git (LF), que es lo que produce un checkout con
  `-text` en `.gitattributes`.

## Resultados

### Fallo observado antes de tocar nada (RED)

```
FALLA  2 de 19 casos:
  - caveman se instala con su LICENSE, su NOTICE y su ORIGEN.json: caveman quedó sin LICENSE
  - 🔑 caveman modificada: el instalador se niega y no instala nada: tenía que negarse y salió en 0
```

```
FALLA  3 de 22 casos:
  - configuración con un hook nulo en hooks: ... TypeError: Cannot read properties of null (reading 'command')
  - configuración con un grupo nulo en hooks: ... TypeError: Cannot read properties of null (reading 'hooks')
  - configuración con un hook nulo junto a uno ajeno en hooks: ... TypeError: Cannot read properties of null (reading 'command')
```

### Después (GREEN)

- `node pruebas/check.mjs --self-test`: OK 40 casos del verificador, sin fallas.
- `node pruebas/hook.test.mjs`: OK 113 casos, sin fallas.
- `node pruebas/instalar.test.mjs`: OK 22 casos, sin fallas.

### Hashes de caveman (los de lo que guarda git, LF)

- LICENSE `cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30`
- NOTICE `20112dc6e62e91da4f03c29fd10cfa41743a9c526389fdf1396c3649c18216fc`
- SKILL.md `11cab000a0dca1f42e71751ec04f7cab5174bcf2ab0948d075b74c22a9d12195`

### Commits

- 7f939c5 fix(caveman): agrega LICENSE, NOTICE y ORIGEN.json de la copia modificada de Apache-2.0
- 0872b74 fix(instalar): una entrada nula en hooks ya no rompe la instalación a medias
- el de documentación (README y este rastro) es el último de la rama

## Lo que no se pudo verificar

- Un clon nuevo en Windows con `core.autocrlf=true`: `.gitattributes` marca `skills/caveman/** -text` y el índice guarda LF (`git ls-files --eol`), pero no se probó un clon limpio.
