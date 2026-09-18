/**
 * Destello API — Recordatorio automático de pago (T-36)
 *
 * ── Por qué existe ──────────────────────────────────────────────────────────
 *
 * Antes, la única forma de avisarle a alguien que se le venció el plazo de
 * 48 h era que Paola entrara al panel (`ListaEsperaAdmin.jsx`) y le diera
 * clic a "Recordar" fila por fila. Con T-36, un `pendiente` ya ocupa cupo
 * real desde que se crea (migración 017) — así que un recordatorio que
 * llega tarde, o que nunca se manda porque nadie miró el panel ese día,
 * deja un lugar ocupado más tiempo del necesario sin que la persona
 * siquiera sepa que tiene un plazo corriendo.
 *
 * ── Qué hace ─────────────────────────────────────────────────────────────
 *
 * Corre cada cierto tiempo (ver el `setInterval` en `index.js`) y busca los
 * mismos renglones que ya marca `v_alertas` como `falta_recordatorio`
 * (migración 017: `pendiente`/`cupo_confirmado`/`confirmado`, plazo de 48 h
 * vencido, sin recordatorio previo) — la condición se repite aquí en vez de
 * leer la vista porque hace falta el WhatsApp y el nombre para armar el
 * mensaje, que `v_alertas` no expone. Les manda el mismo texto que antes
 * mandaba Paola a mano (`buildWaRecordatorio` en `ListaEsperaAdmin.jsx`).
 *
 * `recordatorio_at` solo se estampa si el envío salió bien — igual que hacía
 * el botón manual: si el mensaje no llegó, no sería justo empezarle a correr
 * las 24 h de gracia a alguien que nunca se enteró.
 *
 * El botón "Recordar" del panel sigue ahí: sirve para mandarlo antes de las
 * 48 h si Paola quiere adelantarse, o para reintentar a mano si el
 * automático falló (ej. el bot estaba caído en ese momento).
 */
import { query } from '../db/db.js'
import { sendWhatsapp } from './botService.js'

// Mismos datos que ya usan `buildWaMensaje()`/`buildWaRecordatorio()`
// (`ListaEsperaAdmin.jsx`) y las plantillas de `mailService.js` — se
// duplican igual que en esos otros dos lugares, no hay un módulo de
// constantes compartido todavía.
const SPEI_CLABE = '036180500687558754'
const CARD_NUM   = '4658 2850 1724 7424'

/**
 * Mismo texto que `buildWaRecordatorio()` en `ListaEsperaAdmin.jsx` —
 * mantenerlos iguales. Reenvía los datos de pago (a petición de Paola,
 * 18 sep 2026): quien recibe el recordatorio ya pasaron 48 h desde que se
 * le mandaron la primera vez, así que no hay que asumir que los tenga a la
 * mano — mejor ponerlos otra vez que hacerle buscar el mensaje viejo.
 */
export function textoRecordatorio(nombre, tallerNombre) {
    const primerNombre = nombre?.split(' ')[0] || 'alumno/a'
    const taller = tallerNombre || 'el taller'

    return [
        `¡Hola ${primerNombre}! ✦`,
        '',
        `Te escribo por tu lugar en *${taller}*.`,
        '',
        'Todavía no nos llega tu comprobante de pago y el plazo ya se cumplió. ' +
        'Si ya pagaste, mándame la foto por aquí y lo confirmo enseguida. 📸',
        '',
        'Si no lo has hecho, aquí tienes de nuevo los datos:',
        '',
        '🏦 *SPEI — Inbursa*',
        'Titular: Paola Arreola',
        `CLABE: ${SPEI_CLABE}`,
        '',
        '💳 *Pago en efectivo*',
        `Tarjeta: ${CARD_NUM}`,
        'Titular: Paola Arreola',
        '(Walmart · OXXO · Sears · Sanborns · Bodega Aurrera)',
        '',
        'Si algo se te complicó, dime y vemos cómo te ayudo. ' +
        'Si no puedo confirmarlo pronto tendría que liberar tu lugar para alguien de la lista. 🙏',
        '',
        '¿Me confirmas?',
    ].join('\n')
}

/**
 * Manda el recordatorio a todo el que cumpla la etapa `falta_recordatorio` y
 * tenga WhatsApp guardado. Un error al mandarle a una persona no debe tumbar
 * el resto del lote.
 *
 * @returns {Promise<{ revisados: number, enviados: number }>}
 */
export async function enviarRecordatoriosAutomaticos() {
    const { rows } = await query(
        `SELECT le.id, le.nombre, le.whatsapp, t.nombre AS taller_nombre
           FROM lista_espera le
                LEFT JOIN talleres t ON t.id = le.taller_id
          WHERE le.estado IN ('pendiente', 'cupo_confirmado', 'confirmado')
            AND COALESCE(le.confirmado_at, le.created_at) < NOW() - INTERVAL '48 hours'
            AND le.recordatorio_at IS NULL
            AND le.whatsapp IS NOT NULL
            AND le.whatsapp <> ''`
    )

    let enviados = 0
    for (const r of rows) {
        try {
            await sendWhatsapp(r.whatsapp, textoRecordatorio(r.nombre, r.taller_nombre))
            await query(
                `UPDATE lista_espera
                    SET recordatorio_at = NOW(),
                        recordatorios   = COALESCE(recordatorios, 0) + 1
                  WHERE id = $1`,
                [r.id]
            )
            enviados++
        } catch (err) {
            // No se detiene el lote por uno: el bot pudo estar caído para ESE
            // mensaje, o el número pudo cambiar. Se reintenta solo en la
            // siguiente corrida (recordatorio_at sigue NULL).
            console.error(`[recordatorio-auto] falló para lista_espera#${r.id}:`, err.message)
        }
    }

    if (rows.length > 0) {
        console.log(`[recordatorio-auto] ${enviados}/${rows.length} recordatorios enviados`)
    }

    return { revisados: rows.length, enviados }
}
