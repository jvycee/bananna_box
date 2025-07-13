#!/usr/bin/env node
// 🎯 CARMACK DASHBOARD SERVER: Monitoring + Dashboard in one
// "One file, everything you need to see"

const express = require('express');
const fs = require('fs');
const path = require('path');
const { SystemMonitor } = require('./system-monitor');

// Extend ultra-minimal with dashboard + monitoring
const { routeAI, createAssistant, checkOllama } = require('./secure-ultra-minimal');

const app = express();
const monitor = new SystemMonitor();

// Dashboard data
let dashboardData = {
  requests: 0,
  errors: 0,
  rateLimited: 0,
  failedAuth: 0,
  lastKeyRotation: Date.now()
};

// Middleware to track dashboard metrics
app.use((req, res, next) => {
  dashboardData.requests++;
  
  // Track auth failures
  const originalSend = res.send;
  res.send = function(data) {
    if (res.statusCode === 401) dashboardData.failedAuth++;
    if (res.statusCode === 429) dashboardData.rateLimited++;
    if (res.statusCode >= 500) dashboardData.errors++;
    originalSend.call(this, data);
  };
  
  next();
});

// Serve dashboard
app.get('/dashboard', (req, res) => {
  try {
    const dashboardPath = path.join(__dirname, 'dashboard.html');
    if (!fs.existsSync(dashboardPath)) {
      return res.status(404).send('Dashboard not found. Make sure dashboard.html is in the same directory.');
    }
    const html = fs.readFileSync(dashboardPath, 'utf8');
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (e) {
    res.status(500).send(`Dashboard error: ${e.message}`);
  }
});

// Serve mobile dashboard
app.get('/mobile', (req, res) => {
  try {
    const mobilePath = path.join(__dirname, 'mobile-dashboard.html');
    if (!fs.existsSync(mobilePath)) {
      return res.status(404).send('Mobile dashboard not found.');
    }
    const html = fs.readFileSync(mobilePath, 'utf8');
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (e) {
    res.status(500).send(`Mobile dashboard error: ${e.message}`);
  }
});

// Real-time metrics endpoint
app.get('/api/metrics', async (req, res) => {
  await monitor.collect();
  const systemMetrics = monitor.getMetrics();
  
  res.json({
    system: systemMetrics.current,
    alerts: systemMetrics.alerts,
    history: systemMetrics.history,
    dashboard: dashboardData,
    services: {
      ollamaHealthy: await checkOllama(),
      anthropicConfigured: !!process.env.ANTHROPIC_API_KEY,
      hubspotConfigured: !!process.env.HUBSPOT_PRIVATE_APP_TOKEN
    },
    timestamp: Date.now()
  });
});

// Dashboard API endpoints
app.post('/api/dashboard/test-health', async (req, res) => {
  try {
    const healthy = await checkOllama();
    res.json({ success: true, healthy, timestamp: Date.now() });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

app.post('/api/dashboard/rotate-keys', (req, res) => {
  dashboardData.lastKeyRotation = Date.now();
  // In real implementation, would call key rotation
  res.json({ success: true, rotated: Date.now() });
});

app.post('/api/dashboard/restart', (req, res) => {
  res.json({ success: true, message: 'Restart requested' });
  // In real implementation, would restart service
  setTimeout(() => process.exit(0), 1000);
});

// Start monitoring collection
setInterval(() => monitor.collect(), 10000); // Every 10 seconds

// Server startup
const PORT = process.env.DASHBOARD_PORT || 3001;

app.listen(PORT, () => {
  console.log(`
🎯 CARMACK DASHBOARD + MONITORING
=================================
Dashboard: http://localhost:${PORT}/dashboard
Metrics:   http://localhost:${PORT}/api/metrics

Real-time monitoring:
✅ System metrics (CPU, memory, temp)
✅ Service health tracking  
✅ Alert generation
✅ Request/error tracking
✅ Single-file dashboard

"See everything, understand instantly." - Carmack
`);
});

module.exports = { app, monitor, dashboardData };