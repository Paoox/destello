#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Destello — Vigilante del túnel
#
# POR QUÉ:
# Con `--protocol http2` el túnel pasó de caerse cada 1-2 minutos a estar
# estable, pero sigue habiendo ventanas: el 23 ago 2026 el log mostró
#     INF Lost connection with the edge connIndex=0 / 2
#     WRN Serve tunnel error error="connection with edge closed"
# El proceso NUNCA se cayó (systemd lo veía "active"), pero perdió todas sus
# conexiones con Cloudflare y tardó en recuperarlas. Desde fuera eso se ve
# como 502 y luego 530, y systemd no reinicia nada porque el proceso vive.
#
# QUÉ HACE ESTE VIGILANTE:
# Cada 2 minutos revisa la URL pública. Si falla 3 veces seguidas, reinicia el
# túnel — que es exactamente lo que hiciste tú a mano, pero sin que tengas que
# darte cuenta.
#
# ES CUIDADOSO A PROPÓSITO:
#   · Primero revisa la API en localhost. Si la API es la que está caída, NO
#     reinicia el túnel: no tendría sentido y solo escondería el problema real.
#   · Pide 3 fallas seguidas, no una. Un 502 aislado no amerita reiniciar.
#
# Correr EN LA TOSHIBA:  bash instalar-watchdog-tunel.sh
# ─────────────────────────────────────────────────────────────
set -e

echo "═══ Instalando el vigilante del túnel ═══"

sudo tee /usr/local/bin/destello-tunel-watchdog.sh > /dev/null <<'SCRIPT'
#!/usr/bin/env bash
# Revisa el túnel y lo reinicia solo si de verdad hace falta.
URL_PUBLICA="https://api.destello.courses/health"
URL_LOCAL="http://127.0.0.1:3001/health"

# 1. ¿La API local responde? Si no, el problema NO es el túnel.
if ! curl -sf -o /dev/null --max-time 10 "$URL_LOCAL"; then
    echo "API local caída — no se toca el túnel, el problema está en la API"
    exit 0
fi

# 2. Tres intentos contra la URL pública, espaciados.
fallas=0
for i in 1 2 3; do
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "$URL_PUBLICA")
    if [ "$code" = "200" ]; then
        exit 0          # con que uno pase, el túnel está bien
    fi
    fallas=$((fallas + 1))
    echo "intento $i -> HTTP $code"
    sleep 5
done

# 3. Tres fallas seguidas con la API sana = el túnel está atorado.
echo "Túnel sin responder ($fallas/3) pero la API está sana. Reiniciando cloudflared."
systemctl restart destello-tunnel
SCRIPT

sudo chmod +x /usr/local/bin/destello-tunel-watchdog.sh

sudo tee /etc/systemd/system/destello-tunel-watchdog.service > /dev/null <<'UNIT'
[Unit]
Description=Destello — revisa que el túnel responda desde internet
After=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/destello-tunel-watchdog.sh
UNIT

sudo tee /etc/systemd/system/destello-tunel-watchdog.timer > /dev/null <<'UNIT'
[Unit]
Description=Revisa el túnel de Destello cada 2 minutos

[Timer]
OnBootSec=3min
OnUnitActiveSec=2min
AccuracySec=15s

[Install]
WantedBy=timers.target
UNIT

sudo systemctl daemon-reload
sudo systemctl enable --now destello-tunel-watchdog.timer

echo
echo "═══ Estado ═══"
systemctl list-timers destello-tunel-watchdog --no-pager | head -4

echo
echo "═══ Prueba inmediata (debe salir sin hacer nada si todo está bien) ═══"
sudo /usr/local/bin/destello-tunel-watchdog.sh && echo "  ✅ túnel respondiendo, no hizo falta reiniciar"

echo
echo "─────────────────────────────────────────────────────────────"
echo " Para ver qué ha hecho:"
echo "   journalctl -u destello-tunel-watchdog --since today --no-pager"
echo
echo " Para quitarlo:"
echo "   sudo systemctl disable --now destello-tunel-watchdog.timer"
echo "   sudo rm /etc/systemd/system/destello-tunel-watchdog.*"
echo "   sudo rm /usr/local/bin/destello-tunel-watchdog.sh"
echo "   sudo systemctl daemon-reload"
echo "─────────────────────────────────────────────────────────────"
