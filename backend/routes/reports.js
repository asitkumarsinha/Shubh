const express = require('express');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { sendReportEmail, listOutbox, getOutboxHtml, hasSmtpConfig } = require('../mail');

const router = express.Router();

function buildReport() {
  const summary = db
    .prepare(
      `SELECT
         COUNT(*) AS totalOrders,
         COALESCE(SUM(total), 0) AS totalRevenue,
         SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
         SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
         SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
         SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected,
         SUM(CASE WHEN status = 'dispatched' THEN 1 ELSE 0 END) AS dispatched,
         COUNT(DISTINCT user_id) AS uniqueBuyers
       FROM orders`
    )
    .get();

  const buyers = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.phone, u.address,
              COUNT(o.id) AS orderCount,
              COALESCE(SUM(o.total), 0) AS totalSpent
       FROM users u
       INNER JOIN orders o ON o.user_id = u.id
       WHERE u.role = 'user'
       GROUP BY u.id
       ORDER BY totalSpent DESC`
    )
    .all();

  const orders = db
    .prepare(
      `SELECT o.id, o.bill_number, o.po_number, o.total, o.status, o.created_at,
              u.name AS userName, u.email AS userEmail, u.phone AS userPhone
       FROM orders o
       JOIN users u ON u.id = o.user_id
       ORDER BY o.created_at DESC`
    )
    .all();

  const topMedicines = db
    .prepare(
      `SELECT medicine_name, SUM(quantity) AS qtySold, SUM(quantity * price) AS revenue
       FROM order_items
       GROUP BY medicine_name
       ORDER BY qtySold DESC
       LIMIT 10`
    )
    .all();

  return { summary, buyers, orders, topMedicines };
}

function formatReportText(report) {
  const lines = [
    '=== Shubh Surgical Sales Report ===',
    '',
    `Total Orders: ${report.summary.totalOrders}`,
    `Unique Buyers: ${report.summary.uniqueBuyers}`,
    `Total Revenue: ₹${Number(report.summary.totalRevenue).toFixed(2)}`,
    `Pending: ${report.summary.pending} | Approved: ${report.summary.approved} | Dispatched: ${report.summary.dispatched} | Rejected: ${report.summary.rejected} | Cancelled: ${report.summary.cancelled}`,
    '',
    '--- Buyers ---',
  ];
  for (const b of report.buyers) {
    lines.push(
      `${b.name} (${b.email}) | Orders: ${b.orderCount} | Spent: ₹${Number(b.totalSpent).toFixed(2)} | Phone: ${b.phone || '-'}`
    );
  }
  lines.push('', '--- Orders ---');
  for (const o of report.orders) {
    lines.push(
      `${o.bill_number} | ${o.userName} | ₹${Number(o.total).toFixed(2)} | ${o.status} | PO: ${o.po_number || '-'} | ${o.created_at}`
    );
  }
  lines.push('', '--- Top Medicines ---');
  for (const m of report.topMedicines) {
    lines.push(
      `${m.medicine_name} | Qty: ${m.qtySold} | Revenue: ₹${Number(m.revenue).toFixed(2)}`
    );
  }
  return lines.join('\n');
}

router.get('/', authenticate, requireAdmin, (_req, res) => {
  res.json({
    ...buildReport(),
    mailConfigured: hasSmtpConfig(),
  });
});

router.get('/outbox', authenticate, requireAdmin, (_req, res) => {
  res.json(listOutbox());
});

router.get('/outbox/:id', authenticate, requireAdmin, (req, res) => {
  const html = getOutboxHtml(req.params.id);
  if (!html) return res.status(404).send('Outbox email not found');
  res.type('html').send(html);
});

router.post('/email', authenticate, requireAdmin, async (req, res) => {
  const { email } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: 'Valid email id is required' });
  }

  try {
    const report = buildReport();
    const text = formatReportText(report);
    const result = await sendReportEmail({
      to: email,
      subject: `Shubh Surgical Report - ${new Date().toLocaleDateString()}`,
      text,
    });

    res.json({
      message: result.message,
      messageId: result.messageId,
      mode: result.mode,
      delivered: result.delivered,
      previewUrl: result.previewUrl,
      outboxId: result.outboxId,
      outboxUrl: result.outboxUrl,
      mailConfigured: hasSmtpConfig(),
    });
  } catch (err) {
    console.error('Email error:', err);
    res.status(500).json({
      message: 'Failed to send report email',
      error: err.message,
      hint: 'For real inbox delivery, set SMTP_USER and SMTP_PASS (Gmail App Password) in backend/.env then restart the API.',
    });
  }
});

module.exports = router;
