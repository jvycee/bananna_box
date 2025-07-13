// 🎯 CARMACK HOME LAB SECURITY: Health Alerts
// "Know when things break, fix them fast"

const axios = require('axios');
const fs = require('fs');

const ALERT_COOLDOWN = 5 * 60 * 1000; // 5 minutes between alerts
const HEALTH_CHECK_URL = 'http://localhost:3000/health';
const PHONE = process.env.ALERT_PHONE; // Your phone number
const lastAlert = { time: 0, service: '' };

async function checkHealth() {
  try {
    const response = await axios.get(HEALTH_CHECK_URL, { timeout: 5000 });
    return response.status === 200;
  } catch (e) {
    return false;
  }
}

function sendAlert(message) {
  const now = Date.now();
  if (now - lastAlert.time < ALERT_COOLDOWN) return;
  
  // Use Twilio, ntfy.sh, or just log to file for now
  console.log(`🚨 ALERT: ${message}`);
  fs.appendFileSync('/tmp/pi-alerts.log', `${new Date().toISOString()} ${message}\n`);
  
  lastAlert.time = now;
  lastAlert.service = message;
}

async function healthMonitor() {
  const healthy = await checkHealth();
  if (!healthy) {
    sendAlert('Pi API Hub is down');
  }
}

// Run health check every 2 minutes
setInterval(healthMonitor, 2 * 60 * 1000);

module.exports = { healthMonitor, sendAlert };