# Backlog — Destello vs. visión completa

> Creado 17 sep 2026. Punto de partida para documentar tickets, comparando lo
> que ya funciona contra la visión descrita en `CLAUDE.md` ("Lo que Falta"),
> `docs/revision-flujo-registro.md` y los contratos de `src/aula/`.
>
> **Cómo mantenerlo:** cada vez que se cierre un ticket, muévelo a "Lo que Está
> Terminado y Funciona" en `CLAUDE.md` (no lo borres de aquí, táchalo). Cada vez
> que aparezca un pendiente nuevo, se agrega aquí con el mismo formato antes de
> tocar código — así el ticket documenta la decisión, no solo el trabajo.

Formato de cada ticket: **qué falta** · **por qué importa** · **dónde tocar** ·
**criterio de terminado**.

---

## 1. Mapa: visión completa vs. estado actual

| Área | Visión completa | Estado hoy | Brecha |
|---|---|---|---|
| Aula — video | Video en vivo real (profe + alumnos) vía OpenVidu/LiveKit | El aula dice "Sin video todavía"; todo lo demás (sellos, pizarrón, semáforo) ya funciona sin video | 🔴 Falta construir completo |
| Aula — actividades | 4 tipos: quiz, memorama, armar, modelo3d, todas sobre el mismo contrato (`contrato.js`) | Solo **quiz** existe de punta a punta. Las otras 3 están declaradas pero no implementadas (`registro.js`) — por eso el 🚧 que viste el 25 ago | 🔴 3 de 4 actividades por construir |
| Aula — profesores | Tabla `profesores` real, con permisos propios (solo su salón, no el panel financiero) | `esProfe` = `isAdminEmail()` — cualquier admin ve todo; no hay concepto de "profesor externo" | 🔴 Riesgo de seguridad, no solo pendiente |
| Accesos | Login sin códigos, activación transaccional, relación por `usuario_id` | Login sin códigos ✅, activación unificada y transaccional ✅, modelo de Resplandor retirado por completo, `POST /auth/login` viejo retirado ✅ (T-14a/b/c + T-33, 18 sep, verificado en sitio real). Solo Google/WhatsApp para entrar. Queda: relación por email (T-13, diferida) | 🟠 Solo T-13 real, ver sección 4 |
| Bot Faro | Menú completo, reporte de pago con foto, diagnóstico automático | Menú y opción 2 (talleres) funcionando ✅. Reporte de pago con foto: el bot **ignora imágenes por completo** | 🟡 Mitad implementado |
| Panel Admin | 7 tabs completos, métricas por vistas SQL | Los 7 tabs existen y funcionan ✅. Una métrica de stats está rota (cuenta mal un estado) | 🟠 Bug puntual |
| Certificados | Emisión automática al cumplir criterio | Criterio automático, **disparo manual** — nadie se entera cuando ya calificó | 🟡 Falta automatizar el envío/aviso |
| Perfil de usuario | Datos reales del alumno: talleres, progreso, certificados | `PagePerfil.jsx` es 100% mock (`PERFIL_MOCK`), incluye gamificación que no existe en backend | 🔴 Construir desde cero (T-32) |
| Pruebas automatizadas | Cobertura de lo crítico (accesos, pagos, aula) | **0** archivos de test en todo el monorepo, ningún `package.json` define `test` | 🔴 Arrancar desde cero — a partir de ahora, cada ticket nuevo incluye sus pruebas |
| Habitat | Mundo tipo Minecraft con objetos desbloqueables | Catálogo de talleres en grid, sin mundo | 🔮 Post-lanzamiento, no bloquea |
| Multi-tenant / pagos / traducción | Arquitectura para rentar a otras escuelas, pasarela automática, traducción en vivo | No empezado (aula ya está desacoplada de la API, que es el prerequisito) | 🔮 Futuro |

---

## 2. 🔴🔒 Seguridad — hallazgos de la revisión del 17 sep 2026

> Más urgentes que los de la sección 3: son explotables en producción ahora
> mismo, no pendientes de construcción. Revisión de código estático (no se
> ejecutó ningún ataque real ni se tocó producción).

### T-S1 — ✅ CERRADO (17 sep 2026) — los endpoints `/bot/*` no verificaban que quien llama sea el bot
- **Qué falta:** un secreto compartido (ej. header `X-Bot-Key`, comparado
  contra una env var nueva `BOT_API_KEY`) que la API exija en cada ruta de
  `routes/bot.js`, y que `apps/bot/` mande en cada request.
- **Por qué importa — cadena de robo de cuenta:** hoy cualquiera en internet
  (sin ser el bot) puede llamar estos endpoints directo, sin login ni CORS
  (CORS solo frena navegadores, no `curl`/Postman/otro servidor):
  1. `POST /bot/registrar` con `{ email: "victima@x.com", whatsapp: "<número del atacante>" }`.
     `upsertUsuario` (`usuarioService.js:110-117`) hace
     `whatsapp = COALESCE(EXCLUDED.whatsapp, usuarios.whatsapp)` — si el
     atacante manda un número, **siempre pisa el de la víctima**, sin
     comparar contra el actual.
  2. El atacante pide `POST /auth/phone/send-code` con ese mismo número.
  3. Verifica el OTP en `POST /auth/phone/verify` → **entra a la cuenta de la
     víctima** (si tenía `estado = 'activo'`, que es justo a quién le sirve
     el login por número).
  - Camino alterno igual de directo: `POST /bot/completar-whatsapp` hace lo
    mismo cuando el campo está vacío (`diagnosticoService.js`).
- **Por qué importa — fuga de datos:** `GET /bot/diagnostico/:email` y
  `GET /bot/pendientes/:email` devuelven, sin ninguna autenticación, para
  CUALQUIER email que se les pida: nombre, WhatsApp, estado de cuenta, motivo
  de bloqueo, talleres, y **los códigos internos `RESP-XXXX-XXXX` /
  `DEST-XXXX-XXXX`** — exactamente lo que `CLAUDE.md` dice que el usuario
  nunca debe ver ni recibir. `GET /bot/usuario/:email` permite además
  enumerar qué correos tienen cuenta.
- **Dónde tocar:** `apps/api/src/routes/bot.js` (middleware nuevo antes de
  cada ruta o `router.use(...)`), `apps/bot/index.js` / `apps/bot/src/flujo.js`
  (mandar el header en cada llamada a la API), `.env` / `.env.example` (nueva
  var), `docker-compose.yml` (pasarla al contenedor de la API).
- **Criterio de terminado:** una petición a cualquier `/bot/*` sin la clave
  correcta responde 401 y no toca la base de datos; el bot Faro sigue
  funcionando de punta a punta con la clave configurada; prueba automatizada
  que confirma el rechazo sin clave y el éxito con ella.
- **Estado (17 sep 2026):** implementado y probado localmente.
  - `apps/api/src/middleware/verificarBotKey.js` — nuevo, exige el header
    `X-Bot-Key` == `process.env.BOT_API_KEY` en toda `/bot/*`
    (`router.use()` en `routes/bot.js`, antes de cualquier ruta). Si
    `BOT_API_KEY` no está configurado, rechaza con 500 en vez de dejar pasar.
  - `apps/bot/src/flujo.js` — nuevo helper `apiFetch()` que manda el header en
    las 10 llamadas a `/bot/*` (se dejó `/tallers` sin tocar: no es una ruta
    del bot y no lo exige).
  - `BOT_API_KEY` agregado a `.env.example` (raíz), `apps/bot/.env.example` y
    `docker-compose.yml` (env del servicio `api`).
  - Pruebas: `apps/api/src/middleware/verificarBotKey.test.js` (4 casos,
    `npm test` en `apps/api` — primer test del proyecto, con
    `node --test`). Todas pasan.
  - De paso, `apps/bot/.env.example` tenía una contraseña de admin con pinta
    de ser real, en texto plano — nunca llegó a git (confirmado con
    `git log --all`), pero se reemplazó por un placeholder. **Si esa
    contraseña era la real de `/admin`, cámbiala por una nueva** — estuvo
    tiempo sentada en un archivo pensado para plantillas.
  - Desplegado en la Toshiba: `BOT_API_KEY` generado y puesto en los dos
    `.env` (raíz y `apps/bot/`), redeploy hecho, bot verificado funcionando
    de punta a punta con la clave configurada.
  - **De paso, se rotaron `ADMIN_TOKEN_SECRET` y la contraseña de `/admin`**
    (`ADMIN_PASSWORD_HASH`) porque ambas se compartieron en texto plano
    durante la sesión de chat de este ticket — regla general: cualquier
    secreto que toca un chat/log se trata como expuesto y se rota, sin
    importar que sea "solo para mí".

#### ⚠️ Gotcha descubierto al rotar la contraseña: hashes bcrypt en el `.env` raíz necesitan `$` escapados como `$$`

`docker-compose.yml` referencia varias variables como `${ADMIN_PASSWORD_HASH}`,
y Docker Compose interpola el `.env` de la raíz buscando patrones `$ALGO` para
sustituir variables — igual que hace con las que sí queremos. Un hash bcrypt
(formato `$2a$12$<53 caracteres>`) trae 3 signos `$`, y el bloque después del
tercero es texto base64 (`./0-9A-Za-z`) que, si por azar empieza con una
letra, Compose lo confunde con el nombre de una variable, no la encuentra, y
la borra en silencio — corrompiendo el hash sin ningún error visible.

Pasó exactamente esto el 17 sep 2026: un hash nuevo cuyo salt empezaba con
letra perdió ese pedazo completo al cargarse en el contenedor, y ni la
contraseña vieja ni la nueva entraban — el síntoma no daba ninguna pista de
que el problema era el `.env`, no la contraseña. Con ~52 de 64 caracteres
posibles del alfabeto bcrypt siendo letras, esto va a pasar la **mayoría** de
las veces que se rote la contraseña, no es un caso raro.

**Regla para la próxima vez que se cambie `ADMIN_PASSWORD_HASH` (o cualquier
valor con `$` que Compose vaya a interpolar):** duplicar cada `$` como `$$` en
el `.env`. Ejemplo con un hash **inventado** (nunca pegar aquí el hash real —
este repo es público):
```
# Hash de ejemplo (NO es uno real): $2a$12$EjemploDeSaltNoEsReal1.HashDeEjemploNoUsarNunca123
# En el .env:                      ADMIN_PASSWORD_HASH="$$2a$$12$$EjemploDeSaltNoEsReal1.HashDeEjemploNoUsarNunca123"
```
Para diagnosticar si esto vuelve a pasar, comparar qué quedó cargado adentro
del contenedor contra el hash real:
```bash
docker exec -it destello-api node -e "console.log(process.env.ADMIN_PASSWORD_HASH)"
```

### T-S2 — ✅ CERRADO (18 sep 2026) — sin límite de intentos por IP en login de admin y envío de OTP
- **Qué falta:** rate limiting por IP en `POST /admin/login` (hoy solo hay
  bcrypt, sin cooldown ni bloqueo tras varios intentos fallidos) y en
  `POST /auth/phone/send-code` (el único límite hoy es por número de WhatsApp
  — `otpService.js` — no por IP, así que alguien puede pedir códigos hacia
  muchos números distintos sin freno, gastando el envío de WhatsApp del bot
  como vector de spam hacia terceros).
- **Por qué importa:** la contraseña de admin es única y compartida — sin
  límite de intentos, es de fuerza bruta viable si algún día se filtra parte
  del hash o se prueba un diccionario.
- **Dónde tocar:** nuevo middleware (`express-rate-limit` u otro) en
  `routes/admin.js` (ruta `/login`) y `routes/auth.js` (`/phone/send-code`).
- **Criterio de terminado:** N intentos fallidos por IP en una ventana de
  tiempo bloquean temporalmente esa IP; prueba que lo confirma.
- **Estado (18 sep 2026):** implementado, sin librería externa — mismo
  criterio que `otpService.js` (Map en memoria, un solo contenedor, no hace
  falta Redis).
  - `apps/api/src/middleware/rateLimit.js` (nuevo) — `rateLimit({ windowMs, max })`
    genérico por IP, responde 429 + header `Retry-After` al pasarse del
    límite. `clientIp()` lee `CF-Connecting-IP` (la API vive detrás de un
    Cloudflare Tunnel — sin esto, `req.ip` habría sido siempre la IP del
    túnel, no la de quien hace la petición, y el límite no habría servido de
    nada).
  - `routes/admin.js` — `/login`: 10 intentos / 15 min por IP.
  - `routes/auth.js` — `/phone/send-code`: 8 solicitudes / 10 min por IP
    (además del límite ya existente por número en `otpService.js` — este es
    el que faltaba, por IP, para que no se use como vector de spam hacia
    números ajenos).
  - Pruebas: `apps/api/src/middleware/rateLimit.test.js` (4 casos: límite por
    IP, IPs independientes entre sí, reseteo pasada la ventana, header
    `Retry-After`). `npm test` en `apps/api`: 8/8 pasan (con los 4 de T-S1).
  - Desplegado y verificado en prod (18 sep 2026): 11 intentos seguidos
    contra `/admin/login` con contraseña incorrecta dieron `401` los
    primeros 10 y `429` el 11.

### Notas menores de la misma revisión (no ameritan ticket propio todavía)
- `.env.example` está listado dentro de `.gitignore` pero SÍ está trackeado en
  git (`git ls-files` lo confirma) — inconsistencia inofensiva hoy porque su
  contenido son solo placeholders (`CAMBIA_ESTO`), pero vale la pena
  entenderla antes de que alguien asuma que ese archivo no se sube.
- `apps/web/src/services/publicApi.js` tiene `const BASE = '/api'` fijo, pero
  `CLAUDE.md` documenta `BASE = import.meta.env.VITE_API_URL ?? '/api'`. Hoy
  no rompe nada (el proxy de Vercel cubre `/api/*`), pero el código y el doc
  ya no coinciden — ajustar uno de los dos al cerrar T-14c.
- La ruta `/acceso` sigue registrada y navegable en `App.jsx` (no es solo
  "huérfana sin link" como dice `CLAUDE.md` — cualquiera puede escribir la URL
  a mano), y sigue viva junto con `POST /auth/resplandor/validate` / `consume`,
  sin rate limit propio. Refuerza la prioridad de **T-14c** (lado usuario del
  modelo viejo de códigos): mientras exista, es superficie de ataque
  adicional, aunque de riesgo bajo (código de 32 bits de entropía).
- No se encontraron secretos reales expuestos en el código ni en el historial
  de git (`.env` nunca se commiteó), ni inyección SQL (todas las queries
  revisadas usan parámetros o listas blancas fijas para nombres de columna),
  ni usos de `dangerouslySetInnerHTML` en el frontend.

---

## 3. 🔴 Bloquea el lanzamiento (meta 11 sep 2026, capas 1-2 del aula)

### T-01 — Video real en el aula
- **Qué falta:** integrar OpenVidu (fork de LiveKit), primero en local/1-a-1 para
  perfilar comportamiento, luego VPS (Hostinger KVM 2, Phoenix).
- **Por qué importa:** sin esto el aula no es un aula en vivo, es un pizarrón.
- **Dónde tocar:** nuevo, no vive en `src/aula/` todavía. Cuidado: el aula sigue
  sin poder hacer `fetch` directo — si video necesita tokens/señalización, ese
  dato entra por el contrato (`sesion`), igual que todo lo demás.
- **Criterio de terminado:** profe y alumnos se ven/escuchan en vivo dentro del
  aula existente, sin romper sellos/pizarrón/semáforo.

### T-02 — Actividad: Memorama
- **Qué falta:** componente que exporte `Componente` + `resumen`, sumado a
  `TIPOS` en `apps/web/src/aula/actividades/registro.js`. Contenido = parejas a
  destapar, viene de la plantilla del taller (no hardcodeado).
- **Por qué importa:** es una de las 3 actividades que faltan para que el aula
  tenga variedad real de ejercicios.
- **Dónde tocar:** nuevo archivo `apps/web/src/aula/actividades/Memorama.jsx`
  (copiar la forma de `Quiz.jsx` como plantilla), + 1 línea en `registro.js`.
- **Criterio de terminado:** sigue las 5 reglas del contrato (`contrato.js`):
  se abre cuando la profe lo ordena, reporta estado con `resumen()`, avisa
  interacción vía `onCambio`, acepta sellos encima, respeta `liberado`.

### T-03 — Actividad: Armar (piezas tipo lego)
- **Qué falta:** igual que T-02, pero con arrastre de piezas.
- **Dónde tocar:** `apps/web/src/aula/actividades/Armar.jsx` + `registro.js`.
- **Criterio de terminado:** mismo checklist del contrato que T-02.

### T-04 — Actividad: Modelo 3D (puntos marcables)
- **Qué falta:** visor 3D con puntos que se pueden marcar (ej. puntos de
  acupuntura para auriculoterapia). El propio código lo marca como
  "la prueba de fuego" del contrato — el más difícil.
- **Por qué importa:** valida si el contrato aguanta con contenido real; el
  comentario en `registro.js` es explícito en **no** construirlo con datos
  de mentira antes de tener los modelos reales — haría inválida la prueba.
- **Dependencia:** necesita los modelos 3D reales de los talleres (auriculoterapia,
  etc.) antes de empezar. Bloqueante externo, no técnico.
- **Dónde tocar:** `apps/web/src/aula/actividades/Modelo3D.jsx` + `registro.js`.
- **Criterio de terminado:** mismo checklist del contrato; además valida que la
  miniatura de la rejilla del profe (20 en vivo) no se sienta lenta.

### T-05 — Tabla de profesores real
- **Qué falta:** tabla `profesores` en BD + lógica de permisos separada de admin.
- **Por qué importa:** hoy un profesor externo con cuenta de "profe" vería todo
  el panel financiero — es un problema de seguridad, no solo cosmético.
- **Desbloquea:** nombre del profesor en diplomas, firma en certificados, ForYou.
- **Dónde tocar:** migración nueva en `apps/api/src/db/migrations/`, reemplazar
  `isAdminEmail()` donde se usa para decidir `esProfe`.
- **Criterio de terminado:** un profesor puede entrar a SU salón sin ver
  métricas/finanzas de otros talleres.

### T-32 — Página de Perfil: construir desde cero
- **Qué falta:** todo. `PagePerfil.jsx` hoy es 100% datos inventados
  (`PERFIL_MOCK`): nombre, racha, puntos y logros de gamificación que ni
  siquiera existen en el backend todavía (`ENABLE_GAMIFICATION=false` en
  `.env.example`), sin una sola llamada a la API.
- **Por qué importa:** es una página real del producto, visible para
  cualquier alumno que entre a `/perfil`, mostrando datos falsos como si
  fueran suyos.
- **Dónde tocar:** `apps/web/src/pages/PagePerfil.jsx` — conectar a
  `GET /users/me`, `GET /users/me/talleres`, `GET /users/me/certificados`
  (ya existen). Racha/puntos/logros: quitarlos o dejarlos claramente como
  "próximamente" hasta que exista gamificación real — no inventar números.
- **Criterio de terminado:** el perfil muestra datos reales del usuario
  logueado; nada en pantalla es texto/número inventado.

### T-06 — Respaldo de BD + ping diario
- **Qué falta:** backup de Supabase (el plan free no incluye backups diarios) +
  un ping diario para que el proyecto no se pause por inactividad.
- **Por qué importa:** sin esto, un día sin tráfico puede pausar el proyecto o
  perder datos sin aviso, justo antes de abrir a usuarios reales.
- **Criterio de terminado:** backup corriendo con cadencia definida + cron/ping
  configurado y verificado que evita la pausa automática.

---

## 4. 🟠 Deuda técnica (de `docs/revision-flujo-registro.md`, 22 ago 2026)

> ⚠️ **Corrección del 18 sep 2026:** esta sección se armó copiando el
> diagnóstico de `revision-flujo-registro.md` (22 ago) sin comparar contra el
> código actual. Al ir a empezar T-08, se verificó cada ticket contra el
> código real: **5 de los 9 ya estaban resueltos** desde antes (varios el
> mismo 22 ago, en el commit `46a4a31 fix revisar y validar cupo de taller`,
> y CLAUDE.md ya los tenía documentados en "Lo que Está Terminado" — solo
> nunca se sincronizó esta lista). Quedan abajo como referencia histórica,
> tachados, para que quede constancia de qué se verificó y cuándo.

### ~~T-07 — Unificar activación de alumno (bug "pagado sin taller")~~ ✅ ya resuelto
Verificado 18 sep 2026: `inscripcionService.js` tiene `activarAlumno()`, y
tanto `PATCH /admin/lista-espera/:id` como `POST .../confirmar-pago`
(`routes/admin.js`) ya lo llaman — un solo camino, no dos.

### ~~T-08 — Fix conteo de talleres confirmados~~ ✅ ya resuelto
Verificado 18 sep 2026: `adminController.js` (`getTalleresStats`) ya filtra
con `estado IN ('cupo_confirmado', 'confirmado')`.

### ~~T-09 — Validar cupo máximo antes de inscribir~~ ✅ ya resuelto
Verificado 18 sep 2026: `cupoService.hayCupo()` existe y ya se llama desde
`listaEsperaService.js` (antes de anotar en lista de espera) y desde
`chispaService.js` (antes de crear una chispa).

### ~~T-10 — Nombre y apellido en un solo lugar~~ ✅ CERRADO (18 sep 2026)
- **Estado verificado el 18 sep:** el problema original ya no existía en el
  camino normal — `apps/bot/src/flujo.js` (paso `REG_NOMBRE`) ya separaba
  nombre y apellido al capturar el mensaje. Solo quedaba el caso borde de
  `activarAlumno()` (`inscripcionService.js`): al activar desde
  `lista_espera` a alguien que nunca pasó por el bot, copiaba el nombre
  completo concatenado sin partirlo, dejando `apellido` vacío.
- **Qué se hizo:** nueva función `partirNombre()` (exportada) en
  `inscripcionService.js` — misma regla que ya usa el bot: primera palabra
  = nombre, el resto = apellido (o `null` si es una sola palabra). Se
  aplica a `reg.nombre` antes de las dos queries de `activarAlumno()`
  (la que actualiza una cuenta existente vía `COALESCE`, y la que crea una
  cuenta nueva) — ninguna de las dos escribía `apellido` antes; ahora las
  dos lo hacen.
- **Pruebas:** `apps/api/src/services/inscripcionService.test.js` (4 casos:
  nombre+apellido, una sola palabra, espacios extra, null/vacío). `npm test`
  en `apps/api`: 12/12 (los 8 de antes + estos 4).
- **Criterio de terminado:** ✅ una cuenta activada desde `lista_espera` sin
  pasar por el bot también termina con `nombre` y `apellido` separados.
- **Verificación funcional con datos reales:** diferida a propósito (decisión
  de Paola, 18 sep 2026) — se confirma en la próxima revisión completa del
  flujo del bot, en vez de armar un caso de prueba manual aislado ahora.
  Código desplegado y cubierto por las 4 pruebas automatizadas mientras tanto.

### ~~T-11 — Transacción en `confirmar-pago`~~ ✅ ya resuelto
Verificado 18 sep 2026: `activarAlumno()` corre completo dentro de
`withTransaction()` (`db.js`) — correo y WhatsApp se mandan después, fuera de
la transacción, a propósito.

### ~~T-12 — Persistir conversación del bot~~ ✅ ya resuelto
Verificado 18 sep 2026: `flujo.js` ya escribe cada cambio de conversación a
`bot_conversaciones` vía `PUT /bot/conversacion/:jid` (sin bloquear) y la
rehidrata con `restaurarConversacion()` al arrancar en frío — confirmado que
se llama desde el manejador principal de mensajes.

### T-13 — Migrar relaciones de email a `usuario_id`
- **Qué falta:** agregar `usuario_id` nullable a `chispas` y `lista_espera`
  (originalmente eran 3 tablas incluyendo `resplandores`, pero esa ya es
  histórica desde T-14 — 18 sep 2026 — y nada la consulta, así que no hace
  falta migrarla); rellenarlo desde el email actual; migrar las queries de a
  una dejando el email como respaldo; recién entonces `NOT NULL` y quitar
  `chispas_usuario_email_fkey`.
- **Por qué importa:** hoy si alguien cambia de correo se rompe la cadena, y
  todas las queries hacen `LOWER(email) = LOWER($1)` para compensar mayúsculas.
- ⚠️ **NO hacerlo de un tirón** — es la migración por etapas que ya está descrita
  en `CLAUDE.md`. Mientras no esté hecha, la FK sigue siendo intencional.
- **Criterio de terminado:** cada etapa se cierra y verifica antes de pasar a la
  siguiente; el `NOT NULL` final solo se pone cuando las 2 tablas ya tienen
  `usuario_id` poblado al 100%.

### ~~Paso 1 de 4 — agregar `usuario_id` nullable~~ ✅ CERRADO (18 sep 2026)
- Migración `apps/api/src/db/migrations/015_usuario_id_paso1.sql`: agrega
  `usuario_id INTEGER REFERENCES usuarios(id)` (nullable, `ON DELETE
  SET NULL` — mismo criterio que la FK vieja por email) a `chispas` y
  `lista_espera`, con su índice cada una. Queda vacía en todas las filas
  a propósito — llenarla es el paso 2.
- `db/schema.supabase.sql` actualizado con esta migración también (sigue
  siendo la concatenación fiel de todas, ahora 001 a 015).
- **Corrida en Supabase y confirmada por Paola (18 sep 2026), sin errores.**
- No requirió redeploy de la API — ningún código lee la columna todavía.

### ~~Paso 2 de 4 — rellenar `usuario_id`~~ ✅ CERRADO (18 sep 2026)
- Migración `apps/api/src/db/migrations/016_usuario_id_paso2.sql`: rellena
  `usuario_id` en `chispas` y `lista_espera` cruzando por correo (sin
  distinguir mayúsculas, `LOWER(...)`) contra `usuarios.email`. Idempotente
  — solo toca filas con `usuario_id IS NULL`, correrla dos veces no hace
  nada la segunda vez.
- Trae una consulta de revisión al final que reporta, por tabla: total de
  filas, cuántas quedaron con `usuario_id`, cuántas quedaron "huérfanas"
  (tienen correo pero ese correo no existe en `usuarios` — vale la pena
  mirarlas, no bloquean nada), y en chispas cuántas están "sin asignar"
  (nunca tuvieron dueño).
- `db/schema.supabase.sql` actualizado (ahora 001 a 016).
- **No requiere redeploy de la API** — sigue sin haber código que lea la
  columna.
- **Corrida en Supabase y confirmada por Paola (18 sep 2026).** Resultado:
  `chispas` 9/9 con `usuario_id`. `lista_espera` 6/7, con 1 huérfana (correo
  sin cuenta asociada hoy — dato de prueba, no bloquea nada; queda para
  revisar cuando se quiera, no es parte del criterio de terminado de este
  paso).

### Paso 3 de 4 — se partió en dos al empezarlo (18 sep 2026)

> Al arrancar el paso 3 se encontró que el patrón `usuario_email` se usa en
> muchas más tablas de las que T-13 cubre (`pagos`, `eventos`, `insignias`,
> `asistencias`, `certificados`, `usuarios_bloqueos`, `canjes_supernova`) —
> esas quedan **fuera de alcance**, T-13 solo habla de `chispas` y
> `lista_espera`. Dentro de esas dos tablas, el paso se partió en 3a/3b
> (mismo criterio que T-14): 3a es aditivo y de bajo riesgo, 3b toca
> consultas que ya funcionan.

#### ~~Paso 3a — que las inserciones nuevas guarden `usuario_id`~~ ✅ CERRADO (18 sep 2026)
- **Qué se hizo:** los 4 lugares del código que insertan en `chispas` o
  `lista_espera` ahora también guardan `usuario_id` (antes ninguno lo hacía
  — con eso, el trabajo del paso 2 se habría ido quedando atrás con cada
  registro nuevo):
  - `listaEsperaService.registrarEnLista()` — nuevo lookup con
    `findByEmail()` antes del INSERT (puede dar `null`, normal: no siempre
    existe cuenta todavía cuando alguien se anota).
  - `chispaService.createChispa()` — el UPSERT a `usuarios` que esta
    función ya hacía (para garantizar que la cuenta exista) ahora captura
    el `id` con `RETURNING id` y lo reutiliza en sus dos INSERT
    (`lista_espera` y `chispas`).
  - `inscripcionService.activarAlumno()` — ya tenía `usuario.id` resuelto
    de antes; se agregó a su INSERT de `chispas`.
  - **De paso** (no es un INSERT, pero mismo criterio que T-10): el UPDATE
    de `activarAlumno()` que marca `lista_espera` como `'pagado'` ahora
    también rellena `usuario_id` con `COALESCE` si el registro venía de
    antes de esta migración — sin esto, la única forma de que un registro
    viejo consiguiera su `usuario_id` sería re-correr el paso 2 a mano.
- **Lo que NO se tocó:** ningún `SELECT`/`WHERE` que ya filtra por correo
  — eso es el paso 3b. La FK vieja tampoco se toca (paso 4).
- **Pruebas:** no fue posible escribir un test automatizado — depende de
  una base de datos real (INSERT/UPDATE con `RETURNING`), y este proyecto
  no tiene infraestructura de pruebas de integración con Postgres todavía.
  `npm test` (unitarias, sin tocar BD): sigue en 12/12, sin regresiones.
- **Verificado por Paola (18 sep 2026) con una inscripción real por el
  bot.** El primer intento dio `usuario_id: null` — investigado a fondo,
  **no era un bug de este paso**: la cuenta nunca se creó porque el número
  de WhatsApp ya estaba ligado a otra cuenta de prueba, y el bot no revisa
  si `/bot/registrar` falló antes de seguir adelante. Confirmado sin fila
  en `usuarios` para ese correo. Documentado como **T-37** (más abajo) —
  es un bug real de `flujo.js`, no de este paso, y quedó fuera del alcance
  de T-13.

#### ~~Paso 3b — los `JOIN` cruzados prefieren `usuario_id`, con el correo de respaldo~~ ✅ código listo, ⚠️ pendiente probar (18 sep 2026)
- **Qué se hizo:** los 4 lugares donde el código cruza `chispas` y
  `lista_espera` comparando `LOWER(usuario_email) = LOWER(email)` ahora
  agregan `usuario_id_a = usuario_id_b OR` antes de esa comparación —
  **sin quitar la comparación por correo**. En SQL, si cualquiera de los
  dos `usuario_id` es `NULL`, esa parte de la condición no es verdadera ni
  falsa (es `NULL`), así que la comparación cae sola al correo — es
  exactamente "correo de respaldo" sin necesitar un `CASE` ni duplicar la
  consulta.
  - `services/asistenciaService.js` (`tieneAcceso`) — el `EXISTS` que
    valida que el pago ya esté confirmado antes de dejar registrar
    asistencia.
  - `services/chispaService.js` (`getTalleresDelUsuario`) — el mismo
    `EXISTS`, usado por `/users/me/talleres` (lo que arma el Home).
  - `routes/admin.js` (`GET /lista-espera`) — el `LEFT JOIN LATERAL` que
    trae la chispa más reciente de cada registro (de ahí sale el reloj de
    48h y la etiqueta de demo en `ListaEsperaAdmin.jsx`).
  - `routes/metricas.js` (ficha de alumno) — mismo patrón, para mostrar la
    chispa junto con cada renglón de su historial.
- **Lo que NO se tocó a propósito:** los filtros donde `usuario_email` se
  compara contra un correo que **viene de un parámetro** (JWT, query string)
  — eso no es un cruce entre `chispas` y `lista_espera`, es "¿esto es de
  esta persona?", y cambiarlo significa decidir cómo identificar a un
  usuario en toda la API (un tema más grande, no parte de T-13). Tampoco se
  toca la FK vieja (paso 4).
- **Pruebas:** mismo caso que 3a — no es posible un test automatizado sin
  una base real. `npm test`: 12/12, sin regresiones (estas pruebas no
  tocan las consultas modificadas). Verificación real pendiente: revisar
  que la Lista de espera y la Ficha de alumno en el panel se sigan viendo
  igual que antes del cambio.

### T-14 — Limpiar el modelo viejo de códigos (Resplandor)

> Partido en 3 el 18 sep 2026 al empezarlo: resultó ser una funcionalidad
> viva y entrelazada en 3 zonas separadas, no "agregar comentarios de
> deprecado" como decía la descripción original. Antes de tocar nada se
> confirmó con Paola que el botón manual de Resplandor en el panel **no se
> usa** (lo que sí usa es "Crear Chispa", para demos — algo aparte, no se
> toca). Ver el detalle de la conversación en el historial de git de este
> archivo si hace falta el contexto completo.

#### ~~T-14a — Limpiar `AccesosPanel.jsx`~~ ✅ CERRADO (18 sep 2026)
- **Qué se hizo:** se quitó toda la UI y lógica de Resplandor del panel
  (botón crear/reenviar/revocar, tab de historial, tab de la vista global,
  mensajes de WhatsApp) — quedó como panel de Chispas exclusivamente. Se
  renombró `needsResplandor` → `sinCuentaActiva` (misma lógica, nombre que
  ya no depende del concepto que se quitó). El encabezado del archivo se
  reescribió para describir el flujo real (bot → `activarAlumno()`, sin
  Resplandor de por medio).
- **Backend sin tocar a propósito:** el panel sigue llamando
  `GET /admin/resplandores?email=` porque es el único endpoint que ya hace
  la búsqueda de `usuario` por correo que este panel necesita — solo se dejó
  de usar el arreglo `resplandores` de la respuesta. Se retira cuando se
  haga T-14b.
- **Pruebas:** `apps/web` no tiene NINGÚN framework de pruebas configurado
  (Vitest/Testing Library/etc. — 0, confirmado en la revisión de seguridad
  del 17 sep). No fue posible escribir un test automatizado para este
  cambio; se verificó sintaxis con `esbuild` (compila sin errores) y
  revisión manual línea por línea. **Verificación funcional confirmada por
  Paola en el panel real (18 sep 2026)**, con el checklist de 6 puntos
  (buscar cuenta activa/en espera/inexistente, generar chispa, tabla
  global, sin rastro de "Resplandor") — todo correcto.
- **Pendiente futuro, no de este ticket:** meter Vitest + Testing Library a
  `apps/web` para que el frontend deje de depender 100% de pruebas manuales.

#### ~~T-14b — Backend admin: retirar endpoints y paneles muertos~~ ✅ CERRADO (18 sep 2026)
- **Qué se hizo:**
  - `routes/admin.js` — se quitaron los 5 endpoints `/admin/resplandores/*`,
    `POST /admin/mail/resplandor` (tampoco lo llamaba nada), y la ruta
    huérfana `POST /admin/lista-espera/:id/confirmar` (confirmado que
    `ListaEsperaAdmin.jsx` nunca la llama — la usaba un panel viejo, ver
    abajo). También se quitó el `EXISTS (...) AS tiene_resplandor` de la
    query viva de `GET /lista-espera`: se calculaba en cada carga del panel
    y nada lo leía.
  - Nuevo endpoint limpio `GET /admin/usuarios/buscar?email=` — reemplaza al
    viejo `GET /admin/resplandores?email=` que `AccesosPanel.jsx` (T-14a)
    seguía usando solo por el dato de `usuario`; ahora ya no toca la tabla
    `resplandores` para nada.
  - `adminController.js` — se quitaron `confirmarCupo()` y `listEspera()`,
    dos funciones que **nunca estuvieron enrutadas** (código muerto desde
    antes, no solo por esto): `confirmarCupo` llamaba
    `resplandorService.createResplandor`, `listEspera` llamaba a
    `listaEsperaService.listTodas()` — que también se quitó (misma
    `tiene_resplandor` muerta, sin más consumidores).
  - **Se encontraron 3 componentes de React huérfanos** que ninguna página
    importaba (verificado con grep contra todo `apps/web/src`, no solo
    contra `PageAdmin.jsx`): `ListaEsperaPanel.jsx` (551 líneas — una
    versión vieja de la lista de espera, previa a `ListaEsperaAdmin.jsx`,
    que sí llamaba la ruta `/confirmar` huérfana), `RespladorAdmin.jsx`
    (267 líneas, nombre con typo) y `ResplandoresPanel.jsx` (429 líneas) —
    los tres se borraron. En total, ~1,247 líneas de frontend muerto que no
    aparecían en ningún flujo real.
- **`resplandorService.js` y `resplandorController.js` NO se tocaron** — se
  descubrió que casi todas las funciones de `resplandorService.js`
  (`createResplandor`, `listResplandores`, `getStats`, `revokeResplandor`,
  `getResplandoresPorEmail`, `validateResplandor`, `consumeResplandor`) las
  sigue llamando `resplandorController.js`, que es de `routes/auth.js`
  (T-14c) — no de `routes/admin.js`. Tocar ese archivo aquí habría invadido
  el alcance de T-14c. Única excepción: `getResplandor()` no tiene ningún
  llamador en todo el repo, pero se dejó igual para que T-14c limpie el
  archivo completo de una vez, en vez de tocarlo en dos ratos distintos.
- **Pruebas:** `apps/api` — `npm test` sigue en 8/8 (sin tests nuevos, este
  ticket no agregó lógica propia, solo quitó código y renombró una ruta).
  `apps/web` — verificado con `esbuild` (sintaxis) y confirmado por Paola en
  el panel real tras el redeploy (18 sep 2026): la búsqueda de usuario en
  `AccesosPanel.jsx` funciona con el endpoint nuevo `/usuarios/buscar`. En
  el camino se detectó un 404-como-HTML esperable (contenedor viejo sin la
  ruta nueva antes del `docker compose up --build`) — resuelto con el
  redeploy normal, no era un bug del código.
- **Por qué importaba:** peso muerto activo desde el 20 jul 2026 — confundía
  a cualquiera que leyera el código sin el contexto, y era superficie de
  ataque extra sin necesidad (T-S1/T-S2 ya habían señalado algo parecido
  del lado de `/acceso`).
- **La tabla `resplandores` NO se tocó** — sigue con todo su historial, tal
  como pedía el criterio de terminado original.

#### ~~T-14c — Lado usuario: `PageAcceso.jsx`, registro con contraseña~~ ✅ CERRADO (18 sep 2026)
- **Qué se hizo:**
  - **Backend:** `routes/auth.js` — quitados `POST /auth/register`,
    `POST /auth/resplandor/validate` y `/consume`. `authController.js` —
    quitada `registerUser()` completa (109 líneas: validaba el resplandor,
    creaba/activaba la cuenta con contraseña, lo consumía, y de paso
    generaba código de referido — nada de eso vuelve a pasar).
    `resplandorController.js` y `resplandorService.js` — **borrados por
    completo**: al quitar las dos rutas de arriba quedaron en cero
    llamadores en todo el repo (confirmado con grep antes de tocar nada).
    `mailService.js` — quitados `sendResplandor()` y su plantilla HTML
    (`templateResplandor`), sin ningún llamador desde T-14b.
  - **Frontend:** `App.jsx` — `/acceso` ahora redirige a `/login` (no
    404, por si alguna liga vieja de correo o QR sigue apuntando ahí).
    Borrados: `PageAcceso.jsx`, y `RegisterForm` completo dentro de
    `PageLogin.jsx` (con `PasswordRules`/`passwordIsStrong`, que solo esa
    forma usaba). `useAuthStore.js` — quitada la acción `register()`.
    `publicApi.js` — quitadas `apiValidarResplandor`/`apiConsumirResplandor`
    (exportadas pero sin ningún llamador — `PageAcceso.jsx` hacía su propio
    `fetch` en vez de usarlas). `adminApi.js` — quitada `apiConfirmarCupo()`
    (llamaba a la ruta `/lista-espera/:id/confirmar` que T-14b ya había
    retirado). Borrado `AccessCodeInput.jsx` (huérfano — solo lo usaba
    `PageAcceso.jsx`, confirmado con grep que nada más lo importaba).
  - **La tabla `resplandores` NO se tocó** — sigue con su historial, tal
    como pedía el criterio de terminado original.
- **Dos hallazgos relacionados, dejados fuera a propósito** (no forman
  parte de este ticket, decisión consciente para no ampliar el alcance sin
  confirmarlo primero):
  1. **El login con correo+contraseña también está muerto.** `LoginForm`
     en `PageLogin.jsx` solo ofrece Google o WhatsApp OTP — no existe
     ningún campo de contraseña en la UI de login. La rama
     "email+password" de `authController.loginWithCode()` (backend) y la
     acción `login()` de `useAuthStore.js` (frontend, cero llamadores)
     siguen ahí, alcanzables solo llamando la API directo. Es la otra
     mitad del mismo modelo viejo (login, no solo registro) — decidir si
     se retira necesita su propio ticket, porque tocar login es más
     sensible que tocar un registro ya confirmado inalcanzable.
  2. **`PageLanding.jsx` (🔒 CONGELADA) sigue explicándole "Resplandor y
     Chispa" a las visitas** en una sección de marketing — no se tocó por
     la regla de "nunca modificar sin permiso explícito de Paola", pero
     ahora describe un mecanismo que ya no existe del lado del código. Es
     una decisión de contenido/marketing, no de código — queda anotada
     para cuando Paola quiera revisarla.
- **Pruebas:** `apps/api` — `npm test` sigue en 8/8. `apps/web` —
  verificado con `esbuild` en cada archivo tocado (sintaxis), y confirmado
  por Paola en el sitio real (18 sep 2026) tras el redeploy: Google y
  WhatsApp siguen funcionando igual, `/acceso` redirige a `/login` sin
  error.
- **Criterio de terminado:** ✅ la ruta `/acceso` ya no muestra el
  formulario viejo (redirige a `/login`), y los endpoints
  correspondientes ya no existen.

### ~~T-15 — Resolver los dos schemas contradictorios~~ ✅ CERRADO (18 sep 2026)
- **Qué falta (original):** `db/schema.sql` y `db/schema.supabase.sql` diferían
  en el default de `usuarios.estado`, el nombre de columna de email en
  `resplandores`, y el tipo de `lista_espera.taller_id`. El código vivo asume
  el de Supabase.
- **Lo que se encontró al revisar a fondo:** el problema era más grande que
  "dos schemas distintos" — `schema.supabase.sql` (jul 2026) tampoco reflejaba
  la realidad de hoy: le faltaban 6+ tablas de las migraciones 001-014
  (`pagos`, `eventos`, `bot_conversaciones`, `certificados`, `asistencias`,
  `usuarios_bloqueos`) y encima empezaba con `DROP TABLE ... CASCADE` de las
  tablas principales. Como el proyecto sigue en desarrollo y hoy no hay datos
  reales de usuarios (confirmado con Paola), correrlo por accidente no
  hubiera sido catastrófico — pero igual no era el schema "de hoy".
  También apareció una migración huérfana más:
  `apps/api/src/migrations/002_create_resplandores.sql` (abril 2026, mismo
  origen MVP que `schema.sql`) — completamente superada por
  `schema.supabase.sql`, que ya crea `resplandores` desde cero.
- **Qué se hizo:**
  - Se borraron `db/schema.sql` y `src/migrations/002_create_resplandores.sql`
    (los dos del MVP pre-Supabase, con tipos/columnas/FK equivocados —
    recuperables del historial de git si algún día hace falta verlos).
  - `db/schema.supabase.sql` se reconstruyó como la concatenación **literal**
    (verificada con `diff` contra cada archivo fuente, no transcrita a mano)
    de la base original + las 14 migraciones en orden, con un encabezado
    nuevo que explica qué es, que no se debe correr de un tirón sobre una
    base con datos, y que las tablas reales pueden tener cambios hechos a
    mano en Supabase que ningún script capturó.
- **Discrepancia resuelta (18 sep 2026):** se confirmó contra la base real
  (`information_schema.columns` en Supabase) que `talleres.id` **sí es
  `TEXT`** (slug) — `schema.supabase.sql` estaba bien, `CLAUDE.md` tenía el
  dato viejo (decía UUID) y ya se corrigió.
- **Hallazgo nuevo de la misma consulta:** `talleres` tiene dos columnas
  reales — `instructor TEXT` y `duracion_horas NUMERIC` — que no existen en
  NINGÚN schema ni migración versionada del repo. Se agregaron a mano
  directo en Supabase. No rompe nada (el código ya las usa vía
  `tallerService.js`, `CLAUDE.md` ya las documentaba), pero confirma en
  concreto que la base real puede tener más que cualquier archivo `.sql`
  de aquí. Anotado en el encabezado de `schema.supabase.sql` para la
  próxima vez que alguien dude de lo mismo.
- **Criterio de terminado:** ✅ un solo schema en el repo
  (`db/schema.supabase.sql`), y refleja la estructura acumulada real, no solo
  el arranque de julio.

---

## 5. 🟡 Pendiente (acordado, sin empezar / a medias)

- **T-16** — Onboarding / visita guiada la primera vez en el aula.
- **T-17** — `/aula-nueva` reconvertida por completo en salón de ensayo del
  profesor (hoy ya entra como `profe` por defecto, `?rol=alumno` para probar).
- **T-18** — Ilustraciones reales de sellos y reacciones (las hace Paola,
  quedan en `catalogo.js` cuando estén listas).
- **T-19** — Corregir talleres con horario `12:00 PM – 12:00 PM` cargado mal
  (dato, no bug de código).
- **T-20** — Vigencia de Chispa en frontend: bloquear rooms/contenido
  automáticamente al vencer (hoy el vencimiento existe en BD pero no se aplica
  visualmente en el frontend).
- **T-21** — Leer `imageMessage` en `apps/bot/index.js` + reenvío a Paola, para
  que "reportar pago con foto" funcione (hoy las fotos se ignoran). Ver
  `docs/flujo-acceso-bot.md` sección "Cambios pendientes de implementar" para
  el detalle completo (incluye tabla `reportes_acceso`, columnas de pago,
  endpoints nuevos y textos del bot).
- **T-22** — Limpieza de entorno: agregar `MAIL_FROM` y `BOT_HTTP_URL` al `.env`
  de la Toshiba (hoy salen WARN); regenerar `package-lock.json` de la API con
  `resend`.
- **T-23** — Automatizar el aviso de certificado emitido (hoy "emitir" solo lo
  pone en el Home del alumno, nadie le avisa).

### ~~T-33 — Retirar `POST /auth/login` (email+contraseña y código de Chispa)~~ ✅ CERRADO (18 sep 2026)
- **Encontrado al cerrar T-14c:** `LoginForm` (`PageLogin.jsx`) no tiene
  ningún campo de correo+contraseña — solo Google y WhatsApp OTP. Al
  revisar quién llama a `POST /auth/login` desde el frontend, se encontró
  que el único llamador era `useAuthStore.login()` — que a su vez **nadie
  llamaba**. O sea, ni la rama de contraseña NI la de código de Chispa
  eran alcanzables desde la app.
- **Confirmado con Paola:** hoy solo se entra por Google o WhatsApp, así
  que se autorizó retirar la ruta completa, no solo la parte de contraseña.
- **Qué se hizo:**
  - `authController.js` — se quitó `loginWithCode()` completa (las dos
    ramas). Imports `bcrypt` y `validateChispa` quitados, sin más
    llamadores en el archivo.
  - `routes/auth.js` — se quitó `POST /auth/login`.
  - `useAuthStore.js` — se quitó la acción `login()` (cero llamadores).
  - La columna `usuarios.password` NO se tocó — sigue en la tabla, sin
    ningún código que la lea o escriba ya.
- **Pruebas:** `npm test` en `apps/api` sigue en 8/8. `apps/web` verificado
  con `esbuild`, y confirmado por Paola en el sitio real (18 sep 2026) tras
  el mismo redeploy que T-14c: Google y WhatsApp siguen funcionando igual.

### T-34 — `PageLanding.jsx` con copy de marketing desactualizado
- `PageLanding.jsx` (🔒 CONGELADA) tiene una sección de marketing
  "RESPLANDOR & CHISPA" explicándole el concepto viejo a las visitas — no
  se tocó por la regla de no modificar esa página sin permiso explícito.
- **Decisión de Paola (18 sep 2026):** se actualiza al final, cuando haya
  contenido nuevo listo para montar en la página. No es una decisión de
  código — queda en espera, no bloquea nada.

### T-35 — Revisar si `apps/bot/src/flujo.js` tiene una rama muerta de Resplandor
- **Qué falta:** confirmar si el código del bot (opción 3, "No me llegó mi
  acceso") todavía tiene una rama para "avisar del resplandor pendiente".
  Si la tiene, desde T-14 (18 sep 2026) nunca se dispara —
  `GET /bot/pendientes/:email` siempre devuelve el arreglo `resplandores`
  vacío, porque nada crea resplandores ya.
- **Por qué no se hizo ya:** `flujo.js` está explícitamente marcado en
  `CLAUDE.md` como "lo que YA funciona (NO tocar)" — no se revisó a fondo
  en esta sesión para no arriesgar el flujo real del bot sin pruebas.
- **Criterio de terminado:** si existe la rama muerta, se quita (o se deja
  documentada como inofensiva); si no existe, se cierra el ticket sin
  cambios.
- **Aprovechar la misma sesión para:** confirmar con datos reales la
  verificación funcional que quedó diferida en T-10 (activar desde
  `lista_espera` a alguien que nunca escribió al bot, y revisar que
  `usuarios.nombre`/`apellido` queden bien separados).

### T-36 — `pendiente` no cuenta contra el cupo, pero el bot ya promete el lugar
- **Encontrado:** Paola probó el registro por el bot (18 sep 2026) y, en
  cuanto eligió taller, el bot le mandó de inmediato "¡Registro completado!
  Quedaste inscrito" + los medios de pago — sin pasar por que el admin
  confirme el lugar a mano. Esto **no es un bug introducido hoy**: es un
  comportamiento intencional y ya documentado dentro del propio
  `flujo.js` (comentario explícito: mandar el precio de una vez en cuanto
  hay cupo, en vez de hacer esperar a la persona a que el admin conteste).
- **El detalle que sí vale la pena resolver:** `cupoService.js` dice,
  textual, *"Ocupa lugar quien está en `cupo_confirmado` o `pagado`. Los
  `pendiente` NO."* — o sea, cuando el bot le dice a alguien "quedaste
  inscrito", su registro sigue en `pendiente` y **no está contando contra
  el cupo real todavía**. Si varias personas se registran casi al mismo
  tiempo para un taller con poco cupo, a todas se les puede prometer lugar
  aunque el taller ya esté, en los hechos, lleno — el primero que paga se
  queda, a los demás se les prometió algo que el sistema no les estaba
  apartando.
- **Lo que Paola está evaluando** (18 sep 2026): que el lugar se **asigne**
  de verdad al detectar disponibilidad (contando ya contra el cupo desde
  ese momento) y se mande el medio de pago; la confirmación al 100% llega
  cuando se paga; si no paga a tiempo, la liberación automática que ya
  existe (48h + 24h de gracia) se encarga de soltar el lugar. Dos de las
  tres piezas (mandar medios de pago de inmediato, liberar si no paga) ya
  existen — falta la primera (que "pendiente" cuente contra el cupo desde
  que se asigna, no hasta `cupo_confirmado`).
- **Por qué no se resolvió ya:** es una decisión de negocio (qué tan
  temprano se "reserva" un lugar) más que un bug — se revisa junto con
  T-35 en la próxima sesión completa del flujo del bot, no a media
  conversación de otro ticket.
- **Criterio de terminado:** decidir junto con Paola si `pendiente` debe
  contar contra `v_cupo_taller` (o algún estado intermedio nuevo), y
  ajustar `cupoService.js` + lo que dependa de esa regla.

### ~~T-37 — El bot dice "registro guardado" aunque falle silenciosamente~~ ✅ CERRADO (18 sep 2026)
- **Encontrado:** al verificar T-13 paso 3a con una inscripción real por el
  bot (18 sep 2026), un registro nuevo (`paoxx.dev@gmail.com`) quedó con
  `usuario_id: null` en `lista_espera` aun con la API ya redesplegada.
  Investigando la causa: **no es un bug del código de hoy** — es que la
  cuenta en `usuarios` nunca se creó, y el bot nunca avisó.
- **La causa exacta:** `registrarUsuario()` en `apps/bot/src/flujo.js`
  llama a `POST /bot/registrar` y hace `return await res.json()` **sin
  revisar el status code ni el campo `status` de la respuesta**. Quien lo
  llama (paso `REG_NOMBRE`, línea ~1220) tampoco revisa nada — solo sigue
  adelante y responde "✅ ¡Registro guardado!" pase lo que pase.
  `usuarioService.upsertUsuario()` (backend) puede rechazar la creación con
  `409 WA_EN_USO` si el WhatsApp ya está ligado a otra cuenta — en ese caso
  **no crea ni actualiza nada**, pero el bot nunca se entera y sigue el
  flujo como si hubiera funcionado.
- **Por qué importa — es más que un detalle de datos:** si le pasa a un
  usuario real (ej. dos personas de la misma familia comparten WhatsApp, o
  alguien vuelve a registrarse con otro correo desde el mismo número), esa
  persona cree que tiene cuenta, puede llegar a **pagar un taller**, y
  después **no puede entrar nunca** — ni por Google (no existe cuenta con
  ese correo) ni por WhatsApp (su número ya es de alguien más). Se descubre
  hasta que reclama por soporte.
- **Por qué no se arregló ya:** es código de `flujo.js`, marcado
  explícitamente en `CLAUDE.md` como "NO tocar" sin revisión a fondo — se
  deja para la misma sesión de revisión completa del bot (T-35), junto con
  el hallazgo del cupo (T-36) y la posible rama muerta de Resplandor.
- **Diseño mejor, aportado por Paola (18 sep 2026):** en vez de solo
  atrapar el error después de que ya truena, **prevenirlo desde el
  principio**. El bot ya tiene el WhatsApp desde el JID del mensaje, antes
  de pedir nada — y una cuenta no puede tener dos WhatsApp ni un WhatsApp
  puede estar en dos cuentas (regla ya vigente, `usuarios.whatsapp` único).
  Verificado en el código: el paso `REG_CORREO` (`flujo.js` línea ~1150)
  **solo** busca por el correo que la persona escribe (`buscarUsuario()`)
  — nunca pregunta "¿este WhatsApp ya tiene cuenta?", aunque el dato ya
  está disponible desde el primer mensaje. Por eso alguien puede llegar
  hasta el final del registro con un correo "nuevo" y solo hasta el final
  (silenciosamente) chocar por el número repetido.
  - Hoy no existe ningún endpoint para buscar un usuario por WhatsApp desde
    el bot (solo por correo, `GET /bot/usuario/:email`) — haría falta uno
    nuevo, ej. `GET /bot/usuario-por-whatsapp/:numero`.
  - Con eso, el bot podría reconocer a la persona por su número **antes**
    de pedirle el correo, y decirle algo como "ya tienes un registro con el
    correo x@x.com" en vez de dejarla avanzar por un camino que sabemos que
    va a chocar.
- **Criterio de terminado (actualizado):** dos capas, no una sola —
  1. **Preventivo:** antes de iniciar el registro de una cuenta nueva, el
     bot revisa si el WhatsApp de la conversación ya tiene cuenta, y si la
     tiene, la reconoce en vez de pedirle correo como si fuera nueva.
  2. **Red de seguridad:** si aun así `/bot/registrar` falla (por lo que
     sea), `registrarUsuario()` revisa la respuesta y el bot le dice a la
     persona la verdad, en vez de fingir que todo salió bien.
- **Qué se hizo (18 sep 2026):**
  - **Backend:** nuevo endpoint `GET /bot/usuario-por-whatsapp/:numero`
    (`botController.buscarUsuarioPorWhatsapp`, reutiliza
    `usuarioService.cuentaConWhatsapp()` que ya existía) — mismo candado
    `BOT_API_KEY` que el resto de `/bot/*`.
  - **Bot, capa preventiva:** nueva función `iniciarRegistro()` en
    `flujo.js` — antes de pedir correo, si hay WhatsApp extraíble, busca si
    ya tiene cuenta; si la tiene, la reconoce y la manda directo a
    `continuarTrasDatos()` (nunca le pregunta el correo). Reemplaza el
    "pedir correo" en los dos puntos donde arrancaba el registro (menú
    opción 1, y elegir taller desde "Ver talleres") — cada uno conservando
    su propio comportamiento original de qué guardar en la conversación
    (uno arrancaba en blanco, el otro conservaba `conv` + el taller
    preseleccionado; se respetó esa diferencia en vez de unificarla).
  - **Bot, red de seguridad:** en los dos lugares que llaman a
    `registrarUsuario()` (pasos `REG_NOMBRE` y `REG_WHATSAPP`), ahora se
    revisa `resultado.status === 'error'` — si falló, el bot le muestra a
    la persona el mensaje real del error (ej. el de `WA_EN_USO`, que ya
    viene redactado y con el correo enmascarado) en vez de decir que todo
    salió bien.
- **Pruebas:** `npm test` en `apps/api`: 12/12, sin regresiones (no hay
  lógica pura nueva que valga la pena aislar — el endpoint nuevo es una
  reutilización directa de `cuentaConWhatsapp()`, ya usada en otro lado).
  No existe infraestructura de pruebas para el bot tampoco.
- **Verificado por Paola en WhatsApp real (18 sep 2026), tras redeploy de
  `apps/api` y `apps/bot`:** la capa preventiva funciona — al escribirle al
  bot desde un número que ya tenía cuenta, la saluda por su nombre de una
  vez y **no vuelve a pedir correo**. Pendiente de probar más adelante,
  sin bloquear el cierre: forzar el choque de números en el paso
  `REG_WHATSAPP` (JID `@lid` sin `senderPn`) para ver la capa de red de
  seguridad en acción — caso más raro de topar en el uso normal.

---

## 6. 🔮 Futuro (post-lanzamiento)

- **T-24** — Habitat deja de ser catálogo, se vuelve mundo tipo Minecraft con
  objetos desbloqueables.
- **T-25** — Tienda de Supernovas rediseñada alrededor del Habitat nuevo.
- **T-26** — Traducción de voz en tiempo real.
- **T-27** — Toggle "registrarse con Google" en pantalla de Resplandor
  (requiere endpoint `social-register` nuevo). Diferido a propósito: el flujo
  actual (formulario → luego Google login) ya cubre el caso.
- **T-28** — Pasarela de pago (Stripe/Conekta) para automatizar el flujo manual
  del admin.
- **T-29** — Multi-tenant: cada institución con su propio espacio.
- **T-30** — Traducción automática de contenido (ambición global).
- **T-31** *(post-lanzamiento, de `revision-flujo-registro.md`)* — Unificar
  `lista_espera` y `chispas` en una sola tabla `inscripciones` con estado que
  recorre `interesado → cupo_confirmado → pagado → activo → vencido` (y
  `liberado` como rama). Es una migración de datos, no se hace antes del
  lanzamiento — pero es el destino de fondo, elimina 5 fuentes de duplicación.

---

## 7. Cómo revisar las actividades pendientes (T-02, T-03, T-04)

Antes de construir cualquiera, releer `apps/web/src/aula/actividades/contrato.js`
completo — es, textualmente, "el archivo más importante del aula". Checklist
mínimo para que una actividad nueva pase el contrato:

1. Es un componente de React puro: recibe `contenido`, `estado`, `onCambio`,
   `liberado`, `esProfe` — y **nada más**. No sabe de video, ni de quién es la
   profe, ni de sellos.
2. Exporta también un `resumen(contenido, estado) → { avance, etiqueta, terminado }`
   — la rejilla de la profe lo usa para pintar 20 miniaturas sin montar la
   actividad completa.
3. Llama a `onCambio` en **cada** interacción, incluso las que no avanzan
   (girar el modelo, destapar y volver a tapar una carta) — si no, el semáforo
   marca a alguien como inactivo aunque esté trabajando.
4. Respeta `liberado === false`: se ve, pero no se puede tocar.
5. Se registra en `apps/web/src/aula/actividades/registro.js` — es el único
   archivo que se toca fuera del componente nuevo. Si construir una actividad
   obliga a modificar `Aula.jsx`, algo se coló donde no debía.

`Quiz.jsx` es la referencia funcional de punta a punta — cópiale la forma, no el
contenido.
