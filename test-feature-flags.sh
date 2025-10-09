#!/bin/bash

# Test script to demonstrate feature flags functionality
# This script tests the webhook with different feature flag combinations

echo "=========================================="
echo "Feature Flags Test Script"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ENDPOINT="http://localhost:7071/api/RetellWebhookProcessor"

echo "Testing Retell AI Webhook Processor with different feature flag combinations"
echo "Make sure the function is running locally (npm start)"
echo ""
read -p "Press Enter to continue..."
echo ""

# Test 1: Only Email Enabled
echo -e "${YELLOW}Test 1: Only Email Enabled${NC}"
echo "Expected: Email sent, Teams and SMS skipped"
echo ""
echo "Set in local.settings.json:"
echo "  ENABLE_EMAIL_NOTIFICATIONS=true"
echo "  ENABLE_TEAMS_NOTIFICATIONS=false"
echo "  ENABLE_SMS_NOTIFICATIONS=false"
echo ""
read -p "Press Enter to send test request..."
echo ""

curl -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d @test-payload.json \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq .

echo ""
echo "Check the function logs to verify only email was sent"
echo ""
read -p "Press Enter to continue to next test..."
echo ""

# Test 2: Only Teams Enabled
echo -e "${YELLOW}Test 2: Only Teams Enabled${NC}"
echo "Expected: Teams card sent, Email and SMS skipped"
echo ""
echo "Set in local.settings.json:"
echo "  ENABLE_EMAIL_NOTIFICATIONS=false"
echo "  ENABLE_TEAMS_NOTIFICATIONS=true"
echo "  ENABLE_SMS_NOTIFICATIONS=false"
echo ""
read -p "Press Enter to send test request..."
echo ""

curl -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d @test-payload.json \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq .

echo ""
echo "Check the function logs to verify only Teams was sent"
echo ""
read -p "Press Enter to continue to next test..."
echo ""

# Test 3: All Channels Enabled
echo -e "${YELLOW}Test 3: All Channels Enabled${NC}"
echo "Expected: Email, Teams, and SMS all sent"
echo ""
echo "Set in local.settings.json:"
echo "  ENABLE_EMAIL_NOTIFICATIONS=true"
echo "  ENABLE_TEAMS_NOTIFICATIONS=true"
echo "  ENABLE_SMS_NOTIFICATIONS=true"
echo ""
read -p "Press Enter to send test request..."
echo ""

curl -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d @test-payload.json \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq .

echo ""
echo "Check the function logs to verify all three notifications were sent"
echo ""
read -p "Press Enter to continue to next test..."
echo ""

# Test 4: No Channels Enabled
echo -e "${YELLOW}Test 4: No Channels Enabled${NC}"
echo "Expected: HTTP 200, warning in logs, no notifications sent"
echo ""
echo "Set in local.settings.json:"
echo "  ENABLE_EMAIL_NOTIFICATIONS=false"
echo "  ENABLE_TEAMS_NOTIFICATIONS=false"
echo "  ENABLE_SMS_NOTIFICATIONS=false"
echo ""
read -p "Press Enter to send test request..."
echo ""

curl -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d @test-payload.json \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq .

echo ""
echo "Check the function logs for the warning message"
echo ""

echo -e "${GREEN}=========================================="
echo "Feature Flags Testing Complete!"
echo "==========================================${NC}"
echo ""
echo "Key Observations:"
echo "1. Response includes 'notifications_sent' object showing which channels were active"
echo "2. Function returns HTTP 200 even when no channels are enabled"
echo "3. Logs clearly show which channels are enabled/disabled"
echo "4. Only enabled channels execute their notification logic"
echo ""
echo "For more information, see Docs/FEATURE_FLAGS.md"

