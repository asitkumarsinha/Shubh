import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync, existsSync, copyFileSync } from 'fs';
import { createRequire } from 'module';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const shotDir = join(__dirname, 'screenshots');
const outPdf = join(__dirname, '..', 'My-Store-Hub-Training-Manual.pdf');
const helpPdf = join(
  __dirname,
  '..',
  '..',
  'frontend',
  'public',
  'assets',
  'help',
  'My-Store-Hub-Training-Manual.pdf'
);
const BASE = process.env.APP_URL || 'http://localhost:4200';

mkdirSync(shotDir, { recursive: true });
mkdirSync(dirname(helpPdf), { recursive: true });

const shots = {};

async function shot(page, name, selector) {
  console.log('shot:', name);
  await page.waitForTimeout(700);
  const file = join(shotDir, `${name}.png`);
  if (selector) {
    const el = page.locator(selector).first();
    await el.scrollIntoViewIfNeeded().catch(() => {});
    await el.screenshot({ path: file }).catch(async () => {
      await page.screenshot({ path: file, fullPage: true });
    });
  } else {
    await page.screenshot({ path: file, fullPage: true });
  }
  shots[name] = file;
}

async function clearAuth(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'load' });
  await page.evaluate(() => {
    localStorage.removeItem('medishop_token');
    localStorage.removeItem('medishop_user');
  });
}

async function openSignIn(page) {
  const panel = page.locator('#login-panel');
  if (await panel.count()) return;
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await panel.waitFor({ timeout: 8000 });
}

function signingSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const envFile = join(__dirname, '..', '..', 'backend', '.env');
  if (!existsSync(envFile)) return 'medishop-secret-key-2026';
  const line = readFileSync(envFile, 'utf8').split(/\r?\n/).find((row) => row.startsWith('JWT_SECRET='));
  return line ? line.slice('JWT_SECRET='.length).trim() : 'medishop-secret-key-2026';
}

function sessionFor(email) {
  const require = createRequire(join(__dirname, '..', '..', 'backend', 'package.json'));
  const Database = require('better-sqlite3');
  const jwt = require('jsonwebtoken');
  const db = new Database(join(__dirname, '..', '..', 'backend', 'data', 'mystoreshubs.db'), {
    readonly: true,
    fileMustExist: true,
  });
  const row = db
    .prepare('SELECT id, name, email, role, phone, address, tenant_id, client_group FROM users WHERE email = ?')
    .get(email);
  db.close();
  if (!row) throw new Error(`No account for ${email}`);
  const user = {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    phone: row.phone,
    address: row.address,
    tenant_id: row.tenant_id,
    client_group: row.client_group === 'wholesale' ? 'wholesale' : 'retail',
  };
  return {
    token: jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role, tenant_id: user.tenant_id },
      signingSecret(),
      { expiresIn: '2h' }
    ),
    user,
  };
}

async function signInStored(page, email) {
  const session = sessionFor(email);
  await page.goto(`${BASE}/login`, { waitUntil: 'load' });
  await page.evaluate((value) => {
    localStorage.setItem('medishop_token', value.token);
    localStorage.setItem('medishop_user', JSON.stringify(value.user));
  }, session);
}

async function login(page, email, password) {
  await clearAuth(page);
  await page.goto(`${BASE}/login`, { waitUntil: 'load' });
  await openSignIn(page);
  await page.fill('#login-panel input[name="email"]', email);
  await page.fill('#login-panel input[name="password"]', password);
  await page.click('#login-panel button.login-btn');
  await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

function img(name) {
  const buf = readFileSync(shots[name]);
  return `data:image/png;base64,${buf.toString('base64')}`;
}

function section(number, title, summary, steps, shotName) {
  const stepsHtml = steps.map((s) => `<li>${s}</li>`).join('');
  return `
    <section class="chapter">
      <h2>${number}. ${title}</h2>
      <p class="summary">${summary}</p>
      <h3>How to do it</h3>
      <ol>${stepsHtml}</ol>
      <figure>
        <img src="${img(shotName)}" alt="${title}" />
        <figcaption>Screen: ${title}</figcaption>
      </figure>
    </section>`;
}

const reuseShots = process.env.REUSE_SHOTS === '1';
if (reuseShots) {
  for (const name of [
    'catalogue', 'register', 'register-sent', 'login', 'login-black-theme', 'shop', 'cart', 'bill',
    'my-orders', 'admin-dashboard', 'admin-products', 'admin-orders', 'admin-clients',
    'admin-employees-add', 'admin-employees-view', 'admin-reports', 'super-settings',
    'super-tenants', 'super-feedback',
  ]) {
    const file = join(shotDir, `${name}.png`);
    if (existsSync(file)) shots[name] = file;
  }
} else {
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(() => {
  sessionStorage.setItem('msh_welcome_seen', '1');
  localStorage.setItem('msh_bot_hidden', '1');
});
const page = await context.newPage();

// ---------- Guest screens ----------
await page.goto(`${BASE}/shoppingmall`, { waitUntil: 'load' });
await shot(page, 'catalogue');

await page.goto(`${BASE}/register`, { waitUntil: 'load' });
await shot(page, 'register');
const stamp = Date.now();
await page.fill('input[name="name"]', 'Training Contact');
await page.fill('input[name="email"]', `training.${stamp}@example.com`);
await page.fill('input[name="phone"]', '9876500000');
await page.fill('textarea[name="remark"]', 'Interested in a demo walkthrough of My Stores Hubs.');
await page.click('button.login-btn');
await page.waitForTimeout(1000);
await shot(page, 'register-sent');

await page.goto(`${BASE}/login`, { waitUntil: 'load' });
await page.getByRole('heading', { name: /Your store, Your clients, Your hub/ }).waitFor({ timeout: 8000 });
await shot(page, 'login-home');
await openSignIn(page);
await shot(page, 'login');

// Theme toggle demonstration
const blackBtn = page.locator('app-theme-toggle button', { hasText: 'Black' }).first();
if (await blackBtn.count()) {
  await blackBtn.click();
  await page.waitForTimeout(500);
  await shot(page, 'login-black-theme');
  const whiteBtn = page.locator('app-theme-toggle button', { hasText: 'White' }).first();
  if (await whiteBtn.count()) {
    await whiteBtn.click();
    await page.waitForTimeout(400);
  }
}

// ---------- Client (shopper) screens ----------
// The shopper password on this database is no longer the seed password, so the
// same short-lived session the demo video uses is applied instead.
await signInStored(page, 'user@shubhsurgical.com');
await page.goto(`${BASE}/shop`, { waitUntil: 'load' });
await page.waitForSelector('.product', { timeout: 10000 }).catch(() => {});
await shot(page, 'shop');

const addBtn = page.locator('.product button:not([disabled])').first();
if (await addBtn.count()) {
  await addBtn.click();
  await page.waitForTimeout(400);
}

await page.goto(`${BASE}/cart`, { waitUntil: 'load' });
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
  await page.goto(`${BASE}/orders`, { waitUntil: 'load' });
  const view = page.locator('a:has-text("View bill")').first();
  if (await view.count()) {
    await view.click();
    await page.waitForLoadState('networkidle');
    await shot(page, 'bill');
  } else {
    await shot(page, 'bill');
  }
}

await page.goto(`${BASE}/orders`, { waitUntil: 'load' });
await shot(page, 'my-orders');

// ---------- Customer (store admin) screens ----------
await login(page, 'admin@shubhsurgical.com', 'admin123');
await page.goto(`${BASE}/admin/customers_tenats`, { waitUntil: 'load' });
await shot(page, 'admin-dashboard');

await page.goto(`${BASE}/admin/Products`, { waitUntil: 'load' });
await shot(page, 'admin-products');

await page.goto(`${BASE}/admin/orders`, { waitUntil: 'load' });
await shot(page, 'admin-orders');

await page.goto(`${BASE}/admin/users`, { waitUntil: 'load' });
await shot(page, 'admin-clients');

await page.goto(`${BASE}/admin/employees`, { waitUntil: 'load' });
await shot(page, 'admin-employees-add');
const viewBtn = page.locator('button:has-text("View")').first();
if (await viewBtn.count()) {
  await viewBtn.click();
  await page.waitForTimeout(600);
}
await shot(page, 'admin-employees-view');

await page.goto(`${BASE}/admin/reports`, { waitUntil: 'load' });
await shot(page, 'admin-reports');

// ---------- Super Admin screens ----------
await login(page, 'asitkumarsinha@gmail.com', 'Shivansh2026');
await page.goto(`${BASE}/settings`, { waitUntil: 'load' });
await shot(page, 'super-settings');

await page.goto(`${BASE}/tenants`, { waitUntil: 'load' });
await shot(page, 'super-tenants');

await page.goto(`${BASE}/feedback`, { waitUntil: 'load' });
await page.waitForTimeout(500);
await shot(page, 'super-feedback');

await browser.close();
}

const required = [
  'catalogue',
  'register',
  'register-sent',
  'login',
  'shop',
  'cart',
  'bill',
  'my-orders',
  'admin-dashboard',
  'admin-products',
  'admin-orders',
  'admin-clients',
  'admin-employees-add',
  'admin-employees-view',
  'admin-reports',
  'super-settings',
  'super-tenants',
  'super-feedback',
];
const missing = required.filter((k) => !existsSync(shots[k]));
if (missing.length) {
  throw new Error(`Missing screenshots: ${missing.join(', ')}`);
}
const hasLoginBlack = existsSync(shots['login-black-theme']);

const today = new Date().toLocaleDateString('en-IN');
const logoSrc = `data:image/jpeg;base64,${readFileSync(join(__dirname, 'cover-logo.jpg')).toString('base64')}`;
const flowSrc = `data:image/jpeg;base64,${readFileSync(join(__dirname, 'flow-diagram.jpg')).toString('base64')}`;

const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>My Stores Hubs — User Manual</title>
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
    .cover-logo {
      display: block;
      width: 46mm;
      height: auto;
      margin: 2mm auto 5mm;
      border: 0;
      border-radius: 8px;
    }
    .cover .tag { font-size: 14pt; opacity: 0.92; margin: 0 0 10mm; }
    .cover .meta {
      background: #fff;
      color: #1f2933;
      border-radius: 12px;
      padding: 18px 22px;
      margin-top: 12mm;
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
    .flow-page {
      page-break-before: always;
      page-break-after: always;
    }
    .flow-page img {
      display: block;
      width: 100%;
      height: auto;
      border: 0;
      border-radius: 8px;
    }
    .toc { page-break-after: always; }
    .toc ol { font-size: 12pt; }
    .note { background: #fff7ed; border-left: 4px solid #c2410c; padding: 8px 12px; }
    .footer-note { font-size: 9.5pt; color: #52606d; margin-top: 20px; }
    table.ref { width: 100%; border-collapse: collapse; margin: 8px 0 12px; }
    table.ref th { text-align: left; padding: 8px; background: #0f3d4c; color: #fff; }
    table.ref td { padding: 8px; border-bottom: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="cover">
    <p style="letter-spacing:0.18em;text-transform:uppercase;font-size:10pt;opacity:.8">User manual</p>
    <h1>My Stores Hubs</h1>
    <img class="cover-logo" src="${logoSrc}" alt="My Stores Hubs logo" />
    <p class="tag">Your name, your products, your customers.<br/>A complete, step-by-step guide to every screen</p>
    <div class="meta">
      <table>
        <tr><td><strong>Purpose</strong></td><td>Help a brand-new user understand and use the website</td></tr>
        <tr><td><strong>Website</strong></td><td>http://localhost:4200 (local) / your live host URL</td></tr>
        <tr><td><strong>Audience</strong></td><td>Shoppers (Client), store owners (Customer), and the Super Admin</td></tr>
        <tr><td><strong>Version</strong></td><td>5.0 — ${today}</td></tr>
        <tr><td><strong>Open this manual</strong></td><td>Sign-in page → <strong>Demo</strong> button, or after login → <strong>Help Center</strong></td></tr>
      </table>
    </div>
  </div>

  <section class="flow-page">
    <img src="${flowSrc}" alt="My Stores Hubs flow: Super Admin creates Hubs, Hubs create Products, Stores and Employees, and Stores shop, add to cart and view order reports." />
  </section>

  <section class="toc">
    <h2>Contents</h2>
    <ol>
      <li>What My Stores Hubs does</li>
      <li>Website features and access roles</li>
      <li>Browse the Shopping Mall (guest catalogue)</li>
      <li>Register Me (contact request)</li>
      <li>Sign in, Theme, and Language</li>
      <li>Shop and add to cart</li>
      <li>Cart, payment, and place order</li>
      <li>Bill and order status</li>
      <li>My Orders</li>
      <li>Customer: Dashboard</li>
      <li>Customer: manage products</li>
      <li>Customer: orders desk</li>
      <li>Customer: Clients</li>
      <li>Customer: Employee</li>
      <li>Customer: Reports</li>
      <li>Super Admin: Settings</li>
      <li>Super Admin: Customers &amp; tenants</li>
      <li>Super Admin: Feedback &amp; contact requests</li>
      <li>Order status meaning</li>
      <li>Feature map (all screens)</li>
      <li>Getting-started checklist</li>
    </ol>
    <p class="footer-note">All screenshots were captured from the live application. Open this file from the Sign in page <strong>Demo</strong> button (or admin <strong>Help Center</strong>) to always use the latest copy.</p>
  </section>

  <section class="chapter">
    <h2>1. What My Stores Hubs does</h2>
    <p class="summary">My Stores Hubs is a multi-tenant commerce platform: shoppers browse stock, add items to a cart, and place an order. The system creates a bill, and the store collects payment (QR, cash on delivery, or at the counter). A store owner verifies the order, approves it (this generates a Purchase Order), then marks it dispatched. The Super Admin provisions and brands each store independently.</p>
    <h3>End-to-end flow</h3>
    <ol>
      <li>A visitor browses the public Shopping Mall, or signs in with an existing account.</li>
      <li>The shopper adds products to the cart and clicks <strong>Place order</strong>.</li>
      <li>A bill is created with status <strong>pending</strong>, together with a payment method (QR, cash on delivery, or pay at counter).</li>
      <li>The store owner opens <strong>Orders</strong>, confirms payment, and chooses <strong>Approve</strong> (a Purchase Order is generated) or <strong>Reject</strong>.</li>
      <li>When the order is packed, the store owner marks it <strong>Dispatch</strong>.</li>
    </ol>
    <p class="note">New visitors who are not ready to create an account can use <strong>Register Me</strong> on the Sign in page to leave their name, email, phone, and a note — this creates a contact request that only the Super Admin can see on the Feedback page.</p>
  </section>

  <section class="chapter">
    <h2>2. Website features and access roles</h2>
    <p class="summary">The site separates shopping, store operations, and platform management into three roles. On the sign-in page the title bar says <strong>Login</strong>. After sign-in, the header shows the person's name and role.</p>
    <table class="ref">
      <tr><th>Role (shown in header)</th><th>Main features</th><th>Where they land after sign-in</th></tr>
      <tr><td><strong>Client</strong> (shopper)</td><td>Browse the Shopping Mall, Shop, Cart, checkout, and My Orders</td><td>Shopping Mall</td></tr>
      <tr><td><strong>Customer</strong> (store owner)</td><td>Dashboard, Products, Orders, Clients, Employee, Reports</td><td>Dashboard</td></tr>
      <tr><td><strong>Super Admin</strong></td><td>Settings, Customers &amp; tenants, Feedback — provision and brand every store</td><td>Settings</td></tr>
    </table>
    <p class="note">Each store (a "Customer" business) is fully isolated — its branding, logo, checkout QR, product catalogue, clients, employees, and orders never mix with another store's data.</p>
  </section>

  ${section(
    3,
    'Browse the Shopping Mall (guest catalogue)',
    'The Shopping Mall is open to everyone, signed in or not. Store cards show the store name and recent order count. Email and mobile stay on the hub screens. One search box looks through every store.',
    [
      'Open <strong>Shopping Mall</strong> from the title bar, or go to <code>/shoppingmall</code>.',
      'Pick a store. Its products load beside the store list.',
      'Type in <strong>Search every store</strong>. A match from another store still appears, with that store’s name.',
      'Open a product for its own page. The title includes the price in rupees.',
    ],
    'catalogue'
  )}

  ${section(
    4,
    'Register Me (contact request)',
    'The Register Me form on the Sign in page does not create a login — it sends a short contact request (name, email, phone, and a note) that only the Super Admin can read and action on the Feedback page. This is the easiest way for a new visitor to ask for access or help.',
    [
      'On the Sign in page, click <strong>Register Me</strong>.',
      'Fill in your full name, email, phone, and a short note about what you need.',
      'Click <strong>Submit</strong>. A confirmation message appears on screen.',
      'The Super Admin sees the request on the <strong>Feedback</strong> page under Contact requests and marks it Pending or Done.',
    ],
    'register-sent'
  )}

  ${section(
    5,
    'Sign in, Theme, and Language',
    'The sign-in page opens on the centered line “Your store, Your clients, Your hub - My Stores Hubs”, with Free hub, Your store, and Your clients. The sign-in form stays hidden until Login is clicked. Who We Are — MyStoresHubs stays further down the page.',
    [
      'Open the sign-in page. The store line is centered.',
      'Click <strong>Login</strong> in the title bar. The store line hides and the <strong>Log In</strong> form appears in the center.',
      'Click <strong>Login</strong> again to hide the form and bring the store line back.',
      'On the form, enter email and password, then click <strong>Login Now</strong>. Use <strong>Remember Me</strong> or <strong>Forgot Password?</strong> if needed.',
      'Use White or Black for the theme, and the language menu for English, Hindi, Spanish, French, or Chinese.',
    ],
    'login-home'
  )}

  <section class="chapter">
    <h2>5b. The sign-in form</h2>
    <p class="summary">Click <strong>Login</strong> in the title bar. The store line hides and this form is centered. Click <strong>Login</strong> again to return to the store line.</p>
    <figure>
      <img src="${img('login')}" alt="Sign-in form" />
      <figcaption>Screen: Log In form</figcaption>
    </figure>
  </section>

  ${
    hasLoginBlack
      ? `<section class="chapter">
      <h2>5a. Black theme example</h2>
      <p class="summary">Selecting <strong>Black</strong> inverts every page — including the embedded architecture guide — to a dark theme. Photos, logos, and QR codes stay in their true colours. Selecting <strong>White</strong> reverts instantly.</p>
      <figure>
        <img src="${img('login-black-theme')}" alt="Black theme" />
        <figcaption>Screen: Sign in page in Black theme</figcaption>
      </figure>
    </section>`
      : ''
  }

  ${section(
    6,
    'Shop and add to cart',
    'After signing in as a Client, <strong>Shop</strong> shows the current store’s catalogue with images, price, and live stock. Adding an item puts it straight into the Cart.',
    [
      'Sign in with a Client (shopper) account. The left menu shows Shop, Cart, and My orders.',
      'Open <strong>Shop</strong> and use the search box if needed.',
      'Click <strong>Add to cart</strong> on each item you want. The button disables automatically when stock is zero.',
      'The Cart icon in the side menu shows a live count of items selected.',
    ],
    'shop'
  )}

  ${section(
    7,
    'Cart, payment, and place order',
    'The Cart lets you adjust quantity (up to available stock), remove items, choose a payment method, and optionally apply a discount code before placing the order.',
    [
      'Open <strong>Cart</strong> from the side menu.',
      'Change <strong>Qty</strong> or click <strong>Remove</strong> on any line.',
      'Pick a payment method: <strong>UPI / QR</strong>, <strong>Cash on delivery</strong>, or <strong>Pay at counter</strong>.',
      'Optionally enter a discount code, then click <strong>Place order</strong>.',
    ],
    'cart'
  )}

  ${section(
    8,
    'Bill and order status',
    'Placing an order opens the bill page: item list, total, payment method, and (for UPI) the Checkout QR. A visual pipeline shows where the order currently stands.',
    [
      'Read the bill number, items, and total amount.',
      'If you chose UPI, scan the <strong>Checkout QR</strong> and pay the billed amount; for cash on delivery or pay-at-counter, simply wait for the store to confirm.',
      'Track the pipeline: Pending → Approved → Dispatched.',
      'While the order is still pending, you can click <strong>Cancel order</strong> if you change your mind.',
    ],
    'bill'
  )}

  ${section(
    9,
    'My Orders',
    'My Orders lists every bill placed by the signed-in Client, with status and a link back to the bill.',
    [
      'Open <strong>My orders</strong> from the side menu.',
      'Find the bill number and current status (pending, approved, dispatched, rejected, or cancelled).',
      'Click <strong>View bill</strong> to reopen the item list and payment details.',
    ],
    'my-orders'
  )}

  ${section(
    10,
    'Customer: Dashboard',
    'Dashboard is the store owner’s landing page after sign-in. Summary cards show today’s orders, pending approvals, revenue, low stock, and new clients, with quick actions to approve an order, restock an item, or add an employee without leaving the page.',
    [
      'Sign in with a Customer (store owner) account — Dashboard opens automatically.',
      'Read the summary cards, then click <strong>Approve</strong> on a pending order if needed.',
      'Restock a low-stock item directly from the list, or add a new employee using the quick form.',
      'Use the left menu to open Products, Orders, Clients, Employee, or Reports.',
    ],
    'admin-dashboard'
  )}

  ${section(
    11,
    'Customer: manage products',
    'Products is where the store owner maintains the catalogue shown to shoppers: name, description, retail price, optional wholesale price, stock, and a pack image.',
    [
      'Open <strong>Products</strong> from the left menu.',
      'Fill in the Upload product form — name, description, price, optional wholesale price, stock, and an image — then click <strong>Upload</strong>.',
      'The product immediately appears in the Shopping Mall and Shop pages.',
      'Use <strong>Edit</strong> to update a product, or <strong>Delete</strong> to remove it.',
    ],
    'admin-products'
  )}

  ${section(
    12,
    'Customer: orders desk',
    'Orders is the operational desk: filter by status, open the bill, and move each order through the approval pipeline once payment is verified.',
    [
      'Open <strong>Orders</strong>. Use the filters: All, Pending, Approved, Dispatched, Rejected, Cancelled.',
      'Click <strong>Bill / QR</strong> to review items and the amount for any order.',
      'Use the <strong>Action</strong> dropdown on each row to move the order between Pending, Approved, Dispatch, and Reject.',
      'Discount codes for the store can be added or removed from the Discount codes panel at the bottom of this page.',
    ],
    'admin-orders'
  )}

  ${section(
    13,
    'Customer: Clients',
    'Clients lists every shopper account that belongs to this store. The store owner can add a new client, set Retail or Wholesale pricing, Allow or Block login, and open a client record for order history and a password reset.',
    [
      'Open <strong>Clients</strong> from the left menu.',
      'Use <strong>Add client</strong>: full name, email, a password of at least 6 characters, optional phone and address, and Retail or Wholesale group.',
      'Share the password you typed with the client — it is stored encrypted and cannot be recovered later.',
      'In the table, change <strong>Group</strong> (Retail/Wholesale) and <strong>Access</strong> (Allow/Block) with the dropdowns, or click <strong>View</strong> for history and a new password.',
      'Click <strong>Export client list</strong> at the top to download a CSV of every client.',
    ],
    'admin-clients'
  )}

  ${section(
    14,
    'Customer: Employee',
    'Employee keeps a record of staff working at this store, including an optional photo. The page has two modes — Add (or Update) and View.',
    [
      'Open <strong>Employee</strong> from the left menu. It opens on the Add form by default.',
      'Fill the required fields (marked *): full name, email, phone, and designation. Department, joining date, address, and a photo are optional.',
      'Click <strong>Add employee</strong> to save.',
      'Switch to <strong>View</strong> to see the full employee table; use <strong>Update</strong> to edit a record or <strong>Remove</strong> to delete it.',
    ],
    'admin-employees-view'
  )}

  ${section(
    15,
    'Customer: Reports',
    'Reports summarises buyers, revenue, and order status for this store, and can email a copy of the report.',
    [
      'Open <strong>Reports</strong> from the left menu.',
      'Read the stat cards: buyers, orders, revenue, pending, approved, dispatched, rejected, cancelled.',
      'Scroll down for the list of buyers, order status details, and the best-selling products.',
      'Order and report mail is kept on the server until Reports has a Gmail address and a Gmail app password. After those are saved, the report can be sent.',
    ],
    'admin-reports'
  )}

  ${section(
    16,
    'Super Admin: Settings',
    'Settings is the Super Admin’s branding workspace. Pick a customer (store) first — the form then shows only that store’s title, slogan, Login Initial, logo, checkout QR, theme colour, and heading font.',
    [
      'Sign in as Super Admin. You land on <strong>Settings</strong>.',
      'Choose the target store from the <strong>Customer</strong> dropdown — its current branding loads into the form.',
      'Set the <strong>Login Initial</strong> (for example <code>@shubhsurgical</code>). When a visitor types an email containing that text on Sign in, this store’s branding loads automatically, before login.',
      'Update the website title, slogan, logo, checkout QR, theme colour, and heading font as needed.',
      'Click <strong>Save customer settings</strong> — only the selected store is affected; every other store keeps its own look.',
    ],
    'super-settings'
  )}

  ${section(
    17,
    'Super Admin: Customers &amp; tenants',
    'Customers &amp; tenants is where the Super Admin provisions brand-new, fully isolated store businesses, each with its own admin login, plan, modules, and usage limits. Do not confuse a "Customer" (a store business) with the "Clients" (shoppers) listed inside each store.',
    [
      'Open <strong>Customers &amp; tenants</strong>.',
      'Fill in the Create customer business form: business name, slug, the first administrator’s name/email/password, plan, billing details, and the modules to include (Wholesale, Employees, Reports, QR checkout, Coupons, Prescriptions).',
      'Click <strong>Create customer</strong>, then securely share the new administrator’s login with that store owner.',
      'On any customer card, change its status (Active/Suspended/Archived), open the details panel to edit plan/price/payment/theme/modules, reset the admin password, export a backup, or archive the store.',
    ],
    'super-tenants'
  )}

  ${section(
    18,
    'Super Admin: Feedback &amp; contact requests',
    'Feedback is only visible to the Super Admin. It lists every Register Me contact request and every website feedback note, each with an Action dropdown (Pending / Done) so nothing gets lost.',
    [
      'Open <strong>Feedback</strong>.',
      'Review the <strong>Contact requests</strong> table — name, email, phone, and remark from the Register Me form.',
      'Review the <strong>Website feedback</strong> table for general notes left by visitors.',
      'Use the <strong>Action</strong> dropdown on each row to mark a request <strong>Pending</strong> or <strong>Done</strong> as it is handled.',
    ],
    'super-feedback'
  )}

  <section class="chapter">
    <h2>19. Order status meaning (quick reference)</h2>
    <table class="ref">
      <tr><th>Status</th><th>Meaning</th></tr>
      <tr><td><strong>pending</strong></td><td>Bill created. Waiting for payment to be checked by the store.</td></tr>
      <tr><td><strong>approved</strong></td><td>Payment accepted. A Purchase Order (PO) number is generated.</td></tr>
      <tr><td><strong>dispatched</strong></td><td>Order packed and sent out / ready for pickup.</td></tr>
      <tr><td><strong>rejected</strong></td><td>Store declined the order (for example, payment did not match).</td></tr>
      <tr><td><strong>cancelled</strong></td><td>Order was cancelled and will not proceed.</td></tr>
    </table>
  </section>

  <section class="chapter">
    <h2>20. Feature map (all screens)</h2>
    <table class="ref">
      <tr><th>Who</th><th>Menu</th><th>What it does</th></tr>
      <tr><td>Guest</td><td>Shopping Mall, Sign in, Register Me</td><td>Browse every store’s catalogue; sign in; or leave a contact request without an account</td></tr>
      <tr><td>Client</td><td>Shop, Cart, My orders</td><td>Order products, pay, and track order status</td></tr>
      <tr><td>Customer</td><td>Dashboard</td><td>Today’s orders, revenue, low stock, quick actions</td></tr>
      <tr><td>Customer</td><td>Products</td><td>Upload, edit, delete products; retail/wholesale price</td></tr>
      <tr><td>Customer</td><td>Orders</td><td>Approve, reject, or dispatch bills</td></tr>
      <tr><td>Customer</td><td>Clients</td><td>Add shoppers; retail/wholesale; block/allow; CSV export</td></tr>
      <tr><td>Customer</td><td>Employee</td><td>Add, view, update, remove staff, with photo</td></tr>
      <tr><td>Customer</td><td>Reports</td><td>Sales statistics and email report</td></tr>
      <tr><td>Customer / Super Admin</td><td>Help Center</td><td>Opens this user manual PDF</td></tr>
      <tr><td>Super Admin</td><td>Settings</td><td>Per-customer branding, theme, and website hit count</td></tr>
      <tr><td>Super Admin</td><td>Customers &amp; tenants</td><td>Create store businesses, plans, modules, backups</td></tr>
      <tr><td>Super Admin</td><td>Feedback</td><td>Contact requests and website feedback, each with an Action status</td></tr>
    </table>
  </section>

  <section class="chapter">
    <h2>21. Getting-started checklist</h2>
    <ol>
      <li>Open the Sign in page and confirm the brand logo, title, and slogan look correct.</li>
      <li>Try the Theme switch (Black/White) and the language switcher.</li>
      <li>Open the Shopping Mall and browse at least one store’s catalogue without signing in.</li>
      <li>Sign in as a Client, add two products to the cart, choose a payment method, and place the order.</li>
      <li>Sign in as a Customer (store owner), open Dashboard, approve the pending order, then mark it dispatched from Orders.</li>
      <li>Open Clients, add a test client, Block it, confirm the blocked sign-in message, then Allow it again.</li>
      <li>Open Employee, add a staff record, switch to View, and try Update.</li>
      <li>Open Reports and try Email report.</li>
      <li>Sign in as Super Admin, open Settings and change a store’s theme colour, then open Customers &amp; tenants.</li>
      <li>Submit a Register Me request from Sign in, then confirm it appears on the Super Admin Feedback page and can be marked Done.</li>
    </ol>
    <p class="footer-note">End of user manual — My Stores Hubs. Version 5.0 — ${today}.</p>
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
console.log('Help Center / Demo copy:', helpPdf);
