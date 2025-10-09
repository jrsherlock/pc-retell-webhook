#!/bin/bash

# Simple test script for the webhook
# Tests the webhook with the sample payload

echo "Testing Retell AI Webhook Processor..."
echo ""

curl -X POST http://localhost:7071/api/RetellWebhookProcessor \
  -H "Content-Type: application/json" \
  -d @test-payload.json \
  -w "\n\nHTTP Status: %{http_code}\n" \
  -s | jq .

echo ""
echo "Check the function logs in the other terminal for details."

