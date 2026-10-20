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

function buildHtmlEmail({ to, subject, text, title = 'Shubh Surgical Report' }) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:24px;background:#f3faf7;font-family:Segoe UI,Arial,sans-serif;color:#0f2f2a;">
  <div style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #cfe7df;border-radius:16px;padding:24px;">
    <h1 style="margin:0 0 8px;font-size:22px;">${escapeHtml(title)}</h1>
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

const envPath = path.join(__dirname, '.env');

function mailConfigPath() {
  if (process.env.SQLITE_PATH) {
    return path.join(path.dirname(process.env.SQLITE_PATH), 'mail.env');
  }
  return envPath;
}

function readEnvFile(file) {
  const current = {};
  if (!fs.existsSync(file)) return current;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
    if (match) current[match[1]] = match[2];
  }
  return current;
}

readEnvFile(mailConfigPath());

function hasSmtpConfig() {
  return !!(process.env.SMTP_USER && process.env.SMTP_PASS);
}

function smtpError() {
  const err = new Error('Enter the Gmail address and app password in the send box. Send then delivers to the address you type.');
  err.status = 400;
  return err;
}

function saveSmtpAccount({ user, pass }) {
  const email = String(user || '').trim().toLowerCase();
  const password = String(pass || '').replace(/\s+/g, '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
    const err = new Error('Enter the Gmail address and its 16-character app password.');
    err.status = 400;
    throw err;
  }

  const file = mailConfigPath();
  const current = readEnvFile(file);
  current.SMTP_SERVICE = 'gmail';
  current.SMTP_USER = email;
  current.SMTP_PASS = password;
  current.MAIL_FROM = `"My Stores Hubs <${email}>"`;
  const text = Object.entries(current)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${text}\n`);

  process.env.SMTP_SERVICE = 'gmail';
  process.env.SMTP_USER = email;
  process.env.SMTP_PASS = password;
  process.env.MAIL_FROM = `My Stores Hubs <${email}>`;
}

async function createTransporter() {
  if (!hasSmtpConfig() || !process.env.SMTP_PASS) throw smtpError();
  const service = (process.env.SMTP_SERVICE || 'gmail').toLowerCase();
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || 'false') === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return nodemailer.createTransport({
    service,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendOrderNotice({ to, subject, text, html, filename }) {
  const body = html || buildHtmlEmail({ to, subject, text, title: 'My Stores Hubs' });
  const attachments = html && filename
    ? [{ filename, content: html, contentType: 'text/html; charset=utf-8' }]
    : undefined;
  const outbox = saveOutbox({ to, subject, text, html: body });
  if (!hasSmtpConfig() || !process.env.SMTP_PASS) {
    return {
      delivered: false,
      outboxId: outbox.id,
      outboxUrl: `/api/reports/outbox/${outbox.id}`,
      message: `Order email for ${to} was saved. Add the Gmail app password on Reports so it reaches that inbox.`,
    };
  }
  try {
    const transporter = await createTransporter();
    const from = process.env.MAIL_FROM || process.env.SMTP_USER || '"My Stores Hubs" <orders@mystoreshubs.local>';
    const info = await transporter.sendMail({ from, to, subject, text, html: body, attachments });
    return {
      delivered: true,
      messageId: info.messageId,
      outboxId: outbox.id,
      outboxUrl: `/api/reports/outbox/${outbox.id}`,
      message: `Order email sent to ${to}`,
    };
  } catch (err) {
    return {
      delivered: false,
      outboxId: outbox.id,
      outboxUrl: `/api/reports/outbox/${outbox.id}`,
      message: err.message,
    };
  }
}

async function sendReportEmail({ to, subject, text }) {
  const html = buildHtmlEmail({ to, subject, text });
  const outbox = saveOutbox({ to, subject, text, html });
  const transporter = await createTransporter();
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  const info = await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });

  return {
    mode: 'smtp',
    messageId: info.messageId,
    previewUrl: null,
    outboxId: outbox.id,
    outboxUrl: `/api/reports/outbox/${outbox.id}`,
    delivered: true,
    message: `Report emailed to ${to}`,
  };
}

module.exports = {
  sendReportEmail,
  sendOrderNotice,
  saveSmtpAccount,
  listOutbox,
  getOutboxHtml,
  hasSmtpConfig,
  outboxDir,
};
