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
│   │   │   │                            PageHome, PageHabitat, PageAula, PagePerfil
│   │   │   ├── components/
│   │   │   │   ├── admin/            ← AccesosPanel, ListaEsperaAdmin, TalleresPanel,
│   │   │   │   │                        ResplandoresPanel, ChispaCreator, etc.
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

---

## API — Endpoints

### Públicos (sin auth)
```
GET  /health                          → status check
POST /auth/login                      → login JWT usuario
POST /auth/resplandor/validate        → valida resplandor y crea cuenta
POST /chispas/validate                → valida chispa sin consumir
GET  /tallers                         → lista talleres activos

POST /bot/registrar                   → crea/actualiza usuario (desde bot)
GET  /bot/usuario/:email              → verifica si email tiene cuenta
POST /bot/lista-espera                → registra en lista de espera
GET  /bot/listas/:email               → listas de espera del usuario
GET  /bot/pendientes/:email           → chispas + resplandores sin usar
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
POST /admin/send-wa                   → envía mensaje WA directo desde bot Faro
GET  /admin/talleres                  → CRUD de talleres
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

Tabs: **Accesos** | **Talleres** | **Lista de espera**

**Accesos (`AccesosPanel.jsx`)** — búsqueda por email, historial de resplandores + chispas, lógica visual: sin cuenta → card Resplandor activa / con cuenta → card Chispa activa

**Lista de espera (`ListaEsperaAdmin.jsx`)** ✅ completo
- Tabla con filtros por estado (pendiente / cupo_confirmado / pagado / rechazado)
- Botón WA (verde) → `POST /admin/send-wa` → manda desde bot Faro directamente
- Botón correo (jade) → `POST /admin/lista-espera/:id/confirmar-lugar` → Resend

**Talleres (`TalleresPanel.jsx`)** ✅ completo — CRUD con columnas reales de BD

---

## Páginas del Frontend

| Ruta | Archivo | Estado |
|------|---------|--------|
| `/intro` | PageIntro.jsx | ✅ — splash animado, auto-navega a /login |
| `/login` | PageLogin.jsx | ✅ — tabs login/registro, Google pendiente |
| `/acceso` | PageAcceso.jsx | ✅ — valida Resplandor, crea cuenta |
| `/home` | PageHome.jsx | ✅ |
| `/habitat` | PageHabitat.jsx | ✅ — grid talleres reales desde BD, modal lista de espera |
| `/aula/:id` | PageAula.jsx | ✅ — sala 3D |
| `/perfil` | PagePerfil.jsx | ✅ |
| `/admin` | PageAdmin.jsx | ✅ — protegido con JWT admin |
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

---

## Lo que Falta (Próximas Sesiones)

### 🟡 Pendiente
- **Dashboard Analytics** en panel admin — métricas de conversión, rentabilidad, reincidencia
- **Error en consola frontend** — `Cannot read properties of undefined (reading 'payload')`. Nota: `useAuthStore.js` actual NO tiene referencia a `payload` (0 matches en `apps/web/src`); ya corregido o viene de una librería. Reproducir y leer stack trace para ubicarlo.
- **Vigencia de Chispa en frontend** — bloquear rooms/contenido automáticamente al vencer
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
