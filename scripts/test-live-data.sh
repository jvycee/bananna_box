#!/bin/bash

# 🎯 Live Data Testing - MCP + RAG with Your HubSpot Data
# Tests the system with real CRM data and intelligent queries

PORT=${PORT:-3000}
BASE_URL="http://localhost:$PORT"

# Script can be run from anywhere
cd "$(dirname "$0")/.." || exit 1

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warn() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

echo "🎯 Testing MCP + RAG with Your Live HubSpot Data"
echo "================================================="

# 1. Test MCP HubSpot Tools with Real Data
log "Testing MCP HubSpot Tools with Real Data..."

echo
echo "1️⃣ List Recent Contacts (MCP Tool)"
echo "curl -X POST $BASE_URL/mcp -H 'Content-Type: application/json' -d '{\"jsonrpc\":\"2.0\",\"method\":\"tools/call\",\"params\":{\"name\":\"hubspot-list-objects\",\"arguments\":{\"object_type\":\"contacts\",\"limit\":3}},\"id\":1}' | jq"
echo

echo "2️⃣ Search for Specific Contact (MCP Tool)"
echo "curl -X POST $BASE_URL/mcp -H 'Content-Type: application/json' -d '{\"jsonrpc\":\"2.0\",\"method\":\"tools/call\",\"params\":{\"name\":\"hubspot-search-crm\",\"arguments\":{\"object_type\":\"contacts\",\"query\":\"gmail\",\"limit\":2}},\"id\":2}' | jq"
echo

echo "3️⃣ List Companies (MCP Tool)"
echo "curl -X POST $BASE_URL/mcp -H 'Content-Type: application/json' -d '{\"jsonrpc\":\"2.0\",\"method\":\"tools/call\",\"params\":{\"name\":\"hubspot-list-objects\",\"arguments\":{\"object_type\":\"companies\",\"limit\":2}},\"id\":3}' | jq"
echo

# 2. Test RAG with Intelligent Queries
log "Testing RAG (Retrieval-Augmented Generation) with Intelligent Queries..."

echo
echo "4️⃣ RAG: Find Recent Contacts (Intelligent Query)"
echo "curl -X POST $BASE_URL/mcp -H 'Content-Type: application/json' -d '{\"jsonrpc\":\"2.0\",\"method\":\"tools/call\",\"params\":{\"name\":\"rag-hubspot-query\",\"arguments\":{\"query\":\"Who are my newest contacts this week?\",\"object_type\":\"contacts\",\"limit\":3}},\"id\":4}' | jq -r '.result.content[0].text'"
echo

echo "5️⃣ RAG: Business Analysis (Intelligent Query)"
echo "curl -X POST $BASE_URL/mcp -H 'Content-Type: application/json' -d '{\"jsonrpc\":\"2.0\",\"method\":\"tools/call\",\"params\":{\"name\":\"rag-hubspot-query\",\"arguments\":{\"query\":\"Analyze my top companies by industry\",\"object_type\":\"companies\",\"limit\":5}},\"id\":5}' | jq -r '.result.content[0].text'"
echo

echo "6️⃣ RAG: Sales Pipeline (Intelligent Query)"
echo "curl -X POST $BASE_URL/mcp -H 'Content-Type: application/json' -d '{\"jsonrpc\":\"2.0\",\"method\":\"tools/call\",\"params\":{\"name\":\"rag-hubspot-query\",\"arguments\":{\"query\":\"What deals are in my pipeline right now?\",\"object_type\":\"deals\",\"limit\":4}},\"id\":6}' | jq -r '.result.content[0].text'"
echo

# 3. Test RAG Pi Assistant
log "Testing RAG Pi Assistant..."

echo
echo "7️⃣ RAG Pi: System Health Check"
echo "curl -X POST $BASE_URL/mcp -H 'Content-Type: application/json' -d '{\"jsonrpc\":\"2.0\",\"method\":\"tools/call\",\"params\":{\"name\":\"rag-pi-assistant\",\"arguments\":{\"issue\":\"Is my server running efficiently?\"}},\"id\":7}' | jq -r '.result.content[0].text'"
echo

# 4. Interactive Test Runner
log "Interactive Test Runner..."

echo
echo "🚀 READY TO TEST WITH YOUR DATA!"
echo "================================="
echo
echo "Choose a test to run:"
echo "1) List recent contacts (MCP)"
echo "2) Search contacts (MCP)"
echo "3) List companies (MCP)"
echo "4) RAG: Find newest contacts"
echo "5) RAG: Analyze companies"
echo "6) RAG: Sales pipeline"
echo "7) RAG: Pi health check"
echo "8) Run all tests"
echo "9) Custom RAG query"
echo

read -p "Enter choice (1-9): " choice

case $choice in
    1)
        echo "🔍 Testing: List Recent Contacts..."
        curl -X POST $BASE_URL/mcp -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"hubspot-list-objects","arguments":{"object_type":"contacts","limit":3}},"id":1}' | jq
        ;;
    2)
        read -p "Search term: " search_term
        echo "🔍 Testing: Search Contacts for '$search_term'..."
        curl -X POST $BASE_URL/mcp -H 'Content-Type: application/json' -d "{\"jsonrpc\":\"2.0\",\"method\":\"tools/call\",\"params\":{\"name\":\"hubspot-search-crm\",\"arguments\":{\"object_type\":\"contacts\",\"query\":\"$search_term\",\"limit\":3}},\"id\":2}" | jq
        ;;
    3)
        echo "🔍 Testing: List Companies..."
        curl -X POST $BASE_URL/mcp -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"hubspot-list-objects","arguments":{"object_type":"companies","limit":3}},"id":3}' | jq
        ;;
    4)
        echo "🤖 Testing: RAG - Find Newest Contacts..."
        curl -X POST $BASE_URL/mcp -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"rag-hubspot-query","arguments":{"query":"Who are my newest contacts this week?","object_type":"contacts","limit":3}},"id":4}' | jq -r '.result.content[0].text'
        ;;
    5)
        echo "🤖 Testing: RAG - Analyze Companies..."
        curl -X POST $BASE_URL/mcp -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"rag-hubspot-query","arguments":{"query":"Analyze my top companies by industry","object_type":"companies","limit":5}},"id":5}' | jq -r '.result.content[0].text'
        ;;
    6)
        echo "🤖 Testing: RAG - Sales Pipeline..."
        curl -X POST $BASE_URL/mcp -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"rag-hubspot-query","arguments":{"query":"What deals are in my pipeline right now?","object_type":"deals","limit":4}},"id":6}' | jq -r '.result.content[0].text'
        ;;
    7)
        echo "🤖 Testing: RAG Pi Assistant..."
        curl -X POST $BASE_URL/mcp -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"rag-pi-assistant","arguments":{"issue":"Is my server running efficiently?"}},"id":7}' | jq -r '.result.content[0].text'
        ;;
    8)
        echo "🚀 Running all tests..."
        echo
        echo "=== MCP Tests ==="
        curl -s -X POST $BASE_URL/mcp -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"hubspot-list-objects","arguments":{"object_type":"contacts","limit":2}},"id":1}' | jq '.result.content[0].text' | head -10
        echo
        echo "=== RAG Tests ==="
        curl -s -X POST $BASE_URL/mcp -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"rag-hubspot-query","arguments":{"query":"Who are my newest contacts this week?","object_type":"contacts","limit":3}},"id":2}' | jq -r '.result.content[0].text' | head -15
        ;;
    9)
        read -p "Enter your custom RAG query: " custom_query
        read -p "Object type (contacts/companies/deals): " obj_type
        echo "🤖 Testing: Custom RAG Query..."
        curl -X POST $BASE_URL/mcp -H 'Content-Type: application/json' -d "{\"jsonrpc\":\"2.0\",\"method\":\"tools/call\",\"params\":{\"name\":\"rag-hubspot-query\",\"arguments\":{\"query\":\"$custom_query\",\"object_type\":\"$obj_type\",\"limit\":10}},\"id\":9}" | jq -r '.result.content[0].text'
        ;;
    *)
        echo "Invalid choice. Run ./test-live-data.sh again."
        ;;
esac

echo
echo "🎉 Test Complete!"
echo "================="
echo "💡 TIP: RAG combines data retrieval + AI analysis for intelligent insights"
echo "🔧 MCP provides direct access to your CRM data via standardized protocol"
echo "🚀 Your ultra-minimal server now has enterprise-grade capabilities!"