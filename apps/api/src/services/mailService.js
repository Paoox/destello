/**
 * Destello API — Mail Service
 * Envío de correos transaccionales con Resend.
 *
 * Variables de entorno requeridas:
 *   RESEND_API_KEY → re_xxxxxxxxxxxxxxxxxxxx
 *   MAIL_FROM      → (opcional) "Destello ✦ <hola@destello.courses>"
 */

import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM = process.env.MAIL_FROM || 'Destello ✦ <hola@destello.courses>'

// ── Función base de envío ─────────────────────────────────────────────────────
export async function sendMail({ to, subject, html }) {
    const { data, error } = await resend.emails.send({
        from:    FROM,
        to:      Array.isArray(to) ? to : [to],
        subject,
        html,
    })

    if (error) throw new Error(error.message ?? 'Error al enviar correo')
    return data
}

// ── Templates específicos ─────────────────────────────────────────────────────

export async function sendConfirmacionTaller({ to, nombre, taller, chispaCode }) {
    const subject = `¡Tu lugar en "${taller.nombre}" está confirmado! ✦`
    const html    = templateConfirmacionTaller({ nombre, taller, chispaCode })
    return sendMail({ to, subject, html })
}

export async function sendResplandor({ to, nombre, code }) {
    const subject = `Tu Resplandor de acceso a Destello ✦`
    const html    = templateResplandor({ nombre, code })
    return sendMail({ to, subject, html })
}

// ── Base HTML ─────────────────────────────────────────────────────────────────

function templateBase(content) {
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#0A0A0E; font-family:'Segoe UI',Arial,sans-serif; color:#FAF7F2; }
    .wrapper { max-width:600px; margin:0 auto; padding:32px 16px; }
    .card { background:#18181F; border:1px solid #2A2A35; border-radius:20px; overflow:hidden; }

    /* Header */
    .header { background:linear-gradient(135deg,#0D7377 0%,#085e62 100%); padding:40px 40px 36px; text-align:center; }
    .logo-mark { font-size:36px; color:#FAF7F2; letter-spacing:-1px; margin-bottom:2px; }
    .logo-name { font-size:28px; font-weight:900; color:#FAF7F2; letter-spacing:-0.04em; }
    .logo-sub  { font-size:11px; color:rgba(255,255,255,0.6); letter-spacing:0.12em; text-transform:uppercase; margin-top:6px; }

    /* Body */
    .body { padding:40px; }
    .greeting { font-size:24px; font-weight:800; color:#FAF7F2; margin-bottom:14px; }
    .text { font-size:15px; color:#9CA3B0; line-height:1.75; margin-bottom:20px; }

    /* Code box */
    .code-box { background:linear-gradient(135deg,#0D7377,#085e62); border-radius:14px; padding:28px 24px; text-align:center; margin:28px 0; }
    .code { font-size:30px; font-weight:900; letter-spacing:0.14em; color:#FAF7F2; font-family:'Courier New',monospace; }
    .code-hint { font-size:12px; color:rgba(255,255,255,0.6); margin-top:10px; }

    /* Info rows */
    .info-box { background:#1E1E28; border:1px solid #2A2A35; border-radius:12px; padding:24px; margin:20px 0; }
    .section-label { font-size:11px; font-weight:700; color:#0D9EA3; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:14px; }
    .info-label { font-size:11px; font-weight:700; color:#0D9EA3; text-transform:uppercase; letter-spacing:0.06em; }
    .info-value { font-size:14px; color:#FAF7F2; }

    /* Steps — usando tabla para compatibilidad Gmail */
    .step-table { width:100%; border-collapse:collapse; margin-bottom:10px; }
    .step-num-cell { width:32px; vertical-align:top; padding-top:1px; }
    .step-num { display:inline-block; background:#0D7377; color:#FAF7F2; border-radius:50%;
                width:26px; height:26px; line-height:26px; text-align:center;
                font-size:12px; font-weight:800; font-family:Arial,sans-serif; }
    .step-text { font-size:14px; color:#9CA3B0; line-height:1.6; padding-left:10px; vertical-align:top; padding-top:3px; }

    /* Payments */
    .pago-box { background:#1A1A24; border:1px solid #2A2A35; border-radius:12px; padding:20px; margin:14px 0; }
    .pago-title { font-size:11px; font-weight:700; color:#D97706; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:12px; }
    .pago-row { margin-bottom:7px; font-size:13px; }
    .pago-key { color:#6B7280; }
    .pago-val { color:#FAF7F2; font-weight:700; font-family:monospace; }

    /* Button */
    .btn-wrap { text-align:center; margin:32px 0 8px; }
    .btn { display:inline-block; padding:15px 36px; background:#0D7377; border-radius:100px;
           color:#FAF7F2 !important; font-weight:800; font-size:15px; text-decoration:none; letter-spacing:0.02em; }

    /* Divider */
    .divider { border:none; border-top:1px solid #2A2A35; margin:28px 0; }

    /* Footer */
    .footer { padding:24px 40px; text-align:center; background:#111118; border-top:1px solid #1E1E28; }
    .footer-text { font-size:12px; color:#4B5563; line-height:1.7; }

    @media (max-width:480px) {
      .body { padding:28px 20px; }
      .header { padding:28px 20px; }
      .code { font-size:23px; }
      .greeting { font-size:20px; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      ${content}
    </div>
    <p style="text-align:center;font-size:11px;color:#374151;margin-top:20px;">
      © 2026 Destello &nbsp;·&nbsp; Todos los derechos reservados
    </p>
  </div>
</body>
</html>`
}

// ── Template: Resplandor ──────────────────────────────────────────────────────

function templateResplandor({ nombre, code }) {
    const nombreCorto = nombre?.split(' ')[0] || 'viajero'

    return templateBase(`
    <div class="header">
      <div class="logo-mark">✦</div>
      <div class="logo-name">Destello</div>
      <div class="logo-sub">Plataforma de aprendizaje inmersivo 3D</div>
    </div>
    <div class="body">
      <div class="greeting">¡Hola, ${nombreCorto}! ✨</div>
      <p class="text">
        Estás a un paso de entrar a Destello. Te enviamos tu <strong style="color:#FAF7F2;">Resplandor</strong> —
        el código único con el que crearás tu cuenta y accederás a tus talleres.
      </p>

      <div class="code-box">
        <div class="code">${code}</div>
        <div class="code-hint">Código de un solo uso &nbsp;·&nbsp; No lo compartas</div>
      </div>

      <p class="section-label">Cómo usar tu Resplandor</p>

      <table class="step-table">
        <tr><td class="step-num-cell"><span class="step-num">1</span></td>
            <td class="step-text">Entra a <strong style="color:#FAF7F2;">destello.courses/acceso</strong></td></tr>
      </table>
      <table class="step-table">
        <tr><td class="step-num-cell"><span class="step-num">2</span></td>
            <td class="step-text">Ingresa el código cuando se te pida.</td></tr>
      </table>
      <table class="step-table">
        <tr><td class="step-num-cell"><span class="step-num">3</span></td>
            <td class="step-text">Crea tu perfil y ¡listo! Ya eres parte de Destello. ✦</td></tr>
      </table>

      <div class="btn-wrap">
        <a href="https://destello.courses/acceso" class="btn">Activar mi Resplandor →</a>
      </div>
    </div>
    <div class="footer">
      <p class="footer-text">
        ¿Tienes dudas? Escríbenos por WhatsApp al <strong style="color:#9CA3B0;">+52 55 7788 8800</strong>
      </p>
    </div>`)
}

// ── Template: Confirmación de taller ─────────────────────────────────────────

function templateConfirmacionTaller({ nombre, taller, chispaCode }) {
    const nombreCorto = nombre?.split(' ')[0] || 'alumno'
    const fechaStr    = taller.fecha_disponible
        ? new Date(taller.fecha_disponible).toLocaleDateString('es-MX', {
            weekday:'long', day:'numeric', month:'long', year:'numeric' })
        : null
    const precioStr = taller.precio > 0 ? `$${taller.precio} MXN` : 'Gratuito'

    return templateBase(`
    <div class="header">
      <div class="logo-mark">✦</div>
      <div class="logo-name">Destello</div>
      <div class="logo-sub">Plataforma de aprendizaje inmersivo 3D</div>
    </div>
    <div class="body">
      <div class="greeting">¡Hola, ${nombreCorto}! 🎉</div>
      <p class="text">
        Tu lugar en el siguiente taller ha sido <strong style="color:#FAF7F2;">confirmado</strong>.
        Aquí tienes todo lo que necesitas para prepararte:
      </p>

      <!-- Detalle del taller -->
      <div class="info-box">
        <p class="section-label">Detalles del taller</p>
        <table width="100%" style="border-collapse:collapse;">
          <tr>
            <td style="padding-bottom:10px;width:90px;vertical-align:top;">
              <span class="info-label">Taller</span>
            </td>
            <td style="padding-bottom:10px;vertical-align:top;">
              <span style="font-size:16px;font-weight:800;color:#FAF7F2;">${taller.nombre}</span>
            </td>
          </tr>
          ${fechaStr ? `<tr>
            <td style="padding-bottom:10px;vertical-align:top;"><span class="info-label">Fecha</span></td>
            <td style="padding-bottom:10px;vertical-align:top;"><span class="info-value">${fechaStr}</span></td>
          </tr>` : ''}
          ${taller.horario ? `<tr>
            <td style="padding-bottom:10px;vertical-align:top;"><span class="info-label">Horario</span></td>
            <td style="padding-bottom:10px;vertical-align:top;"><span class="info-value">${taller.horario} (CDMX)</span></td>
          </tr>` : ''}
          <tr>
            <td style="vertical-align:top;"><span class="info-label">Inversión</span></td>
            <td style="vertical-align:top;"><span class="info-value">${precioStr}</span></td>
          </tr>
        </table>
      </div>

      ${taller.descripcion ? `
      <p class="section-label">¿Qué aprenderás?</p>
      <p class="text">${taller.descripcion}</p>
      <hr class="divider">` : ''}

      <!-- Chispa -->
      <p class="section-label">Tu código de acceso (Chispa)</p>
      <div class="code-box">
        <div class="code">${chispaCode}</div>
        <div class="code-hint">Guarda este código — lo necesitarás para ingresar al aula</div>
      </div>

      <!-- Pagos -->
      <p class="section-label">Métodos de pago</p>
      <div class="pago-box">
        <p class="pago-title">Transferencia SPEI · Inbursa</p>
        <div class="pago-row"><span class="pago-key">Titular&nbsp;&nbsp;</span><span class="pago-val">Paola Arreola</span></div>
        <div class="pago-row"><span class="pago-key">CLABE&nbsp;&nbsp;&nbsp;</span><span class="pago-val">036180500687558754</span></div>
      </div>
      <div class="pago-box">
        <p class="pago-title">Pago en efectivo</p>
        <div class="pago-row"><span class="pago-key">Tarjeta&nbsp;</span><span class="pago-val">4658 2850 1724 7424</span></div>
        <div class="pago-row"><span class="pago-key">Titular&nbsp;</span><span class="pago-val">Paola Arreola</span></div>
        <p style="font-size:12px;color:#6B7280;margin-top:10px;">
          Walmart · Bodega Aurrera · Sam's Club · OXXO · Sears · Sanborns
        </p>
      </div>
      <p class="text" style="font-size:13px;margin-top:16px;">
        Una vez realizado tu pago, envía tu <strong style="color:#FAF7F2;">comprobante por WhatsApp</strong> para verificarlo.
      </p>

      <hr class="divider">

      <p class="section-label">Siguientes pasos</p>
      <table class="step-table">
        <tr><td class="step-num-cell"><span class="step-num">1</span></td>
            <td class="step-text">Realiza tu pago y envía el comprobante por WhatsApp.</td></tr>
      </table>
      <table class="step-table">
        <tr><td class="step-num-cell"><span class="step-num">2</span></td>
            <td class="step-text">Ingresa a <strong style="color:#FAF7F2;">destello.courses/acceso</strong> y usa tu Chispa
            <code style="background:#2A2A35;padding:2px 7px;border-radius:4px;font-size:13px;">${chispaCode}</code>.</td></tr>
      </table>
      <table class="step-table">
        <tr><td class="step-num-cell"><span class="step-num">3</span></td>
            <td class="step-text">Crea tu perfil y explora la plataforma antes del taller.</td></tr>
      </table>
      <table class="step-table">
        <tr><td class="step-num-cell"><span class="step-num">4</span></td>
            <td class="step-text">El día del taller entra al aula 3D y ¡a aprender! ✦</td></tr>
      </table>

      <div class="btn-wrap">
        <a href="https://destello.courses/acceso" class="btn">Activar mi Chispa →</a>
      </div>
    </div>
    <div class="footer">
      <p class="footer-text">
        ¿Tienes dudas? Escríbenos por WhatsApp al <strong style="color:#9CA3B0;">+52 55 7788 8800</strong><br>
        o responde directamente a este correo.
      </p>
    </div>`)
}