# Testing Guide - Retell AI Webhook Processor

This guide provides comprehensive testing procedures for the Azure Function webhook handler.

## Table of Contents
1. [Local Testing](#local-testing)
2. [Service-Specific Testing](#service-specific-testing)
3. [Integration Testing](#integration-testing)
4. [Production Testing](#production-testing)
5. [Troubleshooting Tests](#troubleshooting-tests)

---

## Local Testing

### Prerequisites
- All environment variables configured in `local.settings.json`
- Function built successfully (`npm run build`)
- Azure Functions Core Tools installed

### Step 1: Start the Function Locally

```bash
npm start
```

Expected output:
```
Azure Functions Core Tools
Core Tools Version:       4.x.x
Function Runtime Version: 4.x.x

Functions:
    RetellWebhookProcessor: [POST] http://localhost:7071/api/RetellWebhookProcessor

For detailed output, run func with --verbose flag.
```

### Step 2: Test with Sample Payload

Use the provided `test-payload.json` file:

```bash
curl -X POST http://localhost:7071/api/RetellWebhookProcessor \
  -H "Content-Type: application/json" \
  -d @test-payload.json
```

Expected response:
```json
{
  "success": true,
  "message": "Webhook processed successfully",
  "call_id": "584f904a8cda77eb733224"
}
```

### Step 3: Verify Notifications

Check that you received:
- ✅ Email in the configured IRT inbox
- ✅ Adaptive Card in the Teams channel
- ✅ SMS on the configured phone number

---

## Service-Specific Testing

### Testing SendGrid Email Only

Create a minimal test function to isolate email sending:

```bash
curl -X POST http://localhost:7071/api/RetellWebhookProcessor \
  -H "Content-Type: application/json" \
  -d '{
    "call_id": "email_test_001",
    "agent_id": "test",
    "start_timestamp": 1760013120,
    "end_timestamp": 1760013256,
    "transcript": "Test",
    "summary": "Email test",
    "analysis": {
      "caller_name": "Test User",
      "company_name": "Test Company",
      "caller_email_address": "test@example.com",
      "IR_call_description": "Testing email notification only"
    }
  }'
```

**Verification Steps:**
1. Check the IRT email inbox
2. Verify the email subject: "New Cybersecurity Incident Reported: Test Company"
3. Confirm HTML formatting is correct
4. Check all fields are populated

**Common Issues:**
- **Email not received**: Check spam folder, verify SendGrid API key
- **Formatting broken**: Verify HTML rendering in different email clients
- **Wrong sender**: Check `SENDGRID_FROM_EMAIL` is verified in SendGrid

### Testing Microsoft Teams Only

```bash
curl -X POST http://localhost:7071/api/RetellWebhookProcessor \
  -H "Content-Type: application/json" \
  -d '{
    "call_id": "teams_test_001",
    "agent_id": "test",
    "start_timestamp": 1760013120,
    "end_timestamp": 1760013256,
    "transcript": "Test",
    "summary": "Teams test",
    "analysis": {
      "caller_name": "Teams Test User",
      "company_name": "Teams Test Co",
      "caller_phone_number": "5551234567",
      "IR_call_description": "Testing Teams notification only"
    }
  }'
```

**Verification Steps:**
1. Check the configured Teams channel
2. Verify the Adaptive Card appears with proper formatting
3. Confirm all fact sets are displayed correctly
4. Check the attention-style header is red

**Common Issues:**
- **Card not appearing**: Verify webhook URL is active
- **Formatting issues**: Check Adaptive Card schema version compatibility
- **Webhook deleted**: Recreate the webhook in Teams

### Testing Twilio SMS Only

```bash
curl -X POST http://localhost:7071/api/RetellWebhookProcessor \
  -H "Content-Type: application/json" \
  -d '{
    "call_id": "sms_test_001",
    "agent_id": "test",
    "start_timestamp": 1760013120,
    "end_timestamp": 1760013256,
    "transcript": "Test",
    "summary": "SMS test",
    "analysis": {
      "caller_name": "SMS Test User",
      "company_name": "SMS Test Co",
      "IR_call_description": "Testing SMS notification only"
    }
  }'
```

**Verification Steps:**
1. Check the configured phone number receives SMS
2. Verify message format: "New ProCircular IR Alert: Incident reported by SMS Test User from SMS Test Co. Check email/Teams for details."
3. Confirm message is concise and readable

**Common Issues:**
- **SMS not received**: Verify phone number format (+1234567890)
- **Trial account**: Verify destination number is verified in Twilio
- **Wrong sender**: Check `TWILIO_FROM_NUMBER` is a valid Twilio number

---

## Integration Testing

### Full End-to-End Test

Use the complete test payload to verify all three notifications work together:

```bash
curl -X POST http://localhost:7071/api/RetellWebhookProcessor \
  -H "Content-Type: application/json" \
  -d @test-payload.json -v
```

**Verification Checklist:**
- [ ] HTTP 200 response received
- [ ] Response body contains `"success": true`
- [ ] Email received in IRT inbox
- [ ] Teams card posted to channel
- [ ] SMS received on on-call phone
- [ ] All notifications contain consistent information
- [ ] Timestamps are correct
- [ ] No errors in function logs

### Error Handling Test

Test with invalid payload to verify error handling:

```bash
# Missing required fields
curl -X POST http://localhost:7071/api/RetellWebhookProcessor \
  -H "Content-Type: application/json" \
  -d '{"invalid": "payload"}'
```

Expected response:
```json
{
  "success": false,
  "error": "Error message describing the issue"
}
```

### Performance Test

Test parallel execution timing:

```bash
# Send multiple requests
for i in {1..5}; do
  curl -X POST http://localhost:7071/api/RetellWebhookProcessor \
    -H "Content-Type: application/json" \
    -d @test-payload.json &
done
wait
```

**Verification:**
- All requests should complete successfully
- Check function logs for timing information
- Verify no rate limiting issues with external services

---

## Production Testing

### Pre-Deployment Checklist

Before deploying to Azure:

- [ ] All environment variables configured in Azure App Settings
- [ ] Function builds without errors (`npm run build`)
- [ ] Local testing completed successfully
- [ ] All three notification services tested individually
- [ ] Integration test passed
- [ ] Error handling verified
- [ ] Documentation updated

### Post-Deployment Testing

After deploying to Azure:

1. **Get the Function URL:**
```bash
az functionapp function show \
  --name procircular-ir-webhook \
  --resource-group ProCircularIR-RG \
  --function-name RetellWebhookProcessor
```

2. **Test the deployed function:**
```bash
curl -X POST "https://procircular-ir-webhook.azurewebsites.net/api/RetellWebhookProcessor?code=YOUR_FUNCTION_KEY" \
  -H "Content-Type: application/json" \
  -d @test-payload.json
```

3. **Monitor logs in real-time:**
```bash
func azure functionapp logstream procircular-ir-webhook
```

4. **Verify in Azure Portal:**
   - Navigate to Function App → Functions → RetellWebhookProcessor
   - Check "Monitor" tab for invocation history
   - Review any errors or warnings

### Retell AI Integration Test

1. **Configure Retell AI webhook:**
   - Log in to Retell AI dashboard
   - Navigate to agent settings
   - Set webhook URL to your Azure Function URL (with function key)

2. **Make a test call:**
   - Use Retell AI's test call feature
   - Complete a sample incident report
   - Wait for call analysis to complete

3. **Verify webhook received:**
   - Check Azure Function logs
   - Verify all three notifications sent
   - Confirm data accuracy

---

## Troubleshooting Tests

### Debug Mode

Add verbose logging to troubleshoot issues:

1. Check function logs:
```bash
func azure functionapp logstream procircular-ir-webhook
```

2. Enable Application Insights (if configured):
   - Navigate to Function App → Application Insights
   - View detailed telemetry and traces

### Common Test Failures

| Symptom | Possible Cause | Solution |
|---------|---------------|----------|
| 500 error | Missing env vars | Verify all required variables are set |
| Email fails | Invalid API key | Check SendGrid dashboard for API key status |
| Teams fails | Webhook deleted | Recreate webhook in Teams channel |
| SMS fails | Invalid phone format | Use E.164 format: +1234567890 |
| Timeout | Slow external service | Check service status pages |
| Parse error | Invalid JSON | Validate payload structure |

### Testing Individual Components

To test each notification service independently, you can temporarily comment out the other services in the `Promise.all()` call:

```typescript
// In RetellWebhookProcessor.ts, temporarily modify:
await Promise.all([
    sendEmail(payload, config, context),
    // sendTeamsMessage(payload, config, context),  // Commented out
    // sendSms(payload, config, context)            // Commented out
]);
```

Rebuild and test to isolate issues.

---

## Automated Testing (Future Enhancement)

Consider adding automated tests using:

- **Jest** for unit testing
- **Supertest** for HTTP endpoint testing
- **Mock services** for external API calls

Example test structure:
```typescript
describe('RetellWebhookProcessor', () => {
  it('should return 200 for valid payload', async () => {
    // Test implementation
  });
  
  it('should return 500 for invalid payload', async () => {
    // Test implementation
  });
});
```

---

## Test Data Variations

Test with different scenarios:

### Scenario 1: Customer with Insurance
```json
{
  "analysis": {
    "current_customer": "true",
    "incident_liability_insurance_status": "yes",
    "cybersecurity_insurance_provider_name": "Cowbell Cyber"
  }
}
```

### Scenario 2: New Customer without Insurance
```json
{
  "analysis": {
    "current_customer": "false",
    "incident_liability_insurance_status": "no"
  }
}
```

### Scenario 3: Missing Optional Fields
```json
{
  "analysis": {
    "caller_name": "John Doe",
    "company_name": "Test Co"
    // Other fields omitted
  }
}
```

---

## Monitoring and Alerts

Set up monitoring for production:

1. **Azure Monitor Alerts:**
   - Alert on function failures
   - Alert on high latency
   - Alert on missing invocations

2. **Service Health Checks:**
   - Monitor SendGrid delivery rates
   - Monitor Twilio message status
   - Monitor Teams webhook availability

3. **Regular Testing:**
   - Schedule weekly test calls
   - Verify all notifications still working
   - Update test data as needed

---

**Last Updated:** 2025-10-08

