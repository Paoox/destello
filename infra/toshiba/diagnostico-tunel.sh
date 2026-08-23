#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Destello — Diagnóstico del túnel de Cloudflare y la API
# Correr EN LA TOSHIBA:  bash diagnostico-tunel.sh
# No modifica nada. Solo lee y reporta.
# ─────────────────────────────────────────────────────────────
set +e
echo "=========================================================="
echo " DESTELLO — DIAGNÓSTICO  $(date)"
echo "=========================================================="

echo
echo "── 1. ¿Cuántos cloudflared hay corriendo? ────────────────"
echo "   (si sale MÁS DE UNO, ese es el problema)"
ps -eo pid,etime,cmd | grep -i "[c]loudflared"
echo "Total de procesos cloudflared: $(pgrep -c cloudflared 2>/dev/null || echo 0)"

echo
echo "── 2. Servicios systemd relacionados ─────────────────────"
systemctl list-units --type=service --all --no-pager 2>/dev/null \
  | grep -iE "cloudflare|tunnel|destello" || echo "  (ninguno)"

echo
echo "── 3. Estado de cada servicio destello-* ─────────────────"
for s in destello-api destello-tunnel destello-vercel-sync destello-bot cloudflared; do
  printf "  %-24s " "$s"
  systemctl is-active "$s" 2>/dev/null || echo "no-existe"
done

echo
echo "── 4. Configuración del túnel ────────────────────────────"
for f in /etc/cloudflared/config.yml ~/.cloudflared/config.yml /root/.cloudflared/config.yml; do
  if [ -f "$f" ]; then echo "  >>> $f"; sed 's/^/      /' "$f"; fi
done
echo "  --- ExecStart de las units ---"
grep -hER "ExecStart" /etc/systemd/system/*tunnel* /etc/systemd/system/*cloudflared* 2>/dev/null | sed 's/^/      /'

echo
echo "── 5. ¿Qué protocolo usa el túnel? (quic vs http2) ───────"
echo "   quic = UDP. En internet doméstico se cae seguido -> 502 intermitente"
journalctl -u destello-tunnel -u cloudflared --since "2 hours ago" --no-pager 2>/dev/null \
  | grep -iE "protocol|quic|http2|Registered tunnel connection|connIndex" | tail -20

echo
echo "── 6. Errores del túnel en las últimas 2 horas ───────────"
journalctl -u destello-tunnel -u cloudflared --since "2 hours ago" --no-pager 2>/dev/null \
  | grep -iE "error|fail|unable|refused|timeout|lost connection|retry" | tail -30

echo
echo "── 7. ¿La API responde LOCALMENTE? (sin pasar por el túnel)"
for i in 1 2 3; do
  curl -s -o /dev/null -w "   intento $i -> HTTP %{http_code} en %{time_total}s\n" \
    --max-time 20 http://127.0.0.1:3001/health
done

echo
echo "── 8. Contenedores Docker ────────────────────────────────"
docker compose -f ~/destello/docker-compose.yml ps 2>/dev/null \
  || docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo
echo "── 9. ¿Llegaron a la API las peticiones que dieron 502? ──"
echo "   Si aquí NO aparecen /admin/talleres ni /admin/lista-espera,"
echo "   el problema es 100% del túnel, no del código."
docker compose -f ~/destello/docker-compose.yml logs --tail=120 api 2>/dev/null \
  | grep -iE "GET /admin|POST /admin|error" | tail -40

echo
echo "── 10. Latencia real a Supabase desde la Toshiba ─────────"
DBHOST=$(grep -hoE "aws-[0-9]-[a-z0-9-]+\.pooler\.supabase\.com" ~/destello/.env 2>/dev/null | head -1)
echo "   host: ${DBHOST:-no encontrado en .env}"
[ -n "$DBHOST" ] && ping -c 4 "$DBHOST" 2>/dev/null | tail -3

echo
echo "── 11. Salud de la conexión de internet de la Toshiba ────"
ping -c 8 1.1.1.1 2>/dev/null | tail -3
echo "   (packet loss > 0% = tu internet pierde paquetes -> el túnel se cae)"

echo
echo "── 12. ¿La Toshiba se durmió o se reinició? ──────────────"
uptime
last -x --since "-2 days" 2>/dev/null | grep -iE "reboot|shutdown" | head -5

echo
echo "=========================================================="
echo " FIN. Copia TODO este texto y pégalo en el chat."
echo "=========================================================="
