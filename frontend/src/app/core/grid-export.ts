export interface GridSection {
  title: string;
  headers: string[];
  rows: string[][];
}

export function inr(value: number | string | null | undefined): string {
  const amount = Number(value || 0);
  return `₹${amount.toFixed(2)}`;
}

export function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function toCsv(sections: GridSection[]): string {
  const lines: string[] = [];
  for (const section of sections) {
    if (sections.length > 1) lines.push(csvCell(section.title));
    lines.push(section.headers.map(csvCell).join(','));
    for (const row of section.rows) lines.push(row.map((cell) => csvCell(cell ?? '')).join(','));
    if (sections.length > 1) lines.push('');
  }
  return lines.join('\n');
}

export function downloadGrid(filename: string, sections: GridSection[]): void {
  const blob = new Blob([`\uFEFF${toCsv(sections)}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function printGrid(sections: GridSection[]): void {
  const tables = sections
    .map((section) => {
      const head = section.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('');
      const body = section.rows.length
        ? section.rows
            .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell ?? '')}</td>`).join('')}</tr>`)
            .join('')
        : `<tr><td colspan="${section.headers.length || 1}">No rows</td></tr>`;
      return `<h1>${escapeHtml(section.title)}</h1><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
    })
    .join('');
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) {
    frame.remove();
    return;
  }
  doc.open();
  doc.write(`<!DOCTYPE html><html><head><title>Print</title><style>
    body{font-family:sans-serif;color:#111;margin:24px}
    h1{font-size:18px;margin:0 0 8px}
    table{width:100%;border-collapse:collapse;margin:0 0 24px}
    th,td{border:1px solid #d1d5db;padding:6px 8px;text-align:left;font-size:12px}
    th{background:#f3f4f6}
  </style></head><body>${tables}</body></html>`);
  doc.close();
  frame.contentWindow?.focus();
  frame.contentWindow?.print();
  setTimeout(() => frame.remove(), 1000);
}
