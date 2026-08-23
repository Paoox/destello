#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Destello — FIX del túnel: cambiar QUIC (UDP) por HTTP2 (TCP)
#
# Diagnóstico confirmado 22 ago 2026:
#   cloudflared corre con protocol=quic (UDP 7844). Tu internet
#   entrega TCP perfecto (0% packet loss a 1.1.1.1, 13ms) pero
#   el UDP hacia el edge de Cloudflare se muere cada 1-2 min:
#     "failed to dial to edge with quic: timeout: no recent network activity"
#   Cada reconexión = ventana de 502 instantáneos.
#
# Correr EN LA TOSHIBA:  bash fix-tunel-http2.sh
# Reversible: al final te dice cómo deshacerlo.
# ─────────────────────────────────────────────────────────────
set -e

UNIT=destello-tunnel
DROPIN=/etc/systemd/system/${UNIT}.service.d
BIN=$(command -v cloudflared || echo /usr/bin/cloudflared)

echo "=========================================================="
echo " FIX TÚNEL DESTELLO — QUIC -> HTTP2"
echo "=========================================================="

echo
echo "── 1. ExecStart actual (por si hay que revertir) ─────────"
systemctl cat "$UNIT" | grep ExecStart

echo
echo "── 2. Creando override de systemd ────────────────────────"
sudo mkdir -p "$DROPIN"
sudo tee "$DROPIN/override.conf" >/dev/null <<EOF
[Service]
# Vaciar el ExecStart original antes de redefinirlo (regla de systemd)
ExecStart=
ExecStart=$BIN tunnel --protocol http2 --edge-ip-version 4 --no-autoupdate run destello-api

# Que se levante solo si se cae
Restart=always
RestartSec=5
EOF
echo "   escrito en $DROPIN/override.conf"
sudo cat "$DROPIN/override.conf" | sed 's/^/      /'

echo
echo "── 3. Recargando y reiniciando el túnel ──────────────────"
sudo systemctl daemon-reload
sudo systemctl restart "$UNIT"
sleep 8

echo
echo "── 4. ExecStart nuevo ────────────────────────────────────"
systemctl cat "$UNIT" | grep ExecStart

echo
echo "── 5. ¿Con qué protocolo se registró? ────────────────────"
echo "   Debe decir protocol=http2 (NO quic)"
journalctl -u "$UNIT" --since "1 min ago" --no-pager \
  | grep -iE "Registered tunnel connection" | tail -6

echo
echo "── 6. Vigilando errores durante 90 segundos ──────────────"
echo "   Antes del fix salía un error cada 1-2 min."
echo "   Si aquí no sale nada, quedó arreglado."
timeout 90 journalctl -u "$UNIT" -f --no-pager 2>/dev/null \
  | grep -iE "ERR|WRN|Retrying|terminated" || echo "   ✅ Sin errores en 90 segundos"

echo
echo "── 7. Prueba real desde fuera (20 peticiones seguidas) ───"
ok=0; fail=0
for i in $(seq 1 20); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 https://api.destello.courses/health)
  if [ "$code" = "200" ]; then ok=$((ok+1)); printf "."; else fail=$((fail+1)); printf "X"; fi
  sleep 1
done
echo
echo "   OK: $ok/20   FALLOS: $fail/20"
[ "$fail" -eq 0 ] && echo "   ✅ TÚNEL ESTABLE" || echo "   ⚠️  Todavía falla — pégame la salida en el chat"

echo
echo "=========================================================="
echo " Para revertir si algo sale mal:"
echo "   sudo rm -rf $DROPIN"
echo "   sudo systemctl daemon-reload && sudo systemctl restart $UNIT"
echo "=========================================================="
