const ExcelJS = require('exceljs');

// Spreadsheet helpers shared by the product and store imports.

// Excel saves CSV with ';' in some regional settings, so use whichever separator the header line uses.
function detectDelimiter(src) {
  const firstLine = src.split(/\r?\n/, 1)[0] || '';
  const commas = (firstLine.match(/,/g) || []).length;
  const semicolons = (firstLine.match(/;/g) || []).length;
  return semicolons > commas ? ';' : ',';
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const src = String(text || '').replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(src);
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch !== '\r') cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((line) => line.some((value) => String(value).trim()));
}

function cellText(value) {
  if (value == null) return '';
  if (typeof value === 'object') {
    if ('result' in value) return cellText(value.result);
    if ('richText' in value) return value.richText.map((part) => part.text).join('');
    if ('text' in value) return cellText(value.text);
    return '';
  }
  return String(value);
}

// Headers are matched loosely: case, extra spaces, underscores and non-breaking spaces are ignored.
function normalizeHeader(value) {
  return String(value || '').replace(/\u00a0/g, ' ').replace(/[\s_]+/g, ' ').trim().toLowerCase();
}

function headerRowOf(rows) {
  return rows.findIndex((row) => row && row.some((value) => String(value).trim()));
}

function sheetRows(sheet) {
  const rows = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    rows[rowNumber - 1] = Array.from(row.values).slice(1).map(cellText);
  });
  return rows;
}

function tableOf(rows) {
  return rows.filter((row) => row && row.some((value) => String(value).trim()));
}

// Picks the sheet whose header row has every required column. Preferred sheet names are tried first.
// Falls back to the first sheet, so the caller can report which columns were found.
function pickSheet(workbook, { preferredNames = [], required = [] } = {}) {
  const preferred = (sheet) => preferredNames.includes(normalizeHeader(sheet.name));
  const sheets = [...workbook.worksheets].sort((a, b) => Number(preferred(b)) - Number(preferred(a)));
  const hasRequired = (rows) => {
    const at = headerRowOf(rows);
    if (at < 0) return false;
    const headers = rows[at].map(normalizeHeader);
    return required.every((name) => headers.includes(name));
  };
  for (const sheet of sheets) {
    const rows = sheetRows(sheet);
    if (hasRequired(rows)) return { sheet, rows };
  }
  const first = sheets[0];
  return first ? { sheet: first, rows: sheetRows(first) } : { sheet: null, rows: [] };
}

async function readSheetTable(buffer, options = {}) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const { sheet, rows } = pickSheet(workbook, options);
  return sheet ? { table: tableOf(rows), sheetName: sheet.name } : { table: [], sheetName: null };
}

module.exports = { parseCsv, cellText, normalizeHeader, headerRowOf, sheetRows, pickSheet, readSheetTable };
