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
- [ ] T2 · procedencia de caveman + pruebas
- [ ] T3 · guardas de nulos en `instalar.mjs` + prueba
- [ ] T4 · línea en el README
- [ ] T5 · controles finales y rastro

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

(se completan al cerrar)
