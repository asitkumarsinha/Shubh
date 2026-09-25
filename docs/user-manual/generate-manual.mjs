import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync, existsSync, copyFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const shotDir = join(__dirname, 'screenshots');
const outPdf = join(__dirname, '..', 'Shubh-Surgical-Training-Manual.pdf');
const helpPdf = join(__dirname, '..', '..', 'frontend', 'public', 'assets', 'help', 'Shubh-Surgical-Training-Manual.pdf');
const BASE = process.env.APP_URL || 'http://localhost:4200';

mkdirSync(shotDir, { recursive: true });
mkdirSync(dirname(helpPdf), { recursive: true });

const shots = {};

async function shot(page, name) {
  const file = join(shotDir, `${name}.png`);
  await page.waitForTimeout(700);
  await page.screenshot({ path: file, fullPage: true });
  shots[name] = file;
}

async function clearAuth(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.removeItem('medishop_token');
    localStorage.removeItem('medishop_user');
    localStorage.removeItem('medishop_cart');
  });
}

async function login(page, email, password) {
  await clearAuth(page);
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

function img(name) {
  const buf = readFileSync(shots[name]);
  return `data:image/png;base64,${buf.toString('base64')}`;
}

function section(title, summary, steps, shotName) {
  const stepsHtml = steps.map((s) => `<li>${s}</li>`).join('');
  return `
    <section class="chapter">
      <h2>${title}</h2>
      <p class="summary">${summary}</p>
      <h3>How to do it</h3>
      <ol>${stepsHtml}</ol>
      <figure>
        <img src="${img(shotName)}" alt="${title}" />
        <figcaption>Screen: ${title}</figcaption>
      </figure>
    </section>`;
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(`${BASE}/medicines`, { waitUntil: 'networkidle' });
await shot(page, 'catalogue');

await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
await shot(page, 'register');

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await shot(page, 'login');

await login(page, 'user@shubhsurgical.com', 'user123');
await page.goto(`${BASE}/medicines`, { waitUntil: 'networkidle' });
await page.waitForSelector('.medicine-item');
await shot(page, 'shop');

const addBtn = page.locator('button:has-text("Add to cart")').first();
if (await addBtn.count()) {
  await addBtn.click();
  await page.waitForTimeout(400);
}

await page.goto(`${BASE}/cart`, { waitUntil: 'networkidle' });
await shot(page, 'cart');

const place = page.locator('button:has-text("Place order")');
if (await place.count()) {
  await place.click();
  await page.waitForURL(/\/orders\/\d+/, { timeout: 20000 }).catch(() => {});
}

await page.waitForTimeout(800);
if (page.url().includes('/orders/')) {
  await shot(page, 'bill');
} else {
  await page.goto(`${BASE}/orders`, { waitUntil: 'networkidle' });
  const view = page.locator('a:has-text("View bill / QR")').first();
  if (await view.count()) {
    await view.click();
    await page.waitForLoadState('networkidle');
    await shot(page, 'bill');
  } else {
    await shot(page, 'bill');
  }
}

await page.goto(`${BASE}/orders`, { waitUntil: 'networkidle' });
await shot(page, 'my-orders');

await login(page, 'admin@shubhsurgical.com', 'admin123');
await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
await shot(page, 'admin-dashboard');

await page.goto(`${BASE}/admin/medicines`, { waitUntil: 'networkidle' });
await shot(page, 'admin-medicines');

await page.goto(`${BASE}/admin/orders`, { waitUntil: 'networkidle' });
await shot(page, 'admin-orders');

await page.goto(`${BASE}/admin/users`, { waitUntil: 'networkidle' });
await shot(page, 'admin-clients');

await page.goto(`${BASE}/admin/employees`, { waitUntil: 'networkidle' });
await shot(page, 'admin-employees-add');

const nameInput = page.locator('input[name="name"]');
if (await nameInput.count()) {
  const stamp = Date.now();
  await nameInput.fill('Training Staff');
  await page.fill('input[name="email"]', `staff.${stamp}@shubhsurgical.local`);
  await page.fill('input[name="phone"]', '9876543210');
  await page.fill('input[name="designation"]', 'Pharmacist');
  await page.fill('input[name="department"]', 'Dispensary');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1200);
}

await page.goto(`${BASE}/admin/employees`, { waitUntil: 'networkidle' });
const viewBtn = page.locator('button:has-text("View")').first();
if (await viewBtn.count()) {
  await viewBtn.click();
  await page.waitForTimeout(800);
}
await shot(page, 'admin-employees-view');

await page.goto(`${BASE}/admin/reports`, { waitUntil: 'networkidle' });
await shot(page, 'admin-reports');

await login(page, 'asitkumarsinha@gmail.com', 'Shivansh2026');
await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
await shot(page, 'super-settings');

await page.goto(`${BASE}/tenants`, { waitUntil: 'networkidle' });
await shot(page, 'super-tenants');

await browser.close();

const required = [
  'catalogue',
  'register',
  'login',
  'shop',
  'cart',
  'bill',
  'my-orders',
  'admin-dashboard',
  'admin-medicines',
  'admin-orders',
  'admin-clients',
  'admin-employees-add',
  'admin-employees-view',
  'admin-reports',
  'super-settings',
  'super-tenants',
];
const missing = required.filter((k) => !existsSync(shots[k]));
if (missing.length) {
  throw new Error(`Missing screenshots: ${missing.join(', ')}`);
}

const today = new Date().toLocaleDateString('en-IN');

const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Shubh Surgical — Training User Manual</title>
  <style>
    @page { size: A4; margin: 16mm 14mm 18mm; }
    * { box-sizing: border-box; }
    body {
      font-family: "Segoe UI", Calibri, Arial, sans-serif;
      color: #1f2933;
      font-size: 11.5pt;
      line-height: 1.45;
      margin: 0;
    }
    .cover {
      page-break-after: always;
      min-height: 240mm;
      padding: 28mm 8mm 0;
      background: linear-gradient(180deg, #0f3d4c 0%, #1a5a6e 55%, #f4f7f8 55%);
      color: #fff;
    }
    .cover h1 { font-size: 32pt; margin: 0 0 8px; letter-spacing: -0.03em; }
    .cover .tag { font-size: 14pt; opacity: 0.92; margin: 0 0 40mm; }
    .cover .meta {
      background: #fff;
      color: #1f2933;
      border-radius: 12px;
      padding: 18px 22px;
      margin-top: 48mm;
    }
    .cover table { width: 100%; border-collapse: collapse; }
    .cover td { padding: 6px 0; border-bottom: 1px solid #e5e7eb; }
    h2 { color: #0f3d4c; font-size: 16pt; margin: 0 0 8px; page-break-after: avoid; }
    h3 { color: #1a5a6e; font-size: 12pt; margin: 14px 0 6px; }
    .chapter { page-break-inside: avoid; margin-bottom: 18px; }
    .summary { background: #eef6f8; border-left: 4px solid #1a5a6e; padding: 8px 12px; margin: 0 0 10px; }
    ol { margin: 0 0 12px; padding-left: 20px; }
    li { margin-bottom: 4px; }
    figure { margin: 8px 0 0; }
    figure img {
      width: 100%;
      border: 1px solid #d1d5db;
      border-radius: 8px;
    }
    figcaption { font-size: 9pt; color: #52606d; margin-top: 4px; }
    .toc { page-break-after: always; }
    .toc ol { font-size: 12pt; }
    .note { background: #fff7ed; border-left: 4px solid #c2410c; padding: 8px 12px; }
    .footer-note { font-size: 9.5pt; color: #52606d; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="cover">
    <p style="letter-spacing:0.18em;text-transform:uppercase;font-size:10pt;opacity:.8">Training document</p>
    <h1>Shubh Surgical</h1>
    <p class="tag">Your Trusted Partner in Health and Wellness.<br/>Complete website user manual</p>
    <div class="meta">
      <table>
        <tr><td><strong>Purpose</strong></td><td>Staff, admin, and customer training</td></tr>
        <tr><td><strong>Website</strong></td><td>http://localhost:4200 (local) / live host URL</td></tr>
        <tr><td><strong>Audience</strong></td><td>Customers, store administrators, and Super Admin</td></tr>
        <tr><td><strong>Version</strong></td><td>3.0 — ${today}</td></tr>
        <tr><td><strong>Help Center</strong></td><td>Admin or Super Admin login → Help Center (opens this PDF)</td></tr>
      </table>
    </div>
  </div>

  <section class="toc">
    <h2>Contents</h2>
    <ol>
      <li>What this website does</li>
      <li>Demo / training logins</li>
      <li>Register</li>
      <li>Sign in</li>
      <li>Browse catalogue and shop</li>
      <li>Cart and place order</li>
      <li>Bill and Checkout QR</li>
      <li>My Orders</li>
      <li>Admin: Help Center</li>
      <li>Admin: Dashboard</li>
      <li>Admin: manage medicines</li>
      <li>Admin: orders desk</li>
      <li>Admin: Clients (add, view, block / allow)</li>
      <li>Admin: Employee (add, view, update, remove)</li>
      <li>Admin: reports</li>
      <li>Super Admin: Settings</li>
      <li>Super Admin: Customers (tenants)</li>
      <li>Order status meaning</li>
      <li>Feature map</li>
      <li>Training checklist</li>
    </ol>
    <p class="footer-note">Screenshots were taken from the live application. Open this file from admin <strong>Help Center</strong> to always use the latest copy.</p>
  </section>

  <section class="chapter">
    <h2>1. What this website does</h2>
    <p class="summary">Shubh Surgical is an online medicine store that can also be sold to multiple customer businesses. Shoppers browse stock, add items to a cart, and place an order. The system creates a bill with a checkout QR. A store administrator verifies payment, approves the order (this creates a Purchase Order), then marks it dispatched. Super Admin customises branding and provisions isolated customer stores.</p>
    <h3>End-to-end flow</h3>
    <ol>
      <li>Customer registers or signs in.</li>
      <li>Customer adds medicines to the cart and clicks <strong>Place order</strong>.</li>
      <li>A bill is created with status <strong>pending</strong> and a Checkout QR is shown.</li>
      <li>Customer pays using the QR (any UPI app).</li>
      <li>Admin opens <strong>Orders</strong>, confirms payment, and chooses <strong>Approve</strong> (PO generated) or <strong>Reject</strong>.</li>
      <li>When stock is packed, admin marks the order <strong>Dispatch</strong>.</li>
    </ol>
    <p class="note">After any successful save (settings, client, employee, medicine, tenant, and similar forms), the site shows a short toast and a save status so staff know the change was stored.</p>
  </section>

  <section class="chapter">
    <h2>2. Demo / training logins</h2>
    <p class="summary">Use these accounts in classroom or UAT. Do not use them as real customer credentials in production.</p>
    <table style="width:100%;border-collapse:collapse;margin:8px 0 12px">
      <tr style="background:#0f3d4c;color:#fff"><th style="text-align:left;padding:8px">Role</th><th style="text-align:left;padding:8px">Email</th><th style="text-align:left;padding:8px">Password</th></tr>
      <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">Store admin</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">admin@shubhsurgical.com</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">admin123</td></tr>
      <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">Customer</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">user@shubhsurgical.com</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">user123</td></tr>
      <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">Super Admin</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">asitkumarsinha@gmail.com</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">Shivansh2026</td></tr>
    </table>
    <p class="note">On Sign in you can tap <strong>Admin demo</strong> or <strong>User demo</strong> to fill these values automatically.</p>
  </section>

  ${section(
    '3. Register',
    'The left panel matches Sign in: heart logo in a circle, brand name, and slogan Your Trusted Partner in Health and Wellness. New customers must register before checkout.',
    [
      'Click <strong>Register</strong> in the top bar.',
      'Enter full name, email, and a password of at least 6 characters.',
      'Optionally add phone and address (used on bills and client records).',
      'Click <strong>Register</strong>. You are signed in and taken to the shop.',
    ],
    'register'
  )}

  ${section(
    '4. Sign in',
    'Returning customers, store admins, and Super Admin use the same Sign in screen. Store admins land on Dashboard. Super Admin lands on Settings. A blocked customer cannot sign in.',
    [
      'Click <strong>Login</strong> in the top bar.',
      'Enter email and password, then click <strong>Sign in</strong>.',
      'If the account is blocked, the site shows: <em>User is blocked now, please contact to admin</em>.',
      'Use <strong>Logout</strong> in the top-right when the session is finished.',
    ],
    'login'
  )}

  ${section(
    '5. Browse catalogue and shop',
    'Guests can open Catalogue without signing in. After login, Shop lets customers add items to the cart. Admins see the catalogue but cannot add to cart.',
    [
      'Guests: open <strong>Catalogue</strong>. Customers: open <strong>Shop</strong>.',
      'Review image, description, price, and stock. Low stock is highlighted.',
      'Click <strong>Add to cart</strong> on each required item.',
      'The Cart badge in the top bar shows how many units are selected.',
    ],
    'shop'
  )}

  ${section(
    '6. Cart and place order',
    'The cart is a wholesale-style order sheet. Quantity can be changed up to available stock. Checkout creates a bill and QR.',
    [
      'Click <strong>Cart</strong> in the top bar.',
      'Adjust Qty or click <strong>Remove</strong> if needed.',
      'Confirm the total, then click <strong>Place order</strong>.',
      'You are taken to the bill page. Status starts as <strong>pending</strong>.',
    ],
    'cart'
  )}

  ${section(
    '7. Bill and Checkout QR',
    'The bill lists medicines, quantities, and total. The Checkout QR is the UPI payment image. After payment, wait for admin approval.',
    [
      'Read the bill number, items, and total amount.',
      'Scan the <strong>Checkout QR</strong> and pay the billed amount.',
      'Keep the bill number handy if the desk asks for confirmation.',
      'Track the pipeline: Pending / QR → Approved → Dispatched.',
    ],
    'bill'
  )}

  ${section(
    '8. My Orders',
    'My Orders lists every bill for the signed-in customer with status, total, and a link back to the QR bill.',
    [
      'Click <strong>My orders</strong> in the top bar.',
      'Find the bill number and current status (pending, approved, dispatched, rejected, or cancelled).',
      'Click <strong>View bill / QR</strong> to reopen payment QR and line items.',
    ],
    'my-orders'
  )}

  ${section(
    '9. Admin: Help Center',
    'After admin or Super Admin login, Help Center sits next to Logout. It opens this training PDF in a new tab so staff always have the latest manual.',
    [
      'Sign in as store admin or Super Admin.',
      'In the top-right, next to Logout, click <strong>Help Center</strong> (question-mark icon).',
      'The latest user manual PDF opens in a new browser tab.',
      'Use it for classroom training and for looking up any screen in this document.',
    ],
    'admin-dashboard'
  )}

  ${section(
    '10. Admin: Dashboard',
    'Dashboard is the store admin landing page. Cards show today’s orders, pending approvals, revenue, low stock, and new clients, with quick actions to approve, restock, or add an employee.',
    [
      'Sign in as store admin. Dashboard opens automatically.',
      'Read the summary cards, then use a pending-order <strong>Approve</strong> action if needed.',
      'Restock a low-stock item from the list, or add an employee from the quick form.',
      'Use the top nav to open Medicines, Orders, Clients, Employee, or Reports.',
    ],
    'admin-dashboard'
  )}

  ${section(
    '11. Admin: manage medicines',
    'Administrators maintain the catalogue: name, description, retail price, optional wholesale price, stock, and pack image. Admins do not shop or checkout.',
    [
      'Sign in as admin. Open <strong>Medicines</strong>.',
      'Fill Upload medicine: name, description, retail price, optional wholesale price, stock, and image file.',
      'Click <strong>Upload</strong>. The item appears on the customer Shop page.',
      'Use <strong>Edit</strong> to change details, or <strong>Delete</strong> to remove a product.',
    ],
    'admin-medicines'
  )}

  ${section(
    '12. Admin: orders desk',
    'This is the dispensary desk. Filter by status, open the bill, and change the order action after payment is verified.',
    [
      'Open <strong>Orders</strong>. Use filters: All, Pending, Approved, Dispatched, Rejected, Cancelled.',
      'Open <strong>Bill / QR</strong> to see items and amount.',
      'On a pending order choose <strong>Approve & generate PO</strong> or <strong>Reject order</strong>.',
      'On an approved order click <strong>Mark ready to dispatch</strong> when packed.',
      'The Action dropdown on the list can also move status (Pending, Approved, Dispatch, Reject).',
    ],
    'admin-orders'
  )}

  ${section(
    '13. Admin: Clients',
    'Clients lists shopper accounts for this store. Admins can add a client, set retail or wholesale, block or allow login, export CSV, and open a client page for notes, spend, order history, and a new password (the old password cannot be viewed).',
    [
      'Open <strong>Clients</strong> in the admin nav.',
      'Use <strong>Add client</strong>: name, email, password (at least 6 characters), optional phone and address, and Retail or Wholesale. Click <strong>Add client</strong>.',
      'Share the password you typed with the client. It is stored encrypted and cannot be recovered later.',
      'In the table, set Group (retail/wholesale) and Access (Allow/Block). Click <strong>View</strong> for history, notes, and to set a replacement password.',
      'Use <strong>Export client list</strong> to download a CSV.',
    ],
    'admin-clients'
  )}

  ${section(
    '14. Admin: Employee — add',
    'Employee sits in the admin nav before Reports. Required fields are name, email, phone, and designation. You may also add department, joining date, address, and a photo.',
    [
      'Open <strong>Employee</strong>.',
      'Stay on <strong>Add</strong> (default). Fill the required fields marked *.',
      'Optionally choose an employee photo (image file).',
      'Click <strong>Add employee</strong>. The record is saved and you can open View.',
    ],
    'admin-employees-add'
  )}

  ${section(
    '15. Admin: Employee — view, update, remove',
    'View shows every employee in a table with photo and details. Update loads the form; Remove deletes the record.',
    [
      'Click <strong>View</strong> to see the full employee list.',
      'Click <strong>Update</strong> on a row to edit details or replace the photo, then save.',
      'Click <strong>Remove</strong> and confirm to delete that employee.',
    ],
    'admin-employees-view'
  )}

  ${section(
    '16. Admin: reports',
    'Reports summarise buyers, revenue, and order statuses. Email report saves or sends a copy for management.',
    [
      'Open <strong>Reports</strong>.',
      'Read the stat cards (buyers, orders, revenue, pending, approved, dispatched, rejected, cancelled).',
      'Scroll for users who purchased, order status details, and top medicines.',
      'Click <strong>Email report</strong>, enter an email id, and Send. Without SMTP, the report is saved to the local outbox and opened as a preview.',
    ],
    'admin-reports'
  )}

  ${section(
    '17. Super Admin: Settings',
    'Super Admin is the platform owner. After login, Settings lets you change the default website title, slogan, logo, and Checkout QR used on the primary store.',
    [
      'Sign in as Super Admin (asitkumarsinha@gmail.com). You land on <strong>Settings</strong>.',
      'Change website title and slogan.',
      'Optionally upload a new logo and Checkout QR image.',
      'Click <strong>Save website settings</strong>. The top bar, login page, shop hero, and bill QR update.',
    ],
    'super-settings'
  )}

  ${section(
    '18. Super Admin: Customers (tenants)',
    'Customers creates isolated businesses you can sell. Each customer gets its own admin login, catalogue, orders, and plan modules. Do not confuse this with store-level Clients (shoppers).',
    [
      'Open <strong>Customers</strong>.',
      'Fill Create customer business: name, slug, first administrator name/email/password, plan, modules, and optional starter catalogue.',
      'Click <strong>Create customer</strong>, then give that admin their login.',
      'On a customer card: change Active/Suspended/Archived, save plan and feature configuration, reset admin password, export backup, or archive after typing the exact name.',
    ],
    'super-tenants'
  )}

  <section class="chapter">
    <h2>19. Order status meaning (quick reference)</h2>
    <table style="width:100%;border-collapse:collapse">
      <tr style="background:#0f3d4c;color:#fff">
        <th style="text-align:left;padding:8px">Status</th>
        <th style="text-align:left;padding:8px">Meaning for training</th>
      </tr>
      <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb"><strong>pending</strong></td><td style="padding:8px;border-bottom:1px solid #e5e7eb">Bill and QR created. Waiting for payment check.</td></tr>
      <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb"><strong>approved</strong></td><td style="padding:8px;border-bottom:1px solid #e5e7eb">Payment accepted. Purchase Order (PO) number is generated.</td></tr>
      <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb"><strong>dispatched</strong></td><td style="padding:8px;border-bottom:1px solid #e5e7eb">Order packed and ready / sent out.</td></tr>
      <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb"><strong>rejected</strong></td><td style="padding:8px;border-bottom:1px solid #e5e7eb">Admin declined the order (for example payment not matching).</td></tr>
      <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb"><strong>cancelled</strong></td><td style="padding:8px;border-bottom:1px solid #e5e7eb">Order cancelled and will not proceed.</td></tr>
    </table>
  </section>

  <section class="chapter">
    <h2>20. Feature map (all screens)</h2>
    <table style="width:100%;border-collapse:collapse">
      <tr style="background:#0f3d4c;color:#fff">
        <th style="text-align:left;padding:8px">Who</th>
        <th style="text-align:left;padding:8px">Menu</th>
        <th style="text-align:left;padding:8px">What it does</th>
      </tr>
      <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">Guest</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">Catalogue, Login, Register</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">Browse stock; create or open an account</td></tr>
      <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">Customer</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">Shop, Cart, My orders</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">Order medicines, pay by QR, track status</td></tr>
      <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">Admin</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">Dashboard</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">Today’s orders, revenue, low stock, quick actions</td></tr>
      <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">Admin</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">Medicines</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">Upload, edit, delete catalogue; retail/wholesale price</td></tr>
      <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">Admin</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">Orders</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">Approve, reject, dispatch bills</td></tr>
      <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">Admin</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">Clients</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">Add shoppers; retail/wholesale; block/allow; notes; password reset; CSV</td></tr>
      <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">Admin</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">Employee</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">Add, view, update, remove staff with photo</td></tr>
      <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">Admin</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">Reports</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">Sales stats and email report</td></tr>
      <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">Admin / Super Admin</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">Help Center</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">Opens this training PDF</td></tr>
      <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">Super Admin</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">Settings</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">Website title, slogan, logo, Checkout QR</td></tr>
      <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">Super Admin</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">Customers</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">Create tenant businesses, plans, modules, backup</td></tr>
    </table>
  </section>

  <section class="chapter">
    <h2>21. Training checklist</h2>
    <ol>
      <li>Open Register and Sign in and confirm matching left branding plus the slogan.</li>
      <li>Register a new customer and confirm Shop + Cart appear (not admin links).</li>
      <li>Add two medicines, change quantity, place order, scan/view Checkout QR.</li>
      <li>Log in as store admin, review Dashboard, find the pending bill, approve it, note the PO, then dispatch.</li>
      <li>Open <strong>Clients</strong>, add a client from the form, block that client, confirm the blocked login message, then Allow again.</li>
      <li>Open a client with <strong>View</strong>, add a note, and set a new password (old password cannot be shown).</li>
      <li>Open <strong>Employee</strong>, add a staff record with photo, View the list, Update, then practise Remove if needed.</li>
      <li>Open Reports and practise Email report (outbox is acceptable in training).</li>
      <li>Log in as Super Admin, change Settings, then open Customers and review tenant cards.</li>
      <li>Click <strong>Help Center</strong> next to Logout and confirm this latest PDF opens.</li>
    </ol>
    <p class="footer-note">End of training manual — Shubh Surgical. Version 3.0 — ${today}.</p>
  </section>
</body>
</html>`;

writeFileSync(join(__dirname, 'manual.html'), html);

const pdfBrowser = await chromium.launch({ headless: true });
const pdfPage = await pdfBrowser.newPage();
await pdfPage.setContent(html, { waitUntil: 'load' });
await pdfPage.pdf({
  path: outPdf,
  format: 'A4',
  printBackground: true,
  margin: { top: '12mm', bottom: '14mm', left: '12mm', right: '12mm' },
});
await pdfBrowser.close();

copyFileSync(outPdf, helpPdf);
console.log('PDF written:', outPdf);
console.log('Help Center copy:', helpPdf);
