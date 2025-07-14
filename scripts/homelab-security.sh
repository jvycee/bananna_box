#!/bin/bash
# 🎯 CARMACK HOME LAB SECURITY: Network Protection
# "The best firewall is the one you don't have to think about"

# Get your home network range
HOME_NET=$(ip route | grep "192.168" | head -1 | awk '{print $1}')
PI_PORT=3000

echo "🔒 Setting up network protection for Pi API Hub on port $PI_PORT"

# Basic iptables rules - home network only
sudo iptables -F INPUT 2>/dev/null || true
sudo iptables -A INPUT -i lo -j ACCEPT
sudo iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
sudo iptables -A INPUT -s $HOME_NET -p tcp --dport $PI_PORT -j ACCEPT
sudo iptables -A INPUT -p tcp --dport $PI_PORT -j DROP
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# Save rules
sudo iptables-save > /etc/iptables/rules.v4 2>/dev/null || echo "# Install iptables-persistent to auto-restore"

echo "✅ Network protection active: Only $HOME_NET can reach :$PI_PORT"