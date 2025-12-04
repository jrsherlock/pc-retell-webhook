#!/bin/bash

# Verify sync status between Azure DevOps, Production Azure Function, and RetellAI
# Usage: ./scripts/verify-sync-status.sh

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Sync Status Verification                                  ║"
echo "║  Azure DevOps ↔ Production Function ↔ RetellAI            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

AGENT_ID="agent_d1811032b0e5282793a991fe6b"
FUNCTION_APP_NAME="pc-retell-webhook"
RESOURCE_GROUP="pcretellwebhook"
REPO_CONFIG="retell-agents/agents/production.json"
TEMP_RETELL_CONFIG="/tmp/retellai-verify-$$.json"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if required tools are available
if ! command -v jq &> /dev/null; then
    echo -e "${RED}❌ Error: jq is required but not installed${NC}"
    echo "   Install with: brew install jq  # macOS"
    exit 1
fi

# ============================================================================
# 1. Verify RetellAI Agent Configuration
# ============================================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}1. RetellAI Agent Configuration${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ ! -f "$REPO_CONFIG" ]; then
    echo -e "${RED}❌ Repository config not found: $REPO_CONFIG${NC}"
    exit 1
fi

echo "   Fetching current RetellAI agent configuration..."
npm run retell:fetch-agent -- --agent-id "$AGENT_ID" --output "$TEMP_RETELL_CONFIG" > /dev/null 2>&1

if [ ! -f "$TEMP_RETELL_CONFIG" ]; then
    echo -e "${RED}❌ Failed to fetch RetellAI configuration${NC}"
    exit 1
fi

# Compare configs (excluding metadata)
REPO_CONFIG_CLEAN=$(jq 'del(.metadata)' "$REPO_CONFIG" | jq -S .)
RETELL_CONFIG_CLEAN=$(jq 'del(.metadata)' "$TEMP_RETELL_CONFIG" | jq -S .)

if [ "$REPO_CONFIG_CLEAN" = "$RETELL_CONFIG_CLEAN" ]; then
    echo -e "${GREEN}   ✅ RetellAI ↔ Repository: IN SYNC${NC}"
    RETELL_SYNC=true
else
    echo -e "${RED}   ❌ RetellAI ↔ Repository: OUT OF SYNC${NC}"
    echo ""
    echo "   Differences found:"
    diff <(echo "$REPO_CONFIG_CLEAN") <(echo "$RETELL_CONFIG_CLEAN") | head -20 || true
    RETELL_SYNC=false
fi

# Check webhook URL
REPO_WEBHOOK=$(jq -r '.webhook_url // empty' "$REPO_CONFIG")
RETELL_WEBHOOK=$(jq -r '.webhook_url // empty' "$TEMP_RETELL_CONFIG")

echo ""
echo "   Webhook URLs:"
echo "   Repository:  $REPO_WEBHOOK"
echo "   RetellAI:    $RETELL_WEBHOOK"

if [ "$REPO_WEBHOOK" = "$RETELL_WEBHOOK" ]; then
    echo -e "${GREEN}   ✅ Webhook URLs match${NC}"
else
    echo -e "${RED}   ❌ Webhook URLs differ${NC}"
fi

# ============================================================================
# 2. Verify Azure Function Deployment
# ============================================================================
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}2. Azure Function App Deployment${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Check if Azure CLI is available
if ! command -v az &> /dev/null; then
    echo -e "${YELLOW}   ⚠️  Azure CLI not found - skipping Azure Function checks${NC}"
    echo "   Install with: brew install azure-cli  # macOS"
    AZURE_AVAILABLE=false
else
    AZURE_AVAILABLE=true
    
    # Check if logged in
    if ! az account show &> /dev/null; then
        echo -e "${YELLOW}   ⚠️  Not logged into Azure - skipping Azure Function checks${NC}"
        echo "   Log in with: az login"
        AZURE_AVAILABLE=false
    fi
fi

if [ "$AZURE_AVAILABLE" = true ]; then
    echo "   Checking Function App: $FUNCTION_APP_NAME"
    
    # Check if function app exists
    if az functionapp show --name "$FUNCTION_APP_NAME" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
        echo -e "${GREEN}   ✅ Function App exists${NC}"
        
        # Get function app state
        STATE=$(az functionapp show --name "$FUNCTION_APP_NAME" --resource-group "$RESOURCE_GROUP" --query "state" -o tsv 2>/dev/null || echo "unknown")
        echo "   State: $STATE"
        
        # Get webhook URL from function app
        FUNCTION_URL="https://${FUNCTION_APP_NAME}.azurewebsites.net/api/retellwebhookprocessor"
        echo "   Function URL: $FUNCTION_URL"
        
        # Compare with RetellAI webhook
        if [ "$RETELL_WEBHOOK" = "$FUNCTION_URL" ] || [ "$RETELL_WEBHOOK" = "${FUNCTION_URL}?code=*" ]; then
            echo -e "${GREEN}   ✅ Webhook URL matches Function App${NC}"
        else
            echo -e "${YELLOW}   ⚠️  Webhook URL may not match Function App${NC}"
            echo "   Expected: $FUNCTION_URL"
            echo "   Actual:   $RETELL_WEBHOOK"
        fi
        
        # Check if function exists
        FUNCTIONS=$(az functionapp function list --name "$FUNCTION_APP_NAME" --resource-group "$RESOURCE_GROUP" --query "[].name" -o tsv 2>/dev/null || echo "")
        if echo "$FUNCTIONS" | grep -q "RetellWebhookProcessor\|retellwebhookprocessor"; then
            echo -e "${GREEN}   ✅ RetellWebhookProcessor function deployed${NC}"
        else
            echo -e "${YELLOW}   ⚠️  RetellWebhookProcessor function not found in deployed functions${NC}"
        fi
    else
        echo -e "${RED}   ❌ Function App not found${NC}"
    fi
fi

# ============================================================================
# 3. Verify Repository Code
# ============================================================================
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}3. Repository Status${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Check if repo is clean
if git diff --quiet "$REPO_CONFIG" 2>/dev/null; then
    echo -e "${GREEN}   ✅ Agent config file is committed${NC}"
else
    echo -e "${YELLOW}   ⚠️  Agent config file has uncommitted changes${NC}"
    echo "   Run: git status retell-agents/agents/production.json"
fi

# Check if file is tracked
if git ls-files --error-unmatch "$REPO_CONFIG" &> /dev/null; then
    echo -e "${GREEN}   ✅ Agent config is tracked in git${NC}"
else
    echo -e "${YELLOW}   ⚠️  Agent config is not tracked in git${NC}"
    echo "   Run: git add retell-agents/agents/production.json"
fi

# ============================================================================
# Summary
# ============================================================================
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ "$RETELL_SYNC" = true ]; then
    echo -e "${GREEN}✅ RetellAI ↔ Repository: IN SYNC${NC}"
else
    echo -e "${RED}❌ RetellAI ↔ Repository: OUT OF SYNC${NC}"
    echo ""
    echo "   To sync RetellAI to repository:"
    echo "   npm run retell:sync $AGENT_ID"
fi

echo ""
echo "   Next steps:"
if [ "$RETELL_SYNC" = false ]; then
    echo "   1. Sync RetellAI config: npm run retell:sync $AGENT_ID"
    echo "   2. Review changes: git diff $REPO_CONFIG"
    echo "   3. Commit if needed: git add $REPO_CONFIG && git commit -m 'Sync agent config'"
fi
echo "   4. Verify Azure Function deployment matches repository code"
echo "   5. Ensure RetellAI webhook URL points to correct Function App endpoint"

# Cleanup
rm -f "$TEMP_RETELL_CONFIG"

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

