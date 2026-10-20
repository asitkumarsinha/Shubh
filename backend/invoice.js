function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function rupees(value) {
  return `₹${Number(value || 0).toFixed(2)}`;
}

const PAYMENT_LABELS = {
  upi: 'UPI QR',
  cod: 'Cash on delivery',
  counter: 'Card or cash at counter',
};

function renderInvoice(order, store) {
  const storeName = store?.title || store?.name || 'My Stores Hubs';
  const paid = order.payment_status === 'paid';
  const items = order.items || [];
  const rows = items
    .map(
      (item) => `<tr>
        <td>${escapeHtml(item.medicine_name)}</td>
        <td>${Number(item.quantity)}</td>
        <td>${rupees(item.price)}</td>
        <td>${rupees(Number(item.quantity) * Number(item.price))}</td>
      </tr>`
    )
    .join('');
  const discount = Number(order.discount || 0);
  const subtotal = order.subtotal != null ? Number(order.subtotal) : Number(order.total) + discount;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Invoice ${escapeHtml(order.bill_number)}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    body { margin: 0; color: #111827; font: 14px/1.4 Segoe UI, Arial, sans-serif; }
    .sheet { max-width: 180mm; margin: 0 auto; }
    header { display: flex; justify-content: space-between; gap: 16px; border-bottom: 2px solid #0f766e; padding-bottom: 12px; }
    h1 { margin: 0; font-size: 22px; }
    .muted { margin: 2px 0 0; color: #4b5563; }
    .paid { font-weight: 700; letter-spacing: 0.04em; }
    .paid[data-paid="yes"] { color: #047857; }
    .paid[data-paid="no"] { color: #b91c1c; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #e5e7eb; }
    th:nth-child(n + 2), td:nth-child(n + 2) { text-align: right; }
    tfoot td { border: none; font-weight: 700; }
    .total td { font-size: 16px; }
  </style>
</head>
<body>
  <article class="sheet">
    <header>
      <div>
        <h1>${escapeHtml(storeName)}</h1>
        <p class="muted">${escapeHtml(store?.slogan || 'My Stores Hubs')}</p>
      </div>
      <div>
        <strong>Invoice ${escapeHtml(order.bill_number)}</strong>
        <p class="muted">${escapeHtml(order.created_at || '')}</p>
        <p class="paid" data-paid="${paid ? 'yes' : 'no'}">${paid ? 'Paid' : 'Unpaid'}</p>
      </div>
    </header>
    <p><strong>Client</strong> ${escapeHtml(order.user?.name || '')}<br />${escapeHtml(order.user?.email || '')}</p>
    <p class="muted">Payment: ${escapeHtml(PAYMENT_LABELS[order.payment_method] || order.payment_method || '')}</p>
    <p>${order.fulfillment === 'delivery'
      ? `Deliver to ${escapeHtml(order.delivery_address || '')}`
      : 'Collect from the shop'}</p>
    <table>
      <thead>
        <tr><th>Item</th><th>Qty</th><th>Price</th><th>Amount</th></tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        ${discount ? `<tr><td colspan="3">Subtotal</td><td>${rupees(subtotal)}</td></tr>
        <tr><td colspan="3">Discount${order.coupon_code ? ` (${escapeHtml(order.coupon_code)})` : ''}</td><td>−${rupees(discount)}</td></tr>` : ''}
        <tr class="total"><td colspan="3">Total</td><td>${rupees(order.total)}</td></tr>
      </tfoot>
    </table>
  </article>
</body>
</html>`;
}

module.exports = { renderInvoice };
