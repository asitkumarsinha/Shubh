import { chromium } from 'playwright';
import ffmpegPath from 'ffmpeg-static';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const framesDir = path.join(root, 'frames');
const outFile = path.resolve(root, '../../frontend/public/assets/demo/mystoreshubs-demo.mp4');
const base = process.env.APP_URL || 'http://localhost:3000';
const shots = [];

function run(args) {
  const result = spawnSync(ffmpegPath, args, { stdio: 'inherit' });
  if (result.status !== 0) throw new Error('ffmpeg failed');
}

async function snap(page, caption) {
  await page.waitForTimeout(900);
  const file = path.join(framesDir, `${String(shots.length + 1).padStart(2, '0')}.png`);
  await page.screenshot({ path: file, fullPage: false });
  shots.push({ file, caption });
}

function signingSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const envFile = path.resolve(root, '../../backend/.env');
  if (!fs.existsSync(envFile)) return 'medishop-secret-key-2026';
  const line = fs.readFileSync(envFile, 'utf8').split(/\r?\n/).find((row) => row.startsWith('JWT_SECRET='));
  return line ? line.slice('JWT_SECRET='.length).trim() : 'medishop-secret-key-2026';
}

function loadSessions() {
  const require = createRequire(path.resolve(root, '../../backend/package.json'));
  const Database = require('better-sqlite3');
  const jwt = require('jsonwebtoken');
  const db = new Database(path.resolve(root, '../../backend/data/mystoreshubs.db'), { readonly: true, fileMustExist: true });
  const secret = signingSecret();
  const sessions = {};
  for (const email of ['user@shubhsurgical.com', 'admin@shubhsurgical.com', 'asitkumarsinha@gmail.com']) {
    const row = db.prepare('SELECT id, name, email, role, phone, address, tenant_id, client_group FROM users WHERE email = ?').get(email);
    if (!row) continue;
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
    sessions[email] = {
      token: jwt.sign(
        { id: user.id, name: user.name, email: user.email, role: user.role, tenant_id: user.tenant_id },
        secret,
        { expiresIn: '2h' }
      ),
      user,
    };
  }
  db.close();
  return sessions;
}

async function signIn(page, session) {
  await page.goto(`${base}/login`, { waitUntil: 'load' });
  await page.evaluate((value) => {
    localStorage.setItem('medishop_token', value.token);
    localStorage.setItem('medishop_user', JSON.stringify(value.user));
  }, session);
}

async function signOut(page) {
  await page.evaluate(() => {
    localStorage.removeItem('medishop_token');
    localStorage.removeItem('medishop_user');
  });
}

async function main() {
  fs.rmSync(framesDir, { recursive: true, force: true });
  fs.mkdirSync(framesDir, { recursive: true });
  fs.mkdirSync(path.dirname(outFile), { recursive: true });

  const sessions = loadSessions();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  });
  await context.addInitScript(() => {
    sessionStorage.setItem('msh_welcome_seen', '1');
    localStorage.setItem('msh_bot_hidden', '1');
    localStorage.setItem('msh_super_menu_pinned', '1');
    localStorage.setItem('msh_admin_menu_pinned', '1');
    localStorage.setItem('msh_client_menu_pinned', '1');
  });
  const page = await context.newPage();

  await page.goto(`${base}/login`, { waitUntil: 'load' });
  await page.getByRole('heading', { name: /Your store, Your clients, Your hub/ }).waitFor({ timeout: 8000 });
  await snap(page, 'Your store, Your clients, Your hub');

  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await page.locator('#login-panel').waitFor({ timeout: 8000 });
  await snap(page, 'Sign in');

  const blackBtn = page.locator('app-theme-toggle button', { hasText: 'Black' }).first();
  if (await blackBtn.count()) {
    await blackBtn.click();
    await snap(page, 'Black theme');
    const whiteBtn = page.locator('app-theme-toggle button', { hasText: 'White' }).first();
    if (await whiteBtn.count()) await whiteBtn.click();
  }

  await page.goto(`${base}/shoppingmall`, { waitUntil: 'load' });
  await page.locator('select[name="mallGroup"]').waitFor({ timeout: 8000 }).catch(() => undefined);
  await snap(page, 'Shopping Mall — open a store free');

  const group = page.locator('select[name="mallGroup"]');
  if (await group.count()) {
    await group.selectOption('Electronics').catch(() => undefined);
    await snap(page, 'Groups — Electronics, Fashion, Home, Groceries');
    await group.selectOption('').catch(() => undefined);
  }

  const mallSearch = page.locator('input[name="catalogueSearch"]');
  if (await mallSearch.count()) {
    await mallSearch.fill('earbuds');
    await page.getByText('Wireless Earbuds').first().waitFor({ timeout: 8000 }).catch(() => undefined);
    await snap(page, 'Search every store');
  }

  await page.goto(`${base}/register`, { waitUntil: 'load' });
  await snap(page, 'Register your store');

  await page.goto(`${base}/demo`, { waitUntil: 'load' });
  await page.locator('video').waitFor({ timeout: 8000 }).catch(() => undefined);
  await snap(page, 'Demo video');

  await page.goto(`${base}/store/city-mall`, { waitUntil: 'load' });
  await page.locator('select[name="storeGroup"]').waitFor({ timeout: 8000 }).catch(() => undefined);
  await snap(page, 'City Mall — groups inside a store');

  await page.goto(`${base}/store/city-mall/wireless-earbuds-19`, { waitUntil: 'load' });
  await snap(page, 'A page for each product');

  await page.goto(`${base}/store/shubh-surgical`, { waitUntil: 'load' });
  await page.getByRole('button', { name: 'Copy a message to share' }).waitFor({ timeout: 8000 }).catch(() => undefined);
  await snap(page, 'Share the store link');

  const client = sessions['user@shubhsurgical.com'];
  await signIn(page, client);
  const require = createRequire(path.resolve(root, '../../backend/package.json'));
  const Database = require('better-sqlite3');
  const db = new Database(path.resolve(root, '../../backend/data/mystoreshubs.db'), { readonly: true, fileMustExist: true });
  const product = db.prepare(
    'SELECT id, name, price, image, stock FROM medicines WHERE tenant_id = ? ORDER BY id LIMIT 1'
  ).get(client.user.tenant_id);
  db.close();
  await page.evaluate(({ userId, product }) => {
    localStorage.setItem(`medishop_cart_user_${userId}`, JSON.stringify([{
      medicineId: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      quantity: 1,
      stock: product.stock,
    }]));
  }, { userId: client.user.id, product });
  await page.goto(`${base}/cart`, { waitUntil: 'load' });
  const delivery = page.locator('input[value="delivery"]');
  if (await delivery.count()) {
    await delivery.check();
    await page.locator('textarea[name="deliveryAddress"]').fill('12 Market Road, Jaipur');
  }
  await snap(page, 'Delivery address or pickup');

  await page.goto(`${base}/orders`, { waitUntil: 'load' });
  let orderLink = page.locator('a[href^="/orders/"]').first();
  if (!(await orderLink.count())) {
    await page.goto(`${base}/cart`, { waitUntil: 'load' });
    const pickup = page.locator('input[value="pickup"]');
    if (await pickup.count()) await pickup.check();
    const place = page.locator('button.continue');
    if (await place.count()) {
      await place.click();
      await page.waitForURL(/\/orders\/\d+/, { timeout: 20000 }).catch(() => undefined);
    }
    await page.goto(`${base}/orders`, { waitUntil: 'load' });
    orderLink = page.locator('a[href^="/orders/"]').first();
  }
  await snap(page, 'My orders');

  if (await orderLink.count()) {
    await orderLink.click();
    await page.waitForLoadState('load');
    await snap(page, 'Order bill for the client');
  }

  await page.goto(`${base}/account`, { waitUntil: 'load' });
  await snap(page, 'My account');

  await page.goto(`${base}/shop`, { waitUntil: 'load' });
  await snap(page, 'Shop — print or download the product grid');

  await signOut(page);
  await signIn(page, sessions['admin@shubhsurgical.com']);
  await page.goto(`${base}/admin/hubs`, { waitUntil: 'load' });
  await snap(page, 'Hub home — orders, revenue, and pending bills');

  await page.goto(`${base}/admin/stores`, { waitUntil: 'load' });
  await snap(page, 'Hub stores — print or download the list');

  await page.goto(`${base}/admin/clone`, { waitUntil: 'load' });
  await snap(page, 'Clone a store under a unique name');

  await page.goto(`${base}/admin/products`, { waitUntil: 'load' });
  await snap(page, 'Product list');

  await page.goto(`${base}/admin/AddProducts`, { waitUntil: 'load' });
  await page.getByRole('heading', { name: /product/i }).first().waitFor({ timeout: 8000 }).catch(() => undefined);
  await snap(page, 'Add or import products');

  await page.goto(`${base}/admin/orders`, { waitUntil: 'load' });
  await snap(page, 'Hub orders — print or download the grid');

  const hubBill = page.locator('a[href^="/orders/"]').first();
  if (await hubBill.count()) {
    await hubBill.click();
    await page.waitForLoadState('load');
    await snap(page, 'Invoice from the bill column');
  }

  await page.goto(`${base}/admin/employees`, { waitUntil: 'load' });
  await snap(page, 'Employees — print or download');

  await page.goto(`${base}/admin/reports`, { waitUntil: 'load' });
  await snap(page, 'Reports — sales, low stock, and email');

  await signOut(page);
  await signIn(page, sessions['asitkumarsinha@gmail.com']);
  await page.goto(`${base}/settings`, { waitUntil: 'load' });
  await snap(page, 'Settings, hits, and Generate Ads');

  for (const scene of [
    ['/dashboard', 'Dashboard'],
    ['/stores', 'Stores'],
    ['/hubs', 'Hubs'],
    ['/users', 'Users'],
    ['/billing', 'Apps and billing'],
    ['/plans', 'Plans'],
    ['/feedback', 'Feedback'],
    ['/health', 'System health'],
    ['/reports', 'Platform reports'],
  ]) {
    await page.goto(`${base}${scene[0]}`, { waitUntil: 'load' });
    await snap(page, scene[1]);
  }

  await browser.close();

  const captioned = [];
  shots.forEach((shot, index) => {
    const dest = path.join(framesDir, `c${String(index + 1).padStart(2, '0')}.png`);
    const text = shot.caption.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, '').replace(/,/g, '\\,');
    run([
      '-y',
      '-i', shot.file,
      '-vf',
      `drawbox=x=0:y=ih-78:w=iw:h=78:color=0x0f3d4c@0.88:t=fill,drawtext=fontfile=C\\\\:/Windows/Fonts/arial.ttf:text='${text}':fontcolor=white:fontsize=30:x=28:y=h-52`,
      dest,
    ]);
    captioned.push(dest);
  });

  const listPath = path.join(framesDir, 'list.txt');
  const lines = [];
  for (const file of captioned) {
    lines.push(`file '${file.replace(/\\/g, '/')}'`);
    lines.push('duration 3.2');
  }
  lines.push(`file '${captioned[captioned.length - 1].replace(/\\/g, '/')}'`);
  fs.writeFileSync(listPath, lines.join('\n'));

  const seconds = captioned.length * 3.2 + 0.4;
  const audio = path.join(framesDir, 'music.wav');
  run([
    '-y',
    '-f', 'lavfi',
    '-i',
    `aevalsrc=0.07*sin(2*PI*262*t)+0.055*sin(2*PI*330*t)+0.045*sin(2*PI*392*t)+0.03*sin(2*PI*523*t)*(0.55+0.45*sin(2*PI*0.2*t)):s=44100:d=${seconds}`,
    audio,
  ]);

  run([
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', listPath,
    '-i', audio,
    '-shortest',
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '28',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-movflags', '+faststart',
    outFile,
  ]);

  const served = path.resolve(root, '../../backend/public/assets/demo/mystoreshubs-demo.mp4');
  fs.mkdirSync(path.dirname(served), { recursive: true });
  fs.copyFileSync(outFile, served);
  console.log(`frames ${captioned.length}`);
  console.log(`video ${outFile}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
