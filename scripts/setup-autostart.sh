#!/bin/bash

# 🎯 Setup Auto-Start for Bananna Box Ultra-Minimal Server

echo "🚀 Setting up Bananna Box auto-start service..."

# Stop current server if running
if [ -f "../server.pid" ]; then
    echo "📛 Stopping current server..."
    kill $(cat ../server.pid) 2>/dev/null || true
    rm -f ../server.pid
fi

# Install systemd service
echo "📋 Installing systemd service..."
sudo cp ../bananna-box.service /etc/systemd/system/bananna-box.service
sudo systemctl daemon-reload
sudo systemctl enable bananna-box.service

echo "✅ Service installed and enabled for auto-start"

# Start the service
echo "🏁 Starting Bananna Box service..."
sudo systemctl start bananna-box.service

sleep 3

# Check status
echo "📊 Service Status:"
sudo systemctl status bananna-box.service --no-pager -l

echo ""
echo "🎯 Bananna Box Auto-Start Setup Complete!"
echo "================================================="
echo "🔧 Commands:"
echo "  sudo systemctl status bananna-box    # Check status"
echo "  sudo systemctl stop bananna-box     # Stop service"
echo "  sudo systemctl start bananna-box    # Start service"
echo "  sudo systemctl restart bananna-box  # Restart service"
echo "  journalctl -u bananna-box -f        # View live logs"
echo ""
echo "🌐 Access:"
echo "  Server: http://localhost:3000"
echo "  Stats:  http://localhost:3000/stats"
echo "  Health: http://localhost:3000/health"
echo ""
echo "🔍 The server now monitors:"
echo "  ✅ Ollama connectivity (10.0.0.193:11434)"
echo "  ✅ Pi temperature and throttling"
echo "  ✅ HubSpot API connectivity"
echo "  ✅ Request statistics"
echo ""
echo "Monitoring logs update every 30 seconds 📈"