#!/usr/bin/env node

// 🎯 CARMACK ULTRA-MINIMAL: "50% fewer lines" challenge
// Core AI routing + assistants in absolute minimum code

require('dotenv').config();
const express = require('express');
const axios = require('axios');

// Config
const CFG = {
  port: process.env.PORT || 3000,
  anthropic: process.env.ANTHROPIC_API_KEY,
  ollama: process.env.OLLAMA_URL || 'http://10.0.0.120:11434',
  hubspot: process.env.HUBSPOT_PRIVATE_APP_TOKEN || process.env.HUBSPOT_API_KEY
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

// Enhanced search endpoint for all CRM objects and engagements  
app.post('/api/hubspot/:endpoint/search', async (req, res) => {
  if (!CFG.hubspot) return res.status(503).json({ error: 'HubSpot not configured' });
  
  // All supported CRM endpoints from documentation
  const supportedEndpoints = [
    // Standard Objects
    'contacts', 'companies', 'deals', 'tickets', 'products', 'quotes', 'line_items',
    // E-commerce Objects  
    'carts', 'orders', 'commerce_payments', 'subscriptions', 'invoices', 'discounts', 'fees', 'taxes',
    // Engagements
    'calls', 'emails', 'meetings', 'notes', 'tasks',
    // Other Objects
    'leads', 'feedback_submissions', 'deal_split'
  ];
  
  const endpoint = req.params.endpoint;
  
  if (!supportedEndpoints.includes(endpoint)) {
    return res.status(400).json({ 
      error: `Unsupported endpoint: ${endpoint}`,
      supported_endpoints: supportedEndpoints,
      documentation: "https://developers.hubspot.com/docs/api/crm/search"
    });
  }
  
  try {
    // Add query string search if just a 'query' field is provided
    let searchBody = req.body;
    if (searchBody.query && !searchBody.filterGroups) {
      searchBody = { query: searchBody.query, limit: searchBody.limit || 10 };
    }
    
    // Validate limits per HubSpot documentation
    if (searchBody.limit && searchBody.limit > 200) {
      searchBody.limit = 200; // Max 200 per page
    }
    
    // Validate filter groups (max 5 groups, 6 filters each, 18 total)
    if (searchBody.filterGroups) {
      if (searchBody.filterGroups.length > 5) {
        return res.status(400).json({ error: 'Maximum 5 filterGroups allowed' });
      }
      
      let totalFilters = 0;
      for (const group of searchBody.filterGroups) {
        if (group.filters && group.filters.length > 6) {
          return res.status(400).json({ error: 'Maximum 6 filters per filterGroup allowed' });
        }
        totalFilters += group.filters ? group.filters.length : 0;
      }
      
      if (totalFilters > 18) {
        return res.status(400).json({ error: 'Maximum 18 total filters allowed' });
      }
    }
    
    const response = await axios.post(`https://api.hubapi.com/crm/v3/objects/${endpoint}/search`, searchBody, {
      headers: { Authorization: `Bearer ${CFG.hubspot}`, 'Content-Type': 'application/json' }, timeout: 10000
    });
    
    // Enhanced response with metadata
    res.json({ 
      success: true, 
      data: response.data,
      endpoint: endpoint,
      request_body_size: JSON.stringify(searchBody).length,
      rate_limit_info: {
        limit: "5 requests per second",
        max_results: "10,000 total results per query",
        max_page_size: "200 objects per page"
      }
    });
    
  } catch (e) { 
    res.status(500).json({ 
      error: e.message,
      endpoint: endpoint,
      hubspot_documentation: "https://developers.hubspot.com/docs/api/crm/search"
    }); 
  }
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

// Enhanced GraphQL endpoint supporting CRM, HUBDB, BLOG, KB data sources
app.post('/graphql', async (req, res) => {
  const { query, variables } = req.body;
  log(`📊 GraphQL Query:`, query);
  
  // GraphQL query complexity tracking
  let complexity = { used_points: 0, max_points: 30000 };
  
  try {
    // CRM Data Source
    if (query.includes('CRM {') && CFG.hubspot) {
      const crmObjects = {
        // Standard Objects
        'contact_collection': { endpoint: 'contacts', defaultProps: ['firstname', 'lastname', 'email', 'lastmodifieddate', 'hs_object_id', 'createdate'] },
        'company_collection': { endpoint: 'companies', defaultProps: ['name', 'domain', 'createdate', 'hs_lastmodifieddate', 'hs_object_id'] },
        'deal_collection': { endpoint: 'deals', defaultProps: ['dealname', 'amount', 'closedate', 'pipeline', 'dealstage', 'createdate', 'hs_lastmodifieddate', 'hs_object_id'] },
        'ticket_collection': { endpoint: 'tickets', defaultProps: ['content', 'hs_pipeline', 'hs_pipeline_stage', 'hs_ticket_category', 'hs_ticket_priority', 'subject', 'createdate', 'hs_lastmodifieddate', 'hs_object_id'] },
        'product_collection': { endpoint: 'products', defaultProps: ['name', 'description', 'price', 'createdate', 'hs_lastmodifieddate', 'hs_object_id'] },
        'quote_collection': { endpoint: 'quotes', defaultProps: ['hs_expiration_date', 'hs_public_url_key', 'hs_status', 'hs_title', 'hs_createdate', 'hs_lastmodifieddate', 'hs_object_id'] },
        'line_item_collection': { endpoint: 'line_items', defaultProps: ['quantity', 'amount', 'price', 'createdate', 'hs_lastmodifieddate', 'hs_object_id'] },
        
        // E-commerce Objects
        'cart_collection': { endpoint: 'carts', defaultProps: ['createdate', 'hs_lastmodifieddate', 'hs_object_id'] },
        'order_collection': { endpoint: 'orders', defaultProps: ['createdate', 'hs_lastmodifieddate', 'hs_object_id'] },
        'payment_collection': { endpoint: 'commerce_payments', defaultProps: ['createdate', 'hs_lastmodifieddate', 'hs_object_id'] },
        'subscription_collection': { endpoint: 'subscriptions', defaultProps: ['hs_createdate', 'hs_lastmodifieddate', 'hs_object_id'] },
        'invoice_collection': { endpoint: 'invoices', defaultProps: ['createdate', 'hs_lastmodifieddate', 'hs_object_id'] },
        'discount_collection': { endpoint: 'discounts', defaultProps: ['createdate', 'hs_lastmodifieddate', 'hs_object_id'] },
        'fee_collection': { endpoint: 'fees', defaultProps: ['createdate', 'hs_lastmodifieddate', 'hs_object_id'] },
        'tax_collection': { endpoint: 'taxes', defaultProps: ['createdate', 'hs_lastmodifieddate', 'hs_object_id'] },
        
        // Engagements
        'call_collection': { endpoint: 'calls', defaultProps: ['hs_createdate', 'hs_lastmodifieddate', 'hs_object_id'] },
        'email_collection': { endpoint: 'emails', defaultProps: ['hs_createdate', 'hs_lastmodifieddate', 'hs_object_id'] },
        'meeting_collection': { endpoint: 'meetings', defaultProps: ['hs_createdate', 'hs_lastmodifieddate', 'hs_object_id'] },
        'note_collection': { endpoint: 'notes', defaultProps: ['hs_createdate', 'hs_lastmodifieddate', 'hs_object_id'] },
        'task_collection': { endpoint: 'tasks', defaultProps: ['hs_createdate', 'hs_lastmodifieddate', 'hs_object_id'] },
        
        // Other Objects
        'lead_collection': { endpoint: 'leads', defaultProps: ['createdate', 'hs_lastmodifieddate', 'hs_object_id'] },
        'feedback_submission_collection': { endpoint: 'feedback_submissions', defaultProps: ['hs_createdate', 'hs_lastmodifieddate', 'hs_object_id'] },
        'deal_split_collection': { endpoint: 'deal_split', defaultProps: ['hs_createdate', 'hs_lastmodifieddate', 'hs_object_id'] }
      };
      
      for (const [collection, config] of Object.entries(crmObjects)) {
        if (query.includes(collection)) {
          complexity.used_points += 300; // Internal API request
          
          // Parse comprehensive filters from GraphQL query
          const searchBody = parseGraphQLFilters(query, config.defaultProps);
          
          const response = await axios.post(`https://api.hubapi.com/crm/v3/objects/${config.endpoint}/search`, searchBody, {
            headers: { Authorization: `Bearer ${CFG.hubspot}`, 'Content-Type': 'application/json' }, timeout: 10000
          });
          
          complexity.used_points += response.data.results.length * 30; // Objects retrieved
          
          // Map response to GraphQL format with proper property mapping
          const items = response.data.results.map(item => {
            const mapped = { id: item.id };
            searchBody.properties.forEach(prop => {
              mapped[prop] = item.properties[prop];
              complexity.used_points += item.properties[prop] ? 3 : 1; // Property with/without value
            });
            return mapped;
          });
          
          return res.json({
            data: { CRM: { [collection]: { items, total: response.data.total || items.length } } },
            extensions: { query_complexity: complexity }
          });
        }
      }
    }
    
    // HUBDB Data Source (basic implementation)
    if (query.includes('HUBDB {')) {
      return res.json({ 
        data: { message: "HUBDB queries require HubDB table access - contact admin for setup" },
        extensions: { query_complexity: complexity }
      });
    }
    
    // BLOG Data Source (basic implementation) 
    if (query.includes('BLOG {')) {
      return res.json({ 
        data: { message: "BLOG queries require Content Hub Professional+ - contact admin for setup" },
        extensions: { query_complexity: complexity }
      });
    }
    
    // KB Data Source (basic implementation)
    if (query.includes('KB {')) {
      return res.json({ 
        data: { message: "Knowledge Base queries require Service Hub Enterprise+ - contact admin for setup" },
        extensions: { query_complexity: complexity }
      });
    }
    
    // Stats endpoint
    if (query.includes('stats')) {
      return res.json({ data: { stats }, extensions: { query_complexity: complexity } });
    }
    
    // Default response with all supported collections
    res.json({ 
      data: { 
        message: "GraphQL endpoint supports CRM, HUBDB, BLOG, KB data sources",
        supported_crm_collections: Object.keys(crmObjects).slice(0, 10) + "... and more"
      },
      extensions: { query_complexity: complexity }
    });
    
  } catch (e) {
    res.json({ errors: [{ message: e.message }], extensions: { query_complexity: complexity } });
  }
});

// Parse GraphQL filters into HubSpot search format
function parseGraphQLFilters(query, defaultProps) {
  const searchBody = { filterGroups: [], properties: defaultProps, limit: 10 };
  
  // Extract filter from GraphQL query
  const filterMatch = query.match(/filter:\s*{([^}]+)}/);
  if (!filterMatch) return searchBody;
  
  const filterContent = filterMatch[1];
  const filters = [];
  
  // All HubSpot operators with GraphQL syntax
  const operatorMappings = {
    '__eq': 'EQ', '__neq': 'NEQ', '__lt': 'LT', '__lte': 'LTE', 
    '__gt': 'GT', '__gte': 'GTE', '__contains': 'CONTAINS_TOKEN', 
    '__not_contains': 'NOT_CONTAINS_TOKEN', '__in': 'IN', '__not_in': 'NOT_IN',
    '__null': 'HAS_PROPERTY', '__not_null': 'NOT_HAS_PROPERTY'
  };
  
  // Parse each operator type
  for (const [graphqlOp, hubspotOp] of Object.entries(operatorMappings)) {
    const regex = new RegExp(`(\\w+)${graphqlOp.replace('_', '\\_')}:\\s*"([^"]+)"`, 'g');
    let match;
    while ((match = regex.exec(filterContent)) !== null) {
      const [, prop, value] = match;
      filters.push({ propertyName: prop, operator: hubspotOp, value });
    }
  }
  
  // Parse BETWEEN operator (special case)
  const betweenMatch = filterContent.match(/(\w+)__between:\s*{[^}]*value:\s*"([^"]+)"[^}]*highValue:\s*"([^"]+)"[^}]*}/);
  if (betweenMatch) {
    const [, prop, lowValue, highValue] = betweenMatch;
    filters.push({ propertyName: prop, operator: 'BETWEEN', value: lowValue, highValue });
  }
  
  // Parse IN/NOT_IN with arrays
  const inMatches = filterContent.match(/(\w+)__(in|not_in):\s*\[([^\]]+)\]/g);
  if (inMatches) {
    inMatches.forEach(match => {
      const [, prop, op, values] = match.match(/(\w+)__(in|not_in):\s*\[([^\]]+)\]/);
      const valueArray = values.split(',').map(v => v.trim().replace(/"/g, ''));
      filters.push({ propertyName: prop, operator: op === 'in' ? 'IN' : 'NOT_IN', values: valueArray });
    });
  }
  
  // Parse limit
  const limitMatch = query.match(/limit:\s*(\d+)/);
  if (limitMatch) {
    searchBody.limit = Math.min(parseInt(limitMatch[1]), 200); // Max 200 per HubSpot limits
  }
  
  // Parse offset  
  const offsetMatch = query.match(/offset:\s*(\d+)/);
  if (offsetMatch) {
    searchBody.after = offsetMatch[1];
  }
  
  if (filters.length > 0) {
    searchBody.filterGroups = [{ filters }];
  }
  
  return searchBody;
}

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
