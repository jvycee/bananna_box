#!/usr/bin/env node
// 🎯 CARMACK HOME LAB SECURITY: API Key Rotation
// "Security through simplicity, not complexity"

const fs = require('fs');
const crypto = require('crypto');

const ENV_FILE = process.env.ENV_FILE || '/home/jvycee/pi-api-hub/.env';
const ROTATION_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7 days

function rotateApiKey() {
  try {
    const env = fs.readFileSync(ENV_FILE, 'utf8');
    const lines = env.split('\n');
    const rotationKey = `LAST_KEY_ROTATION=${Date.now()}`;
    
    // Check if rotation needed
    const lastRotation = lines.find(l => l.startsWith('LAST_KEY_ROTATION='));
    if (lastRotation) {
      const lastTime = parseInt(lastRotation.split('=')[1]);
      if (Date.now() - lastTime < ROTATION_INTERVAL) {
        console.log('⏳ Key rotation not due yet');
        return;
      }
    }
    
    // Generate new internal auth token
    const newToken = crypto.randomBytes(32).toString('hex');
    const updatedLines = lines
      .filter(l => !l.startsWith('INTERNAL_AUTH_TOKEN=') && !l.startsWith('LAST_KEY_ROTATION='))
      .concat([`INTERNAL_AUTH_TOKEN=${newToken}`, rotationKey])
      .filter(l => l.trim());
    
    fs.writeFileSync(ENV_FILE, updatedLines.join('\n') + '\n');
    console.log('🔄 API key rotated successfully');
  } catch (e) {
    console.log('❌ Key rotation failed:', e.message);
  }
}

// Run if called directly
if (require.main === module) rotateApiKey();

module.exports = { rotateApiKey };