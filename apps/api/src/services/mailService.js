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

/**
 * Envía la confirmación de lugar en un taller.
 */
export async function sendConfirmacionTaller({ to, nombre, taller, chispaCode }) {
    const subject = `¡Tu lugar en "${taller.nombre}" está confirmado! ✦`
    const html    = templateConfirmacionTaller({ nombre, taller, chispaCode })
    return sendMail({ to, subject, html })
}

/**
 * Envía un resplandor (código de acceso para crear cuenta).
 */
export async function sendResplandor({ to, nombre, code }) {
    const subject = `Tu Resplandor de acceso a Destello ✦`
    const html    = templateResplandor({ nombre, code })
    return sendMail({ to, subject, html })
}

// ── HTML Templates ────────────────────────────────────────────────────────────

function templateBase(content) {
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0A0A0E; font-family: 'Segoe UI', Arial, sans-serif; color: #FAF7F2; }
    .wrapper { max-width: 600px; margin: 0 auto; padding: 32px 16px; }
    .card { background: #18181F; border: 1px solid #2A2A35; border-radius: 20px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #0D7377 0%, #0a5a5e 100%); padding: 40px 40px 32px; text-align: center; }
    .header-logo { font-size: 32px; font-weight: 800; letter-spacing: -0.03em; color: #FAF7F2; margin-bottom: 6px; }
    .header-sub  { font-size: 13px; color: rgba(255,255,255,0.7); letter-spacing: 0.05em; text-transform: uppercase; }
    .body  { padding: 40px; }
    .greeting { font-size: 22px; font-weight: 700; margin-bottom: 16px; }
    .text { font-size: 15px; color: #9CA3B0; line-height: 1.7; margin-bottom: 20px; }
    .code-box { background: #0D7377; border-radius: 12px; padding: 24px; text-align: center; margin: 28px 0; }
    .code { font-size: 28px; font-weight: 800; letter-spacing: 0.12em; color: #FAF7F2; font-family: 'Courier New', monospace; }
    .code-hint { font-size: 12px; color: rgba(255,255,255,0.65); margin-top: 8px; }
    .info-row { display: flex; gap: 12px; margin-bottom: 12px; align-items: flex-start; }
    .info-label { font-size: 11px; font-weight: 700; color: #0D7377; text-transform: uppercase; letter-spacing: 0.06em; min-width: 80px; padding-top: 2px; }
    .info-value { font-size: 14px; color: #FAF7F2; }
    .divider { border: none; border-top: 1px solid #2A2A35; margin: 28px 0; }
    .section-title { font-size: 12px; font-weight: 700; color: #D97706; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px; }
    .step { display: flex; gap: 12px; margin-bottom: 12px; align-items: flex-start; }
    .step-num { background: #0D7377; color: #FAF7F2; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0; }
    .step-text { font-size: 14px; color: #9CA3B0; line-height: 1.5; }
    .btn { display: inline-block; padding: 14px 32px; background: #0D7377; border-radius: 100px; color: #FAF7F2 !important; font-weight: 700; font-size: 15px; text-decoration: none; margin: 8px 4px; }
    .pago-box { background: #1E1E28; border: 1px solid #2A2A35; border-radius: 12px; padding: 20px; margin: 20px 0; }
    .pago-title { font-size: 12px; font-weight: 700; color: #D97706; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 14px; }
    .pago-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }
    .pago-key { color: #9CA3B0; }
    .pago-val { color: #FAF7F2; font-weight: 600; font-family: monospace; }
    .footer { padding: 24px 40px; text-align: center; background: #13131A; }
    .footer-text { font-size: 12px; color: #4B5563; line-height: 1.6; }
    @media (max-width: 480px) {
      .body { padding: 28px 20px; }
      .header { padding: 28px 20px; }
      .code { font-size: 22px; }
      .greeting { font-size: 19px; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      ${content}
    </div>
    <p style="text-align:center;font-size:11px;color:#374151;margin-top:20px;">
      © 2026 Destello · Todos los derechos reservados
    </p>
  </div>
</body>
</html>`
}

function templateConfirmacionTaller({ nombre, taller, chispaCode }) {
    const nombreCorto = nombre?.split(' ')[0] || 'Alumno'
    const fechaStr    = taller.fecha_disponible
        ? new Date(taller.fecha_disponible).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
        : null
    const precioStr   = taller.precio > 0 ? `$${taller.precio} MXN` : 'Gratuito'

    const content = `
    <div class="header">
      <div class="header-logo">✦ Destello</div>
      <div class="header-sub">Plataforma de aprendizaje inmersivo 3D</div>
    </div>
    <div class="body">
      <div class="greeting">¡Hola, ${nombreCorto}! 🎉</div>
      <p class="text">
        Tu lugar en el siguiente taller ha sido <strong>confirmado</strong>.
        Aquí tienes todos los detalles que necesitas para prepararte:
      </p>

      <!-- Detalle del taller -->
      <div style="background:#1E1E28;border:1px solid #2A2A35;border-radius:12px;padding:24px;margin:20px 0;">
        <p class="section-title">📚 Detalles del taller</p>
        <div class="info-row">
          <span class="info-label">Taller</span>
          <span class="info-value" style="font-size:16px;font-weight:700;color:#FAF7F2;">${taller.nombre}</span>
        </div>
        ${fechaStr ? `
        <div class="info-row">
          <span class="info-label">Fecha</span>
          <span class="info-value">${fechaStr}</span>
        </div>` : ''}
        ${taller.horario ? `
        <div class="info-row">
          <span class="info-label">Horario</span>
          <span class="info-value">${taller.horario} (hora Ciudad de México)</span>
        </div>` : ''}
        <div class="info-row">
          <span class="info-label">Inversión</span>
          <span class="info-value">${precioStr}</span>
        </div>
      </div>

      ${taller.descripcion ? `
      <!-- Resumen -->
      <p class="section-title">✨ ¿Qué aprenderás?</p>
      <p class="text">${taller.descripcion}</p>
      <hr class="divider">
      ` : ''}

      <!-- Código Chispa -->
      <p class="section-title">⚡ Tu código de acceso (Chispa)</p>
      <div class="code-box">
        <div class="code">${chispaCode}</div>
        <div class="code-hint">Guarda este código — lo necesitarás para ingresar al aula</div>
      </div>

      <!-- Métodos de pago -->
      <p class="section-title">💳 Métodos de pago</p>
      <div class="pago-box">
        <p class="pago-title">🏦 Transferencia SPEI (Inbursa)</p>
        <div class="pago-row"><span class="pago-key">Titular</span><span class="pago-val">Paola Arreola</span></div>
        <div class="pago-row"><span class="pago-key">CLABE</span><span class="pago-val">036180500687558754</span></div>
      </div>
      <div class="pago-box">
        <p class="pago-title">🏪 Pago en efectivo</p>
        <div class="pago-row"><span class="pago-key">Número de tarjeta</span><span class="pago-val">4658 2850 1724 7424</span></div>
        <div class="pago-row"><span class="pago-key">Titular</span><span class="pago-val">Paola Arreola</span></div>
        <p style="font-size:12px;color:#9CA3B0;margin-top:8px;">Disponible en: Walmart · Bodega Aurrera · Sam's Club · OXXO · Sears · Sanborns</p>
      </div>
      <p class="text" style="font-size:13px;">
        📸 Una vez realizado tu pago, envía tu <strong>comprobante por WhatsApp</strong> para verificarlo a la brevedad.
      </p>

      <hr class="divider">

      <!-- Siguientes pasos -->
      <p class="section-title">🚀 Siguientes pasos</p>
      <div class="step"><div class="step-num">1</div><div class="step-text">Realiza tu pago y envía el comprobante por WhatsApp.</div></div>
      <div class="step"><div class="step-num">2</div><div class="step-text">Ingresa a <strong>destello.courses/acceso</strong> y usa tu Chispa <code style="background:#2A2A35;padding:2px 6px;border-radius:4px;">${chispaCode}</code>.</div></div>
      <div class="step"><div class="step-num">3</div><div class="step-text">Crea tu perfil y explora la plataforma antes del día del taller.</div></div>
      <div class="step"><div class="step-num">4</div><div class="step-text">El día del taller entra al aula 3D y ¡a aprender! ✨</div></div>

      <div style="text-align:center;margin-top:32px;">
        <a href="https://destello.courses/acceso" class="btn">Activar mi Chispa →</a>
      </div>
    </div>
    <div class="footer">
      <p class="footer-text">
        ¿Tienes dudas? Escríbenos por WhatsApp al <strong>+52 55 7788 8800</strong><br>
        o responde directamente a este correo.
      </p>
    </div>`

    return templateBase(content)
}

function templateResplandor({ nombre, code }) {
    const nombreCorto = nombre?.split(' ')[0] || 'Bienvenido/a'

    const content = `
    <div class="header">
      <div class="header-logo">✦ Destello</div>
      <div class="header-sub">Plataforma de aprendizaje inmersivo 3D</div>
    </div>
    <div class="body">
      <div class="greeting">¡Hola, ${nombreCorto}! 🌟</div>
      <p class="text">
        Estás a un paso de entrar a Destello. Te enviamos tu <strong>Resplandor</strong> —
        el código con el que crearás tu cuenta y accederás a tus talleres.
      </p>

      <div class="code-box">
        <div class="code">${code}</div>
        <div class="code-hint">Este código es de un solo uso · No lo compartas</div>
      </div>

      <p class="section-title">🚀 Cómo usar tu Resplandor</p>
      <div class="step"><div class="step-num">1</div><div class="step-text">Entra a <strong>destello.courses/acceso</strong></div></div>
      <div class="step"><div class="step-num">2</div><div class="step-text">Ingresa el código de arriba cuando se te pida.</div></div>
      <div class="step"><div class="step-num">3</div><div class="step-text">Crea tu perfil y ¡listo! Ya eres parte de Destello. ✨</div></div>

      <div style="text-align:center;margin-top:32px;">
        <a href="https://destello.courses/acceso" class="btn">Activar mi Resplandor →</a>
      </div>
    </div>
    <div class="footer">
      <p class="footer-text">
        ¿Tienes dudas? Escríbenos por WhatsApp al <strong>+52 55 7788 8800</strong>
      </p>
    </div>`

    return templateBase(content)
}