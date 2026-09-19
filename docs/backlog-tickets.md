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
| Aula — video | Video en vivo real (profe + alumnos) vía OpenVidu/LiveKit | Cámara, micrófono, audio y "dar la palabra" reales, probados de punta a punta en local (T-01) ✅. Sellos/mano arriba/avance siguen sin viajar en tiempo real | 🟠 Solo falta el VPS para el lanzamiento — el código ya está |
| Aula — actividades | 4 tipos: quiz, memorama, armar, modelo3d, todas sobre el mismo contrato (`contrato.js`) | Solo **quiz** existe de punta a punta. Las otras 3 están declaradas pero no implementadas (`registro.js`) | 🔴 3 de 4 por construir — las 3 bloqueadas hasta que Paola tenga el material real (T-02/T-03/T-04) |
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

### T-01 — Video real en el aula — ✅ fase local CERRADA (18 sep 2026), falta el VPS
- **Alcance de esta fase (aclarado con Paola, 18 sep 2026):** integrar
  OpenVidu (LiveKit) **en local, para pruebas** — NO montarlo a un VPS
  todavía. El VPS (Hostinger KVM 2, Phoenix) es parte del montaje de todo el
  backend cuando se lance el proyecto al público general, es la fase
  siguiente, fuera de este ticket.
- **Qué se hizo:**
  - **Infraestructura de prueba** (fuera del repo — `openvidu-local-deployment`
    Community 3.8.0, clonado en `~/openvidu-local-deployment`, es una
    herramienta externa, no código de Destello): `.env` con
    `LAN_MODE=false`/`USE_HTTPS=false` (un solo equipo, sin certificados) +
    `docker-compose.override.yml` local fijando `NODE_IP=127.0.0.1`.
    **Gotcha real encontrado:** sin ese `NODE_IP`, LiveKit anuncia su IP
    interna de Docker para el video/audio (ICE) — inalcanzable desde el
    navegador. La señalización (WebSocket) conecta bien igual, pero el video
    nunca llega: el síntoma exacto es "signal connected" seguido de "could
    not establish pc connection". `127.0.0.1` funciona porque la prueba se
    hizo con dos pestañas en la MISMA máquina que Docker Desktop.
  - **Backend:** `apps/api/src/services/videoService.js`
    (`livekit-server-sdk`) firma el token, sala por taller
    (`sala-<tallerId>`, con `sala-` y no `taller-` para no duplicar el
    prefijo que ya trae el slug del taller). Nuevo endpoint
    `GET /users/me/aula/:tallerId/video-token`, mismo candado que ya usan
    los latidos (`asistenciaService.tieneAcceso()`). `video: null` (200, no
    error) si no hay servidor configurado.
  - **Contrato extendido sin romper la regla:** `sesion.video = { serverUrl,
    token } | null` en `aula/contrato.js` — lo pide `PageAula.jsx` (la única
    pieza que puede hablar con la API de Destello) y se lo pasa al aula ya
    armado.
  - **Conexión real:** `aula/video/useVideoAula.js` (hook sobre
    `livekit-client`) + `aula/video/PistaVideo.jsx`. Rellenó el hueco que
    `Avatar.jsx` ya tenía marcado desde antes (`{camara && null}`).
    `BarraControles` y la tira de personas dejaron de usar estado inventado.
  - **"Dar la palabra"/"silenciar" en tiempo real** (agregado el mismo día,
    a petición de Paola tras la primera prueba — antes ninguno de los dos
    controles le llegaba de verdad a la otra persona): canal de datos de
    LiveKit (`publishData()`/`RoomEvent.DataReceived`), sin backend nuevo.
    Respeta el límite real del navegador: nadie puede prender el micrófono
    de otra persona a la fuerza — "dar la palabra" solo desbloquea SU botón.
  - **Indicador verde/rojo/ámbar** en avatar y botones (pedido por Paola en
    plena prueba, para depurar): 🔴 sin permiso · 🟡 con permiso sin prender
    · 🟢 hablando de verdad. Antes se ocultaba el badge a quien estaba
    silenciada (buen criterio en clase real con 20+, poco útil depurando).
  - **Bug real encontrado y corregido en la misma sesión:** el hook solo
    refrescaba el estado propio con `LocalTrackPublished`/`Unpublished`
    (disparan una sola vez), pero `setMicrophoneEnabled(false)` normalmente
    silencia sin despublicar — el color se quedaba pegado en el primer
    valor capturado sin importar cuántas veces se volviera a togglear.
    Arreglado escuchando también `RoomEvent.TrackMuted`/`TrackUnmuted`.
- **Pruebas:** `apps/api` — 19/19 (`videoService.test.js`, 3 casos:
  nombre de sala, token nulo sin config, token válido). Sin test
  automatizado para la parte LiveKit/React (necesita cámara/navegador real).
  **Verificación funcional real:** Paola probó de punta a punta con dos
  cuentas reales (una profe vía `ADMIN_EMAILS`, una alumna), dos pestañas,
  cámaras físicas — cámara, micrófono, audio, y el control de palabra en
  tiempo real, todo confirmado funcionando.
- **Criterio de terminado (esta fase):** ✅ OpenVidu corriendo en local,
  cámara/micrófono/audio reales confirmados por Paola con hardware real, sin
  romper sellos/pizarrón/semáforo (siguen 100% funcionales, sin tocar).
- **Falta para el lanzamiento (fase siguiente, fuera de este cierre):**
  contratar y montar el VPS, apuntar `LIVEKIT_URL`/`LIVEKIT_API_KEY`/
  `LIVEKIT_API_SECRET` de producción ahí. El código de la app no cambia.
- **Deliberadamente fuera de esta fase (queda como estado local, no
  networked):** sellos, mano levantada y avance de actividad siguen sin
  viajar entre sesiones — mismo mecanismo (canal de datos de LiveKit) que
  ya se usó para "dar la palabra", pendiente como su propio trabajo.

### T-38 — Migrar TODO el backend (API + bot) de la Toshiba al VPS
- **Qué falta:** mover no solo el servidor de video (T-01) sino la API
  (Docker) y el bot de WhatsApp (Baileys) de la Toshiba al mismo VPS
  (Hostinger KVM 2, Phoenix), para que un apagón, corte de internet o falla
  de la máquina en casa de Paola deje de tumbar Destello completo.
- **Por qué importa:** hoy Destello depende de que una laptop en una casa
  particular esté prendida y conectada 24/7 — es el punto único de falla
  más grande del proyecto. Un VPS de datacenter no tiene ese problema.
- **Decidido con Paola (18 sep 2026):** viable, no urgente — se agenda
  ~15-20 días antes del lanzamiento del MVP (no la semana misma, para tener
  margen si algo sale mal). Se hace en la MISMA ventana que el montaje del
  VPS para video (T-01) ya que de todas formas hay que tocar la infra.
- **Lo fácil:** la API ya está en Docker (`docker-compose.yml` corre casi
  tal cual en cualquier máquina); la base de datos ya vive en Supabase, no
  se mueve.
- **Lo delicado (operativo, no de código):** la sesión de WhatsApp del bot
  (`apps/bot/auth_info/`, Baileys). Dos caminos: copiar la carpeta tal cual
  y esperar que WhatsApp la acepte en el nuevo servidor, o volver a
  escanear el QR desde el VPS (más confiable, ~5 min de interrupción). Las
  conversaciones no se pierden en ningún caso — viven en
  `bot_conversaciones` (BD), no en la sesión del bot.
- **Lo que hay que planear con cuidado:** el corte de DNS/túnel de
  Cloudflare — probar todo en el VPS ANTES de apagar la Toshiba, para no
  dejar un hueco sin servicio. Repasar variable por variable el `.env` al
  copiarlo (ya hubo gotchas de este tipo antes — T-S1, el escape de `$` en
  `ADMIN_PASSWORD_HASH`, variables faltantes en `docker-compose.yml`).
- **Dónde tocar:** infraestructura del VPS (fuera del repo), `docker-compose.yml`
  (puede necesitar ajustes de host/networking al dejar de depender de
  `host.docker.internal` hacia el bot local), configuración de Cloudflare
  (Named Tunnel → probablemente ya no hace falta un tunnel con IP pública
  real; puede simplificarse a un registro DNS directo + reverse proxy con
  TLS en el VPS).
- **Criterio de terminado:** API, bot y (si ya existe para entonces) el
  servidor de video corriendo en el VPS; sitio y bot funcionando de punta a
  punta contra el VPS; la Toshiba puede apagarse sin que Destello se caiga.

### T-02 — Actividad: Memorama
- **Qué falta:** componente que exporte `Componente` + `resumen`, sumado a
  `TIPOS` en `apps/web/src/aula/actividades/registro.js`. Contenido = parejas a
  destapar, viene de la plantilla del taller (no hardcodeado) — pensado desde
  el inicio para que el mismo componente sirva para cualquier taller, solo
  cambia el contenido que le pasa la plantilla.
- **Por qué importa:** es una de las 3 actividades que faltan para que el aula
  tenga variedad real de ejercicios.
- **Dependencia (agregada 18 sep 2026):** Paola necesita armar primero el
  material real (las parejas del memorama de al menos un taller) para poder
  probarlo con contenido de verdad, no inventado — mismo criterio que ya
  aplicaba a T-04. Bloqueante externo, no técnico.
- **Dónde tocar:** nuevo archivo `apps/web/src/aula/actividades/Memorama.jsx`
  (copiar la forma de `Quiz.jsx` como plantilla), + 1 línea en `registro.js`.
- **Criterio de terminado:** sigue las 5 reglas del contrato (`contrato.js`):
  se abre cuando la profe lo ordena, reporta estado con `resumen()`, avisa
  interacción vía `onCambio`, acepta sellos encima, respeta `liberado`.

### T-03 — Actividad: Armar (piezas tipo lego)
- **Qué falta:** igual que T-02, pero con arrastre de piezas.
- **Dependencia (agregada 18 sep 2026):** mismo caso que T-02 — necesita el
  material real (las piezas de al menos un taller) antes de construirse.
  Bloqueante externo, no técnico.
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

### ~~T-05 — Tabla de profesores real~~ ✅ CERRADO (18 sep 2026)
- **Lo que se encontró al investigar (antes de tocar nada):** el riesgo
  real NO era que un profesor externo viera el panel `/admin` — ese ya
  estaba bien protegido con su propio login de contraseña
  (`authenticateAdmin`, `router.use()` al inicio de `routes/admin.js`),
  completamente separado de `isAdminEmail()`. El problema real era
  conceptual: `isAdminEmail()` (una lista fija de un correo en
  `apps/web/src/constants.js`) decidía a la vez "quién administra
  Destello" y "quién es profe en el aula" — agregar un profesor nuevo
  significaba volverlo admin de todo, y encima requería editar y
  redesplegar el frontend cada vez.
- **Qué se hizo:**
  - Migración `018_profesores.sql` — tabla `profesores` (cuenta que PUEDE
    ser profesora) + `taller_profesores` (relación muchos a muchos: quién
    da qué taller).
  - `apps/api/src/services/profesorService.js` — `esProfeDelTaller()`,
    `listarAsignaciones()`, `asignarProfesor()`, `quitarProfesor()`.
  - 3 endpoints nuevos: `GET/POST /admin/profesores`,
    `DELETE /admin/profesores/:tallerId/:usuarioId`.
  - `chispaService.getTalleresDelUsuario(email, usuarioId)` — nuevo
    parámetro opcional: cada taller trae `esProfe`, y los talleres donde
    la cuenta es profesora entran a la lista **aunque no tenga chispa**
    (`UNION ALL` con prioridad: si también tiene una chispa real de ese
    taller, esa gana). Sin esto, un profesor real sin chispa de su propio
    taller ni siquiera habría podido entrar al aula.
  - `asistenciaService.tieneAcceso(email, tallerId, usuarioId)` — mismo
    tercer parámetro opcional, para que el endpoint de token de video
    (T-01) también reconozca a un profesor sin chispa. Los latidos de
    asistencia NO lo usan a propósito — la asistencia certifica alumnos.
  - `PageAula.jsx`: `esProfe = isAdminEmail(user?.email) ||
    taller?.esProfe === true` — los admins conservan su acceso a
    cualquier aula tal cual, esto solo agrega la posibilidad de un
    profesor real, limitado a lo que se le asigne.
  - Panel admin nuevo `ProfesoresPanel.jsx` (tab "Profesores", 8vo tab):
    busca una cuenta por correo (mismo patrón que Accesos), la asigna a
    un taller desde un `<select>`, lista las asignaciones agrupadas por
    profesor con botón para quitar una en particular.
- **Migración `018_profesores.sql` corrida en Supabase y confirmada por
  Paola (18 sep 2026).**
- **Verificado con datos reales, directo contra la base de producción**
  (script aparte, sin tocar el panel): se asignó a una cuenta de prueba
  (`paoox.dev@gmail.com`) como profesora de un taller — apareció en su
  `GET /users/me/talleres` con `esProfe: true`. Se probaron los DOS
  caminos: con chispa real de ese taller (trae su código real) y SIN
  chispa de otro taller distinto (fila sintética, `code: null`, pero
  igual `esProfe: true` y con acceso) — confirmando que dar la clase no
  depende de estar inscrita a tu propio taller. Se limpiaron las
  asignaciones de prueba al terminar (`taller_profesores` quedó vacía).
- **Bug encontrado y resuelto de paso, sin relación con T-05:** al
  redesplegar la API en la Toshiba, toda la API (no solo lo nuevo)
  empezó a dar 502 — `DB_PASSWORD` en el `.env` de la Toshiba había
  quedado desactualizado porque se usó "Reset database password" en
  Supabase durante la sesión (para conseguir la contraseña y configurar
  la API local). Corregido actualizando esa línea del `.env` y
  reiniciando el contenedor.
- **Pruebas:** `apps/api` — `npm test`: 19/19 sin regresiones. Sin test
  automatizado nuevo para `profesorService.js` (depende de BD real,
  mismo caso que T-13 3a/3b) — cubierto por la verificación manual de
  arriba.
- **Criterio de terminado:** ✅ un profesor puede entrar a SU salón sin ver
  métricas/finanzas de otros talleres — verificado con datos reales.

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

- **T-06 — Respaldo de BD + ping diario** *(movido aquí desde "Bloquea el
  lanzamiento", 18 sep 2026)*. Backup de Supabase (el plan free no incluye
  backups diarios) + un ping diario para que el proyecto no se pause por
  inactividad. **Decisión de Paola:** todavía hay cambios frecuentes en la
  BD (no está pulida), así que respaldarla ahora no es prioridad — se
  retoma cuando la estructura ya esté más estable, antes de abrir a
  usuarios reales.
- **T-16** — Onboarding / visita guiada la primera vez en el aula. **Nota
  (18 sep 2026, surgió al cerrar T-05):** aplica igual para un profesor
  nuevo, no solo para alumnos — mismo tour, adaptado a la vista de profe,
  corriendo en el aula de prueba (T-17).
- **T-17** — `/aula-nueva` reconvertida por completo en salón de ensayo del
  profesor (hoy ya entra como `profe` por defecto, `?rol=alumno` para
  probar). **Nota (18 sep 2026, surgió al cerrar T-05):** con profesores
  reales ya existiendo (`taller_profesores`), esta aula de prueba cobra
  más sentido — un profesor nuevo debería poder entrar aquí a practicar
  con el **material real** de SU taller (no datos inventados, que es lo
  que tiene hoy), antes de dar su primera clase de verdad. Ver también
  T-39 (el material real tiene que venir de algún lado — el dashboard es
  quien se lo muestra).
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

### ~~T-35 — Revisar si `apps/bot/src/flujo.js` tiene una rama muerta de Resplandor~~ ✅ CERRADO (18 sep 2026)
- **Qué se investigó:** si la opción 3 del bot ("No me llegó mi acceso")
  todavía tenía una rama para "avisar del resplandor pendiente".
- **Lo que se encontró:** `resolverAcceso()` (la función completa detrás de
  la opción 3) no menciona "resplandor" en ningún lado — está construida
  enteramente sobre `getDiagnostico()` → `GET /bot/diagnostico/:email` →
  `diagnosticar()` (`diagnosticoService.js`), que tampoco toca la tabla
  `resplandores`. `grep -i resplandor` sobre todo `flujo.js`: cero
  resultados. **No existe la rama muerta en `flujo.js` — y, revisando el
  historial de git, nunca existió en esta forma.**
- **Lo que sí apareció (código muerto real, pero en el backend, no en el
  bot):** `flujo.js` alguna vez sí llamó a `GET /bot/pendientes/:email`
  (visible en el historial de git), pero ese llamado se quitó hace mucho —
  de hecho antes de T-14, no por T-14. El endpoint siguió viviendo en la
  API sin que nada lo llamara: `grep` sobre todo `apps/` (bot + web + api)
  confirmó **cero llamadores** a `/bot/pendientes` o a
  `getPendientesPorEmail()` en todo el repo. Ese endpoint era justo el que
  consultaba `resplandores` — la función interna se llamaba, literalmente,
  "avisar pendientes", pero nadie la disparaba.
- **Qué se hizo:** se borró el endpoint completo, siguiendo el mismo
  criterio de T-14b (verificar cero llamadores antes de tocar, no dejar
  código muerto que confunda a quien lea el repo después):
  - `apps/api/src/routes/bot.js` — quitada la ruta `GET /pendientes/:email`
    y su import.
  - `apps/api/src/controllers/botController.js` — quitada
    `pendientesDeUsuario()` y el import de `getPendientesPorEmail`.
  - `apps/api/src/services/listaEsperaService.js` — quitada
    `getPendientesPorEmail()` completa (la única función que consultaba
    `resplandores` en el código vivo).
  - **La tabla `resplandores` NO se tocó** — sigue con su historial
    completo, igual que todas las veces anteriores que se limpió algo
    relacionado (T-14).
- **Pruebas:** `npm test` en `apps/api`: 12/12, sin regresiones (el
  endpoint borrado no tenía test propio). `node --check` en los 3 archivos
  tocados: sin errores de sintaxis.
- **Criterio de terminado:** ✅ confirmado que no existe la rama muerta en
  `flujo.js` (nunca existió); de paso se cerró el hallazgo relacionado —
  el endpoint backend que sí quedaba muerto, ya no existe.
- **Nota:** la "aprovechar la misma sesión para confirmar T-10 con datos
  reales" que traía este ticket sigue diferida — decisión de Paola en
  T-10, no depende de este hallazgo.

### ~~T-36 — `pendiente` no cuenta contra el cupo, pero el bot ya promete el lugar~~ ✅ CERRADO (18 sep 2026)
- **Encontrado:** Paola probó el registro por el bot (18 sep 2026) y, en
  cuanto eligió taller, el bot le mandó de inmediato "¡Registro completado!
  Quedaste inscrito" + los medios de pago — sin pasar por que el admin
  confirme el lugar a mano. Esto **no era un bug introducido ese día**: es
  un comportamiento intencional y ya documentado dentro del propio
  `flujo.js` (comentario explícito: mandar el precio de una vez en cuanto
  hay cupo, en vez de hacer esperar a la persona a que el admin conteste).
- **El detalle que sí valía la pena resolver:** `cupoService.js` decía,
  textual, *"Ocupa lugar quien está en `cupo_confirmado` o `pagado`. Los
  `pendiente` NO."* — o sea, cuando el bot le decía a alguien "quedaste
  inscrito", su registro seguía en `pendiente` y **no contaba contra el
  cupo real todavía**. Si varias personas se registraban casi al mismo
  tiempo para un taller con poco cupo, a todas se les podía prometer lugar
  aunque el taller ya estuviera, en los hechos, lleno.
- **Decisión de Paola (18 sep 2026):** `pendiente` sí debe ocupar cupo desde
  que se crea, con el mismo reloj de 48h+24h de gracia que ya existía
  (extendido para arrancar en `pendiente`, no solo en `cupo_confirmado`) —
  y, a petición suya en la misma sesión, el recordatorio de las 48h dejó de
  ser manual.
- **Qué se hizo:**
  - **Migración `017_pendiente_cuenta_cupo.sql`:** `v_cupo_taller` ahora
    cuenta `pendiente` además de `cupo_confirmado`/`confirmado`/`pagado`.
    `v_alertas` (etapas `falta_recordatorio` y `gracia_vencida`) también
    incluye `pendiente`, usando `COALESCE(confirmado_at, created_at)` como
    base del plazo — un `pendiente` nunca tiene `confirmado_at` (ese campo
    solo se llena al "confirmar lugar", que un `pendiente` recién creado
    todavía no pasó), así que sin el `COALESCE` el reloj nunca habría
    arrancado para esos renglones.
  - **`relojPago()`** (`ListaEsperaAdmin.jsx`) — mismo cambio del lado del
    panel: ahora aplica a `pendiente` también, cayendo a `r.created_at`
    cuando no hay `confirmado_at`/`apartado_at`. El botón "Liberar" (que ya
    era agnóstico al estado, solo mira la etapa del reloj) y el botón
    "Recordar" empezaron a funcionar solos para `pendiente` sin tocar más
    UI.
  - **Nuevo `recordatorioAutoService.js`** — la pieza que Paola pidió de
    paso: la API ya no depende de que alguien mire el panel para mandar el
    recordatorio de las 48h. `index.js` corre
    `enviarRecordatoriosAutomaticos()` cada 30 min (`setInterval`, primera
    corrida 2 min después de arrancar, sin librería externa ni cron del
    sistema — mismo criterio que `otpService`/`rateLimit`): busca los
    mismos renglones que `v_alertas` marca `falta_recordatorio`, les manda
    el mismo texto que antes mandaba Paola a mano con el botón "Recordar",
    y solo estampa `recordatorio_at` si el WhatsApp salió bien (igual que
    el flujo manual — si no llegó, no es justo empezarle a correr la
    gracia). El botón manual se conserva como respaldo/adelanto.
  - **Ajuste sobre la marcha (mismo día):** a petición de Paola, el
    recordatorio (automático Y el botón manual, mismo texto en los dos)
    ahora reenvía los datos de pago completos (SPEI + tarjeta) — antes
    solo decía "el plazo se cumplió", asumiendo que la persona todavía
    tenía a la mano el primer mensaje con la CLABE. Duplicado igual que ya
    estaba duplicado en `mailService.js`/`ListaEsperaAdmin.jsx` (no hay un
    módulo de constantes de pago compartido todavía).
  - **La liberación (etapa `gracia_vencida` → `rechazado` + revocar
    chispa) sigue siendo manual a propósito** — no se tocó: el propio
    endpoint `/admin/lista-espera/:id/liberar` ya lo dice en su comentario,
    "alguien puede pagar el domingo y avisar el lunes, y no queremos que un
    cron le quite el lugar de madrugada". Solo se automatizó el
    recordatorio, no la liberación.
- **Pruebas:** `apps/api` — `npm test`: 16/16 (12 de antes + 4 nuevos en
  `recordatorioAutoService.test.js`, sobre el texto del mensaje —
  `sendWhatsapp`/DB no se pueden probar sin infraestructura de integración,
  mismo caso que T-13 3a/3b). `node --check` en los archivos backend
  tocados, `esbuild` en `ListaEsperaAdmin.jsx`: sin errores.
- **Verificación funcional real:** pendiente — no se probó contra un taller
  con cupo real ni se confirmó en prod que el `setInterval` mande el
  WhatsApp automático (requiere esperar 48h reales o manipular fechas en
  una base de prueba). Anotado para la próxima vez que se pruebe el flujo
  completo del bot con datos reales.
- **Criterio de terminado:** ✅ `pendiente` cuenta contra `v_cupo_taller`
  desde que se crea; el recordatorio de 48h se manda solo, sin depender de
  que alguien abra el panel; la liberación sigue siendo decisión manual de
  Paola, sin cambios.

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

### T-39 — Dashboard de profesores
- **Surgió al cerrar T-05 (18 sep 2026):** ahora que existe una tabla real
  de profesores (`taller_profesores`), falta dónde VER esa información —
  hoy un profesor recién asignado no tiene ninguna pantalla propia.
- **Qué falta:** una vista para el profesor (no el panel `/admin` — eso
  sigue siendo solo de Paola) donde vea:
  - Qué talleres tiene asignados.
  - Fecha y horario de cada uno.
  - El material de cada taller (lo mismo que ve en el pizarrón del aula al
    dar la clase — `pizarron.materiales` del contrato del aula).
- **Por qué importa:** sin esto, "ser profesora de un taller" (T-05) no le
  sirve de nada a un profesor real hasta el momento exacto de la clase —
  no puede prepararse, revisar fechas, ni ver qué le toca dar.
- **Relacionado — mismo tema, tickets separados:**
  - **T-17** (aula de prueba) — el profesor debería poder practicar con
    ESE material real antes de su primera clase, no solo verlo en una
    lista.
  - **T-16** (tour guiado) — aplicado también a profesores nuevos, no solo
    a alumnos, corriendo en la aula de prueba de T-17.
- **Dónde tocar:** página nueva en `apps/web/src/pages/` (ej.
  `PageMisTalleresProfe.jsx`), reutilizando
  `chispaService.getTalleresDelUsuario(email, usuarioId)` — ya trae
  `esProfe` por taller desde T-05, solo faltaría filtrar a los que
  `esProfe === true` y exponer el material.
- **Criterio de terminado:** un profesor recién asignado (sin ser admin)
  entra a esa vista y ve sus talleres, fechas/horarios y material, sin
  pasar por `/admin`.

### T-40 — Dar de alta profesores nuevos desde el panel (sin cuenta previa)
- **Pedido por Paola (18 sep 2026), al terminar T-05:** hoy
  `ProfesoresPanel.jsx` (tab "Profesores") solo sabe ASIGNAR a alguien que
  **ya tiene cuenta** — busca por correo contra `/admin/usuarios/buscar` y,
  si no existe, no hay forma de seguir. Falta un segmento para dar de alta
  a un profesor que nunca ha usado Destello: su correo (para que pueda
  entrar con Google), nombre/apellido, y de una vez el taller que va a dar.
- **Por qué importa:** sin esto, para meter a un profesor externo nuevo
  habría que primero hacerlo pasar por el flujo de alumno (bot de
  WhatsApp, lista de espera, "confirmar pago" de $0) solo para que exista
  la cuenta — un rodeo absurdo para alguien que no está comprando nada.
- **Ya existe un patrón idéntico para copiar, no hay que inventar nada
  nuevo:** `chispaService.createChispa()` (usado por "Crear Chispa" en
  AccesosPanel, el flujo de demos) ya hace exactamente esto — UPSERT a
  `usuarios` con `estado = 'activo'` directo (sin pasar por `'espera'`),
  usando `usuarioService.asegurarWhatsappLibre()` para no pisar el
  WhatsApp de otra cuenta. Es cuestión de adaptar ese mismo INSERT
  (`activado_por = 'admin:profesor'` en vez de `'admin:chispa'`, con
  `apellido` además de `nombre`, que `createChispa` no separa) más el
  INSERT en `profesores`/`taller_profesores` que ya existe en
  `profesorService.asignarProfesor()`.
- **Dónde tocar:**
  - `profesorService.js` — nueva función (ej. `altaProfesor({ email,
    nombre, apellido, whatsapp, tallerId })`) que upsertea el usuario en
    `'activo'` y lo asigna, en un solo paso.
  - `routes/admin.js` — nuevo endpoint, ej. `POST /admin/profesores/alta`
    (separado del `POST /admin/profesores` que ya existe, que asume que
    la cuenta ya existe — no romper ese).
  - `ProfesoresPanel.jsx` — nuevo segmento/formulario arriba del buscador
    actual: correo, nombre, apellido, WhatsApp (opcional — el login por
    Google no lo necesita), taller. Cuando la búsqueda por correo dé
    "no encontrado" (`usuarioStatus === 'not_found'`), podría incluso
    ofrecer el botón "Dar de alta" ahí mismo, en vez de un formulario
    aparte — decidir al construirlo.
- **Ojo (mismo criterio que en T-05):** el WhatsApp es opcional aquí —
  a diferencia del flujo del bot, un profesor puede perfectamente entrar
  solo con Google sin nunca dar su número.
- **Criterio de terminado:** Paola puede dar de alta a un profesor que
  nunca ha usado Destello, con solo su correo (+ nombre), y esa persona
  ya puede entrar con Google y ver su taller — sin pasar por el bot ni
  por lista de espera.

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
