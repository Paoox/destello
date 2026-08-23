/**
 * Destello API — Verificación pública de certificados
 *
 * GET /certificados/:folio → ¿este certificado es real?
 *
 * Es pública a propósito: un certificado sin forma de comprobarlo es una
 * imagen bonita. Quien lo recibe (una escuela, un cliente, alguien en
 * LinkedIn) tiene que poder verificarlo sin tener cuenta en Destello.
 *
 * Por eso mismo devuelve lo MÍNIMO: nombre, taller, fecha y si sigue vigente.
 * **Nunca el correo ni nada de contacto.** El folio lo puede traer cualquiera
 * a quien se lo hayan compartido, y compartir el certificado no debe ser
 * compartir los datos personales de quien lo obtuvo.
 */

import { Router } from 'express'
import * as certificadoService from '../services/certificadoService.js'

const router = Router()

router.get('/:folio', async (req, res, next) => {
    try {
        const cert = await certificadoService.porFolio(req.params.folio)

        // Mismo 404 para "no existe" que para un folio mal escrito: no hay nada
        // que ganar diciéndole a quien prueba folios al azar cuál se acercó.
        if (!cert) {
            return res.status(404).json({
                status:  'error',
                message: 'No encontramos ningún certificado con ese folio',
            })
        }

        if (cert.anulado) {
            return res.json({
                status: 'ok', valido: false,
                message: 'Este certificado fue anulado',
            })
        }

        res.json({
            status: 'ok', valido: true,
            certificado: {
                folio:         cert.folio,
                nombre:        cert.nombre,
                taller:        cert.taller_nombre,
                instructor:    cert.instructor,
                duracionHoras: cert.duracion_horas,
                fecha:         cert.fecha_taller,
                emitido:       cert.created_at,
            },
        })
    } catch (err) { next(err) }
})

export default router
