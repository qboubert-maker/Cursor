const nodemailer = require("nodemailer");
const { getProduct } = require("./products");

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: { user, pass },
  });
}

function buildFulfillmentEmail({ email, productId, keyCode, publicUrl }) {
  const product = getProduct(productId);
  const name = product ? product.name : productId;
  const downloadUrl = product
    ? `${publicUrl}${product.downloadPath}`
    : `${publicUrl}/downloads`;
  const hubUrl = `${publicUrl}/hub`;

  const subject = `Your BlankDelay ${name} — download + license key`;
  const text = `Thanks for your BlankDelay purchase!

Product: ${name}
License key: ${keyCode}

Download BlankDelay Setup (Windows .exe):
${downloadUrl}

1. Run the installer
2. Open BlankDelay Product Hub
3. Launch ${name}
4. Paste your license key and activate

Product hub: ${hubUrl}

If this email landed in spam, mark it as Not Spam.
Need help? Discord: https://discord.gg/cJafcE7y5W
`;

  const html = `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#111">
    <h1 style="margin:0 0 8px">BlankDelay</h1>
    <p style="color:#444">Thanks for your purchase.</p>
    <p><strong>Product:</strong> ${name}</p>
    <p style="font-size:18px"><strong>License key:</strong><br>
      <code style="background:#f2f2f2;padding:8px 12px;display:inline-block;letter-spacing:1px">${keyCode}</code>
    </p>
    <p>
      <a href="${downloadUrl}" style="background:#111;color:#fff;padding:12px 18px;text-decoration:none;border-radius:6px;display:inline-block">
        Download BlankDelay Setup.exe
      </a>
    </p>
    <p style="color:#555;font-size:14px">Install → open Product Hub → launch ${name} → paste your key → activate.</p>
    <p style="color:#777;font-size:13px">Hub: <a href="${hubUrl}">${hubUrl}</a><br>
    Discord: <a href="https://discord.gg/cJafcE7y5W">https://discord.gg/cJafcE7y5W</a></p>
  </div>`;

  return { subject, text, html, downloadUrl };
}

function smtpConfigured() {
  const host = process.env.SMTP_HOST || "";
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS || "";
  if (!host || !user || !pass) return false;
  // Treat placeholder example values as "not configured"
  if (user.includes("your@") || pass.includes("your-app-password") || pass === "your-app-password") {
    return false;
  }
  return true;
}

async function sendFulfillmentEmail({ email, productId, keyCode }) {
  const publicUrl = (process.env.PUBLIC_URL || "http://localhost:3000").replace(/\/$/, "");
  const payload = buildFulfillmentEmail({ email, productId, keyCode, publicUrl });

  if (!smtpConfigured()) {
    console.warn("[email] SMTP not configured — email NOT sent. Key still assigned.");
    console.warn(`[email] Would send to ${email}: key=${keyCode} download=${payload.downloadUrl}`);
    return { sent: false, reason: "smtp_not_configured", ...payload };
  }

  const transporter = getTransporter();
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to: email,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });
    return { sent: true, ...payload };
  } catch (err) {
    console.error("[email] send failed:", err.message);
    return { sent: false, reason: err.message, ...payload };
  }
}

module.exports = {
  sendFulfillmentEmail,
  buildFulfillmentEmail,
  getTransporter,
};
