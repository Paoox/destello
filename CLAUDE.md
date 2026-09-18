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
│   │   │   │                            actividades/contrato.js + Quiz.jsx,
│   │   │   │                            video/useVideoAula.js + PistaVideo.jsx
│   │   │   │                            — LiveKit, T-01). NUNCA llama a la API
│   │   │   │                            de Destello — ver "Reglas Críticas"
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
│   │       ├── services/             ← chispaService.js, listaEsperaService.js, mailService.js,
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

`/acceso` ya no existe como pantalla — desde el 18 sep 2026 (T-14c) redirige
directo a `/login`. No mencionarla como opción de entrada.

**`usuarios.estado` = permiso, NO "cuenta creada":**
- `activo` → Paola le dio acceso. `phoneAuthController` lo exige para el login.
- `espera` → está en lista, todavía sin permiso.

### Chispa (`DEST-XXXX-XXXX`) — el único token que sigue vivo

- Vincula un usuario con un taller. **No hay canje**: al crearla, el taller
  aparece solo en `/home`. Por eso el usuario nunca elige ni reclama taller.
- Un usuario puede tener muchas chispas (una por taller)
- Al vencer → rooms y contenido del taller se bloquean automáticamente
- **FK constraint `chispas_usuario_email_fkey`** es INTENCIONAL — NUNCA eliminar
- Columna en BD: `chispas.usuario_email`

⚠️ Para asignarle cualquier cosa (taller, demo, artilugio) la persona debe tener
cuenta creada como todos: nombre, apellido, correo y WhatsApp.

**Resplandor (`RESP-XXXX-XXXX`) — retirado del código el 18 sep 2026 (T-14).**
Era un registro interno para autorizar la creación de cuenta, de antes de que
existiera el bot. La tabla `resplandores` sigue en la base (con su historial),
pero **ningún código la lee ni la escribe ya** — ni el panel, ni el backend, ni
el bot. No usarlo como referencia de cómo funciona el acceso hoy.

### Flujo completo (vigente desde T-14/T-33, 18 sep 2026)

```
1. Usuario escribe al bot Faro → se crea su cuenta (`usuarios`, estado
   'espera') y se anota en lista_espera. Pasa UNA vez, la primera compra.
2. Admin confirma su lugar (ListaEsperaAdmin → "Confirmar lugar") → correo
   con métodos de pago.
3. Usuario paga → reporta el pago por WhatsApp al admin.
4. Admin confirma el pago (ListaEsperaAdmin → "Confirmar pago") →
   `activarAlumno()` activa la cuenta (`estado = 'activo'`) Y crea la
   Chispa del taller, todo junto, en una transacción.
5. Usuario entra a /login con Google o con su número + OTP — sin código.
6. El taller ya aparece solo en /home (la chispa ya existía desde el paso 4).
```

Compras siguientes del mismo usuario repiten los pasos 2-4 y 6 (la cuenta ya
existe, así que el paso 1 no vuelve a pasar).

Ver `docs/flujo-acceso-bot.md` para el detalle completo del árbol de
decisión del bot.

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

**`resplandores`** — ⚠️ tabla histórica desde el 18 sep 2026 (T-14): ningún
código la lee ni la escribe ya. Columnas dejadas de referencia por si hace
falta consultar datos viejos:
| columna | tipo | nota |
|---------|------|------|
| code | TEXT PK | `RESP-XXXX-XXXX` |
| email | TEXT NOT NULL | |
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
| id | **TEXT PK** (slug, ej. `'taller-auriculoterapia'`) — confirmado 18 sep 2026 vía `information_schema.columns` en Supabase; NO es UUID (dato corregido, `schema.supabase.sql` ya lo tenía bien) |
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
| duracion_horas | NUMERIC — ⚠️ existe en la BD real pero en NINGÚN schema/migración versionada (se agregó a mano en Supabase) |
| instructor | TEXT — hoy vacío para casi todos los talleres (ver "Lo que Falta"). ⚠️ Mismo caso: no está en ningún `.sql` del repo |

⚠️ **`instructor` y `duracion_horas` confirman que la base real tiene cambios
hechos a mano en Supabase que ningún archivo versionado captura** — exactamente
la advertencia que ya traía el encabezado de `db/schema.supabase.sql` desde
que se reconstruyó (T-15, 18 sep 2026), ahora con evidencia concreta. Si se
agrega otra columna a mano, considerar aunque sea dejar una línea en
`db/schema.supabase.sql` documentándola, para que este archivo seguido de
utilidad y no se quede desactualizado otra vez sin que nadie se entere.

**Tablas agregadas por las migraciones 001-014** (`apps/api/src/db/migrations/`),
no documentadas arriba en detalle — ver el `.sql` de cada una para columnas
exactas: `pagos`, `eventos` (bitácora JSONB append-only), `bot_conversaciones`
(persiste conversaciones del bot, sobrevive reinicios), `asistencias` y
`certificados` (migración 010), `usuarios_bloqueos` (migración 013, append-only).

✅ **Resuelto (18 sep 2026, T-15):** la pregunta de arriba sobre la migración
huérfana `src/migrations/002_create_resplandores.sql` ya se contestó: era
residuo del MVP pre-Supabase (abril 2026, mismo estilo que el `schema.sql`
viejo — `id SERIAL`, sin las columnas ni la FK que tiene `resplandores` hoy).
Quedó completamente reemplazada por `db/schema.supabase.sql`, que ya crea
`resplandores` desde cero con la estructura correcta. Se borró (recuperable
en el historial de git si algún día hace falta ver el original).

`apps/api/src/db/schema.sql` (el otro schema viejo, también del MVP) se borró
por la misma razón. Hoy solo queda **un** schema en el repo:
`apps/api/src/db/schema.supabase.sql`, reconstruido el 18 sep 2026 como la
concatenación literal (sin editar) de la base original de Supabase + las 14
migraciones — pensado para leerse de corrido, no para correrse tal cual sobre
una base con datos. Ver la advertencia y la discrepancia conocida
(`talleres.id`) en su propio encabezado.

---

## API — Endpoints

⚠️ Esta lista no es exhaustiva — para el detalle completo de una ruta, leer el
router correspondiente en `apps/api/src/routes/`.

### Públicos (sin auth)
```
GET  /health                          → status check
POST /auth/social                     → login Google (Firebase)
POST /auth/phone/send-code            → OTP por WhatsApp
POST /auth/phone/verify               → verifica OTP, login o liga número
POST /chispas/validate                → valida chispa sin consumir
GET  /tallers                         → lista talleres activos
GET  /supernovas                      → catálogo de premios canjeables
GET  /certificados/:folio             → verificación pública de un certificado
                                         (a donde lleva el QR impreso; sin auth)
```

### Bot (requieren header `X-Bot-Key`, ver `BOT_API_KEY`)
⚠️ Hasta el 17 sep 2026 estas rutas eran públicas sin ninguna verificación —
cualquiera en internet podía llamarlas directo (sin pasar por CORS) y, por
ejemplo, pisar el WhatsApp de una cuenta ajena vía `/bot/registrar` para
robársela por OTP. Ver T-S1 en `docs/backlog-tickets.md`. Ahora
`verificarBotKey` (middleware, `router.use()` en `routes/bot.js`) exige que
el caller mande el mismo secreto que tiene la API en `BOT_API_KEY` — el bot
Faro lo manda automático en cada llamada (`apiFetch()` en `flujo.js`).
```
POST /bot/registrar                   → crea/actualiza usuario (desde bot)
GET  /bot/usuario/:email              → verifica si email tiene cuenta
GET  /bot/usuario-por-whatsapp/:numero → verifica si ese WhatsApp ya tiene cuenta
                                         (para reconocer a alguien ANTES de
                                         pedirle correo — ver T-37 en backlog)
POST /bot/lista-espera                → registra en lista de espera
GET  /bot/listas/:email               → listas de espera del usuario
GET  /bot/diagnostico/:email          → foto completa del acceso, para que el bot ramifique
POST /bot/completar-whatsapp          → guarda el WhatsApp de quien ya tiene permiso pero no lo tenía
POST /bot/reporte-acceso              → levanta reporte (abierto incluso a cuentas bloqueadas)
POST /bot/reporte-pago                → reporta un pago (foto o datos) para que Paola lo coteje
PUT  /bot/conversacion/:jid           · GET /bot/conversacion/:jid → persistencia de la charla del bot
POST /bot/evento                      → bitácora del embudo del bot
```

### Protegidos con JWT de usuario (`/users`, vía `authenticate`)
```
GET  /users/me                          → perfil del usuario
PUT  /users/me                          → actualiza nombre/apellido/whatsapp/nombre_certificado
GET  /users/me/talleres                 → talleres del usuario (para Home)
POST /users/me/canjear                  · POST /users/me/supernovas/:id/canjear
GET  /users/me/confirmar-asistencia     · POST /users/me/confirmar-asistencia (demos)
POST /users/me/aula/:tallerId/presencia → LATIDO de asistencia (cada 2 min desde el aula)
GET  /users/me/aula/:tallerId/video-token → token de LiveKit para el video del aula (T-01);
                                           `video: null` si no hay servidor configurado o sin acceso
GET  /users/me/certificados             → certificados ya emitidos al usuario
```

### Admin (JWT admin separado)
```
POST /admin/login                     → login admin → adminToken
GET  /admin/chispas/all               → todas las chispas
POST /admin/chispas/generate          → generar chispa
POST /admin/chispas/:code/revoke      → revocar chispa
GET  /admin/lista-espera              → lista completa, precio, horario
POST /admin/lista-espera/:id/confirmar-lugar → confirma + envía correo (Resend)
POST /admin/lista-espera/:id/confirmar-pago  → activarAlumno() transaccional
GET  /admin/usuarios/buscar?email=    → busca un usuario por correo (AccesosPanel)
POST /admin/send-wa                   → envía mensaje WA directo desde bot Faro
GET  /admin/talleres                  → CRUD de talleres
GET  /admin/profesores                → quién da qué taller (T-05)
POST /admin/profesores                → asigna, body {usuarioId, tallerId}
DELETE /admin/profesores/:tallerId/:usuarioId → quita esa asignación
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
⚠️ Los endpoints `/admin/resplandores/*` y `POST /admin/lista-espera/:id/confirmar`
(sin sufijo) se retiraron el 18 sep 2026 (T-14b) — no existen más.

---

## Correos Transaccionales (Resend)

- FROM: `Destello ✦ <hola@destello.courses>`
- Templates activos en `mailService.js`:
  - `sendBienvenida` — invita a crear cuenta en `/login` tras confirmar el pago
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
3. No me llegó mi acceso → `resolverAcceso()` en `flujo.js` diagnostica todo
   por `GET /bot/diagnostico/:email` (T-35, 18 sep 2026: confirmado que no
   existe, ni existía, ninguna rama de "avisar del resplandor pendiente" —
   el endpoint viejo que sí la tenía, `GET /bot/pendientes/:email`, no tenía
   ningún llamador en todo el repo desde antes de T-14; se borró junto con
   `getPendientesPorEmail()`)
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

8 tabs en `PageAdmin.jsx`: **Accesos** · **Talleres** · **Profesores** ·
**Lista de espera** · **Reportes** · **Asistencia** · **Usuarios** ·
**Métricas**.

**Accesos (`AccesosPanel.jsx`)** — búsqueda por email, historial de chispas del usuario y tabla global de todas las chispas; genera Chispas nuevas para cuentas ya activas (uso principal: demos). Ya no maneja Resplandores — retirado el 18 sep 2026 (T-14a).

**Lista de espera (`ListaEsperaAdmin.jsx`)** ✅ completo
- Tabla con filtros por estado (pendiente / cupo_confirmado / pagado / rechazado)
- Chip de filtro 🎁 Demo — las cortesías viven en la misma lista, no aparte
- Botón WA (verde) → `POST /admin/send-wa` → manda desde bot Faro directamente
- Botón correo (jade) → `POST /admin/lista-espera/:id/confirmar-lugar` → Resend

**Talleres (`TalleresPanel.jsx`)** ✅ completo — CRUD con columnas reales de BD, editor de cupo, fecha y horario (texto libre; `hora_inicio`/`hora_fin` se derivan del texto en el backend)

**Profesores (`ProfesoresPanel.jsx`, T-05, 18 sep 2026)** — busca una cuenta ya existente por correo (mismo patrón que Accesos) y la asigna como profesora de un taller (`taller_profesores`). No hace falta que tenga chispa de ese taller — dar la clase ya es su acceso. Las cuentas admin (`ADMIN_EMAILS`) siguen entrando como profe a cualquier aula sin pasar por aquí; esto es solo para profesores reales, limitados a lo que se les asigne.

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
| `/aula-nueva/:id` | PageAulaNueva.jsx | ✅ — salón de ensayo del profesor con datos inventados (sin backend, sin video). Entra como `profe` por defecto; `?rol=alumno` para verla del otro lado |
| `/perfil` | PagePerfil.jsx | ✅ |
| `/admin` | PageAdmin.jsx | ✅ — protegido con JWT admin, 7 tabs (ver arriba) |
| `/` | PageLanding.jsx | 🔒 CONGELADO — NO modificar sin permiso explícito de Paola |

---

## Reglas Críticas

1. **`PageLanding.jsx` está CONGELADO** — nunca modificarlo sin permiso explícito de Paola.
2. **FK constraint en `chispas.usuario_email`** — es intencional y correcta, NUNCA eliminarla.
3. **La tabla `resplandores` es histórica desde el 18 sep 2026 (T-14)** —
   ningún código la lee ni la escribe ya. Se conserva por su historial, no
   como referencia de cómo funciona el acceso hoy (ver "Sistema de Accesos").
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

> **A partir del 17 sep 2026, el backlog vivo y detallado es
> `docs/backlog-tickets.md`** (tickets cortos, un tema por ticket, con qué
> falta / por qué importa / dónde tocar / criterio de terminado). Esta
> sección se mantiene como resumen de alto nivel; para el detalle o el
> estado real de un pendiente, ir al backlog.

### 🔒 Seguridad
La revisión del 17 sep 2026 (`docs/backlog-tickets.md` sección 2) encontró
T-S1 y T-S2, los dos ya cerrados y verificados en producción — ver
"Lo que Está Terminado y Funciona" más abajo para el detalle de cada uno.

⚠️ **Al rotar `ADMIN_PASSWORD_HASH` en el `.env` de la Toshiba:** Docker
Compose interpola ese archivo buscando `$ALGO` para sustituir variables, y un
hash bcrypt (`$2a$12$...`) casi siempre trae un tramo que empieza con letra
justo después del tercer `$` — Compose lo confunde con el nombre de una
variable inexistente y lo borra en silencio, corrompiendo el hash sin ningún
error visible (pasó el 17 sep 2026: ni la contraseña vieja ni la nueva
entraban). **Hay que escapar cada `$` como `$$`** en esa línea del `.env`.
Detalle completo y cómo diagnosticarlo en `docs/backlog-tickets.md` (T-S1).

### 🔴 Bloquea el lanzamiento (meta: 11 sep 2026, capas 1-2 del aula)
- **Video real en el aula (T-01) — fase local ✅, falta el VPS.** La
  integración completa (cámara, micrófono, audio, "dar la palabra"/
  "silenciar" en tiempo real) ya está construida y probada en local con
  OpenVidu — ver el detalle completo en "Lo que Está Terminado y Funciona"
  más abajo. **Lo que falta para el lanzamiento:** contratar y montar el VPS
  (Hostinger KVM 2, Phoenix) con un LiveKit/OpenVidu real y apuntar
  `LIVEKIT_URL`/`LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET` de producción ahí —
  el código de la app no cambia, solo esas 3 variables.
- **T-38 — Migrar TODO el backend (API + bot) de la Toshiba al VPS.**
  Decidido con Paola (18 sep 2026): no es solo el video — la Toshiba es un
  punto único de falla (depende de una laptop prendida en una casa). Se
  agenda ~15-20 días antes del lanzamiento, en la misma ventana que el
  montaje del VPS de video. Detalle completo en `docs/backlog-tickets.md`.
- **Actividades reales (T-02/T-03/T-04).** Existe el contrato
  (`src/aula/actividades/contrato.js`) y el Quiz funcionando de punta a
  punta; faltan `memorama`, `armar` y `modelo3d`. **Las 3 están bloqueadas
  por igual (18 sep 2026):** Paola necesita armar primero el material real
  de cada una (parejas, piezas, modelos 3D) — construirlas con contenido
  inventado invalidaría la prueba del contrato, mismo criterio que ya
  aplicaba solo a `modelo3d` y ahora se extiende a las tres.

### 🟠 Deuda técnica — las tablas se relacionan por CORREO, no por id
Detectado por Paola el 21 jul 2026. `chispas.usuario_email` y
`lista_espera.email` ligan por texto (la tercera tabla que originalmente
tenía este mismo problema, `resplandores.email`, ya no aplica: esa tabla es
histórica desde el 18 sep 2026, T-14, y nada la consulta).

Migración por etapas hacia `usuario_id` (T-13 en `docs/backlog-tickets.md`,
detalle completo ahí) — **pasos 1, 2 y 3 ya cerrados y verificados (18 sep
2026):** las dos tablas tienen la columna, las filas existentes ya están
rellenas (con las huérfanas esperables — alguien sin cuenta todavía no
tiene qué enlazar, eso es normal), toda inserción nueva la guarda, y los
`JOIN` cruzados entre `chispas`/`lista_espera` ya prefieren `usuario_id`
con el correo como respaldo automático.

**Falta solo el paso 4** (`NOT NULL` + quitar `chispas_usuario_email_fkey`)
— pendiente a propósito, y con una duda por resolver antes de hacerlo: no
todas las filas van a tener `usuario_id` alguna vez (una chispa "sin
asignar", alguien en lista de espera sin cuenta todavía), así que "100%
poblado" tal como estaba escrito el criterio original puede no ser la meta
correcta — hay que revisarlo con calma antes de tocar la FK vieja.

⚠️ Mientras el paso 4 no esté hecho, la regla #2 de abajo sigue vigente:
**NO eliminar `chispas_usuario_email_fkey`.**

### 🤖 Pendiente de la próxima revisión completa del bot
`apps/bot/src/flujo.js` sigue marcado "NO tocar sin revisión a fondo" — lo
de hoy (T-37, T-35, T-36, ya cerrados) fueron excepciones puntuales y
acotadas, no la revisión completa. Detalle en `docs/backlog-tickets.md`.
- **T-35 — ✅ CERRADO (18 sep 2026):** no existía (ni existió nunca) una
  rama de "avisar del resplandor pendiente" en `flujo.js`. Sí apareció un
  endpoint backend muerto relacionado (`GET /bot/pendientes/:email`, sin
  ningún llamador en todo el repo) — se borró junto con
  `getPendientesPorEmail()`.
- **T-36 — ✅ CERRADO (18 sep 2026):** `pendiente` ya cuenta contra el cupo
  real (migración 017) y el recordatorio de 48h ya se manda solo — ver
  "Lo que Está Terminado y Funciona" más abajo para el detalle completo.

### 🟡 Pendiente
- **T-06 — Respaldo de BD + ping diario** *(movido aquí desde "Bloquea el
  lanzamiento", 18 sep 2026)*: la BD todavía tiene cambios frecuentes, no
  está pulida — Paola decidió que respaldarla ahora no es prioridad, se
  retoma cuando la estructura esté más estable.
- **Acordado, sin empezar:** onboarding/visita guiada la primera vez en el aula;
  `/aula-nueva` se está reconvirtiendo en salón de ensayo del profesor (en vez
  de borrarla); ilustraciones de sellos y reacciones (las hace Paola);
  corregir talleres con horario `12:00 PM – 12:00 PM` cargado mal (dato, no bug).
- **T-34** — `PageLanding.jsx` (🔒 CONGELADA) todavía menciona "Resplandor y
  Chispa" en su copy de marketing, un mecanismo que ya no existe en el
  código (T-14, 18 sep 2026). Decisión de Paola: se actualiza al final,
  cuando haya contenido nuevo listo para montar — no bloquea nada.
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
- Pasarela de pago (Stripe/Conekta) → automatizar flujo manual del admin
- Multi-tenant (cada institución con su propio espacio)
- Traducción automática

---

## Lo que Está Terminado y Funciona

- ✅ **T-05 — Tabla de profesores real** (18 sep 2026). Hoy "profe"
  era `isAdminEmail()`, una lista fija de un solo correo en el frontend
  (`apps/web/src/constants.js`) — la misma que decide quién ve el nav
  "Admin" (ojo: el panel `/admin` en sí ya estaba bien protegido, con su
  propio login de contraseña separado — `authenticateAdmin`, no
  `isAdminEmail`; el riesgo real no era ESE panel, era que agregar un
  profesor nuevo significaba volverlo admin de todo Destello, y encima
  requería editar y redesplegar el frontend).
  - **Backend:** migración `018_profesores.sql` — tabla `profesores`
    (quién PUEDE ser profesora) + `taller_profesores` (quién da qué
    taller, muchos a muchos). `profesorService.js` con
    `esProfeDelTaller()`/`listarAsignaciones()`/`asignarProfesor()`/
    `quitarProfesor()`. 3 endpoints nuevos bajo `/admin/profesores`.
  - **`chispaService.getTalleresDelUsuario(email, usuarioId)`** — segundo
    parámetro opcional (T-05): cada taller trae `esProfe`, y los talleres
    donde la cuenta es profesora **entran a la lista aunque no tenga
    chispa** (un `UNION ALL` con prioridad — si además tiene chispa de ese
    taller, esa fila real gana sobre la sintética). Sin esto, un profesor
    real sin chispa de su propio taller no habría podido ni entrar al aula
    ni pedir su token de video — dar la clase no debería depender de estar
    "inscrita" a tu propio taller.
  - **`asistenciaService.tieneAcceso(email, tallerId, usuarioId)`** —
    mismo tercer parámetro opcional, usado por
    `GET /users/me/aula/:tallerId/video-token` (T-01) para que un profesor
    sin chispa sí pueda pedir su token de video. Los latidos de asistencia
    (`registrarPresencia`) NO lo mandan a propósito: la asistencia
    certifica alumnos, no profesoras.
  - **`PageAula.jsx`** — `esProfe = isAdminEmail(user?.email) ||
    taller?.esProfe === true`. Los admins conservan su acceso a CUALQUIER
    aula sin cambios; esto solo agrega la posibilidad de un profesor real,
    limitado a los talleres que se le asignen.
  - **Panel admin nuevo, `ProfesoresPanel.jsx`** (tab "Profesores", 8vo tab
    de `PageAdmin.jsx`) — busca una cuenta por correo (mismo patrón que
    Accesos) y la asigna a un taller desde un `<select>`. Lista las
    asignaciones agrupadas por profesor, con botón para quitar una
    asignación puntual.
  - **Migración `018_profesores.sql` corrida en Supabase y confirmada por
    Paola.** Verificado con datos reales directo contra producción: una
    cuenta de prueba asignada como profesora aparece en su
    `GET /users/me/talleres` con `esProfe: true`, tanto con chispa real
    del taller como sin ella (fila sintética vía `taller_profesores`) —
    confirma que dar la clase no depende de tener chispa de tu propio
    taller. Asignaciones de prueba limpiadas al terminar.
  - **De paso (sin relación con T-05):** al redesplegar la API en la
    Toshiba, toda la API empezó a dar 502 — `DB_PASSWORD` del `.env`
    quedó vieja porque se usó "Reset database password" en Supabase
    durante la sesión. Corregido actualizando esa línea y reiniciando.
  - **Pruebas:** `apps/api` — `npm test`: 19/19 sin regresiones (no hay
    lógica pura nueva que aislar en `profesorService.js` — depende de BD
    real, mismo caso que T-13 3a/3b; cubierto por la verificación manual
    de arriba).

- ✅ **T-01 — Video real en el aula, fase local** (18 sep 2026). Cámara,
  micrófono, audio y el control de palabra ya son de verdad — probado de
  punta a punta por Paola con dos cuentas reales en dos pestañas, cámaras
  físicas, contra un OpenVidu corriendo en local (Docker Desktop en su
  propia máquina). Falta solo el VPS para el lanzamiento (ver "Bloquea el
  lanzamiento" arriba) — el código no cambia, solo la URL/llaves.
  - **Backend:** `apps/api/src/services/videoService.js` (`livekit-server-sdk`)
    firma un token de LiveKit scoped a una sala por taller (`sala-<tallerId>`)
    y a la identidad del usuario (su `id`, como string — coincide con el
    `Persona.id` que ya usa el resto del aula). Nuevo endpoint
    `GET /users/me/aula/:tallerId/video-token`, mismo candado de acceso que
    ya usan los latidos de asistencia (`asistenciaService.tieneAcceso()`).
    `video: null` en la respuesta (200, no error) si `LIVEKIT_URL`/llaves no
    están configuradas — el aula ya sabe mostrar "Sin video todavía" en ese
    caso, no hizo falta inventar un tercer estado.
  - **Contrato del aula extendido, sin romper la regla:** `sesion.video =
    { serverUrl, token } | null` (`aula/contrato.js`) — lo pide
    `PageAula.jsx` (la única pieza que puede hablar con la API de Destello)
    y se lo pasa al aula ya armado. Nada dentro de `src/aula/` llama a
    LiveKit por su cuenta con llaves propias; solo usa el token que ya le
    dieron.
  - **Conexión real:** `aula/video/useVideoAula.js` (hook sobre
    `livekit-client`) + `aula/video/PistaVideo.jsx` (pega una pista de
    LiveKit a un `<video>`/`<audio>`). Rellenó el hueco que `Avatar.jsx` ya
    tenía marcado desde antes (`{camara && null}`) para el video real en
    lugar del avatar de color. `BarraControles` (micro/cámara) y la tira de
    personas ya reflejan el estado real de LiveKit, no estado inventado.
  - **"Dar la palabra" / "silenciar" en tiempo real**, agregado el mismo día
    a petición de Paola tras la primera prueba (antes era solo estado local,
    no le llegaba nada a la otra persona): usa el **canal de datos de
    LiveKit** (`localParticipant.publishData()` / `RoomEvent.DataReceived`)
    — mensajería directa entre navegadores por el mismo servidor que ya
    reenvía cámara y micrófono, sin backend nuevo. Importante, ya
    documentado en el propio código desde antes: **nunca se puede prender el
    micrófono de alguien a la fuerza** (ningún navegador lo permite sin que
    la persona lo confirme) — "dar la palabra" solo le quita el bloqueo a SU
    botón; es ella quien lo prende.
  - **Indicador verde/rojo/ámbar** (pedido por Paola durante la prueba, para
    depurar mientras se conecta video real): 🔴 sin permiso (silenciada) ·
    🟡 con permiso, aún sin prender · 🟢 de verdad hablando/transmitiendo —
    visible siempre, tanto en el avatar de la tira como en los botones de
    micro/cámara. Antes de esto se escondía el badge por completo a quien
    estaba silenciada (buen criterio para 20+ personas en clase real, pero
    poco útil mientras se depura conexión real de a dos).
  - **Bug real encontrado y corregido en la misma sesión:** el hook solo
    escuchaba `LocalTrackPublished`/`Unpublished` para refrescar el estado
    propio de cámara/micro — pero `setMicrophoneEnabled(false)` normalmente
    **silencia** la pista sin despublicarla, así que esos eventos solo
    disparaban la primera vez. Resultado: el color del botón se quedaba
    pegado en el primer valor capturado, sin importar cuántas veces se
    volviera a apagar/prender. Arreglado escuchando también
    `RoomEvent.TrackMuted`/`TrackUnmuted` (que sí disparan en cada toggle,
    para la pista propia y las remotas).
  - **Infraestructura de prueba (fuera del repo, no es código de Destello):**
    `openvidu-local-deployment` (Community 3.8.0) clonado en
    `~/openvidu-local-deployment`, con `LAN_MODE=false`/`USE_HTTPS=false` (un
    solo equipo, sin certificados) y un `docker-compose.override.yml` local
    fijando `NODE_IP=127.0.0.1` — sin esto, el contenedor de LiveKit anuncia
    su IP interna de Docker para el video/audio (ICE), inalcanzable desde el
    navegador, y la señalización conecta pero el video nunca llega
    ("could not establish pc connection").
  - **Pruebas:** `apps/api` — `npm test`: 19/19 (3 nuevos en
    `videoService.test.js`: nombre de sala, token nulo sin config, token
    válido con JWT de 3 partes). La parte de LiveKit/React no tiene test
    automatizado (necesita cámara/navegador real) — verificado a mano por
    Paola de punta a punta.
  Encontrado al probar T-13: si el WhatsApp usado ya estaba ligado a otra
  cuenta, `usuarioService.upsertUsuario()` rechazaba la creación
  (`WA_EN_USO`, regla ya vigente: un WhatsApp no puede estar en dos
  cuentas) pero el bot nunca revisaba la respuesta y seguía como si hubiera
  funcionado — la persona podía hasta pagar un taller y después no poder
  entrar nunca. Dos capas de arreglo (diseño de Paola): (1) preventiva —
  nuevo endpoint `GET /bot/usuario-por-whatsapp/:numero` + nueva función
  `iniciarRegistro()` en `flujo.js` que reconoce a la persona por su
  WhatsApp ANTES de pedirle correo, sin volver a preguntar si ya tiene
  cuenta; (2) red de seguridad — si `/bot/registrar` falla igual, el bot
  ahora sí le avisa. Verificado por Paola en WhatsApp real: te reconoce y
  saluda por nombre sin pedir correo.

- ✅ **T-13, pasos 1-3 — migración hacia `usuario_id` en `chispas` y
  `lista_espera`** (18 sep 2026). Columna agregada y poblada, toda
  inserción nueva ya la guarda, y los `JOIN` cruzados entre las dos tablas
  ya prefieren `usuario_id` con el correo como respaldo automático (si
  cualquiera de los dos ids es `NULL`, SQL cae solo a la comparación por
  correo — no hizo falta duplicar ninguna consulta). Falta solo el paso 4
  (`NOT NULL` + quitar la FK vieja), pendiente a propósito — ver "Deuda
  técnica" arriba. Detalle completo en `docs/backlog-tickets.md` (T-13).

- ✅ **T-10 — nombre/apellido separados también en el caso borde** (18 sep
  2026). El bug original (bot concatenaba nombre completo) ya estaba
  resuelto; quedaba que `activarAlumno()` (`inscripcionService.js`) copiara
  el nombre completo de `lista_espera` sin partir cuando activaba a alguien
  que nunca pasó por el bot. Nueva función `partirNombre()` (misma regla
  que el bot: primera palabra = nombre, resto = apellido), aplicada en las
  dos queries de `activarAlumno()`. Pruebas en
  `inscripcionService.test.js` (4 casos). `npm test`: 12/12.

- ✅ **T-14 (a/b/c) + T-33 — Modelo viejo de Resplandor y login por
  código/contraseña retirados por completo** (18 sep 2026). Hoy solo se
  entra por Google o WhatsApp OTP — todo lo demás se quitó:
  - **T-14a (panel admin):** el botón de crear/enviar Resplandor en
    `AccesosPanel.jsx` no se usaba (confirmado con Paola — lo que sí se
    usa ahí es "Crear Chispa", para demos, que no se tocó). Se quitó toda
    esa UI/lógica; el panel quedó solo con Chispas.
  - **T-14b (backend admin):** los 5 endpoints `/admin/resplandores/*`,
    `POST /admin/mail/resplandor`, la ruta huérfana `POST
    /admin/lista-espera/:id/confirmar`, y dos funciones de
    `adminController.js` que nunca estuvieron enrutadas. Nuevo endpoint
    limpio `GET /admin/usuarios/buscar?email=`. De paso aparecieron y se
    borraron **3 componentes de React huérfanos**
    (`ListaEsperaPanel.jsx`, `RespladorAdmin.jsx`, `ResplandoresPanel.jsx`
    — ~1,247 líneas que ninguna página importaba).
  - **T-14c (lado usuario):** `/acceso` ahora redirige a `/login` en vez
    de mostrar el formulario viejo; se borraron `PageAcceso.jsx`,
    `RegisterForm`, `resplandorController.js`, `resplandorService.js`,
    `POST /auth/register`, `/auth/resplandor/*`, y `sendResplandor()` +
    su plantilla en `mailService.js` — todo confirmado en cero llamadores
    antes de borrarlo.
  - **T-33 (login viejo):** al cerrar T-14c se encontró que
    `POST /auth/login` (email+contraseña **y** código de Chispa) tampoco
    lo llamaba nadie en el frontend — se retiró la ruta completa,
    `loginWithCode()` y la acción `login()` del store.
  - `usuarios.password` y la tabla `resplandores` **no se tocaron** —
    siguen con su historial completo, tal como pedía el criterio de
    terminado original.
  - Verificado por Paola en el sitio y panel reales tras cada redeploy —
    todo correcto. Sin test automatizado nuevo — `apps/web` no tiene
    ningún framework de pruebas configurado todavía. Detalle completo en
    `docs/backlog-tickets.md` (T-14, T-33).
  - **Pendiente, no de este cierre:** T-34 — `PageLanding.jsx` (🔒
    CONGELADA) sigue mencionando "Resplandor y Chispa" en su copy de
    marketing; Paola decidió actualizarla al final, cuando haya contenido
    nuevo listo para montar — no es una decisión de código.

- ✅ **T-15 — un solo schema en el repo** (18 sep 2026). Se borraron los dos
  archivos del MVP pre-Supabase (`db/schema.sql` y
  `src/migrations/002_create_resplandores.sql`, con tipos/columnas/FK
  equivocados). `db/schema.supabase.sql` se reconstruyó como la
  concatenación verificada de la base original + las 14 migraciones — ver
  su propio encabezado para el detalle y una discrepancia sin resolver
  (`talleres.id`). Detalle completo en `docs/backlog-tickets.md` (T-15).

- ✅ **T-S2 — rate limiting por IP en `/admin/login` y `/auth/phone/send-code`**
  (18 sep 2026). Middleware propio en memoria (`apps/api/src/middleware/rateLimit.js`,
  mismo criterio que `otpService.js`, sin librería externa), leyendo
  `CF-Connecting-IP` porque la API vive detrás de un Cloudflare Tunnel.
  `/admin/login`: 10 intentos / 15 min por IP. `/auth/phone/send-code`:
  8 solicitudes / 10 min por IP (además del límite ya existente por número).
  Verificado en prod: 11 intentos seguidos contra `/admin/login` con
  contraseña incorrecta dieron `401` los primeros 10 y `429` el 11.

- ✅ **T-S1 — endpoints `/bot/*` ya exigen `BOT_API_KEY`** (17 sep 2026).
  Cerraba una cadena de robo de cuenta: cualquiera en internet podía llamar
  `/bot/registrar` con el correo de una cuenta ajena y pisarle el WhatsApp
  para luego entrar por OTP; `/bot/diagnostico` y `/bot/pendientes` exponían
  datos y códigos internos de cualquier email sin autenticación. Middleware
  `verificarBotKey` en `routes/bot.js`, header `X-Bot-Key` desde
  `apps/bot/src/flujo.js` (`apiFetch()`). Verificado en prod: el bot sigue
  respondiendo normal con la clave puesta, y `curl` externo sin la clave
  contra `https://api.destello.courses/bot/diagnostico/...` confirma
  `401 UNAUTHORIZED` (18 sep 2026). De paso se rotaron `ADMIN_TOKEN_SECRET`
  y la contraseña de `/admin` (se
  habían compartido en texto plano durante la sesión). Detalle completo en
  `docs/backlog-tickets.md` (T-S1), incluyendo el gotcha de escapar `$` como
  `$$` en hashes bcrypt dentro del `.env`.

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
- ✅ `AccesosPanel.jsx` — panel unificado Chispas + Resplandores *(histórico:
  desunificado el 18 sep 2026, T-14a — hoy solo maneja Chispas)*
- ✅ `TalleresPanel.jsx` — CRUD con columnas reales
- ✅ `PageAcceso.jsx` → endpoint `/api/auth/resplandor/validate` *(histórico:
  `PageAcceso.jsx` se borró el 18 sep 2026, T-14c — `/acceso` redirige a `/login`)*
- ✅ Login dual + `registerUser` en `authController.js` *(histórico:
  `registerUser` se borró el 18 sep 2026, T-14c — ya no hay registro con
  contraseña, solo Google/WhatsApp)*
- ✅ CORS incluye `destello.courses`
- ✅ Proxy Vercel `/api/*` → túnel en `vercel.json`
- ✅ Talleres dinámicos desde BD en PageLanding y PageHabitat

### Entregado en agosto 2026 (no estaba documentado aquí)

- ✅ **`usuarios.whatsapp` único** (21 ago, commit `b53eea5`) — el bug que este
  archivo listaba como prioridad ya está resuelto y verificado en producción:
  índice único parcial (`001_whatsapp_unico.sql`) + `asegurarWhatsappLibre()`
  validando en los 6 puntos que escriben el campo + `errorHandler.js` traduce
  el 23505 de Postgres a un 409 legible.
- ✅ **Reglas de cupo, plazos y liberación** (migraciones 006-009, extendidas
  por 017 en T-36) — `v_cupo_taller` como fuente única del cupo real; 48h
  para pagar → recordatorio → 24h de gracia → liberar lugar; las
  cortesías/demos ocupan cupo igual que un pago (`monto=0`, nunca cuentan
  como ingreso).
- ✅ **T-36 — `pendiente` ya ocupa cupo real, con recordatorio automático**
  (18 sep 2026). Antes, `v_cupo_taller` solo contaba `cupo_confirmado`/
  `pagado` — un renglón `pendiente` (el que crea el bot apenas alguien elige
  taller, ANTES de que Paola confirme nada, con el mensaje "¡Quedaste
  inscrito!" + medios de pago) no apartaba nada. Con poco cupo, varias
  personas casi al mismo tiempo podían pasar la validación y a todas se les
  prometía un lugar que el sistema no les estaba apartando de verdad.
  Migración `017_pendiente_cuenta_cupo.sql`: agrega `pendiente` a los
  estados que cuentan en `v_cupo_taller`, y extiende el reloj de 48h+24h de
  `v_alertas` para que también arranque en `pendiente` (usando `created_at`
  como base, porque `confirmado_at` solo se llena al confirmar el lugar —
  algo que un `pendiente` recién creado todavía no pasó). El botón "Liberar"
  del panel ya funcionaba para cualquier estado, así que no hizo falta UI
  nueva — un `pendiente` vencido aparece con el mismo reloj/botón que un
  `cupo_confirmado` vencido. `relojPago()` (`ListaEsperaAdmin.jsx`) se
  extendió igual, cayendo a `created_at` cuando no hay `confirmado_at`.
  **De paso, a petición de Paola:** el recordatorio de las 48h dejó de ser
  manual — nuevo `recordatorioAutoService.js`, corrido cada 30 min desde
  `index.js` (`setInterval`, sin librería externa ni cron del sistema,
  mismo criterio que `otpService`/`rateLimit`), manda automáticamente el
  mismo WhatsApp que antes mandaba Paola a mano con el botón "Recordar" (que
  se conserva, como respaldo/adelanto manual). El texto (automático y
  manual, idéntico) reenvía también los datos de pago completos (SPEI +
  tarjeta) — ajuste pedido por Paola el mismo día, para que la persona no
  tenga que buscar el mensaje viejo. Pruebas: 16/16 en `apps/api`
  (`recordatorioAutoService.test.js`, 4 casos: texto base + datos de pago).
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
