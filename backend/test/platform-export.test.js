const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ExcelJS = require('exceljs');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shubh-platform-'));
process.env.SQLITE_PATH = path.join(tempDir, 'test.db');

const db = require('../db');
const { exportPlatformWorkbook, importPlatformWorkbook } = require('../platform-export');

test('the exported workbook updates a store and adds an employee', async () => {
  const buffer = await exportPlatformWorkbook();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  assert.ok(workbook.getWorksheet('Stores'));
  assert.ok(workbook.getWorksheet('Hubs'));
  assert.ok(workbook.getWorksheet('Employees'));

  const stores = workbook.getWorksheet('Stores');
  let target = 0;
  stores.eachRow((row, number) => {
    if (number > 1 && row.getCell(2).value === 'shubh-surgical') target = number;
  });
  assert.ok(target);
  stores.getRow(target).getCell(3).value = '9811112222';

  const staff = workbook.getWorksheet('Employees');
  staff.addRow(['My Stores Hubs', 'Meera Desk', 'meera.desk@shubh-surgical.example', '9800007777', 'Floor lead', 'Shop', '12 Market Road', '2026-11-11']);

  const edited = await workbook.xlsx.writeBuffer();
  const result = await importPlatformWorkbook(edited, null);
  assert.equal(result.createdEmployees, 1);

  const tenant = db.prepare('SELECT contact_phone FROM tenants WHERE slug = ?').get('shubh-surgical');
  assert.equal(tenant.contact_phone, '9811112222');
  const employee = db.prepare('SELECT designation, tenant_id FROM employees WHERE email = ?').get('meera.desk@shubh-surgical.example');
  const hub = db.prepare('SELECT id FROM tenants WHERE slug = ?').get('shubh-surgical');
  assert.equal(employee.designation, 'Floor lead');
  assert.equal(employee.tenant_id, hub.id);
});
