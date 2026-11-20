# Hábitat — ficha para hacer el arte

Guía para dibujar las piezas del Hábitat y que se monten sin tocar la lógica.
Hoy cada pieza está dibujada con código (`apps/web/src/habitat/muebles.jsx`).
Cuando llegue tu imagen, esa pieza usa la imagen y deja el dibujo de código.
Las demás siguen como están, así que puedes entregar **poco a poco**.

## Plantillas

| Archivo | Para qué |
|---|---|
| `plantilla-zonas.png` | El cuarto vacío con un recuadro naranja en el lugar de cada objeto. **Dibuja encima de esta.** |
| `plantilla-lleno.png` | El cuarto con los dibujos provisionales: tamaño y posición de referencia. |

Las dos miden **1380 × 1320 px**, el tamaño exacto de la casa al doble de
resolución.

## Reglas para todas las piezas

1. **Cuadrícula isométrica de 30°.** Es la que traen Procreate, Illustrator y
   Affinity con el nombre "isométrica". El cuarto de la plantilla ya la usa;
   sigue sus líneas.
2. **Luz desde arriba a la izquierda.** La cara de arriba es la más clara, la
   que mira a la izquierda queda en tono medio y la que mira a la derecha es la
   más oscura. Así se ve el cuarto de la plantilla.
3. **Una capa por pieza, sobre el lienzo completo.** Dibuja cada objeto en su
   propia capa encima de `plantilla-zonas.png`, en su recuadro. Exporta cada
   capa por separado con el **lienzo completo de 1380 × 1320 y fondo
   transparente**. No recortes: yo recorto y calculo la posición de forma
   automática. Así queda exactamente donde lo dibujaste.
4. **Formato:** PNG con transparencia (o WEBP). Nombra el archivo con el `id`
   de la tabla, por ejemplo `cama-nube.png`.
5. **El contorno** puede ser como en tu referencia (línea oscura) o sin
   contorno. Lo importante es que **todas las piezas usen el mismo estilo**.
6. **Lo que va en el piso no puede pasarse a las paredes**, y lo que va en una
   pared no puede salirse de ella. Respeta los recuadros.

## Piezas del cuarto (base)

| id | Qué es | Nota |
|---|---|---|
| `isla` | La islita de pasto y tierra debajo del cuarto | Sin paredes ni piso |
| `losa` | El borde del piso, entre el piso y el pasto | |
| `ventana-dia` / `ventana-noche` | La ventana de la pared izquierda | Dos versiones: sol y luna |
| `repisa-sellos-der` / `repisa-sellos-izq` | Repisas altas donde se paran los sellos | Solo la tabla: los sellos ya tienen sus imágenes |

### Paredes (una imagen por color, con las dos paredes juntas)

`pared-crema` (gratis) · `pared-jade` · `pared-ambar` · `pared-lavanda` ·
`pared-cielo` · `pared-noche`

### Pisos (una imagen por estilo, solo el rombo del piso)

`piso-madera` (gratis) · `piso-clara` · `piso-tatami` · `piso-mosaico`

## Objetos de la tienda (31 en total con paredes y pisos)

| id | Nombre | Lugar | Precio |
|---|---|---|---|
| `alfombra-zen` | Alfombra zen | alfombra | gratis |
| `alfombra-rayas` | Alfombra de rayas | alfombra | 40 |
| `helecho` | Helecho | planta del frente | gratis |
| `cactus` | Cactus | planta del frente | 30 |
| `monstera` | Monstera | planta del rincón | 45 |
| `bambu` | Bambú | planta del rincón | 45 |
| `cama-nube` | Cama nube | cama | 80 |
| `cama-futon` | Futón japonés | cama | 60 |
| `sofa-jade` | Sillón jade | sillón | 90 |
| `sofa-ambar` | Sillón ámbar | sillón | 90 |
| `escritorio` | Escritorio con compu y silla | escritorio | 100 |
| `librero` | Librero | librero | 70 |
| `mesa-te` | Mesita de té | mesita | 50 |
| `lampara` | Lámpara de pie | lámpara | 40 |
| `cuadro-montana` | Cuadro montaña | cuadro (pared derecha) | 30 |
| `cuadro-ola` | Cuadro ola | cuadro (pared izquierda) | 30 |
| `cortinas` | Cortinas | ventana | 35 |
| `repisa` | Repisa con plantas | pared derecha | 50 |
| `puff` | Puff | puff | 35 |
| `gato` | Gatito | mascota | 120 |
| `perrito` | Perrito | mascota | 120 |

- **Objetos del mismo lugar se dibujan en el mismo recuadro.** Son
  alternativas (cama nube o futón): nunca están los dos a la vez.
- **Objetos nuevos:** puedes inventar todos los que quieras. Dime el nombre,
  el lugar y el precio. Si es un lugar nuevo, marca en la plantilla dónde va
  y lo agrego.
- **Nombres y precios** se cambian en `apps/api/src/services/habitatCatalogo.js`.

## Mascotas y avatar que caminan (siguiente fase)

Para que caminen y hagan cosas hace falta **animación cuadro por cuadro**
(*sprites*): varias imágenes del mismo personaje, cada una un poquito
distinta.

### Lo que necesito por personaje

Todos los cuadros van en un **lienzo cuadrado del mismo tamaño**, por ejemplo
256 × 256 px. **Los pies van siempre en el mismo punto**, abajo al centro, para
que no "brinque" al cambiar de cuadro.

| Animación | Cuadros | Direcciones |
|---|---|---|
| Quieto, respirando | 2–4 | 2 |
| Caminar | 6–8 | 2 |
| Dormir | 2–4 | 1 |
| Algo especial (estirarse, jugar, leer…) | 4–8 | 1 |

- **Solo hacen falta 2 direcciones:** caminando hacia el frente (abajo a la
  derecha) y hacia atrás (arriba a la derecha). Las otras dos salen volteando
  la imagen como espejo.
- **Entrega cada animación como una tira horizontal** (todos los cuadros uno
  junto al otro) o como archivos numerados: `gato-caminar-frente-1.png`,
  `-2.png`…

### Avatar personalizable

Un avatar personalizable se arma **por capas**, todas con exactamente los
mismos cuadros y posiciones:

- **Cuerpo base:** el tono de piel se cambia de color con código.
- **Peinados:** cada uno con todas sus animaciones.
- **Ropa:** cada prenda con todas sus animaciones.
- **Accesorios** (lentes, sombrero…).

**Ojo con la carga de trabajo:** cada prenda o peinado nuevo multiplica los
cuadros, porque se dibuja en todas las animaciones. Para empezar sugiero:

- **1 cuerpo, 3 peinados, 3 conjuntos de ropa** y solo las animaciones
  *quieto* y *caminar*.
- **Píntalos con colores "llave" fijos**, por ejemplo pelo en rojo puro
  `#FF0000` y ropa en verde puro `#00FF00`. Yo los cambio por el color que
  elija cada persona. Así con un solo dibujo salen muchos colores.

Con eso hago que caminen por el piso esquivando muebles, se sienten en el
sillón y se duerman en la cama. El mismo avatar sirve para el aula, para quien
tiene la cámara apagada (T-46).

## Cómo me lo entregas

Una carpeta con los PNG nombrados con su `id`, por ejemplo
`docs/habitat-arte/piezas/`. Puede ser poco a poco: cada pieza que llegue
reemplaza la de código.
