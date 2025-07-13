// 🎯 CARMACK MONITORING: System Metrics Collection
// "Monitor what matters, ignore the noise"

const fs = require('fs');
const { exec } = require('child_process');

class SystemMonitor {
  constructor() {
    this.metrics = {
      cpu: 0,
      memory: { used: 0, total: 0, percent: 0 },
      disk: { used: 0, total: 0, percent: 0 },
      network: { rx: 0, tx: 0 },
      temperature: 0,
      processes: 0
    };
    this.history = [];
    this.alerts = [];
  }

  // Get CPU usage (simple approach)
  async getCPU() {
    return new Promise((resolve) => {
      exec("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1", (err, stdout) => {
        this.metrics.cpu = parseFloat(stdout) || 0;
        resolve(this.metrics.cpu);
      });
    });
  }

  // Get memory info
  getMemory() {
    try {
      const meminfo = fs.readFileSync('/proc/meminfo', 'utf8');
      const total = parseInt(meminfo.match(/MemTotal:\s+(\d+)/)?.[1]) * 1024;
      const free = parseInt(meminfo.match(/MemFree:\s+(\d+)/)?.[1]) * 1024;
      const used = total - free;
      
      this.metrics.memory = {
        used: Math.round(used / 1024 / 1024),
        total: Math.round(total / 1024 / 1024),
        percent: Math.round((used / total) * 100)
      };
    } catch (e) {
      // Fallback to Node.js process memory
      const used = process.memoryUsage().rss;
      this.metrics.memory = {
        used: Math.round(used / 1024 / 1024),
        total: 1024, // Assume 1GB
        percent: Math.round((used / (1024 * 1024 * 1024)) * 100)
      };
    }
  }

  // Get Pi temperature (Raspberry Pi specific)
  getTemperature() {
    try {
      const temp = fs.readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf8');
      this.metrics.temperature = Math.round(parseInt(temp) / 1000);
    } catch (e) {
      this.metrics.temperature = 0;
    }
  }

  // Check for alerts
  checkAlerts() {
    const now = Date.now();
    this.alerts = this.alerts.filter(a => now - a.time < 300000); // Keep 5 min

    if (this.metrics.cpu > 80) {
      this.addAlert('HIGH_CPU', `CPU usage: ${this.metrics.cpu}%`);
    }
    
    if (this.metrics.memory.percent > 85) {
      this.addAlert('HIGH_MEMORY', `Memory usage: ${this.metrics.memory.percent}%`);
    }
    
    if (this.metrics.temperature > 70) {
      this.addAlert('HIGH_TEMP', `Temperature: ${this.metrics.temperature}°C`);
    }
  }

  addAlert(type, message) {
    const existing = this.alerts.find(a => a.type === type && Date.now() - a.time < 60000);
    if (!existing) {
      this.alerts.push({ type, message, time: Date.now() });
    }
  }

  // Collect all metrics
  async collect() {
    await this.getCPU();
    this.getMemory();
    this.getTemperature();
    this.checkAlerts();
    
    // Store in history (keep last 60 data points)
    this.history.push({
      timestamp: Date.now(),
      ...this.metrics
    });
    
    if (this.history.length > 60) {
      this.history = this.history.slice(-60);
    }
  }

  // Get current metrics for dashboard
  getMetrics() {
    return {
      current: this.metrics,
      alerts: this.alerts,
      history: this.history.slice(-20) // Last 20 points for chart
    };
  }
}

module.exports = { SystemMonitor };