const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shubh-tenant-test-'));
process.env.SQLITE_PATH = path.join(tempDir, 'test.db');

const app = require('../server');
const db = require('../db');

function request(server, method, urlPath, { token, body } = {}) {
  const payload = body == null ? null : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: server.address().port,
        path: urlPath,
        method,
        headers: {
          ...(payload
            ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
            : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString();
          let parsed = text;
          try {
            parsed = text ? JSON.parse(text) : null;
          } catch {
            parsed = text;
          }
          resolve({ status: res.statusCode, body: parsed, headers: res.headers });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function login(server, email, password) {
  const res = await request(server, 'POST', '/api/auth/login', { body: { email, password } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body;
}

test('multi-tenant customer isolation', async (t) => {
  const server = app.listen(0);
  t.after(() => {
    server.close();
    db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  await t.test('rejects the shortened Super Admin email', async () => {
    const res = await request(server, 'POST', '/api/auth/login', {
      body: { email: 'asitkumarsinh@gmail.com', password: 'Shivansh2026' },
    });
    assert.equal(res.status, 401);
  });

  await t.test('Super Admin signs in with the stored account', async () => {
    const session = await login(server, 'asitkumarsinha@gmail.com', 'Shivansh2026');
    assert.equal(session.user.role, 'super_admin');
    t.superToken = session.token;
  });

  await t.test('a store admin cannot create a customer', async () => {
    const admin = await login(server, 'admin@shubhsurgical.com', 'admin123');
    const res = await request(server, 'POST', '/api/tenants', {
      token: admin.token,
      body: {
        name: 'Blocked Store',
        adminName: 'Nobody',
        adminEmail: 'nobody@blocked.test',
        adminPassword: 'secret1',
      },
    });
    assert.equal(res.status, 403);
  });

  await t.test('Super Admin creates a customer with a login initial', async () => {
    const res = await request(server, 'POST', '/api/tenants', {
      token: t.superToken,
      body: {
        name: 'Acme Store',
        adminName: 'Acme Admin',
        adminEmail: 'admin@acme.test',
        adminPassword: 'acme123',
        login_initial: '@acme',
        website_title: 'Acme Store',
        website_slogan: 'Acme products for Acme customers.',
        theme_color: '#112233',
        font_family: 'IBM Plex Sans',
        seedSampleData: false,
      },
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.admin_email, 'admin@acme.test');
    assert.equal(res.body.login_initial, '@acme');
    assert.notEqual(res.body.id, 1);
    t.acmeId = res.body.id;
  });

  await t.test('an email containing the login initial loads that customer brand', async () => {
    const matched = await request(server, 'GET', '/api/settings?email=buyer%40acme.test');
    assert.equal(matched.status, 200);
    assert.equal(matched.body.title, 'Acme Store');
    assert.equal(matched.body.slogan, 'Acme products for Acme customers.');
    assert.equal(matched.body.theme_color, '#112233');
    assert.equal(matched.body.font_family, 'IBM Plex Sans');
    assert.equal(matched.body.login_initial, '@acme');

    const platform = await request(server, 'GET', '/api/settings?email=visitor%40other.test');
    assert.equal(platform.body.title, 'My Store Hub');
    assert.notEqual(platform.body.theme_color, '#112233');
  });

  await t.test('the new customer admin can sign in only for that store', async () => {
    const session = await login(server, 'admin@acme.test', 'acme123');
    assert.equal(session.user.role, 'admin');
    assert.equal(session.user.tenant_id, t.acmeId);
    t.acmeToken = session.token;
  });

  await t.test('that admin can create a client and an employee', async () => {
    const client = await request(server, 'POST', '/api/users', {
      token: t.acmeToken,
      body: {
        name: 'Acme Buyer',
        email: 'buyer@acme.test',
        password: 'buyer123',
        client_group: 'retail',
      },
    });
    assert.equal(client.status, 201, JSON.stringify(client.body));
    assert.equal(client.body.role, 'user');
    assert.notEqual(client.body.password, 'buyer123');

    const employee = await request(server, 'POST', '/api/employees', {
      token: t.acmeToken,
      body: {
        name: 'Acme Staff',
        email: 'staff@acme.test',
        phone: '9000000001',
        designation: 'Cashier',
      },
    });
    assert.equal(employee.status, 201, JSON.stringify(employee.body));
    assert.equal(employee.body.email, 'staff@acme.test');
  });

  await t.test('another customer cannot see those clients or employees', async () => {
    const other = await login(server, 'admin@shubhsurgical.com', 'admin123');
    const clients = await request(server, 'GET', '/api/users', { token: other.token });
    assert.equal(clients.status, 200);
    assert.equal(clients.body.users.some((user) => user.email === 'buyer@acme.test'), false);

    const employees = await request(server, 'GET', '/api/employees', { token: other.token });
    assert.equal(employees.status, 200);
    assert.equal(employees.body.some((employee) => employee.email === 'staff@acme.test'), false);

    const ownClients = await request(server, 'GET', '/api/users', { token: t.acmeToken });
    assert.equal(ownClients.body.users.some((user) => user.email === 'buyer@acme.test'), true);
    const ownEmployees = await request(server, 'GET', '/api/employees', { token: t.acmeToken });
    assert.equal(ownEmployees.body.some((employee) => employee.email === 'staff@acme.test'), true);
  });

  await t.test('product search returns one page of matching rows', async () => {
    for (const name of ['Alpha Tablet', 'Alpha Syrup', 'Beta Lotion']) {
      const created = await request(server, 'POST', '/api/medicines', {
        token: t.acmeToken,
        body: { name, description: `${name} pack`, price: 10, stock: 5 },
      });
      assert.equal(created.status, 201, JSON.stringify(created.body));
    }
    const page = await request(server, 'GET', '/api/medicines?q=Alpha&limit=1&page=1', { token: t.acmeToken });
    assert.equal(page.status, 200);
    assert.equal(page.body.total, 2);
    assert.equal(page.body.pages, 2);
    assert.equal(page.body.items.length, 1);
    assert.match(page.body.items[0].name, /Alpha/);
  });

  await t.test('a client cannot manage employees', async () => {
    const buyer = await login(server, 'buyer@acme.test', 'buyer123');
    const res = await request(server, 'GET', '/api/employees', { token: buyer.token });
    assert.equal(res.status, 403);
  });

  await t.test('the primary customer cannot be deleted', async () => {
    const res = await request(server, 'DELETE', '/api/tenants/1', {
      token: t.superToken,
      body: { confirmation: 'Shubh Surgical', permanent: true },
    });
    assert.equal(res.status, 400);
  });

  await t.test('checkout applies a discount, blocks overselling, and a customer can cancel', async () => {
    const enabled = await request(server, 'PATCH', `/api/tenants/${t.acmeId}`, {
      token: t.superToken,
      body: { modules: { coupons: true } },
    });
    assert.equal(enabled.status, 200, JSON.stringify(enabled.body));

    const coupon = await request(server, 'POST', '/api/orders/coupons', {
      token: t.acmeToken,
      body: { code: 'save10', kind: 'percent', value: 10 },
    });
    assert.equal(coupon.status, 201, JSON.stringify(coupon.body));

    const product = await request(server, 'POST', '/api/medicines', {
      token: t.acmeToken,
      body: { name: 'Pay Test Item', description: 'checkout', price: 100, stock: 2 },
    });
    assert.equal(product.status, 201, JSON.stringify(product.body));

    const buyer = await login(server, 'buyer@acme.test', 'buyer123');
    const order = await request(server, 'POST', '/api/orders/checkout', {
      token: buyer.token,
      body: {
        items: [{ medicineId: product.body.id, quantity: 1 }],
        paymentMethod: 'cod',
        couponCode: 'save10',
      },
    });
    assert.equal(order.status, 201, JSON.stringify(order.body));
    assert.equal(order.body.payment_method, 'cod');
    assert.equal(order.body.subtotal, 100);
    assert.equal(order.body.discount, 10);
    assert.equal(order.body.total, 90);

    const oversell = await request(server, 'POST', '/api/orders/checkout', {
      token: buyer.token,
      body: { items: [{ medicineId: product.body.id, quantity: 2 }], paymentMethod: 'counter' },
    });
    assert.equal(oversell.status, 400);

    const cancelled = await request(server, 'PATCH', `/api/orders/${order.body.id}/cancel-own`, { token: buyer.token });
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.body.status, 'cancelled');
    const stock = await request(server, 'GET', `/api/medicines/${product.body.id}`, { token: buyer.token });
    assert.equal(stock.body.stock, 2);
  });

  await t.test('sign-in locks after repeated failures and short passwords are rejected', async () => {
    const health = await request(server, 'GET', '/api/health');
    assert.equal(health.headers['x-content-type-options'], 'nosniff');

    const short = await request(server, 'POST', '/api/auth/register', {
      body: { name: 'Short', email: 'short@example.com', password: '123' },
    });
    assert.equal(short.status, 400);

    let last = { status: 0 };
    for (let i = 0; i < 8; i += 1) {
      last = await request(server, 'POST', '/api/auth/login', {
        body: { email: 'nobody-lock@example.com', password: 'wrong-password' },
      });
    }
    assert.equal(last.status, 401);
    const locked = await request(server, 'POST', '/api/auth/login', {
      body: { email: 'nobody-lock@example.com', password: 'wrong-password' },
    });
    assert.equal(locked.status, 429);
  });
});
