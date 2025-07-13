#!/usr/bin/env node

// 🎯 CARMACK CHALLENGE: Core Pi API Hub in <1000 lines
// AI routing, health monitoring, CLI assistants - maximum simplicity

const express = require('express');
const axios = require('axios');
const { spawn } = require('child_process');

// =================== CONFIGURATION ===================
const config = {
  port: process.env.PORT || 3000,
  anthropicKey: process.env.ANTHROPIC_API_KEY,
  ollamaUrl: process.env.OLLAMA_URL || 'http://10.0.0.120:11434',
  hubspotKey: process.env.HUBSPOT_PRIVATE_APP_TOKEN
};

// =================== SIMPLE LOGGER ===================
const log = (level, msg, data = {}) => {
  console.log(`[${new Date().toISOString()}] ${level.toUpperCase()}: ${msg}`, 
    Object.keys(data).length ? JSON.stringify(data) : '');
};

// =================== AI ROUTER ===================
class AIRouter {
  constructor() {
    this.stats = { anthropic: 0, ollama: 0, errors: 0 };
    this.ollamaHealthy = false;
    this.anthropicHealthy = !!config.anthropicKey;
    this.lastHealthCheck = 0;
  }

  async checkHealth() {
    if (Date.now() - this.lastHealthCheck < 30000) return; // 30s cache
    
    // Check Ollama
    try {
      await axios.get(`${config.ollamaUrl}/api/tags`, { timeout: 5000 });
      this.ollamaHealthy = true;
    } catch (e) {
      this.ollamaHealthy = false;
    }
    
    this.lastHealthCheck = Date.now();
    log('debug', 'Health check', { ollama: this.ollamaHealthy, anthropic: this.anthropicHealthy });
  }

  async route(messages, maxTokens = 4096) {
    await this.checkHealth();
    
    // Try Ollama first if healthy
    if (this.ollamaHealthy) {
      try {
        const prompt = messages.map(m => `${m.role === 'user' ? 'Human' : 'Assistant'}: ${m.content}`).join('\n') + '\nAssistant:';
        
        const response = await axios.post(`${config.ollamaUrl}/api/generate`, {
          model: 'llama3.2:latest',
          prompt,
          stream: false,
          options: { temperature: 0.7 }
        }, { timeout: 30000 });
        
        this.stats.ollama++;
        return { content: response.data.response, provider: 'ollama' };
      } catch (e) {
        log('warn', 'Ollama failed, trying Anthropic', { error: e.message });
      }
    }
    
    // Fallback to Anthropic
    if (this.anthropicHealthy) {
      try {
        const response = await axios.post('https://api.anthropic.com/v1/messages', {
          model: 'claude-3-haiku-20240307',
          max_tokens: maxTokens,
          messages
        }, {
          headers: {
            'x-api-key': config.anthropicKey,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01'
          },
          timeout: 30000
        });
        
        this.stats.anthropic++;
        return { content: response.data.content[0].text, provider: 'anthropic' };
      } catch (e) {
        log('error', 'Anthropic failed', { error: e.message });
      }
    }
    
    this.stats.errors++;
    throw new Error('No AI providers available');
  }

  getStats() {
    return {
      ...this.stats,
      ollamaHealthy: this.ollamaHealthy,
      anthropicHealthy: this.anthropicHealthy,
      total: this.stats.anthropic + this.stats.ollama
    };
  }
}

// =================== AI ASSISTANT BASE ===================
class Assistant {
  constructor(name, emoji, personality) {
    this.name = name;
    this.emoji = emoji;
    this.personality = personality;
    this.history = [];
    this.router = new AIRouter();
  }

  addToHistory(user, assistant) {
    this.history.push({ user, assistant, timestamp: Date.now() });
    if (this.history.length > 20) this.history = this.history.slice(-20);
  }

  async chat(message) {
    const context = this.history.slice(-5).map(h => 
      `Human: ${h.user}\nAssistant: ${h.assistant}`
    ).join('\n\n');
    
    const systemMessage = `You are ${this.name} ${this.emoji}, ${this.personality}. ${context ? 'Recent conversation:\n' + context : ''}`;
    
    const messages = [
      { role: 'user', content: `${systemMessage}\n\nHuman: ${message}\n${this.name}:` }
    ];
    
    try {
      const result = await this.router.route(messages);
      this.addToHistory(message, result.content);
      return { success: true, response: result.content, provider: result.provider };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  getStats() {
    return {
      name: this.name,
      conversations: this.history.length,
      routerStats: this.router.getStats()
    };
  }
}

// =================== MARK: Pi API Hub Assistant ===================
class Mark extends Assistant {
  constructor() {
    super('Mark', '🐐', 'an AI assistant specialized in Pi API Hub infrastructure, API testing, webhooks, and HubSpot integration. You provide practical examples and curl commands.');
  }
}

// =================== MARK2: General Purpose Assistant ===================
class Mark2 extends Assistant {
  constructor() {
    super('Mark2', '🐘', 'a versatile AI assistant for general conversations, coding help, creative writing, and learning. You adapt your tone to the user\'s needs.');
  }
}

// =================== HEALTH MONITOR ===================
class HealthMonitor {
  constructor() {
    this.startTime = Date.now();
    this.requestCount = 0;
    this.errorCount = 0;
  }

  recordRequest(success = true) {
    this.requestCount++;
    if (!success) this.errorCount++;
  }

  getStatus() {
    const uptime = Date.now() - this.startTime;
    return {
      status: 'healthy',
      uptime: Math.floor(uptime / 1000),
      requests: this.requestCount,
      errors: this.errorCount,
      errorRate: this.requestCount > 0 ? (this.errorCount / this.requestCount * 100).toFixed(2) + '%' : '0%',
      timestamp: new Date().toISOString()
    };
  }
}

// =================== MAIN APPLICATION ===================
const app = express();
app.use(express.json());

// Initialize services
const mark = new Mark();
const mark2 = new Mark2();
const health = new HealthMonitor();
const router = new AIRouter();

// Middleware
app.use((req, res, next) => {
  log('info', `${req.method} ${req.path}`);
  next();
});

// =================== API ENDPOINTS ===================

// Health check
app.get('/health', (req, res) => {
  health.recordRequest();
  res.json(health.getStatus());
});

// AI routing endpoint
app.post('/api/anthropic/messages', async (req, res) => {
  try {
    const { messages, max_tokens } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array required' });
    }

    const result = await router.route(messages, max_tokens);
    health.recordRequest(true);
    
    res.json({
      data: { content: [{ text: result.content }] },
      metadata: { provider: result.provider, responseTime: Date.now() }
    });
  } catch (error) {
    health.recordRequest(false);
    log('error', 'AI routing failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// HubSpot proxy (simplified)
app.get('/api/hubspot/:endpoint', async (req, res) => {
  if (!config.hubspotKey) {
    return res.status(503).json({ error: 'HubSpot not configured' });
  }

  try {
    const response = await axios.get(`https://api.hubapi.com/crm/v3/objects/${req.params.endpoint}`, {
      headers: { 'Authorization': `Bearer ${config.hubspotKey}` },
      timeout: 10000
    });
    
    health.recordRequest(true);
    res.json({ success: true, data: response.data });
  } catch (error) {
    health.recordRequest(false);
    res.status(500).json({ error: error.message });
  }
});

// Mark AI assistant
app.post('/api/mark/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });
    
    const result = await mark.chat(message);
    health.recordRequest(result.success);
    res.json({ success: result.success, data: result });
  } catch (error) {
    health.recordRequest(false);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/mark/status', (req, res) => {
  res.json({ success: true, data: mark.getStats() });
});

// Mark2 AI assistant
app.post('/api/mark2/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });
    
    const result = await mark2.chat(message);
    health.recordRequest(result.success);
    res.json({ success: result.success, data: result });
  } catch (error) {
    health.recordRequest(false);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/mark2/status', (req, res) => {
  res.json({ success: true, data: mark2.getStats() });
});

// System stats
app.get('/stats', (req, res) => {
  res.json({
    health: health.getStatus(),
    aiRouter: router.getStats(),
    mark: mark.getStats(),
    mark2: mark2.getStats(),
    config: {
      anthropicConfigured: !!config.anthropicKey,
      hubspotConfigured: !!config.hubspotKey,
      ollamaUrl: config.ollamaUrl
    }
  });
});

// =================== CLI HELPERS ===================

// Simple CLI launcher
function launchCLI(assistant, name) {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `You: `
  });

  console.log(`\n${assistant.emoji} ${name} CLI - Type 'exit' to quit\n`);
  rl.prompt();

  rl.on('line', async (input) => {
    const message = input.trim();
    if (message === 'exit') {
      console.log(`\n${assistant.emoji} Goodbye!\n`);
      process.exit(0);
    }
    
    if (message) {
      console.log(`\n${assistant.emoji} ${name} is thinking...`);
      const result = await assistant.chat(message);
      
      if (result.success) {
        console.log(`\n${assistant.emoji} ${name}: ${result.response}\n`);
      } else {
        console.log(`\n❌ Error: ${result.error}\n`);
      }
    }
    
    rl.prompt();
  });
}

// =================== STARTUP ===================

// Handle CLI mode
if (process.argv[2] === 'mark') {
  launchCLI(mark, 'Mark');
} else if (process.argv[2] === 'mark2') {
  launchCLI(mark2, 'Mark2');
} else {
  // Start server
  app.listen(config.port, () => {
    log('info', 'Pi API Hub (Carmack Edition) started', { 
      port: config.port,
      anthropic: !!config.anthropicKey,
      hubspot: !!config.hubspotKey,
      ollama: config.ollamaUrl
    });
    
    console.log(`
🎯 CARMACK CHALLENGE IMPLEMENTATION
=====================================
Server: http://localhost:${config.port}
Health: http://localhost:${config.port}/health
Stats:  http://localhost:${config.port}/stats

CLI Usage:
  node minimal-api-hub.js mark   # Launch Mark
  node minimal-api-hub.js mark2  # Launch Mark2

API Endpoints:
  POST /api/anthropic/messages   # AI routing
  POST /api/mark/chat           # Mark assistant
  POST /api/mark2/chat          # Mark2 assistant
  GET  /api/hubspot/:endpoint   # HubSpot proxy

Total lines: ${__filename.split('\n').length} (excluding comments)
`);
  });
}

module.exports = { AIRouter, Assistant, Mark, Mark2, HealthMonitor };