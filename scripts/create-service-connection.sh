#!/bin/bash

# Create Azure DevOps Service Connection
# This script creates the Azure-ProCircular-Subscription service connection
# Usage: ./scripts/create-service-connection.sh

set -e

ORG="procircular"
PROJECT="dco"
SERVICE_CONNECTION_NAME="Azure-ProCircular-Subscription"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Create Azure DevOps Service Connection                   ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo "❌ Azure CLI is not installed"
    exit 1
fi

# Get subscription info
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
SUBSCRIPTION_NAME=$(az account show --query name -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)

echo "Subscription: $SUBSCRIPTION_NAME"
echo "Subscription ID: $SUBSCRIPTION_ID"
echo "Tenant ID: $TENANT_ID"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Creating Service Connection via Azure DevOps UI"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "The Azure CLI cannot create service connections in non-interactive mode."
echo "Please create the service connection manually:"
echo ""
echo "1. Go to: https://dev.azure.com/$ORG/$PROJECT/_settings/adminservices"
echo ""
echo "2. Click 'New service connection' → 'Azure Resource Manager'"
echo ""
echo "3. Select 'Workload Identity federation (automatic)' or 'Service principal (automatic)'"
echo ""
echo "4. Fill in the details:"
echo "   - Subscription: $SUBSCRIPTION_NAME"
echo "   - Subscription ID: $SUBSCRIPTION_ID"
echo "   - Resource group: pcretellwebhook (optional)"
echo "   - Service connection name: $SERVICE_CONNECTION_NAME"
echo ""
echo "5. Click 'Save'"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Alternative: Use Azure Portal"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "You can also create it via Azure Portal:"
echo "1. Go to: https://portal.azure.com"
echo "2. Navigate to: Subscriptions → $SUBSCRIPTION_NAME → Access control (IAM)"
echo "3. Ensure Azure DevOps has appropriate permissions"
echo ""
echo "Then create the service connection in Azure DevOps as above."
echo ""

