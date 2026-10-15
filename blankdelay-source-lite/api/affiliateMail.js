const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])

let transportPromise = null

const transport = () => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null
  if (!transportPromise) {
    transportPromise = import('nodemailer').then(({ default: nodemailer }) => {
      const port = Number(process.env.SMTP_PORT || 465)
      return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: port === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      })
    })
  }
  return transportPromise
}

export const mailReady = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)

export async function sendWelcomeEmail({ email, name, origin }) {
  const pending = transport()
  if (!pending) return { sent: false, reason: 'not-configured' }
  const mailer = await pending
  const from = process.env.SMTP_FROM || `Blank Delay <${process.env.SMTP_USER}>`
  const dashboard = `${origin}/affiliates`
  const logo = `${origin}/Blank%20Delay%20Logo.png`
  const safeName = escapeHtml(name)
  const subject = 'Welcome to the Blank Delay Affiliate Team'
  const line = 'You earn 10% of every sale that comes through your referral link.'

  await mailer.sendMail({
    from,
    to: email,
    subject,
    text: [
      `${subject}, ${name}.`,
      '',
      line,
      `Open your dashboard to choose your link: ${dashboard}`,
      '',
      'Blank Delay',
    ].join('\n'),
    html: `<!doctype html>
<html>
  <body style="margin:0;background:#000000;font-family:Inter,Segoe UI,Arial,sans-serif;color:#ffffff;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#000000;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;border:1px solid rgba(255,255,255,0.22);border-radius:28px;background:#0a0a0a;">
            <tr>
              <td align="center" style="padding:36px 32px 8px;">
                <img src="${logo}" width="96" height="96" alt="Blank Delay" style="display:block;border:0;" />
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:0 32px;">
                <p style="margin:0;color:rgba(255,255,255,0.5);font-size:11px;letter-spacing:4px;text-transform:uppercase;">Blank Delay</p>
                <h1 style="margin:12px 0 0;font-size:30px;line-height:1.05;letter-spacing:-1px;text-transform:uppercase;">${escapeHtml(subject)}</h1>
                <p style="margin:18px 0 0;color:rgba(255,255,255,0.72);font-size:16px;line-height:1.6;">${safeName}, ${escapeHtml(line)}</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:28px 32px 36px;">
                <a href="${dashboard}" style="display:inline-block;padding:16px 28px;border-radius:999px;background:#ffffff;color:#000000;font-weight:800;font-size:13px;letter-spacing:2px;text-decoration:none;text-transform:uppercase;">Open your dashboard</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
  })
  return { sent: true }
}

export async function sendBanEmail({ email, name, origin }) {
  const pending = transport()
  if (!pending) return { sent: false, reason: 'not-configured' }
  const mailer = await pending
  const from = process.env.SMTP_FROM || `Blank Delay <${process.env.SMTP_USER}>`
  const logo = `${origin}/Blank%20Delay%20Logo.png`
  const safeName = escapeHtml(name || 'there')
  const subject = 'Your Blank Delay affiliate account has been banned'
  const line = "You have been banned for violating the terms of service of our company's policy. Your affiliate link has been removed."

  await mailer.sendMail({
    from,
    to: email,
    subject,
    text: [
      `${subject}.`,
      '',
      `${name || 'Hello'}, ${line}`,
      '',
      'Blank Delay',
    ].join('\n'),
    html: `<!doctype html>
<html>
  <body style="margin:0;background:#000000;font-family:Inter,Segoe UI,Arial,sans-serif;color:#ffffff;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#000000;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;border:1px solid rgba(255,255,255,0.22);border-radius:28px;background:#0a0a0a;">
            <tr>
              <td align="center" style="padding:36px 32px 8px;">
                <img src="${logo}" width="96" height="96" alt="Blank Delay" style="display:block;border:0;" />
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:0 32px 36px;">
                <p style="margin:0;color:rgba(255,255,255,0.5);font-size:11px;letter-spacing:4px;text-transform:uppercase;">Blank Delay</p>
                <h1 style="margin:12px 0 0;font-size:30px;line-height:1.05;letter-spacing:-1px;text-transform:uppercase;">Account banned</h1>
                <p style="margin:18px 0 0;color:rgba(255,255,255,0.72);font-size:16px;line-height:1.6;">${safeName}, ${escapeHtml(line)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
  })
  return { sent: true }
}
