/**
 * Copies the Angular production build into backend/public
 * so Express can serve the site reliably on hosting portals.
 */
const fs = require('fs');
const path = require('path');

function copyRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyRecursive(from, to);
    else fs.copyFileSync(from, to);
  }
}

const candidates = [
  path.join(__dirname, '..', 'frontend', 'dist', 'frontend', 'browser'),
  path.join(__dirname, '..', 'frontend', 'dist', 'frontend'),
  path.join(__dirname, '..', 'frontend', 'dist', 'browser'),
];

const src = candidates.find((p) => fs.existsSync(path.join(p, 'index.html')));
if (!src) {
  console.error('Angular build not found under frontend/dist. Run: npm run build --prefix frontend');
  process.exit(1);
}

const dest = path.join(__dirname, '..', 'backend', 'public');
fs.rmSync(dest, { recursive: true, force: true });
copyRecursive(src, dest);
console.log(`Copied frontend: ${src}`);
console.log(`Into:            ${dest}`);
