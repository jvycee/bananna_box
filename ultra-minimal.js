#!/usr/bin/env node

// 🎯 CARMACK ULTRA-MINIMAL: "50% fewer lines" challenge
// Core AI routing + assistants in absolute minimum code

const express = require('express');
const axios = require('axios');

// Config
const CFG = {
  port: process.env.PORT || 3000,
  anthropic: process.env.ANTHROPIC_API_KEY,
  ollama: process.env.OLLAMA_URL || 'http://10.0.0.120:11434',
  hubspot: process.env.HUBSPOT_PRIVATE_APP_TOKEN
};

// Global state
let stats = { anthropic: 0, ollama: 0, errors: 0, requests: 0 };
let ollamaHealthy = false;
let lastCheck = 0;

// Pi Guardian - Carmack ultra-minimal hardware monitoring
let piHealth = { temp: 0, throttled: false, storage: 100, lastPiCheck: 0 };

async function checkPi() {
  if (Date.now() - piHealth.lastPiCheck < 30000) return piHealth;
  try {
    const { exec } = require('child_process');
    const execPromise = (cmd) => new Promise((resolve, reject) => {
      exec(cmd, { timeout: 5000 }, (err, stdout) => err ? reject(err) : resolve(stdout.trim()));
    });
    
    const temp = await execPromise('vcgencmd measure_temp');
    piHealth.temp = parseFloat(temp.match(/[\d.]+/)[0]);
    
    const throttled = await execPromise('vcgencmd get_throttled');
    piHealth.throttled = throttled.includes('0x50000') || throttled.includes('0x50005');
    
    const df = await execPromise('df / | tail -1');
    piHealth.storage = 100 - parseInt(df.split(/\s+/)[4].replace('%', ''));
    
    if (piHealth.temp > 75) log(`🔥 Pi temp high: ${piHealth.temp}°C`);
    
  } catch { /* Pi commands not available */ }
  piHealth.lastPiCheck = Date.now();
  return piHealth;
}

// Ultra-simple logger
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

// AI Router - Ollama first, Anthropic fallback
async function routeAI(prompt, maxTokens = 1000) {
  if (await checkOllama()) {
    try {
      const res = await axios.post(`${CFG.ollama}/api/generate`, {
        model: 'llama3.2:latest', prompt, stream: false
      }, { timeout: 20000 });
      stats.ollama++;
      return { text: res.data.response, provider: 'ollama' };
    } catch (e) { log('Ollama failed:', e.message); }
  }
  
  if (CFG.anthropic) {
    try {
      const res = await axios.post('https://api.anthropic.com/v1/messages', {
        model: 'claude-3-haiku-20240307', max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }]
      }, {
        headers: { 'x-api-key': CFG.anthropic, 'anthropic-version': '2023-06-01' },
        timeout: 20000
      });
      stats.anthropic++;
      return { text: res.data.content[0].text, provider: 'anthropic' };
    } catch (e) { log('Anthropic failed:', e.message); }
  }
  
  stats.errors++;
  throw new Error('No AI available');
}

// Assistant factory - specialized vs general
function createAssistant(name, emoji, prompt) {
  const history = [];
  return {
    name, emoji,
    async chat(msg) {
      const context = history.slice(-3).map(h => `Human: ${h.q}\nAssistant: ${h.a}`).join('\n');
      const fullPrompt = `${prompt}\n${context}\nHuman: ${msg}\nAssistant:`;
      
      try {
        const result = await routeAI(fullPrompt);
        history.push({ q: msg, a: result.text, t: Date.now() });
        if (history.length > 10) history.splice(0, 5);
        return { ok: true, text: result.text, provider: result.provider };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },
    stats: () => ({ conversations: history.length, lastUsed: history[history.length - 1]?.t })
  };
}

// Initialize assistants
const mark = createAssistant('Mark', '🐐', 
  'You are Mark, a Pi API Hub specialist. Provide API testing examples, curl commands, and HubSpot integration help.');

const mark2 = createAssistant('Mark2', '🐘', 
  'You are Mark2, a versatile AI assistant. Help with coding, writing, learning, and general conversations.');

// Express app
const app = express();
app.use(express.json());
app.use((req, res, next) => { stats.requests++; log(`${req.method} ${req.path}`); next(); });

// Routes
app.get('/health', async (req, res) => {
  const pi = await checkPi();
  res.json({ 
    status: 'ok', uptime: process.uptime(), requests: stats.requests,
    pi: { temp: pi.temp + '°C', throttled: pi.throttled, storage: pi.storage + '% free' }
  });
});

app.get('/stats', async (req, res) => res.json({
  ...stats, ollamaHealthy: await checkOllama(), 
  anthropicConfigured: !!CFG.anthropic, total: stats.anthropic + stats.ollama,
  pi: await checkPi()
}));

app.post('/api/anthropic/messages', async (req, res) => {
  try {
    const prompt = req.body.messages?.map(m => `${m.role}: ${m.content}`).join('\n') || req.body.prompt;
    const result = await routeAI(prompt, req.body.max_tokens);
    res.json({ data: { content: [{ text: result.text }] }, metadata: { provider: result.provider } });
  } catch (e) { res.status(500).json({ error: e.message }); }
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

// HubSpot proxy - Full CRUD
app.get('/api/hubspot/:endpoint', async (req, res) => {
  if (!CFG.hubspot) return res.status(503).json({ error: 'HubSpot not configured' });
  try {
    const response = await axios.get(`https://api.hubapi.com/crm/v3/objects/${req.params.endpoint}`, {
      headers: { Authorization: `Bearer ${CFG.hubspot}` }, timeout: 10000
    });
    res.json({ success: true, data: response.data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/hubspot/:endpoint', async (req, res) => {
  if (!CFG.hubspot) return res.status(503).json({ error: 'HubSpot not configured' });
  try {
    const response = await axios.post(`https://api.hubapi.com/crm/v3/objects/${req.params.endpoint}`, req.body, {
      headers: { Authorization: `Bearer ${CFG.hubspot}`, 'Content-Type': 'application/json' }, timeout: 10000
    });
    res.json({ success: true, data: response.data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/hubspot/:endpoint/:id', async (req, res) => {
  if (!CFG.hubspot) return res.status(503).json({ error: 'HubSpot not configured' });
  try {
    const response = await axios.patch(`https://api.hubapi.com/crm/v3/objects/${req.params.endpoint}/${req.params.id}`, req.body, {
      headers: { Authorization: `Bearer ${CFG.hubspot}`, 'Content-Type': 'application/json' }, timeout: 10000
    });
    res.json({ success: true, data: response.data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/hubspot/:endpoint/:id', async (req, res) => {
  if (!CFG.hubspot) return res.status(503).json({ error: 'HubSpot not configured' });
  try {
    await axios.delete(`https://api.hubapi.com/crm/v3/objects/${req.params.endpoint}/${req.params.id}`, {
      headers: { Authorization: `Bearer ${CFG.hubspot}` }, timeout: 10000
    });
    res.json({ success: true, data: { deleted: true, id: req.params.id } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Webhooks endpoint
app.post('/webhooks/:source', (req, res) => {
  log(`📨 Webhook from ${req.params.source}:`, JSON.stringify(req.body, null, 2));
  stats.requests++;
  res.json({ success: true, received: new Date().toISOString(), source: req.params.source });
});

app.get('/webhooks/url/:source', (req, res) => {
  const webhookUrl = `http://localhost:${CFG.port}/webhooks/${req.params.source}`;
  res.json({ success: true, webhook_url: webhookUrl, source: req.params.source });
});

// GraphQL endpoint (simple query resolver)
app.post('/graphql', (req, res) => {
  const { query, variables } = req.body;
  log(`📊 GraphQL Query:`, query);
  
  // Simple resolver for common queries
  if (query.includes('contacts')) {
    res.json({ data: { contacts: { message: "Use /api/hubspot/contacts for REST API" } } });
  } else if (query.includes('stats')) {
    res.json({ data: { stats } });
  } else {
    res.json({ data: { message: "GraphQL endpoint active - extend resolvers as needed" } });
  }
});

// MCP Tools
const mcpTools = {
  hubspot_contacts: async (args) => {
    if (!CFG.hubspot) return { error: 'HubSpot not configured' };
    try {
      const response = await axios.get('https://api.hubapi.com/crm/v3/objects/contacts', {
        headers: { Authorization: `Bearer ${CFG.hubspot}` }
      });
      return { success: true, contacts: response.data.results };
    } catch (e) {
      return { error: e.message };
    }
  },
  
  create_contact: async (args) => {
    if (!CFG.hubspot) return { error: 'HubSpot not configured' };
    try {
      const response = await axios.post('https://api.hubapi.com/crm/v3/objects/contacts', {
        properties: args
      }, {
        headers: { Authorization: `Bearer ${CFG.hubspot}`, 'Content-Type': 'application/json' }
      });
      return { success: true, contact: response.data };
    } catch (e) {
      return { error: e.message };
    }
  },
  
  pi_stats: async () => ({ success: true, stats, pi: await checkPi() })
};

app.post('/mcp/tool/:tool', async (req, res) => {
  const tool = mcpTools[req.params.tool];
  if (!tool) return res.status(404).json({ error: 'Tool not found' });
  
  const result = await tool(req.body);
  res.json(result);
});

app.get('/mcp/tools', (req, res) => {
  res.json({ 
    success: true, 
    tools: Object.keys(mcpTools),
    endpoints: {
      call_tool: '/mcp/tool/:tool',
      list_tools: '/mcp/tools'
    }
  });
});

// Root route
app.get('/', (req, res) => {
  res.json({
    name: '🎯 Carmack Ultra-Minimal Pi API Hub',
    version: '2.0.0',
    features: ['AI Routing', 'HubSpot CRUD', 'Webhooks', 'GraphQL', 'MCP Tools', 'Pi Monitoring'],
    endpoints: {
      health: '/health',
      stats: '/stats',
      anthropic: '/api/anthropic/messages',
      mark: '/api/mark/chat',
      mark2: '/api/mark2/chat',
      hubspot_get: '/api/hubspot/:endpoint',
      hubspot_post: '/api/hubspot/:endpoint',
      hubspot_patch: '/api/hubspot/:endpoint/:id',
      hubspot_delete: '/api/hubspot/:endpoint/:id',
      webhooks_receive: '/webhooks/:source',
      webhooks_url: '/webhooks/url/:source',
      graphql: '/graphql',
      mcp_tools: '/mcp/tools',
      mcp_call: '/mcp/tool/:tool'
    },
    cli: 'node ultra-minimal.js mark|mark2'
  });
});

// Webhook URL helper endpoint
app.get("/webhook-url", async (req, res) => {
  try {
    const response = await axios.get("http://localhost:4040/api/tunnels");
    const tunnelUrl = response.data.tunnels[0]?.public_url;
    if (tunnelUrl) {
      res.json({ 
        success: true, 
        webhook_url: `${tunnelUrl}/webhooks/hubspot`,
        tunnel_url: tunnelUrl 
      });
    } else {
      res.json({ success: false, error: "No ngrok tunnel found. Start ngrok first: ngrok http 3333" });
    }
  } catch (e) {
    res.json({ success: false, error: "ngrok not running. Start with: ngrok http 3333" });
  }
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
        console.log(`${assistant.emoji} ${result.ok ? result.text : 'Error: ' + result.error}\n`);
      }
      chat();
    });
  };
  chat();
} else {
  // Server mode
  app.listen(CFG.port, () => {
    log(`Ultra-minimal Pi API Hub started on :${CFG.port}`);
    
    // Start Pi monitoring
    setInterval(checkPi, 60000);
    
    console.log(`\n🎯 CARMACK ULTRA-MINIMAL EDITION + PI GUARDIAN
================================================
Lines of code: ~140 (Pi hardware monitoring included!)
Server: http://localhost:${CFG.port}

Usage:
  node ultra-minimal.js mark   # 🐐 Mark CLI
  node ultra-minimal.js mark2  # 🐘 Mark2 CLI

Core features:
  ✅ Smart AI routing (Ollama→Anthropic)
  ✅ Mark & Mark2 assistants with memory
  ✅ Health monitoring & stats
  ✅ HubSpot proxy
  ✅ CLI interfaces
  ✅ API compatibility

"The best code is code you don't have to write." - Carmack
`);
  });
}

module.exports = { routeAI, createAssistant, checkOllama };
