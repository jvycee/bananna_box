#!/bin/bash

# 🎯 Manual Test Commands Reference
# Use automated tests: ./test.sh
# This file shows manual commands for debugging specific issues

echo "🎯 Ultra-Minimal MCP Server - Manual Test Commands"
echo "=================================================="
echo
echo "1. Start the server:"
echo "   node ultra-minimal.js"
echo
echo "2. Test Basic REST API:"
echo "   curl http://localhost:3000/health"
echo "   curl http://localhost:3000/stats"
echo "   curl http://localhost:3000/"
echo
echo "3. Test MCP REST Endpoints:"
echo "   curl http://localhost:3000/mcp/tools"
echo "   curl http://localhost:3000/mcp/resources"
echo
echo "4. Test MCP JSON-RPC Protocol:"
echo "   # Initialize MCP server"
echo '   curl -X POST http://localhost:3000/mcp -H "Content-Type: application/json" -d '"'"'{"jsonrpc":"2.0","method":"initialize","params":{},"id":1}'"'"
echo
echo "   # List available tools"
echo '   curl -X POST http://localhost:3000/mcp -H "Content-Type: application/json" -d '"'"'{"jsonrpc":"2.0","method":"tools/list","id":2}'"'"
echo
echo "   # List available resources"
echo '   curl -X POST http://localhost:3000/mcp -H "Content-Type: application/json" -d '"'"'{"jsonrpc":"2.0","method":"resources/list","id":3}'"'"
echo
echo "   # Call Pi Stats tool"
echo '   curl -X POST http://localhost:3000/mcp -H "Content-Type: application/json" -d '"'"'{"jsonrpc":"2.0","method":"tools/call","params":{"name":"pi-stats","arguments":{}},"id":4}'"'"
echo
echo "   # Call HubSpot tool (will show structure)"
echo '   curl -X POST http://localhost:3000/mcp -H "Content-Type: application/json" -d '"'"'{"jsonrpc":"2.0","method":"tools/call","params":{"name":"hubspot-list-objects","arguments":{"object_type":"contacts"}},"id":5}'"'"
echo
echo "5. Test GraphQL:"
echo '   curl -X POST http://localhost:3000/graphql -H "Content-Type: application/json" -d '"'"'{"query":"{ stats }"}'"'"
echo
echo "6. Test Search API:"
echo '   curl -X POST http://localhost:3000/api/hubspot/contacts/search -H "Content-Type: application/json" -d '"'"'{"query":"test","limit":5}'"'"
echo
echo "7. Test AI Assistants:"
echo '   curl -X POST http://localhost:3000/api/mark/chat -H "Content-Type: application/json" -d '"'"'{"message":"hello"}'"'"
echo '   curl -X POST http://localhost:3000/api/mark2/chat -H "Content-Type: application/json" -d '"'"'{"message":"hello"}'"'"
echo
echo "8. Run automated test suite:"
echo "   ./test.sh"
echo
echo "Expected Results:"
echo "=================="
echo "✅ All REST endpoints should return JSON responses"
echo "✅ MCP should show 6 tools and 2 resources"
echo "✅ JSON-RPC should return proper MCP protocol responses"
echo "✅ Pi stats should show temperature, storage, etc."
echo "✅ HubSpot tools show structure (error expected without API key)"
echo "✅ GraphQL should return stats data"
echo "✅ Search API should validate endpoints properly"
echo
echo "🚀 Your ultra-minimal server now has full MCP protocol support!"