const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shubh-workbook-'));
process.env.SQLITE_PATH = path.join(tempDir, 'test.db');

const db = require('../db');
const { buildHubTemplate, importHubWorkbook } = require('../hub-workbook');

test('shopping mall workbook creates the hub, clients, and employees', async () => {
  const buffer = await buildHubTemplate();
  const created = await importHubWorkbook(buffer, null);
  assert.equal(created.name, 'Shopping Mall');
  assert.equal(created.slug, 'shopping-mall');
  assert.equal(created.clients, 2);
  assert.equal(created.employees, 2);

  const tenant = db.prepare('SELECT id FROM tenants WHERE slug = ?').get('shopping-mall');
  const clients = db.prepare(`SELECT COUNT(*) AS count FROM users WHERE tenant_id = ? AND role = 'user'`).get(tenant.id);
  const employees = db.prepare('SELECT COUNT(*) AS count FROM employees WHERE tenant_id = ?').get(tenant.id);
  const admin = db.prepare(`SELECT email FROM users WHERE tenant_id = ? AND role = 'admin'`).get(tenant.id);
  assert.equal(clients.count, 2);
  assert.equal(employees.count, 2);
  assert.equal(admin.email, 'desk@shopping-mall.mystoreshubs.com');

  await assert.rejects(() => importHubWorkbook(buffer, null), (err) => err.status === 409);
});
