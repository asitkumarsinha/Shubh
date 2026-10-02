const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, 'data', 'logs');
const logFile = path.join(logDir, 'app.log');

function write(level, message, extra = {}) {
  const line = JSON.stringify({
    time: new Date().toISOString(),
    level,
    message,
    ...extra,
  });
  const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  sink(line);
  try {
    fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(logFile, `${line}\n`);
  } catch (err) {
    console.error(JSON.stringify({ time: new Date().toISOString(), level: 'error', message: 'log write failed', error: err.message }));
  }
}

module.exports = {
  info: (message, extra) => write('info', message, extra),
  warn: (message, extra) => write('warn', message, extra),
  error: (message, extra) => write('error', message, extra),
};
