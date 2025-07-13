// 🎯 CARMACK HOME LAB SECURITY: Request Logging
// "Log what matters, ignore the noise"

const fs = require('fs');
const LOG_FILE = process.env.LOG_FILE || '/tmp/pi-api-hub.log';

function createLogger() {
  return (req, res, next) => {
    const start = Date.now();
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      const entry = `${new Date().toISOString().slice(0,19)} ${ip} ${req.method} ${req.path} ${res.statusCode} ${duration}ms\n`;
      
      // Async write, don't block requests
      fs.appendFile(LOG_FILE, entry, () => {});
    });
    
    next();
  };
}

// Tail last 100 lines for debugging
function tailLogs() {
  try {
    const logs = fs.readFileSync(LOG_FILE, 'utf8').split('\n').slice(-100).join('\n');
    console.log(logs);
  } catch (e) {
    console.log('No logs found');
  }
}

module.exports = { createLogger, tailLogs };