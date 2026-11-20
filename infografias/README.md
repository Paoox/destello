# Infografías interactivas

Material didáctico interactivo para los talleres de Destello. Cada infografía vive en
su propia carpeta y es una página HTML autosuficiente (sin dependencias ni build), con la paleta y tipografía de Destello:
se abre directo en el navegador.

| Carpeta | Taller | Qué es |
|---|---|---|
| `anatomia-oreja/` | Auriculoterapia | Las 9 partes de la oreja. Clic en un número o etiqueta → ficha de detalle con la zona resaltada. |

## `anatomia-oreja/`

- `index.html` — la infografía (lienzo 1200×800 que se escala a la pantalla; flechas ← → y Esc también funcionan).
- `imagenes/oreja-partes.png` — vista principal; `imagenes/oreja-<zona>.png` — una por parte, solo esa zona en color.
- `imagenes/original-*.jpg` — las ilustraciones originales de Paola.
- `separar-zonas.py` — script que genera los `oreja-*.png` a partir de `original-partes.jpg`
  (`python3 separar-zonas.py imagenes/original-partes.jpg`, deja el resultado en `out/`).

⚠️ Los textos de "En auriculoterapia" son un borrador: revisarlos con la profe antes de usarlos en clase.
