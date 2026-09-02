const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const outboxDir = path.join(__dirname, 'data', 'outbox');
if (!fs.existsSync(outboxDir)) fs.mkdirSync(outboxDir, { recursive: true });

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildHtmlEmail({ to, subject, text }) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:24px;background:#f3faf7;font-family:Segoe UI,Arial,sans-serif;color:#0f2f2a;">
  <div style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #cfe7df;border-radius:16px;padding:24px;">
    <h1 style="margin:0 0 8px;font-size:22px;">MediShop Report</h1>
    <p style="margin:0 0 16px;color:#5b736e;">Sent to ${escapeHtml(to)}</p>
    <pre style="white-space:pre-wrap;font-family:Consolas,monospace;font-size:13px;line-height:1.5;background:#f0fdfa;padding:16px;border-radius:12px;">${escapeHtml(text)}</pre>
  </div>
</body>
</html>`;
}

function saveOutbox({ to, subject, text, html }) {
  const id = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const fileName = `${id}.html`;
  const filePath = path.join(outboxDir, fileName);
  const content = html || buildHtmlEmail({ to, subject, text });
  fs.writeFileSync(filePath, content, 'utf8');

  const meta = {
    id,
    to,
    subject,
    createdAt: new Date().toISOString(),
    fileName,
  };
  fs.writeFileSync(path.join(outboxDir, `${id}.json`), JSON.stringify(meta, null, 2));
  return meta;
}

function listOutbox(limit = 20) {
  if (!fs.existsSync(outboxDir)) return [];
  return fs
    .readdirSync(outboxDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(outboxDir, f), 'utf8')))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, limit);
}

function getOutboxHtml(id) {
  const safe = String(id).replace(/[^a-zA-Z0-9_-]/g, '');
  const filePath = path.join(outboxDir, `${safe}.html`);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf8');
}

function hasSmtpConfig() {
  return !!(process.env.SMTP_HOST || process.env.SMTP_SERVICE || process.env.SMTP_USER);
}

async function createTransporter() {
  if (process.env.SMTP_SERVICE || process.env.SMTP_USER) {
    const service = (process.env.SMTP_SERVICE || 'gmail').toLowerCase();
    if (process.env.SMTP_HOST) {
      return {
        mode: 'smtp',
        transporter: nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: String(process.env.SMTP_SECURE || 'false') === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        }),
      };
    }
    return {
      mode: 'smtp',
      transporter: nodemailer.createTransport({
        service,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      }),
    };
  }

  // No real SMTP configured — Ethereal is preview-only (does NOT deliver to real inboxes)
  const testAccount = await nodemailer.createTestAccount();
  return {
    mode: 'preview',
    transporter: nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    }),
  };
}

async function sendReportEmail({ to, subject, text }) {
  const html = buildHtmlEmail({ to, subject, text });
  const outbox = saveOutbox({ to, subject, text, html });

  const { mode, transporter } = await createTransporter();
  const from =
    process.env.MAIL_FROM ||
    process.env.SMTP_USER ||
    '"MediShop Reports" <reports@medishop.local>';

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info) || null;

  return {
    mode,
    messageId: info.messageId,
    previewUrl,
    outboxId: outbox.id,
    outboxUrl: `/api/reports/outbox/${outbox.id}`,
    delivered: mode === 'smtp',
    message:
      mode === 'smtp'
        ? `Report emailed to ${to}`
        : `Email captured for ${to}. Real inbox delivery needs SMTP in backend/.env — open the outbox/preview link to view it now.`,
  };
}

module.exports = {
  sendReportEmail,
  listOutbox,
  getOutboxHtml,
  hasSmtpConfig,
  outboxDir,
};
