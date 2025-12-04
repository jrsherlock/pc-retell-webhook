#!/bin/bash

# Azure DevOps Pipeline Setup Script
# This script helps set up variable groups and pipelines in Azure DevOps
# Usage: ./scripts/setup-azure-devops-pipeline.sh

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Azure DevOps Pipeline Setup                               ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

ORG="procircular"
PROJECT="dco"
REPO_NAME="IRBot-Automation"

# Check if Azure DevOps CLI is installed
if ! command -v az &> /dev/null; then
    echo "❌ Azure CLI is not installed"
    echo "   Install with: brew install azure-cli  # macOS"
    exit 1
fi

# Check if az devops extension is installed
if ! az extension list --query "[?name=='azure-devops'].name" -o tsv | grep -q "azure-devops"; then
    echo "📦 Installing Azure DevOps extension..."
    az extension add --name azure-devops
fi

# Check if logged in
if ! az account show &> /dev/null; then
    echo "❌ Not logged into Azure"
    echo "   Log in with: az login"
    exit 1
fi

echo "✅ Azure CLI ready"
echo ""

# ============================================================================
# Step 1: Create Variable Groups
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 1: Creating Variable Groups"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Common variables
echo "Creating pc-ir-relay-common-vars..."
az pipelines variable-group create \
    --name "pc-ir-relay-common-vars" \
    --variables NODE_VERSION=20.x BUILD_CONFIGURATION=Release \
    --org "https://dev.azure.com/$ORG" \
    --project "$PROJECT" \
    --authorize true \
    --output none 2>/dev/null || echo "  ⚠️  Variable group may already exist"

# Development variables
echo "Creating pc-ir-relay-dev-vars..."
az pipelines variable-group create \
    --name "pc-ir-relay-dev-vars" \
    --variables \
        ENABLE_EMAIL_NOTIFICATIONS=true \
        ENABLE_JIRA_NOTIFICATIONS=true \
        ENABLE_TEAMS_NOTIFICATIONS=false \
        ENABLE_SMS_NOTIFICATIONS=false \
        EMAIL_PROVIDER=sendgrid \
        IRT_EMAIL_ADDRESS=jsherlock@procircular.com \
        NON_IR_EMAIL_RECIPIENT=jsherlock@procircular.com \
        SENDGRID_FROM_EMAIL=jsherlock@procircular.com \
        EMAIL_FROM_NAME_IR="ProCircular IR Alert" \
        EMAIL_FROM_NAME_NON_IR="ProCircular General Inquiry" \
        JIRA_API_URL=https://procircular.atlassian.net \
        JIRA_PROJECT_KEY=IRTDEV \
        JIRA_USER_EMAIL=jsherlock@procircular.com \
        JIRA_FAILURE_NOTIFICATION_RECIPIENTS=jsherlock@procircular.com \
        TEAMS_WEBHOOK_URL="" \
        TWILIO_FROM_NUMBER="" \
        ONCALL_PHONE_NUMBER="" \
    --org "https://dev.azure.com/$ORG" \
    --project "$PROJECT" \
    --authorize true \
    --output none 2>/dev/null || echo "  ⚠️  Variable group may already exist"

# Staging variables
echo "Creating pc-ir-relay-stg-vars..."
az pipelines variable-group create \
    --name "pc-ir-relay-stg-vars" \
    --variables \
        ENABLE_EMAIL_NOTIFICATIONS=true \
        ENABLE_JIRA_NOTIFICATIONS=true \
        ENABLE_TEAMS_NOTIFICATIONS=false \
        ENABLE_SMS_NOTIFICATIONS=false \
        EMAIL_PROVIDER=sendgrid \
        IRT_EMAIL_ADDRESS=IRT@procircular.com \
        NON_IR_EMAIL_RECIPIENT=jsherlock@procircular.com \
        SENDGRID_FROM_EMAIL=DONOTREPLY@procircular.com \
        EMAIL_FROM_NAME_IR="ProCircular IR Alert" \
        EMAIL_FROM_NAME_NON_IR="ProCircular General Inquiry" \
        JIRA_API_URL=https://procircular.atlassian.net \
        JIRA_PROJECT_KEY=IRTSTG \
        JIRA_USER_EMAIL=jsherlock@procircular.com \
        JIRA_FAILURE_NOTIFICATION_RECIPIENTS=jsherlock@procircular.com \
    --org "https://dev.azure.com/$ORG" \
    --project "$PROJECT" \
    --authorize true \
    --output none 2>/dev/null || echo "  ⚠️  Variable group may already exist"

# Production variables
echo "Creating pc-ir-relay-prod-vars..."
az pipelines variable-group create \
    --name "pc-ir-relay-prod-vars" \
    --variables \
        ENABLE_EMAIL_NOTIFICATIONS=true \
        ENABLE_JIRA_NOTIFICATIONS=true \
        ENABLE_TEAMS_NOTIFICATIONS=false \
        ENABLE_SMS_NOTIFICATIONS=false \
        EMAIL_PROVIDER=sendgrid \
        IRT_EMAIL_ADDRESS=IRT@procircular.com \
        NON_IR_EMAIL_RECIPIENT=jsherlock@procircular.com \
        SENDGRID_FROM_EMAIL=DONOTREPLY@procircular.com \
        EMAIL_FROM_NAME_IR="ProCircular IR Alert" \
        EMAIL_FROM_NAME_NON_IR="ProCircular General Inquiry" \
        JIRA_API_URL=https://procircular.atlassian.net \
        JIRA_PROJECT_KEY=IRT \
        JIRA_USER_EMAIL=jsherlock@procircular.com \
        JIRA_FAILURE_NOTIFICATION_RECIPIENTS=jsherlock@procircular.com \
    --org "https://dev.azure.com/$ORG" \
    --project "$PROJECT" \
    --authorize true \
    --output none 2>/dev/null || echo "  ⚠️  Variable group may already exist"

echo ""
echo "✅ Variable groups created"
echo ""

# ============================================================================
# Step 2: Create Environments
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 2: Creating Environments"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

for env in Development Staging Production; do
    echo "Creating $env environment..."
    az pipelines environment create \
        --name "$env" \
        --org "https://dev.azure.com/$ORG" \
        --project "$PROJECT" \
        --output none 2>/dev/null || echo "  ⚠️  Environment may already exist"
done

echo ""
echo "✅ Environments created"
echo ""

# ============================================================================
# Step 3: Create Pipelines
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 3: Creating Pipelines"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# CI Pipeline
echo "Creating CI Pipeline..."
CI_PIPELINE_ID=$(az pipelines create \
    --name "CI - ProCircular IR Relay" \
    --repository "$REPO_NAME" \
    --branch main \
    --yaml-path ".azure-pipelines/ci-pipeline.yml" \
    --org "https://dev.azure.com/$ORG" \
    --project "$PROJECT" \
    --skip-first-run true \
    --query id -o tsv 2>/dev/null || echo "")

if [ -n "$CI_PIPELINE_ID" ]; then
    echo "  ✅ CI Pipeline created (ID: $CI_PIPELINE_ID)"
    
    # Link variable group to CI pipeline
    echo "  Linking variable group to CI pipeline..."
    az pipelines variable-group variable update \
        --group-id $(az pipelines variable-group list --org "https://dev.azure.com/$ORG" --project "$PROJECT" --query "[?name=='pc-ir-relay-common-vars'].id" -o tsv) \
        --name NODE_VERSION \
        --org "https://dev.azure.com/$ORG" \
        --project "$PROJECT" \
        --output none 2>/dev/null || true
else
    echo "  ⚠️  CI Pipeline may already exist or creation failed"
    echo "  You can create it manually:"
    echo "    1. Go to https://dev.azure.com/$ORG/$PROJECT/_build"
    echo "    2. New pipeline → Azure Repos Git → $REPO_NAME"
    echo "    3. Existing Azure Pipelines YAML file"
    echo "    4. Path: .azure-pipelines/ci-pipeline.yml"
fi

# CD Pipeline
echo ""
echo "Creating CD Pipeline..."
CD_PIPELINE_ID=$(az pipelines create \
    --name "CD - ProCircular IR Relay" \
    --repository "$REPO_NAME" \
    --branch main \
    --yaml-path ".azure-pipelines/cd-pipeline.yml" \
    --org "https://dev.azure.com/$ORG" \
    --project "$PROJECT" \
    --skip-first-run true \
    --query id -o tsv 2>/dev/null || echo "")

if [ -n "$CD_PIPELINE_ID" ]; then
    echo "  ✅ CD Pipeline created (ID: $CD_PIPELINE_ID)"
else
    echo "  ⚠️  CD Pipeline may already exist or creation failed"
    echo "  You can create it manually:"
    echo "    1. Go to https://dev.azure.com/$ORG/$PROJECT/_build"
    echo "    2. New pipeline → Azure Repos Git → $REPO_NAME"
    echo "    3. Existing Azure Pipelines YAML file"
    echo "    4. Path: .azure-pipelines/cd-pipeline.yml"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Setup Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next Steps:"
echo ""
echo "1. Verify Variable Groups:"
echo "   https://dev.azure.com/$ORG/$PROJECT/_library?itemType=VariableGroups"
echo ""
echo "2. Verify Pipelines:"
echo "   https://dev.azure.com/$ORG/$PROJECT/_build"
echo ""
echo "3. Link Variable Groups to Pipelines (if not auto-linked):"
echo "   - Edit each pipeline → Variables → Variable groups"
echo "   - Link: pc-ir-relay-common-vars"
echo "   - Link: pc-ir-relay-dev-vars (CD only)"
echo "   - Link: pc-ir-relay-stg-vars (CD only)"
echo "   - Link: pc-ir-relay-prod-vars (CD only)"
echo ""
echo "4. Verify Key Vault Access:"
echo "   - Key Vault: pc-ir-relay-kv"
echo "   - Secrets should be accessible by Azure DevOps service principal"
echo ""
echo "5. Test the pipelines by pushing a commit to main branch"
echo ""

