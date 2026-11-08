#!/usr/bin/env node
// 🎯 CARMACK HOME LAB SECURITY: API Key Rotation
// "Security through simplicity, not complexity"

const fs = require('fs');
const crypto = require('crypto');

const DEFAULT_ENV_FILE = process.env.ENV_FILE || '/home/jvycee/pi-api-hub/.env';
const ROTATION_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7 days

function rotateApiKey(options = {}) {
  const envFile = options.envFile || DEFAULT_ENV_FILE;
  try {
    const env = fs.readFileSync(envFile, 'utf8');
    const lines = env.split('\n');
    const rotationKey = `LAST_KEY_ROTATION=${Date.now()}`;
    
    // Check if rotation needed
    const lastRotation = lines.find(l => l.startsWith('LAST_KEY_ROTATION='));
    if (lastRotation) {
      const lastTime = parseInt(lastRotation.split('=')[1], 10);
      if (Date.now() - lastTime < ROTATION_INTERVAL) {
        console.log('⏳ Key rotation not due yet');
        return { rotated: false };
      }
    }
    
    // Generate new internal auth token
    const newToken = crypto.randomBytes(32).toString('hex');
    const updatedLines = lines
      .filter(l => !l.startsWith('INTERNAL_AUTH_TOKEN=') && !l.startsWith('LAST_KEY_ROTATION='))
      .concat([`INTERNAL_AUTH_TOKEN=${newToken}`, rotationKey])
      .filter(l => l.trim());
    
    fs.writeFileSync(envFile, updatedLines.join('\n') + '\n');
    if (typeof options.onRotated === 'function') options.onRotated(newToken);
    console.log('🔄 API key rotated successfully');
    return { rotated: true };
  } catch (e) {
    console.log('❌ Key rotation failed:', e.message);
    return { rotated: false };
  }
}

// Run if called directly
if (require.main === module) rotateApiKey();

module.exports = { rotateApiKey };