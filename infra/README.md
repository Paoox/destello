# Infraestructura — scripts de la Toshiba

Scripts que configuran el servidor, no la aplicación. Viven aquí para que estén
versionados y no haya que copiarlos a mano cada vez.

## Qué se despliega con git y qué no

Es la duda que aparece siempre. La regla corta:

| Qué cambia | ¿`git pull` lo aplica? | Qué hay que hacer |
|---|---|---|
| `apps/api/**` | Sí, pero no basta | `git pull` + `docker compose up --build -d api` |
| `apps/bot/**` | Sí, pero no basta | `git pull` + `sudo systemctl restart destello-bot` |
| `apps/web/**` | Sí | Nada en la Toshiba — eso lo publica Vercel solo |
| `apps/api/src/db/migrations/*.sql` | **No** | Pegarlo a mano en Supabase → SQL Editor |
| `infra/toshiba/*.sh` | Sí, pero no basta | `git pull` + correr el script una vez |

El patrón detrás: **git mueve archivos, no aplica cambios.**

- Un `.sql` en el repo es el *registro* de lo que se hizo, no la ejecución. La
  base está en Supabase, no en la Toshiba: git no la toca.
- El código de la API vive dentro de un contenedor. Bajar el archivo no
  reconstruye la imagen — por eso el `--build`.
- Estos scripts escriben en `/etc/systemd/` y `/usr/local/bin/`, fuera del repo.
  Bajarlos no los ejecuta.

## Los scripts

### `diagnostico-tunel.sh`
Solo lee. Revisa cuántos cloudflared corren, con qué protocolo, los errores
recientes, si la API responde en local, el estado de Docker y la salud de la
conexión. **Correr esto primero** cuando algo falle desde internet.

```bash
bash infra/toshiba/diagnostico-tunel.sh
```

### `fix-tunel-http2.sh` — ya aplicado el 22 ago 2026
Cambia el túnel de QUIC (UDP) a HTTP2 (TCP).

Los 502 intermitentes eran esto: cloudflared usa QUIC por defecto, el internet
doméstico maltrata el UDP, y el túnel se caía y reconectaba **cada 1-2 minutos**.
Cada reconexión era una ventana de errores. Con `--protocol http2` pasó de
**0/12 peticiones exitosas a 30/30**.

Solo hace falta correrlo de nuevo si se pierde el drop-in de systemd.

### `instalar-watchdog-tunel.sh`
Vigilante que revisa la URL pública cada 2 minutos y reinicia el túnel si falla
3 veces seguidas.

Existe porque el fix de http2 no cerró todo el hueco: el 23 ago el log mostró
`Lost connection with the edge` — el proceso **seguía vivo** (systemd lo veía
"active", así que `Restart=always` no hacía nada) pero había perdido todas sus
conexiones con Cloudflare. Desde fuera se veía caído; desde adentro, sano.

Antes de reiniciar revisa la API en `localhost`: si la caída es de la API, no
toca el túnel — reiniciarlo escondería el problema real.

```bash
bash infra/toshiba/instalar-watchdog-tunel.sh
journalctl -u destello-tunel-watchdog --since today --no-pager   # qué ha hecho
```

## Servicios en la Toshiba

| Servicio | Qué es |
|---|---|
| `destello-tunnel` | Túnel de Cloudflare → expone la API en `api.destello.courses` |
| `destello-bot` | Bot Faro de WhatsApp |
| `destello-tunel-watchdog.timer` | El vigilante de arriba |
| Docker: `destello-api`, `destello-redis` | La API y su caché |

La base de datos **no** está aquí: vive en Supabase (`ca-central-1`).

## Diagnóstico rápido de un 502

El tiempo de respuesta dice de quién es el problema:

| El 502 tarda | Quién es |
|---|---|
| **menos de 1 s** | El túnel. No es el código ni la base |
| **30–100 s** | Timeout real: consulta lenta o Supabase sin responder |
| **530 / error 1033** | No hay ningún túnel registrado |

```bash
for i in 1 2 3 4 5; do
  curl -s -o /dev/null -w "HTTP %{http_code} en %{time_total}s\n" \
    --max-time 40 https://api.destello.courses/health
done
```

El campo `uptime` de `/health` dice hace cuánto arrancó el contenedor: si es
alto, la API nunca se cayó.
