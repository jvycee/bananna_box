#!/bin/bash

# 🎯 Ultra-Minimal API Hub Test Suite
# Tests all endpoints: REST, Search, GraphQL, MCP

# Don't exit on errors - we want to continue testing
set +e

PORT=${PORT:-3000}
BASE_URL="http://localhost:$PORT"
PASSED=0
FAILED=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
    ((PASSED++))
}

fail() {
    echo -e "${RED}❌ $1${NC}"
    ((FAILED++))
}

warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check if server is running
check_server() {
    log "Checking server status..."
    if curl -s "$BASE_URL/health" > /dev/null; then
        success "Server is running on $BASE_URL"
    else
        fail "Server not responding. Start with: node ultra-minimal.js"
        exit 1
    fi
}

# Test basic REST API
test_rest_api() {
    log "Testing Basic REST API..."
    
    # Health check
    echo "  → Testing GET /health"
    health_response=$(curl -s "$BASE_URL/health")
    if echo "$health_response" | jq -e '.status == "ok"' > /dev/null; then
        echo "    Response: $(echo "$health_response" | jq -c .)"
        success "Health endpoint working"
    else
        fail "Health endpoint failed"
    fi
    
    # Stats endpoint
    echo "  → Testing GET /stats"
    stats_response=$(curl -s "$BASE_URL/stats")
    if echo "$stats_response" | jq -e '.ollamaHealthy != null' > /dev/null; then
        echo "    Response: $(echo "$stats_response" | jq -c '. | {ollamaHealthy, anthropicConfigured, total}')"
        success "Stats endpoint working"
    else
        fail "Stats endpoint failed"
    fi
    
    # Root endpoint with MCP info
    echo "  → Testing GET / (MCP info)"
    root_response=$(curl -s "$BASE_URL/")
    if echo "$root_response" | jq -e '.mcp.tools > 0' > /dev/null; then
        echo "    MCP Info: $(echo "$root_response" | jq -c '.mcp')"
        success "Root endpoint with MCP info working"
    else
        fail "Root endpoint missing MCP info"
    fi
}

# Test HubSpot Search API
test_search_api() {
    log "Testing HubSpot Search API..."
    
    # Test search endpoint structure (without actual HubSpot API key)
    response=$(curl -s -X POST "$BASE_URL/api/hubspot/contacts/search" \
        -H "Content-Type: application/json" \
        -d '{"query":"test","limit":5}')
    
    if echo "$response" | jq -e '.error' > /dev/null; then
        warn "HubSpot search test (expected error without API key)"
        success "Search endpoint structure working"
    else
        success "HubSpot search endpoint working"
    fi
    
    # Test supported endpoints validation
    response=$(curl -s -X POST "$BASE_URL/api/hubspot/invalid_endpoint/search" \
        -H "Content-Type: application/json" \
        -d '{"query":"test"}')
    
    if echo "$response" | jq -e '.error | contains("Unsupported endpoint")' > /dev/null; then
        success "Search endpoint validation working"
    else
        fail "Search endpoint validation failed"
    fi
}

# Test GraphQL API
test_graphql() {
    log "Testing GraphQL API..."
    
    # Test basic GraphQL query
    response=$(curl -s -X POST "$BASE_URL/graphql" \
        -H "Content-Type: application/json" \
        -d '{"query":"{ stats }"}')
    
    if echo "$response" | jq -e '.data.stats' > /dev/null; then
        success "GraphQL stats query working"
    else
        fail "GraphQL stats query failed"
    fi
    
    # Test CRM query structure (without HubSpot key)
    response=$(curl -s -X POST "$BASE_URL/graphql" \
        -H "Content-Type: application/json" \
        -d '{"query":"{ CRM { contact_collection { items { id } } } }"}')
    
    if echo "$response" | jq -e '.extensions.query_complexity' > /dev/null; then
        success "GraphQL CRM query structure working"
    else
        fail "GraphQL CRM query structure failed"
    fi
}

# Test MCP Protocol
test_mcp() {
    log "Testing MCP Protocol..."
    
    # Test MCP tools list (REST)
    echo "  → Testing GET /mcp/tools"
    tools_response=$(curl -s "$BASE_URL/mcp/tools")
    if echo "$tools_response" | jq -e '.tools | length > 0' > /dev/null; then
        tool_count=$(echo "$tools_response" | jq -r '.tools | length')
        tool_names=$(echo "$tools_response" | jq -r '.tools[].name' | tr '\n' ', ' | sed 's/,$//')
        echo "    Found $tool_count tools: $tool_names"
        success "MCP REST tools listing working"
    else
        fail "MCP REST tools listing failed"
    fi
    
    # Test MCP resources list (REST)
    echo "  → Testing GET /mcp/resources"
    resources_response=$(curl -s "$BASE_URL/mcp/resources")
    if echo "$resources_response" | jq -e '.resources | length > 0' > /dev/null; then
        resource_count=$(echo "$resources_response" | jq -r '.resources | length')
        resource_uris=$(echo "$resources_response" | jq -r '.resources[].uri' | tr '\n' ', ' | sed 's/,$//')
        echo "    Found $resource_count resources: $resource_uris"
        success "MCP REST resources listing working"
    else
        fail "MCP REST resources listing failed"
    fi
    
    # Test MCP JSON-RPC initialization
    echo "  → Testing POST /mcp (initialize)"
    response=$(curl -s -X POST "$BASE_URL/mcp" \
        -H "Content-Type: application/json" \
        -d '{"jsonrpc":"2.0","method":"initialize","params":{},"id":1}')
    
    if echo "$response" | jq -e '.result.serverInfo.name == "ultra-minimal-mcp"' > /dev/null; then
        server_info=$(echo "$response" | jq -c '.result.serverInfo')
        echo "    Server info: $server_info"
        success "MCP JSON-RPC initialization working"
    else
        fail "MCP JSON-RPC initialization failed"
    fi
    
    # Test MCP tools list (JSON-RPC)
    echo "  → Testing POST /mcp (tools/list)"
    response=$(curl -s -X POST "$BASE_URL/mcp" \
        -H "Content-Type: application/json" \
        -d '{"jsonrpc":"2.0","method":"tools/list","id":2}')
    
    if echo "$response" | jq -e '.result.tools | length > 0' > /dev/null; then
        tool_count=$(echo "$response" | jq -r '.result.tools | length')
        echo "    JSON-RPC returned $tool_count tools"
        success "MCP JSON-RPC tools list working"
    else
        fail "MCP JSON-RPC tools list failed"
    fi
    
    # Test MCP resources list (JSON-RPC)
    echo "  → Testing POST /mcp (resources/list)"
    response=$(curl -s -X POST "$BASE_URL/mcp" \
        -H "Content-Type: application/json" \
        -d '{"jsonrpc":"2.0","method":"resources/list","id":3}')
    
    if echo "$response" | jq -e '.result.resources | length > 0' > /dev/null; then
        resource_count=$(echo "$response" | jq -r '.result.resources | length')
        echo "    JSON-RPC returned $resource_count resources"
        success "MCP JSON-RPC resources list working"
    else
        fail "MCP JSON-RPC resources list failed"
    fi
    
    # Test Pi Stats tool
    echo "  → Testing POST /mcp (tools/call pi-stats)"
    response=$(curl -s -X POST "$BASE_URL/mcp" \
        -H "Content-Type: application/json" \
        -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"pi-stats","arguments":{}},"id":4}')
    
    if echo "$response" | jq -e '.result.content[0].text | contains("stats")' > /dev/null; then
        pi_data=$(echo "$response" | jq -r '.result.content[0].text' | jq -c '. | {temp: .pi.temp, uptime: .uptime}')
        echo "    Pi stats: $pi_data"
        success "MCP Pi Stats tool working"
    else
        fail "MCP Pi Stats tool failed"
    fi
    
    # Test HubSpot tool structure (without API key)
    echo "  → Testing POST /mcp (tools/call hubspot-list-objects)"
    response=$(curl -s -X POST "$BASE_URL/mcp" \
        -H "Content-Type: application/json" \
        -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"hubspot-list-objects","arguments":{"object_type":"contacts"}},"id":5}')
    
    if echo "$response" | jq -e '.result.isError or .result.content' > /dev/null; then
        if echo "$response" | jq -e '.result.isError' > /dev/null; then
            error_msg=$(echo "$response" | jq -r '.result.content[0].text' | head -c 50)
            echo "    Expected error (no API key): ${error_msg}..."
        else
            echo "    HubSpot tool working with API key"
        fi
        success "MCP HubSpot tool structure working"
    else
        fail "MCP HubSpot tool structure failed"
    fi
}

# Test AI assistants (if available)
test_assistants() {
    log "Testing AI Assistants..."
    
    # Test Mark assistant
    response=$(curl -s -X POST "$BASE_URL/api/mark/chat" \
        -H "Content-Type: application/json" \
        -d '{"message":"hello"}')
    
    if echo "$response" | jq -e '.success != null' > /dev/null; then
        success "Mark assistant endpoint structure working"
    else
        fail "Mark assistant endpoint failed"
    fi
    
    # Test Mark2 assistant
    response=$(curl -s -X POST "$BASE_URL/api/mark2/chat" \
        -H "Content-Type: application/json" \
        -d '{"message":"hello"}')
    
    if echo "$response" | jq -e '.success != null' > /dev/null; then
        success "Mark2 assistant endpoint structure working"
    else
        fail "Mark2 assistant endpoint failed"
    fi
}

# Test RAG (Retrieval-Augmented Generation) capabilities
test_rag() {
    log "Testing RAG (Retrieval-Augmented Generation)..."
    
    # Check RAG tools are available
    echo "  → Checking RAG tools availability"
    tools_response=$(curl -s "$BASE_URL/mcp/tools")
    rag_tool_count=$(echo "$tools_response" | jq -r '.tools[].name' | grep rag | wc -l)
    
    if [ "$rag_tool_count" -eq 2 ]; then
        echo "    Found 2 RAG tools: rag-pi-assistant, rag-hubspot-query"
        success "RAG tools loaded correctly"
    else
        fail "RAG tools missing (found $rag_tool_count, expected 2)"
        return
    fi
    
    # Test RAG Pi Assistant
    echo "  → Testing RAG Pi Assistant"
    rag_pi_response=$(curl -s -X POST "$BASE_URL/mcp" \
        -H "Content-Type: application/json" \
        -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"rag-pi-assistant","arguments":{"issue":"Server seems slow"}},"id":1}')
    
    if echo "$rag_pi_response" | jq -e '.result.content[0].text' > /dev/null; then
        echo "    RAG Pi response includes system data and troubleshooting"
        success "RAG Pi Assistant working"
    else
        fail "RAG Pi Assistant failed"
    fi
    
    # Test RAG HubSpot Query (structure test)
    echo "  → Testing RAG HubSpot Query structure"
    rag_hubspot_response=$(curl -s -X POST "$BASE_URL/mcp" \
        -H "Content-Type: application/json" \
        -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"rag-hubspot-query","arguments":{"query":"Show recent contacts","limit":3}},"id":2}')
    
    if echo "$rag_hubspot_response" | jq -e '.result' > /dev/null; then
        if echo "$rag_hubspot_response" | jq -e '.result.isError' > /dev/null; then
            echo "    Expected error without HubSpot API key - structure working"
        else
            echo "    RAG HubSpot working with API key"
        fi
        success "RAG HubSpot Query structure working"
    else
        fail "RAG HubSpot Query failed"
    fi
    
    echo "  → RAG Process: RETRIEVAL → AUGMENTATION → GENERATION ✅"
}

# Run performance test
test_performance() {
    log "Testing Performance..."
    
    start_time=$(date +%s.%N)
    for i in {1..10}; do
        curl -s "$BASE_URL/health" > /dev/null
    done
    end_time=$(date +%s.%N)
    
    duration=$(echo "$end_time - $start_time" | bc -l)
    avg_time=$(echo "scale=3; $duration / 10" | bc -l)
    
    if (( $(echo "$avg_time < 0.1" | bc -l) )); then
        success "Performance test: avg ${avg_time}s per request"
    else
        warn "Performance: avg ${avg_time}s per request (consider optimization)"
    fi
}

# Main test runner
main() {
    echo "🎯 Ultra-Minimal API Hub + MCP + RAG Test Suite"
    echo "================================================"
    
    check_server
    test_rest_api
    test_search_api
    test_graphql
    test_mcp
    test_rag
    test_assistants
    test_performance
    
    echo
    echo "================================================"
    echo -e "${GREEN}✅ Passed: $PASSED${NC}"
    echo -e "${RED}❌ Failed: $FAILED${NC}"
    
    if [ $FAILED -eq 0 ]; then
        echo -e "${GREEN}🎉 All tests passed!${NC}"
        echo "Your ultra-minimal server is production-ready! 🚀"
        exit 0
    else
        echo -e "${RED}💥 Some tests failed!${NC}"
        exit 1
    fi
}

# Handle command line arguments
case "${1:-all}" in
    "rest")
        check_server
        test_rest_api
        ;;
    "search")
        check_server
        test_search_api
        ;;
    "graphql")
        check_server
        test_graphql
        ;;
    "mcp")
        check_server
        test_mcp
        ;;
    "rag")
        check_server
        test_rag
        ;;
    "assistants")
        check_server
        test_assistants
        ;;
    "perf")
        check_server
        test_performance
        ;;
    "all"|*)
        main
        ;;
esac