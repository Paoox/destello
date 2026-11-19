/**
 * Destello API — Una sola regla para "pago confirmado" (19 nov 2026)
 *
 * La usan el aviso a la profe ("Tienes N alumnos registrados", T-44) y la
 * pestaña Detalle talleres del panel. Si cada uno contara a su manera, la
 * profe y Paola verían números distintos para el mismo taller.
 *
 *   · Fuente: `lista_espera.pagado_at` (lo llena "Confirmar pago").
 *   · Una persona cuenta una vez por taller aunque tenga varios renglones.
 *   · Cortesía = tiene pago 'cortesia' y ningún pago verificado con dinero.
 *     Las cortesías NO cuentan como "pagó".
 */

/** Fragmento SQL: ¿el renglón `leId` de lista_espera es cortesía? */
export const SQL_ES_CORTESIA = (leId) => `(
    EXISTS (SELECT 1 FROM pagos p WHERE p.lista_espera_id = ${leId} AND p.metodo = 'cortesia')
    AND NOT EXISTS (SELECT 1 FROM pagos p WHERE p.lista_espera_id = ${leId}
                      AND p.estado = 'verificado' AND COALESCE(p.metodo, '') <> 'cortesia'
                      AND COALESCE(p.monto, 0) > 0))`

/** Fragmento SQL: cuántas personas con pago confirmado (sin cortesías) tiene el taller. */
export const SQL_REGISTRADOS = (tallerCol) => `(
    SELECT COUNT(DISTINCT LOWER(lr.email))::int FROM lista_espera lr
     WHERE lr.taller_id = ${tallerCol}
       AND lr.pagado_at IS NOT NULL
       AND NOT ${SQL_ES_CORTESIA('lr.id')})`
