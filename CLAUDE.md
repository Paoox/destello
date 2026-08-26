# Destello — Contexto del Proyecto

> Leer este archivo COMPLETO antes de tocar cualquier archivo del repo.

---

## ¿Qué es Destello?

**Destello** es una plataforma de aprendizaje inmersivo 3D con clases en vivo. El nombre evoca el "aha-moment" del aprendizaje.

**Visión:** Plataforma B2B y B2C. Individuos toman talleres, pero también escuelas, instituciones y empresas rentan la plataforma para enseñar a sus alumnos/empleados. Ambición global (traducción automática). Arquitectura multi-tenant desde el inicio.

**Talleres actuales:** Salud y MTC (auriculoterapia, iridología, piedras calientes) bajo sub-marca "Horizonte Zen", más superación personal, automaquillaje, elaboración de gomitas, dibujo, etc.

**Diferenciadores:** Aula 3D en vivo + gamificación tipo Animal Crossing (Habitat con avatares y rooms).

---

## Infraestructura

### Servidor (Toshiba — Debian 13 trixie, local en casa de Paola)
- **Ruta real del repo en la Toshiba: `/home/pao/destello`** (usuario `pao`).
  ⚠️ NO es `/home/develop/destello` — esa ruta aparecía en notas viejas y es incorrecta.
- **API:** Express + PostgreSQL + Redis corriendo en **Docker** en puerto 3001
- **Cloudflare Named Tunnel:** URL fija `https://api.destello.courses` (Tunnel ID: `27b3edf7-0450-4b50-a0ac-2497b2445a8c`)
- Los archivos de configuración de servicios viven SOLO en el servidor, **NO en el repo**

Servicios systemd que arrancan automáticamente:
- `destello-api` → levanta Docker con API Express
- `destello-tunnel` → Named Tunnel Cloudflare (URL fija, nunca cambia)
- `destello-bot` → Bot Faro de WhatsApp
  (`WorkingDirectory=/home/pao/destello/apps/bot`, corre con node v20.20.2 de nvm)

⚠️ En la Toshiba **no hay pm2**. El bot se reinicia con systemd, no con `pm2 restart`.

Comandos en la Toshiba:
```bash
cd ~/destello
git pull

# API (Docker) — obligatorio tras cambios en apps/api/
docker compose up --build -d api
docker compose logs -f api

# Bot Faro — obligatorio tras cambios en apps/bot/
sudo systemctl restart destello-bot
journalctl -u destello-bot -f
```

Nota: `severian.service` también corre en la Toshiba — es OTRO bot, no tocarlo.

### Frontend (Vercel)
- URL: `destello.courses` / `destello-web.vercel.app`
- Root Directory en Vercel: `apps/web`, Framework: Vite
- `VITE_API_URL` apunta a `https://api.destello.courses`
- `apps/web/vercel.json` → proxy `/api/*` → `https://api.destello.courses`
- `publicApi.js` → `const BASE = import.meta.env.VITE_API_URL ?? '/api'`

---

## Estructura del Monorepo

```
destello/
├── apps/
│   ├── web/                          ← React + Three.js (Vercel)
│   │   ├── src/
│   │   │   ├── pages/                ← PageLanding, PageLogin, PageAcceso, PageAdmin,
│   │   │   │                            PageHome, PageHabitat, PageAula, PageAulaNueva,
│   │   │   │                            PageCertificado, PagePerfil
│   │   │   ├── aula/                 ← El módulo del aula (Aula.jsx, Sello.jsx,
│   │   │   │                            actividades/contrato.js + Quiz.jsx). NUNCA
│   │   │   │                            llama a la API de Destello — ver "Reglas Críticas"
│   │   │   ├── components/
│   │   │   │   ├── admin/            ← AccesosPanel, ListaEsperaAdmin, TalleresPanel,
│   │   │   │   │                        AsistenciaPanel, MetricasPanel, etc.
│   │   │   │   └── layout/           ← MainLayout, Navbar, AuthLayout
│   │   │   └── services/             ← publicApi.js, adminApi.js
│   │   └── vercel.json               ← proxy /api/* + SPA rewrites
│   ├── api/                          ← Express Node.js (Docker en Toshiba, puerto 3001)
│   │   └── src/
│   │       ├── routes/               ← admin.js, auth.js, tallers.js, chispas.js,
│   │       │                            users.js, health.js, bot.js
│   │       ├── services/             ← chispaService.js, resplandorService.js,
│   │       │                            listaEsperaService.js, mailService.js,
│   │       │                            tallerService.js, usuarioService.js,
│   │       │                            adminAuthService.js, firebaseAdmin.js
│   │       ├── middleware/           ← authenticate.js, errorHandler.js, requestLogger.js
│   │       ├── db/                   ← db.js (pool PostgreSQL)
│   │       └── index.js              ← entry point (todos los routers ya montados)
│   └── bot/                          ← Bot Faro con Baileys (WhatsApp)
│       ├── index.js                  ← conexión Baileys, normalización JID
│       └── src/flujo.js              ← toda la lógica de conversación
└── packages/
    └── tokens/                       ← Design tokens compartidos (colores, tipografía)
```

---

## Paleta de Colores (usar en TODO lo que se construya)

| Rol | Color | Hex |
|-----|-------|-----|
| Primario | Verde jade profundo | `#0D7377` / `#0F766E` |
| Acento | Ámbar cálido | `#D97706` |
| Fondo dark | Negro con subtono verde | `#061A18` |
| Fondo light | Blanco crema (NUNCA blanco puro) | `#FAF7F2` |
| Tipografía | Space Grotesk | — |

---

## Sistema de Accesos (núcleo del negocio)

### ⚠️ Los códigos NO se le mandan al usuario

**Desde el 20 jul 2026 el usuario nunca recibe un código.** Ni `RESP-` ni `DEST-`.
Ambos son registros INTERNOS que solo relacionan usuario ↔ taller en la BD.
Lo único que se le envía es **la liga de login** (WhatsApp) o **el QR** (correo).

Cómo entra la gente — `/login`, sin códigos:
- **Google** (requiere que el correo exista en `usuarios`)
- **Número + OTP** de 6 dígitos que manda el bot Faro
  (requiere `estado = 'activo'` **y** `usuarios.whatsapp` lleno)

`/acceso` (validar código) quedó huérfana en el router, sin enlazar. No usarla.

**`usuarios.estado` = permiso, NO "cuenta creada":**
- `activo` → Paola le dio acceso. `phoneAuthController` lo exige para el login.
- `espera` → está en lista, todavía sin permiso.

### Dos tipos de tokens (internos)

**Resplandor (`RESP-XXXX-XXXX`)**
- Registro interno de que a esa persona se le autorizó crear cuenta
- Solo 1 activo por usuario
- Columna en BD: `resplandores.email`

**Chispa (`DEST-XXXX-XXXX`)**
- Vincula un usuario con un taller. **No hay canje**: al crearla, el taller
  aparece solo en `/home`. Por eso el usuario nunca elige ni reclama taller.
- Un usuario puede tener muchas chispas (una por taller)
- Al vencer → rooms y contenido del taller se bloquean automáticamente
- **FK constraint `chispas_usuario_email_fkey`** es INTENCIONAL — NUNCA eliminar
- Columna en BD: `chispas.usuario_email` (≠ de `resplandores.email`)

⚠️ Para asignarle cualquier cosa (taller, demo, artilugio) la persona debe tener
cuenta creada como todos: nombre, apellido, correo y WhatsApp.

### Flujo completo

```
1. Usuario llega por bot WA o publicidad → se anota en lista_espera
2. Admin confirma cupo → envía correo con métodos de pago (sin código aún)
3. Usuario paga → manda comprobante por WA al admin
4. Admin verifica → genera Resplandor en panel
5. Admin activa al usuario (`estado = 'activo'`) y le manda la LIGA de login
6. Usuario entra en /login con Google o con su número + OTP — SIN código
7. Admin genera Chispa → el taller aparece SOLO en /home (no hay canje)
```

⚠️ Los pasos que decían "usuario usa su código en /acceso" ya no aplican.
Ver `docs/flujo-acceso-bot.md` para el detalle del flujo actual.

---

## Base de Datos (PostgreSQL en Docker)

### Tablas principales

**`usuarios`**
| columna | tipo |
|---------|------|
| id | SERIAL PK |
| email | TEXT UNIQUE NOT NULL |
| nombre | TEXT |
| whatsapp | TEXT (10 dígitos sin código país) |
| estado | TEXT (default 'espera') |

**`resplandores`**
| columna | tipo | nota |
|---------|------|------|
| code | TEXT PK | `RESP-XXXX-XXXX` |
| **email** | TEXT NOT NULL | ⚠️ es `email`, NO `usuario_email` |
| used | BOOLEAN | default FALSE |
| revoked | BOOLEAN | default FALSE |
| expires_at | TIMESTAMPTZ | |

**`chispas`**
| columna | tipo | nota |
|---------|------|------|
| code | TEXT PK | `DEST-XXXX-XXXX` |
| **usuario_email** | TEXT NOT NULL | ⚠️ es `usuario_email`, tiene FK a `usuarios.email` |
| taller_id | UUID | FK a talleres |
| used | BOOLEAN | default FALSE |
| revoked | BOOLEAN | default FALSE |
| is_demo | BOOLEAN | default FALSE |

**`lista_espera`**
| columna | tipo |
|---------|------|
| id | SERIAL PK |
| email | TEXT NOT NULL |
| taller_id | UUID |
| nombre | TEXT |
| whatsapp | TEXT |
| estado | TEXT (pendiente / cupo_confirmado / pagado / rechazado) |

**`talleres`**
| columna | tipo |
|---------|------|
| id | UUID PK (gen_random_uuid()) |
| nombre | TEXT NOT NULL |
| descripcion | TEXT |
| precio | NUMERIC |
| estado | TEXT (default 'activo') |
| fecha_inicio | DATE |
| fecha_fin | DATE |
| cupo_maximo | INTEGER |
| imagen_url | TEXT |
| categoria | TEXT |
| hora_inicio / hora_fin | TIME — derivadas del texto de `horario` en `tallerService.js`, no se editan directo |
| duracion_horas | NUMERIC, default 4 |
| instructor | TEXT — hoy vacío para casi todos los talleres (ver "Lo que Falta") |

**Tablas agregadas por las migraciones 001-014** (`apps/api/src/db/migrations/`),
no documentadas arriba en detalle — ver el `.sql` de cada una para columnas
exactas: `pagos`, `eventos` (bitácora JSONB append-only), `bot_conversaciones`
(persiste conversaciones del bot, sobrevive reinicios), `asistencias` y
`certificados` (migración 010), `usuarios_bloqueos` (migración 013, append-only).

⚠️ Hay una migración fuera de la carpeta numerada:
`apps/api/src/migrations/002_create_resplandores.sql` (carpeta `src/migrations/`,
singular — no confundir con `src/db/migrations/`). No es residuo: la tabla
`resplandores` sigue activa. Antes de moverla a la secuencia numerada, confirmar
si ya se corrió en Supabase.

---

## API — Endpoints

⚠️ Esta lista no es exhaustiva — para el detalle completo de una ruta, leer el
router correspondiente en `apps/api/src/routes/`.

### Públicos (sin auth)
```
GET  /health                          → status check
POST /auth/login                      → login JWT usuario
POST /auth/resplandor/validate        → valida resplandor y crea cuenta
POST /auth/social                     → login Google (Firebase)
POST /auth/phone/send-code            → OTP por WhatsApp
POST /auth/phone/verify               → verifica OTP, login o liga número
POST /chispas/validate                → valida chispa sin consumir
GET  /tallers                         → lista talleres activos
GET  /supernovas                      → catálogo de premios canjeables
GET  /certificados/:folio             → verificación pública de un certificado
                                         (a donde lleva el QR impreso; sin auth)

POST /bot/registrar                   → crea/actualiza usuario (desde bot)
GET  /bot/usuario/:email              → verifica si email tiene cuenta
POST /bot/lista-espera                → registra en lista de espera
GET  /bot/listas/:email               → listas de espera del usuario
GET  /bot/pendientes/:email           → chispas + resplandores sin usar
GET  /bot/diagnostico/:email          → foto completa del acceso, para que el bot ramifique
POST /bot/reporte-acceso              → levanta reporte (abierto incluso a cuentas bloqueadas)
```

### Protegidos con JWT de usuario (`/users`, vía `authenticate`)
```
GET  /users/me                          → perfil del usuario
PUT  /users/me                          → actualiza nombre/apellido/whatsapp/nombre_certificado
GET  /users/me/talleres                 → talleres del usuario (para Home)
POST /users/me/canjear                  · POST /users/me/supernovas/:id/canjear
GET  /users/me/confirmar-asistencia     · POST /users/me/confirmar-asistencia (demos)
POST /users/me/aula/:tallerId/presencia → LATIDO de asistencia (cada 2 min desde el aula)
GET  /users/me/certificados             → certificados ya emitidos al usuario
```

### Admin (JWT admin separado)
```
POST /admin/login                     → login admin → adminToken
GET  /admin/chispas/all               → todas las chispas
GET  /admin/resplandores/all          → todos los resplandores
POST /admin/chispas/generate          → generar chispa
POST /admin/resplandores/generate     → generar resplandor
POST /admin/chispas/:code/revoke      → revocar chispa
POST /admin/resplandores/:code/revoke → revocar resplandor
GET  /admin/lista-espera              → con tiene_resplandor, precio, horario
POST /admin/lista-espera/:id/confirmar-lugar → confirma + envía correo (Resend)
POST /admin/lista-espera/:id/confirmar       → genera Chispa o Resplandor + correo
POST /admin/lista-espera/:id/confirmar-pago  → activarAlumno() transaccional
POST /admin/send-wa                   → envía mensaje WA directo desde bot Faro
GET  /admin/talleres                  → CRUD de talleres
GET  /admin/talleres/:id/asistencia   → asistencia registrada de un taller
POST /admin/talleres/:id/certificados → emitir certificados (todos o selección, body {emails})
POST /admin/certificados              → emitir certificado individual
DELETE /admin/certificados/:folio     → anular certificado (con motivo)
GET  /admin/metricas                  → resumen (embudo, talleres, actividad, ingresos…)
GET  /admin/metricas/categorias · /alumnos · /financiero · /alumno/:email
GET  /admin/usuarios                  → lista para el tab Usuarios (bloqueo)
GET  /admin/usuarios/:email/historial → historial de bloqueos de una cuenta
PATCH /admin/usuarios/:email/bloqueo  → bloquea/desbloquea acceso o compras (reversible, con motivo)
```

---

## Correos Transaccionales (Resend)

- FROM: `Destello ✦ <hola@destello.courses>`
- Templates activos en `mailService.js`:
  - `sendResplandor` — código de acceso para crear cuenta
  - `sendConfirmacionTaller` — chispa + detalles del taller
  - `sendConfirmacionLugar` — confirmación de lugar + métodos de pago

Métodos de pago incluidos en templates:
- SPEI: CLABE `036180500687558754`
- Efectivo: tarjeta `4658 2850 1724 7424`
- WA comprobante: `https://wa.me/525577888800`

---

## Bot Faro (WhatsApp / Baileys)

- Archivo de sesión: `apps/bot/auth_info/` — no versionar
- JID normalizado en `index.js` línea ~80: `msg.key.remoteJid?.replace(/:\d+@/, '@')`

### Menú del bot (5 opciones)
1. Registrarte a taller → captura datos → lista de espera
2. Ver talleres (falta: inscripción desde aquí)
3. No me llegó mi acceso → busca por email → devuelve chispa o avisa del resplandor
   (el copy visible al usuario NO usa "chispa"/"resplandor" — son nombres internos)
4. Medios de pago → SPEI + efectivo
5. Dudas → "próximamente"

### Estado en `flujo.js` — lo que YA funciona (NO tocar)
- Nombre y apellido se capturan en pasos SEPARADOS
- Estado `POST_ACCION` al terminar cualquier flujo
- Palabras clave "menu", "cancelar", "salir", "adios" en cualquier momento
- **`extractWhatsapp(jid, senderPn)`** — resuelve el número real (10 dígitos):
  1. Si el JID es `@lid`, usa `senderPn` que Baileys adjunta con el número real
     (`index.js` lo saca de `msg.key.senderPn ?? msg.key.participantPn`)
  2. Si no hay `senderPn`, devuelve `null` → el bot pide el número en `REG_WHATSAPP`
  3. NUNCA devuelve el raw del `@lid`. Verificado en prod el 21 jul 2026.
- **Opción 2 (Ver talleres)** — se escribe el número del taller directo desde la lista
  y te inscribe a ese taller (`conv.tallerPre`), sin volver al menú. `menu` / `salir`
  como palabras para no chocar con la numeración.
- Lista de talleres **sin tope**: emoji del 1 al 10, luego `11.`, `12.`…
- Registro en BD solo cuando ya hay nombre + número (no se crean usuarios a medias)
- `inscribirEnTaller()` es el ÚNICO punto que llama a `POST /bot/lista-espera`

---

## Panel Admin `/admin`

7 tabs en `PageAdmin.jsx`: **Accesos** · **Talleres** · **Lista de espera** ·
**Reportes** · **Asistencia** · **Usuarios** · **Métricas**.

**Accesos (`AccesosPanel.jsx`)** — búsqueda por email, historial de resplandores + chispas, lógica visual: sin cuenta → card Resplandor activa / con cuenta → card Chispa activa

**Lista de espera (`ListaEsperaAdmin.jsx`)** ✅ completo
- Tabla con filtros por estado (pendiente / cupo_confirmado / pagado / rechazado)
- Chip de filtro 🎁 Demo — las cortesías viven en la misma lista, no aparte
- Botón WA (verde) → `POST /admin/send-wa` → manda desde bot Faro directamente
- Botón correo (jade) → `POST /admin/lista-espera/:id/confirmar-lugar` → Resend

**Talleres (`TalleresPanel.jsx`)** ✅ completo — CRUD con columnas reales de BD, editor de cupo, fecha y horario (texto libre; `hora_inicio`/`hora_fin` se derivan del texto en el backend)

**Reportes** — reportes de acceso (`reportes_acceso`), incluye los que manda una cuenta bloqueada (`POST /bot/reporte-acceso` sigue abierto a propósito)

**Asistencia (`AsistenciaPanel.jsx`)** — asistencia real por latidos desde el aula, emisión de certificados en bloque o por selección (casillas + "los N que califican")

**Usuarios** — bloquear/desbloquear acceso o compras por cuenta, reversible, con motivo obligatorio e historial (`usuarios_bloqueos`)

**Métricas (`MetricasPanel.jsx`)** — sub-pestañas Resumen / Financiero / Ficha de alumno; gráficas en SVG/CSS a mano (sin Recharts ni pandas/numpy)

---

## Páginas del Frontend

| Ruta | Archivo | Estado |
|------|---------|--------|
| `/intro` | PageIntro.jsx | ✅ — splash animado, auto-navega a /login |
| `/login` | PageLogin.jsx | ✅ — Google + número/OTP |
| `/acceso` | PageAcceso.jsx | ✅ funcional, pero sin link desde la UI (ver "Sistema de Accesos" arriba) |
| `/certificado/:folio` | PageCertificado.jsx | ✅ — verificación pública del QR del diploma, sin layout |
| `/home` | PageHome.jsx | ✅ |
| `/habitat` | PageHabitat.jsx | ✅ — grid talleres reales desde BD, modal lista de espera |
| `/aula/:id` | PageAula.jsx | ✅ — LA FRONTERA: única pieza que habla con la API de Destello. Arma la `sesion` del contrato y envuelve `src/aula/Aula.jsx` (el módulo del aula: sellos, contrato de actividades, Quiz, rejilla — no consulta la API a propósito, para poder rentarse a otras escuelas como producto aparte). Le suma los latidos de asistencia que el módulo del aula no puede tener |
| `/aula-nueva/:id` | PageAulaNueva.jsx | ✅ — salón de ensayo con datos inventados (sin backend, sin video), para practicar el aula sin depender de un taller real. `?rol=profe` para verla del otro lado |
| `/perfil` | PagePerfil.jsx | ✅ |
| `/admin` | PageAdmin.jsx | ✅ — protegido con JWT admin, 7 tabs (ver arriba) |
| `/` | PageLanding.jsx | 🔒 CONGELADO — NO modificar sin permiso explícito de Paola |

---

## Reglas Críticas

1. **`PageLanding.jsx` está CONGELADO** — nunca modificarlo sin permiso explícito de Paola.
2. **FK constraint en `chispas.usuario_email`** — es intencional y correcta, NUNCA eliminarla.
3. **`resplandores.email` ≠ `chispas.usuario_email`** — columnas con nombres distintos, no confundirlas.
4. **Los archivos de config de systemd/cloudflared viven solo en el servidor**, no en el repo.
5. **Después de cualquier cambio en `apps/api/`** → reconstruir Docker: `docker compose up --build -d api`
6. **Las tablas de PostgreSQL ya existen** (creadas en pgAdmin por Paola) — no usar scripts SQL de creación.
7. **`VITE_API_URL` en Vercel** — si se marca como "Sensitive", Vite NO la embebe en el build.
8. **Nada dentro de `apps/web/src/aula/` puede llamar a la API de Destello.**
   Recibe una `sesion` (armada por `PageAula.jsx` o `PageAulaNueva.jsx`) y con eso
   le basta. El día que un componente del aula haga `fetch('/api/...')`, el aula
   deja de ser un producto rentable aparte a otras escuelas y deshacerlo cuesta
   caro. Si falta un dato, se agrega al contrato (`src/aula/contrato.js` o
   `src/aula/actividades/contrato.js`), nunca se pide directo.

---

## Lo que Falta (Próximas Sesiones)

### 🔴 Bloquea el lanzamiento (meta: 11 sep 2026, capas 1-2 del aula)
- **Video real en el aula.** Plan: primero probar OpenVidu (fork de LiveKit) en
  local/1 a 1 para perfilar su comportamiento; recién después se contrata el VPS
  (Hostinger KVM 2, Phoenix) y se monta ahí. Hoy el aula dice "Sin video todavía".
- **Actividades reales.** Existe el contrato (`src/aula/actividades/contrato.js`)
  y el Quiz funcionando de punta a punta; faltan `modelo3d`, `memorama`, `armar`,
  y conectar el contenido real de cada taller a la plantilla.
- **Tabla de profesores.** Hoy "profe" = `isAdminEmail()` — es un problema de
  seguridad (un profesor externo vería todo el panel financiero), no solo un
  pendiente cosmético. Destraba también: nombre en los diplomas, firma, y ForYou.
- **Justo antes de abrir:** respaldo de la BD (Supabase free no incluye backups
  diarios) y un ping diario para que el proyecto no se pause por inactividad.

### 🟠 Deuda técnica — las tablas se relacionan por CORREO, no por id
Detectado por Paola el 21 jul 2026. Hoy `chispas.usuario_email`, `resplandores.email`
y `lista_espera.email` ligan por texto. Consecuencias: si alguien cambia de correo
se rompe la cadena, y todas las queries hacen `LOWER(email) = LOWER($1)` para
compensar mayúsculas.

Lo correcto es `usuario_id UUID/INT` con FK a `usuarios.id`. Migración por etapas
(NO hacerlo de un tirón):
1. Agregar `usuario_id` nullable a las tres tablas
2. Rellenarlo desde el correo actual (`UPDATE ... FROM usuarios WHERE LOWER(email)...`)
3. Migrar las consultas de los servicios una por una, dejando el email como respaldo
4. Recién entonces poner NOT NULL y quitar `chispas_usuario_email_fkey`

⚠️ Mientras esta migración no esté hecha, la regla #2 de abajo sigue vigente:
**NO eliminar `chispas_usuario_email_fkey`.**

### 🟡 Pendiente
- **Acordado, sin empezar:** onboarding/visita guiada la primera vez en el aula;
  `/aula-nueva` se está reconvirtiendo en salón de ensayo del profesor (en vez
  de borrarla); ilustraciones de sellos y reacciones (las hace Paola);
  corregir talleres con horario `12:00 PM – 12:00 PM` cargado mal (dato, no bug).
- **Después de abrir:** Habitat deja de ser catálogo y se vuelve un mundo tipo
  Minecraft con objetos desbloqueables; tienda de Supernovas rediseñada
  alrededor de eso; traducción de voz en tiempo real; automatizar la emisión
  de certificados (hoy el criterio es automático, el disparo es manual).
- **Reporte de pago por WhatsApp** — falta leer `imageMessage` en `apps/bot/index.js`
  (hoy las fotos se ignoran por completo). Ver `docs/flujo-acceso-bot.md`.
- **Vigencia de Chispa en frontend** — bloquear rooms/contenido automáticamente al vencer
- **`docker-compose.yml` → `viewer3d`** apuntaba a `./apps/viewer3d`, que no
  existe en el repo (limpiado — ver "Lo que Está Terminado y Funciona").
- **Limpieza env** — agregar `MAIL_FROM` y `BOT_HTTP_URL` al `.env` de la Toshiba (salen WARN); regenerar `package-lock.json` de la api con `resend`

### 🔮 Futuro
- **Toggle "registrarse con Google"** en la pantalla de Resplandor (`RegisterForm`) — dejar elegir formulario vs Google al crear cuenta. Requiere endpoint backend social-register (verifica token Google + consume Resplandor + crea cuenta). Diferido: el flujo actual (registrar con formulario → luego Google login) ya cubre el caso.
- Pasarela de pago (Stripe/Conekta) → automatizar flujo manual del admin
- Multi-tenant (cada institución con su propio espacio)
- Traducción automática

---

## Lo que Está Terminado y Funciona

- ✅ **Bot Faro — fix `@lid` + opción 2 con inscripción directa** (21 jul 2026). Verificado en prod:
  un chat `@lid` resolvió el número vía `senderPn` sin preguntarle nada al usuario, y el flujo
  "ver talleres → número → correo → nombre/apellido → inscrito" funcionó de corrido.

- ✅ **Login con Google (Firebase OAuth)** — funciona end-to-end (13 jul 2026). `signInWithGoogle()` → `POST /auth/social` → Firebase Admin verifica idToken → JWT Destello. Solo para usuarios ya registrados (si el email no tiene cuenta → `USER_NOT_FOUND`, correcto). Causa raíz del bug: al `docker-compose.yml` le faltaban las env vars `FIREBASE_*`, `RESEND_API_KEY`, `MAIL_FROM`, `BOT_HTTP_URL`, `JWT_EXPIRES_IN`, y a `apps/api/package.json` la dependencia `resend`. La `FIREBASE_PRIVATE_KEY` se pasa por interpolación `${...}` desde `.env` (no `env_file`).
- ✅ Named Tunnel Cloudflare — URL fija `https://api.destello.courses`
- ✅ Bot router `/bot` montado en `index.js`
- ✅ `getPendientesPorEmail` corregido con columnas reales de BD
- ✅ JID WhatsApp México corregido (`521XXXXXXXXXX@s.whatsapp.net`)
- ✅ Resend integrado — `hola@destello.courses`
- ✅ Correos personalizados con nombre real del usuario
- ✅ `ListaEsperaAdmin.jsx` — tabla, filtros, botón WA, botón correo, toasts
- ✅ `chispaService.js` migrado a PostgreSQL
- ✅ `AccesosPanel.jsx` — panel unificado Chispas + Resplandores
- ✅ `TalleresPanel.jsx` — CRUD con columnas reales
- ✅ `PageAcceso.jsx` → endpoint `/api/auth/resplandor/validate`
- ✅ Login dual + `registerUser` en `authController.js`
- ✅ CORS incluye `destello.courses`
- ✅ Proxy Vercel `/api/*` → túnel en `vercel.json`
- ✅ Talleres dinámicos desde BD en PageLanding y PageHabitat

### Entregado en agosto 2026 (no estaba documentado aquí)

- ✅ **`usuarios.whatsapp` único** (21 ago, commit `b53eea5`) — el bug que este
  archivo listaba como prioridad ya está resuelto y verificado en producción:
  índice único parcial (`001_whatsapp_unico.sql`) + `asegurarWhatsappLibre()`
  validando en los 6 puntos que escriben el campo + `errorHandler.js` traduce
  el 23505 de Postgres a un 409 legible.
- ✅ **Reglas de cupo, plazos y liberación** (migraciones 006-009) — `v_cupo_taller`
  como fuente única del cupo real; 48h para pagar → recordatorio → 24h de
  gracia → liberar lugar; las cortesías/demos ocupan cupo igual que un pago
  (`monto=0`, nunca cuentan como ingreso).
- ✅ **`activarAlumno()`** (`inscripcionService.js`) — un solo camino
  transaccional para activar una cuenta, usado tanto por confirmar-pago como
  por el selector de estado del panel.
- ✅ **Certificados por asistencia real** (migración 010-012) — latidos desde
  el aula (`POST /users/me/aula/:tallerId/presencia`, cada 2 min, umbral 20 min
  conectado), diploma con ornamentos + sello + QR, página pública
  `/certificado/:folio`, emisión en bloque o por selección. **Emitir ≠ enviar**:
  hoy el certificado aparece en el Home del alumno, no se le notifica.
- ✅ **Bloqueo de usuarios** (migración 013) — dos interruptores reversibles
  (`acceso_bloqueado` / `compras_bloqueadas`), motivo obligatorio, historial
  append-only, el bot también lo respeta.
- ✅ **Panel de Métricas** — SQL + SVG a mano (sin pandas/numpy ni Recharts),
  sub-pestañas Resumen/Financiero/Ficha de alumno, paleta validada para
  daltonismo.
- ✅ **El Aula** — `src/aula/` (módulo desacoplado que no debe llamar a la API
  de Destello) + `PageAula.jsx` como frontera. Shell, sellos, reacciones,
  rejilla de la profesora como estado (no video), contrato de actividades con
  Quiz funcionando de punta a punta. El bug de que el aula nunca abría a su
  hora (migración 014: un `Date` de pg metido en un template literal, el día
  calculado en UTC en vez de CDMX, y el horario en dos campos sin sincronizar)
  quedó cerrado y verificado en producción el 25 ago 2026.
- ✅ `docker-compose.yml` — quitado el servicio `viewer3d` que apuntaba a una
  carpeta inexistente (`./apps/viewer3d`); se vuelve a agregar cuando exista
  el visualizador 3D de verdad.
