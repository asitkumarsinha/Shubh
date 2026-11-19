const fs = require('fs');
const path = require('path');
const express = require('express');
const ExcelJS = require('exceljs');
const JSZip = require('jszip');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticate, requireAdmin, requireTenantLimit, optionalUser } = require('../middleware/auth');
const { decorateMedicine } = require('../pricing');
const { pageQuery, pagePayload } = require('../paging');
const { imageFileFilter, safeImageExt, ensureUploadDir, unlinkStored } = require('../uploads');

const router = express.Router();

const { parseCsv, cellText, normalizeHeader, headerRowOf, pickSheet } = require('../spreadsheet');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, ensureUploadDir()),
  filename: (_req, file, cb) => {
    cb(null, `${uuidv4()}${safeImageExt(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

const activeTenant = db.prepare(`SELECT id FROM tenants WHERE id = ? AND status != 'archived'`);
const countMedicines = db.prepare(
  `SELECT COUNT(*) AS count FROM medicines
   WHERE tenant_id = ? AND (? = '' OR name LIKE ? COLLATE NOCASE OR IFNULL(description, '') LIKE ? COLLATE NOCASE)
     AND (? = '' OR category = ? COLLATE NOCASE)`
);
const listMedicines = db.prepare(
  `SELECT * FROM medicines
   WHERE tenant_id = ? AND (? = '' OR name LIKE ? COLLATE NOCASE OR IFNULL(description, '') LIKE ? COLLATE NOCASE)
     AND (? = '' OR category = ? COLLATE NOCASE)
   ORDER BY created_at DESC
   LIMIT ? OFFSET ?`
);
const listCategories = db.prepare(
  `SELECT DISTINCT category FROM medicines
   WHERE tenant_id = ? AND trim(category) != ''
   ORDER BY category COLLATE NOCASE`
);
const MALL_SORTS = {
  popular: 'm.name COLLATE NOCASE, t.name COLLATE NOCASE',
  price: 'm.price ASC, m.name COLLATE NOCASE',
  'price-desc': 'm.price DESC, m.name COLLATE NOCASE',
  newest: 'm.created_at DESC, m.id DESC',
  stock: 'm.stock DESC, m.name COLLATE NOCASE',
};
const TENANT_SORTS = {
  popular: 'name COLLATE NOCASE',
  price: 'price ASC, name COLLATE NOCASE',
  'price-desc': 'price DESC, name COLLATE NOCASE',
  newest: 'created_at DESC, id DESC',
  stock: 'stock DESC, name COLLATE NOCASE',
};

function mallSortSql(sorts) {
  const prepared = {};
  for (const [key, order] of Object.entries(sorts)) {
    const stock = key === 'stock' ? 'AND m.stock > 0' : '';
    prepared[key] = {
      countSearch: db.prepare(
        `SELECT COUNT(*) AS count, COUNT(DISTINCT m.tenant_id) AS stores
         FROM medicines m
         JOIN tenants t ON t.id = m.tenant_id
         WHERE t.status != 'archived'
           AND (m.name LIKE ? COLLATE NOCASE OR IFNULL(m.description, '') LIKE ? COLLATE NOCASE)
           AND (? = '' OR m.category = ? COLLATE NOCASE)
           ${stock}`
      ),
      listSearch: db.prepare(
        `SELECT m.*, t.name AS store_name, t.slug AS store_slug
         FROM medicines m
         JOIN tenants t ON t.id = m.tenant_id
         WHERE t.status != 'archived'
           AND (m.name LIKE ? COLLATE NOCASE OR IFNULL(m.description, '') LIKE ? COLLATE NOCASE)
           AND (? = '' OR m.category = ? COLLATE NOCASE)
           ${stock}
         ORDER BY ${order}
         LIMIT ? OFFSET ?`
      ),
      countAll: db.prepare(
        `SELECT COUNT(*) AS count, COUNT(DISTINCT m.tenant_id) AS stores
         FROM medicines m
         JOIN tenants t ON t.id = m.tenant_id
         WHERE t.status != 'archived' ${stock}`
      ),
      listAll: db.prepare(
        `SELECT m.*, t.name AS store_name, t.slug AS store_slug
         FROM medicines m
         JOIN tenants t ON t.id = m.tenant_id
         WHERE t.status != 'archived' ${stock}
         ORDER BY ${order}
         LIMIT ? OFFSET ?`
      ),
    };
  }
  return prepared;
}

const mallSorted = mallSortSql(MALL_SORTS);
const tenantSorted = {};
for (const [key, order] of Object.entries(TENANT_SORTS)) {
  const stock = key === 'stock' ? "AND stock > 0" : '';
  tenantSorted[key] = {
    count: db.prepare(
      `SELECT COUNT(*) AS count FROM medicines
       WHERE tenant_id = ? AND (? = '' OR name LIKE ? COLLATE NOCASE OR IFNULL(description, '') LIKE ? COLLATE NOCASE)
         AND (? = '' OR category = ? COLLATE NOCASE) ${stock}`
    ),
    list: db.prepare(
      `SELECT * FROM medicines
       WHERE tenant_id = ? AND (? = '' OR name LIKE ? COLLATE NOCASE OR IFNULL(description, '') LIKE ? COLLATE NOCASE)
         AND (? = '' OR category = ? COLLATE NOCASE) ${stock}
       ORDER BY ${order}
       LIMIT ? OFFSET ?`
    ),
  };
}
const listMallStores = db.prepare(
  `SELECT t.id, t.name, t.slug, IFNULL(s.slogan, '') AS slogan,
          COUNT(m.id) AS products,
          IFNULL(s.logo, '') AS image,
          (
            SELECT GROUP_CONCAT(category, ', ') FROM (
              SELECT category FROM medicines
              WHERE tenant_id = t.id AND trim(category) != ''
              GROUP BY category COLLATE NOCASE
              ORDER BY COUNT(*) DESC
              LIMIT 2
            )
          ) AS categories
   FROM tenants t
   LEFT JOIN tenant_settings s ON s.tenant_id = t.id
   LEFT JOIN medicines m ON m.tenant_id = t.id
   WHERE t.status != 'archived'
   GROUP BY t.id
   ORDER BY t.name COLLATE NOCASE`
);
const listMallGroups = db.prepare(
  `SELECT m.category AS name, COUNT(*) AS count, MIN(m.image) AS image
   FROM medicines m
   JOIN tenants t ON t.id = m.tenant_id
   WHERE t.status != 'archived' AND m.category != ''
   GROUP BY m.category COLLATE NOCASE
   ORDER BY m.category COLLATE NOCASE`
);

function tenantFromRequest(req) {
  const user = optionalUser(req);
  const requested = Number(req.query.tenantId);
  const tenantExists =
    Number.isInteger(requested) && requested > 0 && activeTenant.get(requested);
  return { user, tenantId: tenantExists ? requested : user?.tenant_id || 1 };
}

function sortKey(sorts, value) {
  return Object.prototype.hasOwnProperty.call(sorts, value) ? value : null;
}

function mallSortKey(value) {
  return sortKey(MALL_SORTS, value) || 'popular';
}

router.get('/', (req, res) => {
  const { user, tenantId } = tenantFromRequest(req);
  const { page, limit, offset, q, like } = pageQuery(req, 12);
  const category = String(req.query.category || '').trim();
  const key = sortKey(TENANT_SORTS, String(req.query.sort || ''));
  const sorted = key ? tenantSorted[key] : null;
  const total = (sorted ? sorted.count : countMedicines).get(tenantId, q, like, like, category, category).count;
  const medicines = (sorted ? sorted.list : listMedicines)
    .all(tenantId, q, like, like, category, category, limit, offset)
    .map((m) => decorateMedicine(m, user));
  res.json({ ...pagePayload(medicines, total, page, limit), stores: 1 });
});

router.get('/categories', (req, res) => {
  const { tenantId } = tenantFromRequest(req);
  res.json(listCategories.all(tenantId).map((row) => row.category));
});

router.get('/mall/groups', (_req, res) => {
  res.json(listMallGroups.all());
});

router.get('/mall/stores', (_req, res) => {
  res.json(listMallStores.all());
});

router.get('/mall', (req, res) => {
  const user = optionalUser(req);
  const { page, limit, offset, q, like } = pageQuery(req, 12);
  const category = String(req.query.category || '').trim();
  const sorted = mallSorted[mallSortKey(req.query.sort)];
  const summary = q || category
    ? sorted.countSearch.get(like, like, category, category)
    : sorted.countAll.get();
  const rows = q || category
    ? sorted.listSearch.all(like, like, category, category, limit, offset)
    : sorted.listAll.all(limit, offset);
  res.json({
    ...pagePayload(rows.map((row) => decorateMedicine(row, user)), summary.count, page, limit),
    stores: summary.stores,
  });
});

router.get('/:id', (req, res) => {
  const user = optionalUser(req);
  const medicine = db
    .prepare('SELECT * FROM medicines WHERE id = ? AND tenant_id = ?')
    .get(req.params.id, user?.tenant_id || 1);
  if (!medicine) return res.status(404).json({ message: 'Medicine not found' });
  res.json(decorateMedicine(medicine, optionalUser(req)));
});

router.post('/', authenticate, requireAdmin, requireTenantLimit('medicines', 'medicines'), upload.single('image'), (req, res) => {
  const { name, description, price, wholesale_price, stock, category } = req.body;
  if (!name || price === undefined) {
    return res.status(400).json({ message: 'Name and price are required' });
  }
  const image = req.file ? `/uploads/${req.file.filename}` : null;
  const wholesale =
    wholesale_price === undefined || wholesale_price === '' ? null : Number(wholesale_price);
  const result = db
    .prepare(
      `INSERT INTO medicines (name, description, price, wholesale_price, image, stock, category, created_by, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      name,
      description || '',
      Number(price),
      wholesale,
      image,
      Number(stock || 0),
      String(category || '').trim(),
      req.user.id,
      req.user.tenant_id
    );
  const medicine = db.prepare('SELECT * FROM medicines WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(medicine);
});

router.put('/:id', authenticate, requireAdmin, upload.single('image'), (req, res) => {
  const existing = db.prepare('SELECT * FROM medicines WHERE id = ? AND tenant_id = ?').get(req.params.id, req.user.tenant_id);
  if (!existing) return res.status(404).json({ message: 'Medicine not found' });

  const { name, description, price, wholesale_price, stock, category } = req.body;
  let image = existing.image;
  if (req.file) {
    unlinkStored(existing.image);
    image = `/uploads/${req.file.filename}`;
  }

  let wholesale = existing.wholesale_price;
  if (wholesale_price !== undefined) {
    wholesale = wholesale_price === '' ? null : Number(wholesale_price);
  }

  db.prepare(
    `UPDATE medicines SET name = ?, description = ?, price = ?, wholesale_price = ?, image = ?, stock = ?, category = ?
     WHERE id = ? AND tenant_id = ?`
  ).run(
    name || existing.name,
    description !== undefined ? description : existing.description,
    price !== undefined ? Number(price) : existing.price,
    wholesale,
    image,
    stock !== undefined ? Number(stock) : existing.stock,
    category !== undefined ? String(category).trim() : existing.category || '',
    req.params.id,
    req.user.tenant_id
  );

  res.json(db.prepare('SELECT * FROM medicines WHERE id = ?').get(req.params.id));
});

router.patch('/:id/restock', authenticate, requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM medicines WHERE id = ? AND tenant_id = ?').get(req.params.id, req.user.tenant_id);
  if (!existing) return res.status(404).json({ message: 'Medicine not found' });
  const quantity = Number(req.body?.quantity);
  if (!quantity || quantity < 1) {
    return res.status(400).json({ message: 'Restock quantity must be at least 1' });
  }
  db.prepare('UPDATE medicines SET stock = stock + ? WHERE id = ? AND tenant_id = ?').run(quantity, req.params.id, req.user.tenant_id);
  res.json(db.prepare('SELECT * FROM medicines WHERE id = ?').get(req.params.id));
});

const bulkUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/\.(xlsx|csv)$/i.test(file.originalname || '')) return cb(null, true);
    const err = new Error('Upload an Excel (.xlsx) or CSV file');
    err.status = 400;
    return cb(err);
  },
});
const countForTenant = db.prepare('SELECT COUNT(*) AS count FROM medicines WHERE tenant_id = ?');
const blankImageFor = db.prepare(
  `SELECT id FROM medicines
   WHERE tenant_id = ? AND name = ? COLLATE NOCASE AND IFNULL(size, '') = ? COLLATE NOCASE
     AND (image IS NULL OR trim(image) = '')
   ORDER BY id LIMIT 1`
);
const setImportedImage = db.prepare('UPDATE medicines SET image = ? WHERE id = ? AND tenant_id = ?');
const maxForTenant = db.prepare('SELECT max_medicines AS max FROM tenants WHERE id = ?');
const insertImported = db.prepare(
  `INSERT INTO medicines (name, description, price, wholesale_price, image, stock, category, size, mrp, created_by, tenant_id)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

const LOCAL_IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.jfif', '.webp', '.gif', '.svg']);

// An Image cell may hold a URL, a /uploads path, or a file path on this computer such as C://Image/1.jpeg.
function imageRef(value) {
  const text = cellText(value).trim();
  return /^(https?:\/\/|\/)/i.test(text) ? text : null;
}

function localImagePath(value) {
  let text = cellText(value).trim().replace(/^"+|"+$/g, '');
  if (!text || /^(https?:\/\/|\/)/i.test(text)) return '';
  if (/^file:\/\//i.test(text)) {
    text = decodeURIComponent(text.replace(/^file:\/\//i, ''));
    if (/^\/[A-Za-z]:/.test(text)) text = text.slice(1);
  }
  text = text.replace(/\\/g, '/').replace(/^([A-Za-z]:)\/+/, '$1/');
  if (!/^[A-Za-z]:\//.test(text)) return '';
  const resolved = path.resolve(text);
  if (!LOCAL_IMAGE_EXT.has(path.extname(resolved).toLowerCase())) return '';
  return fs.existsSync(resolved) && fs.statSync(resolved).isFile() ? resolved : '';
}

function saveLocalImage(filePath) {
  const name = `${uuidv4()}${safeImageExt(filePath)}`;
  fs.copyFileSync(filePath, path.join(ensureUploadDir(), name));
  return `/uploads/${name}`;
}

const PRODUCT_SHEET_NAMES = ['products', 'product'];

const IMAGE_HEADERS = ['image', 'product image', 'photo', 'picture', 'img', 'product photo'];

function imageColumn(headers) {
  for (const name of IMAGE_HEADERS) {
    const at = headers.indexOf(name);
    if (at >= 0) return at;
  }
  return headers.findIndex((header) => header.endsWith(' image') || header.startsWith('image '));
}

function decodeXml(text) {
  return String(text)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function xmlAttr(tag, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(?:^|[\\s])${escaped}="([^"]*)"`, 'i').exec(tag);
  return match ? decodeXml(match[1]) : '';
}

function zipEntry(zip, name) {
  const want = `/${name.toLowerCase()}`;
  return Object.values(zip.files).find((file) => {
    if (file.dir) return false;
    const clean = file.name.replace(/\\/g, '/').toLowerCase();
    return clean === name.toLowerCase() || clean.endsWith(want);
  });
}

function resolveZipPath(baseDir, target) {
  const parts = [];
  for (const part of `${baseDir}/${target}`.replace(/\\/g, '/').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return parts.join('/');
}

function colIndex(letters) {
  let index = 0;
  for (const ch of letters) index = index * 26 + (ch.charCodeAt(0) - 64);
  return index - 1;
}

async function mediaPicture(zip, target, baseDir) {
  const located = resolveZipPath(baseDir, target);
  const file = zip.file(located) || zip.file(`/${located}`);
  if (!file) return null;
  const ext = path.extname(located).slice(1).toLowerCase();
  if (!['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'jfif'].includes(ext)) return null;
  return { buffer: await file.async('nodebuffer'), extension: ext === 'jpg' ? 'jpeg' : ext };
}

// WPS and some Excel builds store a picture inside the cell as =DISPIMG("ID_...", 1).
async function dispImgPictures(zip) {
  const imagesXml = zipEntry(zip, 'xl/cellimages.xml');
  const relsXml = zipEntry(zip, 'xl/_rels/cellimages.xml.rels');
  if (!imagesXml || !relsXml) return new Map();
  const rels = new Map();
  for (const tag of (await relsXml.async('string')).match(/<Relationship\b[^>]*>/gi) || []) {
    rels.set(xmlAttr(tag, 'Id'), xmlAttr(tag, 'Target'));
  }
  const byId = new Map();
  const xml = await imagesXml.async('string');
  for (const block of xml.match(/<(?:[\w.]+:)?cNvPr\b[^>]*>[\s\S]*?<(?:[\w.]+:)?blip\b[^>]*>/gi) || []) {
    const id = xmlAttr(block.match(/<(?:[\w.]+:)?cNvPr\b[^>]*>/i)[0], 'name');
    const embed = xmlAttr(block.match(/<(?:[\w.]+:)?blip\b[^>]*>/i)[0], 'r:embed');
    const target = rels.get(embed);
    if (!id || !target || byId.has(id)) continue;
    const picture = await mediaPicture(zip, target, 'xl');
    if (picture) byId.set(id, picture);
  }
  return byId;
}

// Excel 365 "Place in Cell" stores the picture as rich-value metadata, not as a drawing.
async function placedCellPictures(zip) {
  const metadataFile = zipEntry(zip, 'xl/metadata.xml');
  const valuesFile = zipEntry(zip, 'xl/richData/rdrichvalue.xml');
  const structuresFile = zipEntry(zip, 'xl/richData/rdrichvaluestructure.xml');
  const relsFile = zipEntry(zip, 'xl/richData/richValueRel.xml');
  const relsLinks = zipEntry(zip, 'xl/richData/_rels/richValueRel.xml.rels');
  if (!metadataFile || !valuesFile || !structuresFile || !relsFile || !relsLinks) return new Map();

  const metadata = await metadataFile.async('string');
  const valueMetadata = metadata.split(/<valueMetadata\b/i)[1] || '';
  const richIndexes = [...valueMetadata.matchAll(/<bk\b[^>]*>([\s\S]*?)<\/bk>/gi)].map((block) => {
    const record = block[1].match(/<rc\b[^>]*>/i);
    return record ? Number(xmlAttr(record[0], 'v')) : NaN;
  });

  const structures = [...(await structuresFile.async('string')).matchAll(/<s\b([^>]*)>([\s\S]*?)<\/s>/gi)]
    .map((block) => ({
      type: xmlAttr(block[1], 't'),
      keys: [...block[2].matchAll(/<k\b[^>]*>/gi)].map((key) => xmlAttr(key[0], 'n')),
    }));
  const richValues = [...(await valuesFile.async('string')).matchAll(/<rv\b([^>]*)>([\s\S]*?)<\/rv>/gi)]
    .map((block) => ({
      structure: Number(xmlAttr(block[1], 's')),
      values: [...block[2].matchAll(/<v\b[^>]*>([\s\S]*?)<\/v>/gi)].map((value) => value[1].trim()),
    }));

  const relIds = [...(await relsFile.async('string')).matchAll(/<(?:[\w.]+:)?rel\b[^>]*>/gi)]
    .map((tag) => xmlAttr(tag[0], 'r:id'));
  const targets = new Map();
  for (const tag of (await relsLinks.async('string')).match(/<Relationship\b[^>]*>/gi) || []) {
    targets.set(xmlAttr(tag, 'Id'), xmlAttr(tag, 'Target'));
  }

  const byVm = new Map();
  for (let vm = 0; vm < richIndexes.length; vm += 1) {
    const rich = richValues[richIndexes[vm]];
    const structure = rich ? structures[rich.structure] : null;
    if (!rich || !structure || structure.type !== '_localImage') continue;
    const keyAt = structure.keys.indexOf('_rvRel:LocalImageIdentifier');
    const relId = relIds[Number(rich.values[keyAt])];
    const target = targets.get(relId);
    if (!target) continue;
    const picture = await mediaPicture(zip, target, 'xl/richData');
    if (picture) byVm.set(vm + 1, picture);
  }
  return byVm;
}

async function sheetFiles(zip) {
  const workbook = zipEntry(zip, 'xl/workbook.xml');
  const rels = zipEntry(zip, 'xl/_rels/workbook.xml.rels');
  if (!workbook || !rels) return [];
  const targets = new Map();
  for (const tag of (await rels.async('string')).match(/<Relationship\b[^>]*>/gi) || []) {
    targets.set(xmlAttr(tag, 'Id'), xmlAttr(tag, 'Target'));
  }
  const sheets = [];
  for (const tag of (await workbook.async('string')).match(/<sheet\b[^>]*>/gi) || []) {
    const target = targets.get(xmlAttr(tag, 'r:id'));
    if (!target) continue;
    sheets.push({ name: xmlAttr(tag, 'name'), path: resolveZipPath('xl', target) });
  }
  return sheets;
}

// Pictures that live inside a cell. Keyed by sheet name, then "row,col" using the same 0-based indexes as the grid.
async function cellPictures(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const byDisp = await dispImgPictures(zip);
  const byVm = await placedCellPictures(zip);
  const placed = new Map();
  if (!byDisp.size && !byVm.size) return placed;
  for (const sheet of await sheetFiles(zip)) {
    const file = zip.file(sheet.path);
    if (!file) continue;
    const cells = new Map();
    const xml = await file.async('string');
    for (const match of xml.matchAll(/<c\b[^>]*>[\s\S]*?<\/c>/gi)) {
      const cell = match[0];
      const ref = /<c\b[^>]*\br="([A-Z]+)(\d+)"/i.exec(cell);
      if (!ref) continue;
      const key = `${Number(ref[2]) - 1},${colIndex(ref[1])}`;
      const disp = /DISPIMG\(\s*"([^"]+)"/i.exec(decodeXml(cell));
      if (disp && byDisp.has(disp[1])) {
        cells.set(key, byDisp.get(disp[1]));
        continue;
      }
      const vm = /\bvm="(\d+)"/i.exec(cell.slice(0, cell.indexOf('>')));
      if (vm && byVm.has(Number(vm[1]))) cells.set(key, byVm.get(Number(vm[1])));
    }
    if (cells.size) placed.set(sheet.name, cells);
  }
  return placed;
}

function anchorColumn(anchor) {
  if (!anchor) return -1;
  if (Number.isInteger(anchor.nativeCol)) return anchor.nativeCol;
  const col = Number(anchor.col);
  return Number.isFinite(col) ? Math.floor(col) : -1;
}

// A workbook export holds several sheets (Hub, Client, Employee, Product), so pick the product sheet.
// Pictures are kept as objects until a row is inserted, so skipped rows leave no files.
async function readWorkbook(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(buffer));
  const embedded = await cellPictures(buffer);
  const { sheet, rows } = pickSheet(workbook, { preferredNames: PRODUCT_SHEET_NAMES, required: ['name', 'price'] });
  if (!sheet) return { table: [], sheetName: null };

  const headerAt = headerRowOf(rows);
  const imageCol = headerAt < 0 ? -1 : imageColumn(rows[headerAt].map(normalizeHeader));
  if (imageCol >= 0) {
    const inCell = embedded.get(sheet.name);
    if (inCell) {
      for (const [key, picture] of inCell) {
        const [nativeRow, nativeCol] = key.split(',').map(Number);
        if (nativeCol !== imageCol || nativeRow <= headerAt) continue;
        const row = rows[nativeRow] || (rows[nativeRow] = []);
        row[imageCol] = { picture };
      }
    }
    for (const picture of sheet.getImages()) {
      const nativeRow = picture.range?.tl?.nativeRow;
      const fromCol = anchorColumn(picture.range?.tl);
      const toCol = picture.range?.br ? anchorColumn(picture.range.br) : fromCol;
      if (nativeRow == null || nativeRow <= headerAt || imageCol < fromCol || imageCol > toCol) continue;
      const data = workbook.getImage(Number(picture.imageId));
      if (!data?.buffer) continue;
      const row = rows[nativeRow] || (rows[nativeRow] = []);
      if (row[imageCol] && typeof row[imageCol] === 'object') continue;
      row[imageCol] = { picture: data };
    }
  }
  const table = rows.filter((row) => row && row.some((value) => typeof value === 'object' || String(value).trim()));
  return { table, sheetName: sheet.name };
}

function saveImage(picture) {
  const ext = safeImageExt(`picture.${picture.extension || 'png'}`);
  const name = `${uuidv4()}${ext}`;
  fs.writeFileSync(path.join(ensureUploadDir(), name), Buffer.from(picture.buffer));
  return `/uploads/${name}`;
}

async function readSpreadsheet(file) {
  if (/\.xlsx$/i.test(file.originalname || '')) return readWorkbook(file.buffer);
  return { table: parseCsv(file.buffer.toString('utf8')), sheetName: null };
}

router.post('/import', authenticate, requireAdmin, bulkUpload.single('file'), async (req, res) => {
  let read;
  try {
    read = req.file
      ? await readSpreadsheet(req.file)
      : { table: parseCsv(String(req.body?.csv || '')), sheetName: null };
  } catch (err) {
    return res.status(400).json({ message: 'Could not read the spreadsheet. Upload an Excel (.xlsx) or CSV file' });
  }
  const { table } = read;
  if (table.length < 2) {
    return res.status(400).json({ message: 'The spreadsheet needs a header row and at least one product' });
  }
  const headers = table[0].map(normalizeHeader);
  const index = (...names) => {
    for (const name of names) {
      const at = headers.indexOf(name);
      if (at >= 0) return at;
    }
    return -1;
  };
  const nameAt = index('name', 'product name');
  const priceAt = index('price');
  const stockAt = index('stock');
  const descriptionAt = index('description');
  const categoryAt = index('category');
  const sizeAt = index('size');
  const mrpAt = index('mrp');
  const imageAt = imageColumn(headers);
  const hospitalAt = index('price to hospital', 'wholesale price');
  if (nameAt < 0 || priceAt < 0) {
    const found = headers.filter(Boolean).join(', ') || 'none';
    const sheet = read.sheetName ? ` on sheet "${read.sheetName}"` : '';
    return res.status(400).json({
      message: `The header row must include name and price. Columns found${sheet}: ${found}`,
    });
  }
  const room = Math.max(0,
    Number(maxForTenant.get(req.user.tenant_id)?.max || 1000) - countForTenant.get(req.user.tenant_id).count
  );
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const insert = db.transaction((lines) => {
    for (const line of lines) {
      const name = String(line[nameAt] || '').trim();
      const price = Number(line[priceAt]);
      if (!name || !Number.isFinite(price) || price < 0) {
        skipped += 1;
        continue;
      }
      const stock = stockAt >= 0 ? Number(line[stockAt] || 0) : 0;
      const wholesale = hospitalAt >= 0 && String(line[hospitalAt] || '').trim() !== ''
        ? Number(line[hospitalAt])
        : null;
      const mrp = mrpAt >= 0 && String(line[mrpAt] || '').trim() !== ''
        ? Number(line[mrpAt])
        : null;
      if (
        !Number.isFinite(stock) || stock < 0 ||
        (wholesale !== null && (!Number.isFinite(wholesale) || wholesale < 0)) ||
        (mrp !== null && (!Number.isFinite(mrp) || mrp < 0))
      ) {
        skipped += 1;
        continue;
      }
      const cell = imageAt >= 0 ? line[imageAt] : '';
      const size = sizeAt >= 0 ? String(line[sizeAt] || '').trim() : '';
      const picture = cell && typeof cell === 'object' ? cell.picture : null;
      const linked = picture ? null : imageRef(cell);
      const local = picture || linked ? '' : localImagePath(cell);
      const existing = picture || linked || local ? blankImageFor.get(req.user.tenant_id, name, size) : null;
      if (!existing && created >= room) {
        skipped += 1;
        continue;
      }
      const image = picture ? saveImage(picture) : linked || (local ? saveLocalImage(local) : null);
      if (existing) {
        setImportedImage.run(image, existing.id, req.user.tenant_id);
        updated += 1;
        continue;
      }
      insertImported.run(
        name,
        descriptionAt >= 0 ? String(line[descriptionAt] || '').trim() : '',
        price,
        wholesale,
        image,
        stock,
        categoryAt >= 0 ? String(line[categoryAt] || '').trim() : '',
        size,
        mrp,
        req.user.id,
        req.user.tenant_id
      );
      created += 1;
    }
  });
  insert(table.slice(1, 501));
  res.status(201).json({ created, updated, skipped });
});

router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM medicines WHERE id = ? AND tenant_id = ?').get(req.params.id, req.user.tenant_id);
  if (!existing) return res.status(404).json({ message: 'Medicine not found' });
  unlinkStored(existing.image);
  db.prepare('DELETE FROM medicines WHERE id = ? AND tenant_id = ?').run(req.params.id, req.user.tenant_id);
  res.json({ message: 'Medicine deleted' });
});

module.exports = router;
