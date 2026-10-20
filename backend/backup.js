const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const DAY_MS = 24 * 60 * 60 * 1000;
const KEEP = 7;

function backupDir() {
  if (process.env.SQLITE_PATH) {
    return path.join(path.dirname(process.env.SQLITE_PATH), 'backups');
  }
  return path.join(__dirname, 'data', 'backups');
}

function newestBackupAge() {
  const dir = backupDir();
  if (!fs.existsSync(dir)) return Infinity;
  const files = fs.readdirSync(dir).filter((name) => name.endsWith('.db'));
  if (!files.length) return Infinity;
  const newest = files
    .map((name) => fs.statSync(path.join(dir, name)).mtimeMs)
    .sort((a, b) => b - a)[0];
  return Date.now() - newest;
}

function pruneBackups() {
  const dir = backupDir();
  const files = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.db'))
    .map((name) => ({ name, time: fs.statSync(path.join(dir, name)).mtimeMs }))
    .sort((a, b) => a.time - b.time);
  while (files.length > KEEP) {
    const old = files.shift();
    fs.unlinkSync(path.join(dir, old.name));
  }
}

async function backupDatabase(db) {
  const dir = backupDir();
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(dir, `medishop-${stamp}.db`);
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

module.exports = { backupDatabase, scheduleBackups, backupDir };
