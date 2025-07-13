// 🎯 CARMACK HOME LAB SECURITY: Rate Limiting
// "Simple rules, ruthlessly enforced"

const requests = new Map();
const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS = 1000; // Per IP per hour

function rateLimiter() {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowStart = now - WINDOW_MS;
    
    // Get or create IP record
    let ipData = requests.get(ip) || { count: 0, firstRequest: now };
    
    // Reset if outside window
    if (ipData.firstRequest < windowStart) {
      ipData = { count: 0, firstRequest: now };
    }
    
    ipData.count++;
    requests.set(ip, ipData);
    
    if (ipData.count > MAX_REQUESTS) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }
    
    // Clean old entries every 1000 requests
    if (requests.size > 1000) {
      for (const [key, data] of requests) {
        if (data.firstRequest < windowStart) requests.delete(key);
      }
    }
    
    next();
  };
}

module.exports = { rateLimiter };