# Revisión del flujo de registro — 22 ago 2026

> Auditoría completa del flujo de alta de usuarios, de punta a punta:
> bot de WhatsApp → lista de espera → pago → activación → login → taller.
> Acompaña a la migración `apps/api/src/db/migrations/003_metricas.sql`.

---

## Resumen en una línea

El flujo funciona, pero tiene **dos caminos distintos para hacer lo mismo** y eso
produce usuarios rotos en silencio. Además, la mitad del código todavía vive en
el modelo viejo de códigos, que ya se decidió no usar.

---

## 🔴 Bugs que van a morder en producción

### 1. El selector de estado deja usuarios pagados sin su taller

Hay **dos** formas de marcar a alguien como pagado, y hacen cosas distintas:

| Camino | Activa la cuenta | Crea la chispa | Resultado |
|---|---|---|---|
| Botón "Confirmar pago" (`POST /admin/lista-espera/:id/confirmar-pago`) | ✅ | ✅ | Correcto |
| Selector de estado → "pagado" (`PATCH /admin/lista-espera/:id`) | ✅ | ❌ | **Roto** |

Si usas el selector, la persona queda `activo` + `pagado`, **puede entrar a la
plataforma, y su taller no aparece por ningún lado**. Desde su punto de vista:
pagó, entró, y no hay nada. Y desde el panel se ve todo en orden, porque el
estado dice "pagado".

Esto pasa porque `chispaService.getTalleresDelUsuario` exige que exista una
chispa viva, y el `PATCH` nunca la crea (`routes/admin.js:148-176`).

**Fix:** que las dos rutas llamen al mismo servicio. Ver "Simplificación" abajo.
Mientras tanto, la vista `v_alertas` ya detecta este caso como `pagado_sin_taller`.

### 2. Una métrica del panel siempre marca 0

`GET /admin/talleres/stats` cuenta `FILTER (WHERE le.estado = 'confirmado')`
(`adminController.js:88`), pero el código vivo escribe `'cupo_confirmado'`.
Nunca coinciden, así que **el conteo de confirmados siempre da cero**.

**Fix:** un carácter — cambiar `'confirmado'` por `'cupo_confirmado'`. O mejor,
usar `v_metricas_taller`, que ya cuenta por fecha y no por texto de estado.

### 3. Nada valida el cupo máximo

`talleres.cupo_maximo` se guarda y se edita desde el panel, pero **ningún
endpoint lo consulta antes de inscribir o de crear una chispa**. Se puede
sobrevender un taller sin que nada avise.

Esto conecta con el pendiente que ya tenías anotado: *"las demos deben ocupar
cupo"*. La vista `v_metricas_taller` ya cuenta las demos dentro de
`cupo_ocupado` — una cortesía ocupa una silla igual que un pago — y `v_alertas`
marca `taller_sobrevendido`.

**Falta:** la validación en el momento de inscribir. Es un `IF` antes del INSERT.

### 4. El apellido se puede meter dentro del nombre

El bot guarda `nombre` y `apellido` por separado en `usuarios` (bien), pero manda
el **nombre completo concatenado** a `lista_espera.nombre` (`flujo.js:362`).
Después, `confirmar-pago` copia ese nombre completo de vuelta a `usuarios.nombre`
si estaba vacío (`admin.js:364`). Resultado: `nombre = "Ana Ruiz García"`,
`apellido = NULL`.

Importa porque **el nombre es lo que va impreso en el certificado**.

**Fix:** que `lista_espera` no guarde el nombre; que lo lea de `usuarios` con un
JOIN. El dato debe vivir en un solo lugar.

### 5. `confirmar-pago` no está en una transacción

Hace seis operaciones sueltas: busca usuario, lo crea o actualiza, lo activa,
crea la chispa, cambia el estado, manda correo y WhatsApp. **Si falla a la
mitad, el estado queda inconsistente** — y esa es exactamente la causa del
desfase "pagado sin activar" que el bot ya detecta y reporta
(`diagnosticoService.js:48-50`).

**Fix:** envolver en `BEGIN/COMMIT`. Los envíos de correo y WA van *después* del
commit, nunca dentro.

---

## 🟡 Peso muerto que se puede tirar

Ya decidiste que **al usuario nunca se le manda un código**. Pero el código del
modelo viejo sigue completo y activo:

| Qué | Dónde | Estado |
|---|---|---|
| Tabla `resplandores` + toda su lógica | `resplandorService.js`, `resplandorController.js` | Sin uso real |
| `POST /admin/lista-espera/:id/confirmar` | `routes/admin.js:234-310` | Flujo viejo, manda códigos por correo |
| 5 endpoints de `/admin/resplandores/*` | `routes/admin.js:492-580` | Sin uso |
| `PageAcceso.jsx` (`/acceso`) | Frontend | Huérfana, sin enlazar |
| `RegisterForm` con contraseña | `PageLogin.jsx:191-297` | Solo se activa con resplandor |
| `POST /auth/register` | `authController.js:169` | Único lugar que escribe `password` |

También hay **código muerto declarado**: casi todo `adminController.js` no está
montado en ninguna ruta (solo `adminLogin` y `getTalleresStats`).

Y hay **dos esquemas contradictorios en el repo**: `db/schema.sql` y
`db/schema.supabase.sql` difieren en el default de `usuarios.estado`, en el
nombre de la columna de email en `resplandores` y en el tipo de
`lista_espera.taller_id`. El código vivo asume el de Supabase. El otro solo
puede causar accidentes.

**Recomendación:** borrar `schema.sql` y marcar el flujo de resplandores como
deprecado. No borrar la tabla todavía — tiene historial.

---

## Simplificación propuesta

### Ahora (antes del lanzamiento) — bajo riesgo

**1. Un solo servicio para activar a un alumno.**

```
activarAlumno(listaEsperaId, { pagoId, actor })
  ├─ BEGIN
  ├─ upsert usuarios (activo)
  ├─ crear chispa si no existe
  ├─ lista_espera.estado = 'pagado'
  ├─ COMMIT
  └─ luego: correo + WhatsApp
```

Que **las dos** rutas lo llamen. El `PATCH` deja de tener lógica propia. Con eso
desaparecen los bugs 1 y 5 de un golpe.

**2. Validar cupo antes de inscribir y antes de crear chispa.**

**3. Un solo lugar para el nombre.** `lista_espera` deja de guardarlo.

**4. Persistir la conversación del bot.** Hoy vive en un `Map()` en memoria
(`flujo.js:99`): si el bot se reinicia, **toda la gente que estaba a media
captura pierde su conversación**. Eso no es solo una métrica faltante, es una
mala experiencia real que ya está pasando. La tabla `bot_conversaciones` de la
migración lo resuelve.

### Después del lanzamiento — la simplificación de fondo

`lista_espera` y `chispas` están modelando **lo mismo**: la relación entre una
persona y un taller, en distintas etapas. Por eso hay que sincronizarlas a mano
(`chispaService.js:120-144`) y por eso el panel deriva fechas de una para
mostrarlas en la otra (`admin.js:103-117`).

La forma correcta es **una sola tabla `inscripciones`** con un `estado` que
recorre todo el ciclo:

```
interesado → cupo_confirmado → pagado → activo → vencido
                     ↓
                 liberado
```

La chispa deja de ser una tabla y se vuelve lo que siempre fue conceptualmente:
un renglón de `inscripciones` con vigencia.

**No lo hagas antes del 11 de septiembre.** Es una migración de datos y tres
semanas es poco margen. Pero tenlo como el destino: elimina cinco fuentes de
duplicación de un solo golpe.

---

## Métricas: qué faltaba y qué se agregó

El problema de fondo era que los cambios de estado se hacían con
`UPDATE ... SET estado` a secas. **Se sabía dónde estaba cada quien, pero no
cuándo llegó ahí.** Un estado sin fecha es una foto, no una métrica.

### Decisión de diseño: las fechas las estampa la BD, no la API

Las fechas de transición se escriben con **triggers**, no desde el código. Es a
propósito: hay tres rutas distintas que activan a un usuario y dos que lo marcan
como pagado. Si cada una tuviera que acordarse de escribir la fecha, tarde o
temprano una se olvida y la métrica miente sin que nadie se entere.

Con el trigger, da igual quién haga el `UPDATE` — hasta un cambio a mano desde el
SQL Editor de Supabase queda registrado.

### Lo que se agregó

| Qué | Para qué |
|---|---|
| `lista_espera`: `confirmado_at`, `pagado_at`, `rechazado_at`, `updated_at`, `origen` | Medir el embudo y los tiempos entre etapas |
| `usuarios`: `activado_at`, `origen`, `primer_login_at`, `ultimo_login_at`, `total_logins` | Saber quién pagó y **nunca entró** |
| **tabla `pagos`** | Hoy el dinero no existe como dato: monto, banco y folio viven como texto libre dentro de `reportes_acceso.detalle`. No se puede sumar ni sacar un corte |
| **tabla `eventos`** | Bitácora append-only. Permite medir cosas que todavía no se te ocurren, sin volver a migrar |
| **tabla `bot_conversaciones`** | Embudo de abandono del bot + que la conversación sobreviva un reinicio |
| 5 vistas `v_*` | El panel consulta vistas, no SQL armado a mano |

### La métrica que más te va a servir

En `v_embudo`, la diferencia entre `cuentas_activas` y `entraron_alguna_vez`:
**gente que pagó y nunca entró a la plataforma.** Es la señal más temprana de que
algo está roto en el acceso, y hoy es completamente invisible.

### `v_alertas` — la bandeja de "esto necesita tu atención"

Cinco casos, todos detectados solos:

- `pagado_sin_activar` — pagó pero su cuenta sigue en espera
- `pagado_sin_taller` — el bug #1, pagó y no ve su taller
- `activo_sin_entrar` — lleva más de 3 días activo sin entrar
- `cupo_vencido` — se le apartó lugar hace más de 48h y no ha pagado
- `taller_sobrevendido` — más inscritos que `cupo_maximo`

El reloj de 48h hoy solo existe como cálculo en el frontend
(`ListaEsperaAdmin.jsx`), sobre una fecha derivada. Ahora es una fecha real.

---

## Nota sobre la visión de largo plazo

La tabla `eventos` y el campo `pagos.nota` no son solo para el dashboard. Son la
memoria que van a leer los agentes cuando empiecen a tomar las decisiones que hoy
tomas tú: *qué pasó, cuándo, con qué contexto, y por qué se decidió así.*

Guardar el **porqué** de cada decisión — no solo el resultado — es lo que hace
que un agente pueda aprender del historial en vez de solo consultarlo.

---

## Orden sugerido

1. ✅ Correr `003_metricas.sql` en Supabase *(no rompe nada, es aditiva)*
2. Arreglar el bug del selector (#1) y el conteo de `'confirmado'` (#2)
3. Validar cupo (#3)
4. Empezar a escribir en `eventos` y `pagos` desde la API
5. Persistir la conversación del bot
6. Conectar el panel a las vistas `v_*`
7. *(post-lanzamiento)* Deprecar resplandores y unificar en `inscripciones`
