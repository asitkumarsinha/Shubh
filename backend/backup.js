const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const backupDir = path.join(__dirname, 'data', 'backups');
const DAY_MS = 24 * 60 * 60 * 1000;
const KEEP = 7;

function newestBackupAge() {
  if (!fs.existsSync(backupDir)) return Infinity;
  const files = fs.readdirSync(backupDir).filter((name) => name.endsWith('.db'));
  if (!files.length) return Infinity;
  const newest = files
    .map((name) => fs.statSync(path.join(backupDir, name)).mtimeMs)
    .sort((a, b) => b - a)[0];
  return Date.now() - newest;
}

function pruneBackups() {
  const files = fs
    .readdirSync(backupDir)
    .filter((name) => name.endsWith('.db'))
    .map((name) => ({ name, time: fs.statSync(path.join(backupDir, name)).mtimeMs }))
    .sort((a, b) => a.time - b.time);
  while (files.length > KEEP) {
    const old = files.shift();
    fs.unlinkSync(path.join(backupDir, old.name));
  }
}

async function backupDatabase(db) {
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(backupDir, `medishop-${stamp}.db`);
  await db.backup(dest);
  pruneBackups();
  logger.info('database backup written', { file: path.basename(dest) });
  return dest;
}

function scheduleBackups(db) {
  const run = () => {
    backupDatabase(db).catch((err) => logger.error('database backup failed', { message: err.message }));
  };
  if (newestBackupAge() >= DAY_MS) run();
  setInterval(run, DAY_MS);
}

module.exports = { backupDatabase, scheduleBackups };
