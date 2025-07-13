#!/usr/bin/env node
// 🎯 CARMACK ULTRA-MINIMAL + HOME LAB SECURITY
// Core functionality + practical security in ~220 lines

const express = require('express');
const axios = require('axios');
const { createLogger } = require('./request-logger');
const { rateLimiter } = require('./rate-limiter');
const { rotateApiKey } = require('./key-rotation');

// Config + security
const CFG = {
  port: process.env.PORT || 3000,
  anthropic: process.env.ANTHROPIC_API_KEY,
  ollama: process.env.OLLAMA_URL || 'http://10.0.0.120:11434',
  hubspot: process.env.HUBSPOT_PRIVATE_APP_TOKEN,
  authToken: process.env.INTERNAL_AUTH_TOKEN || 'homelab-default'
};

// Global state
let stats = { anthropic: 0, ollama: 0, errors: 0, requests: 0 };
let ollamaHealthy = false;
let lastCheck = 0;

// Simple auth for home lab
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (req.path === '/health' || token === CFG.authToken) return next();
  res.status(401).json({ error: 'Unauthorized' });
};

// Input sanitization
const clean = (str) => str?.replace(/[<>\"'&]/g, '').slice(0, 2000) || '';

const log = (msg, data = '') => console.log(`[${new Date().toISOString().slice(11,19)}] ${msg}`, data);

// Health check with 30s cache
async function checkOllama() {
  if (Date.now() - lastCheck < 30000) return ollamaHealthy;
  try {
    await axios.get(`${CFG.ollama}/api/tags`, { timeout: 3000 });
    ollamaHealthy = true;
  } catch { ollamaHealthy = false; }
  lastCheck = Date.now();
  return ollamaHealthy;
}

// AI Router with input sanitization
async function routeAI(prompt, maxTokens = 1000) {
  const cleanPrompt = clean(prompt);
  
  if (await checkOllama()) {
    try {
      const res = await axios.post(`${CFG.ollama}/api/generate`, {
        model: 'llama3.2:latest', prompt: cleanPrompt, stream: false
      }, { timeout: 20000 });
      stats.ollama++;
      return { text: res.data.response, provider: 'ollama' };
    } catch (e) { log('Ollama failed'); }
  }
  
  if (CFG.anthropic) {
    try {
      const res = await axios.post('https://api.anthropic.com/v1/messages', {
        model: 'claude-3-haiku-20240307', max_tokens: maxTokens,
        messages: [{ role: 'user', content: cleanPrompt }]
      }, {
        headers: { 'x-api-key': CFG.anthropic, 'anthropic-version': '2023-06-01' },
        timeout: 20000
      });
      stats.anthropic++;
      return { text: res.data.content[0].text, provider: 'anthropic' };
    } catch (e) { log('Anthropic failed'); }
  }
  
  stats.errors++;
  throw new Error('No AI available');
}

// Assistant factory with input cleaning
function createAssistant(name, emoji, prompt) {
  const history = [];
  return {
    name, emoji,
    async chat(msg) {
      const cleanMsg = clean(msg);
      const context = history.slice(-3).map(h => `Human: ${h.q}\nAssistant: ${h.a}`).join('\n');
      const fullPrompt = `${prompt}\n${context}\nHuman: ${cleanMsg}\nAssistant:`;
      
      try {
        const result = await routeAI(fullPrompt);
        history.push({ q: cleanMsg, a: result.text, t: Date.now() });
        if (history.length > 10) history.splice(0, 5);
        return { ok: true, text: result.text, provider: result.provider };
      } catch (e) {
        return { ok: false, error: 'Service unavailable' };
      }
    },
    stats: () => ({ conversations: history.length, lastUsed: history[history.length - 1]?.t })
  };
}

// Initialize assistants
const mark = createAssistant('Mark', '🐐', 
  'You are Mark, a Pi API Hub specialist. Provide API testing examples and HubSpot help.');

const mark2 = createAssistant('Mark2', '🐘', 
  'You are Mark2, a versatile AI assistant for coding and general conversations.');

// Express app with security middleware
const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(createLogger());
app.use(rateLimiter());
app.use(auth);
app.use((req, res, next) => { stats.requests++; next(); });

// Routes with minimal error disclosure
app.get('/health', (req, res) => res.json({ 
  status: 'ok', uptime: process.uptime(), requests: stats.requests 
}));

app.get('/stats', async (req, res) => res.json({
  ...stats, ollamaHealthy: await checkOllama(), total: stats.anthropic + stats.ollama
}));

app.post('/api/anthropic/messages', async (req, res) => {
  try {
    const prompt = req.body.messages?.map(m => `${m.role}: ${m.content}`).join('\n') || req.body.prompt;
    const result = await routeAI(prompt, req.body.max_tokens);
    res.json({ data: { content: [{ text: result.text }] }, metadata: { provider: result.provider } });
  } catch (e) { res.status(500).json({ error: 'Service unavailable' }); }
});

app.post('/api/mark/chat', async (req, res) => {
  const result = await mark.chat(req.body.message || '');
  res.json({ success: result.ok, data: result });
});

app.get('/api/mark/status', (req, res) => res.json({ 
  success: true, data: { ...mark.stats(), name: mark.name, emoji: mark.emoji } 
}));

app.post('/api/mark2/chat', async (req, res) => {
  const result = await mark2.chat(req.body.message || '');
  res.json({ success: result.ok, data: result });
});

app.get('/api/mark2/status', (req, res) => res.json({ 
  success: true, data: { ...mark2.stats(), name: mark2.name, emoji: mark2.emoji } 
}));

// HubSpot proxy with error handling
app.get('/api/hubspot/:endpoint', async (req, res) => {
  if (!CFG.hubspot) return res.status(503).json({ error: 'Service unavailable' });
  try {
    const response = await axios.get(`https://api.hubapi.com/crm/v3/objects/${req.params.endpoint}`, {
      headers: { Authorization: `Bearer ${CFG.hubspot}` }, timeout: 10000
    });
    res.json({ success: true, data: response.data });
  } catch (e) { res.status(500).json({ error: 'Service unavailable' }); }
});

// CLI mode
if (process.argv[2] === 'mark' || process.argv[2] === 'mark2') {
  const assistant = process.argv[2] === 'mark' ? mark : mark2;
  const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
  
  console.log(`\n${assistant.emoji} ${assistant.name} CLI - Type 'exit' to quit\n`);
  
  const chat = () => {
    rl.question('You: ', async (input) => {
      if (input.trim() === 'exit') { console.log(`\n${assistant.emoji} Goodbye!\n`); process.exit(0); }
      if (input.trim()) {
        process.stdout.write(`${assistant.emoji} Thinking...\n`);
        const result = await assistant.chat(input.trim());
        console.log(`${assistant.emoji} ${result.ok ? result.text : 'Service unavailable'}\n`);
      }
      chat();
    });
  };
  chat();
} else {
  // Server mode with key rotation
  setInterval(rotateApiKey, 24 * 60 * 60 * 1000); // Daily key rotation check
  
  app.listen(CFG.port, () => {
    log(`Secure ultra-minimal Pi API Hub started on :${CFG.port}`);
    console.log(`
🔒 CARMACK HOME LAB SECURITY EDITION
===================================
Server: http://localhost:${CFG.port}
Auth: Bearer ${CFG.authToken}

Security Features:
✅ Request logging & rate limiting
✅ Input sanitization & auth
✅ Auto key rotation (weekly)
✅ Error message hiding
✅ Network isolation ready

Usage:
  node secure-ultra-minimal.js mark   # 🐐 Mark CLI
  node secure-ultra-minimal.js mark2  # 🐘 Mark2 CLI

"Security through simplicity, not complexity." - Carmack
`);
  });
}

module.exports = { routeAI, createAssistant, checkOllama };