# API Reference - Retell AI Webhook Processor

Complete API documentation for the Azure Function webhook endpoint.

## Endpoint

### POST /api/RetellWebhookProcessor

Processes Retell AI `call_analyzed` webhook events and triggers multi-channel notifications.

**URL:** `https://<your-function-app>.azurewebsites.net/api/RetellWebhookProcessor?code=<function-key>`

**Method:** `POST`

**Authentication:** Function key required (passed as query parameter)

**Content-Type:** `application/json`

---

## Request

### Headers

| Header | Value | Required |
|--------|-------|----------|
| Content-Type | application/json | Yes |

### Query Parameters

| Parameter | Type | Description | Required |
|-----------|------|-------------|----------|
| code | string | Azure Function authorization key | Yes |

### Request Body

The request body must be a valid JSON object matching the Retell AI `call_analyzed` webhook payload structure.

#### Schema

```typescript
{
  call_id: string;              // Unique identifier for the call
  agent_id: string;             // Retell AI agent identifier
  start_timestamp: number;      // Unix timestamp (seconds) when call started
  end_timestamp: number;        // Unix timestamp (seconds) when call ended
  transcript: string;           // Full conversation transcript
  summary: string;              // AI-generated call summary
  analysis: {                   // Custom analysis fields from Retell agent
    caller_name?: string;
    company_name?: string;
    caller_phone_number?: string;
    caller_email_address?: string;
    current_customer?: string;  // "true" or "false"
    incident_is_customer_primary_contact?: string;  // "true" or "false"
    incident_liability_insurance_status?: string;   // "yes" or "no"
    cybersecurity_insurance_provider_name?: string;
    IR_call_description?: string;
    non_IR_inquiry_reason?: string;
  };
  metadata?: Record<string, any>;  // Optional metadata
}
```

#### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `call_id` | string | Unique identifier for the call session |
| `agent_id` | string | ID of the Retell AI agent that handled the call |
| `start_timestamp` | number | Unix timestamp (seconds) when the call started |
| `end_timestamp` | number | Unix timestamp (seconds) when the call ended |
| `transcript` | string | Complete conversation transcript between agent and caller |
| `summary` | string | AI-generated summary of the call |
| `analysis.caller_name` | string | Name of the person who called |
| `analysis.company_name` | string | Company name of the caller |
| `analysis.caller_phone_number` | string | Phone number of the caller |
| `analysis.caller_email_address` | string | Email address of the caller |
| `analysis.current_customer` | string | Whether caller is an existing customer ("true"/"false") |
| `analysis.incident_is_customer_primary_contact` | string | Whether caller is the primary contact ("true"/"false") |
| `analysis.incident_liability_insurance_status` | string | Whether caller has cyber insurance ("yes"/"no") |
| `analysis.cybersecurity_insurance_provider_name` | string | Name of the insurance provider |
| `analysis.IR_call_description` | string | Description of the incident reported |
| `analysis.non_IR_inquiry_reason` | string | Reason if not an IR call |
| `metadata` | object | Optional additional metadata |

### Example Request

```bash
curl -X POST "https://procircular-ir-webhook.azurewebsites.net/api/RetellWebhookProcessor?code=abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "call_id": "584f904a8cda77eb733224",
    "agent_id": "agent_dc74e30b4",
    "start_timestamp": 1760013120,
    "end_timestamp": 1760013256,
    "transcript": "agent: Thank you for calling...",
    "summary": "The user reported a ransomware incident...",
    "analysis": {
      "caller_name": "Jim Sherlock",
      "company_name": "Cyberpave",
      "caller_phone_number": "3196218396",
      "caller_email_address": "jsherlock@cybercade.com",
      "current_customer": "true",
      "incident_liability_insurance_status": "yes",
      "cybersecurity_insurance_provider_name": "Cowbell Cyber",
      "IR_call_description": "All machines locked with ransomware"
    }
  }'
```

---

## Response

### Success Response

**Status Code:** `200 OK`

**Content-Type:** `application/json`

**Body:**
```json
{
  "success": true,
  "message": "Webhook processed successfully",
  "call_id": "584f904a8cda77eb733224"
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Always `true` for successful processing |
| `message` | string | Human-readable success message |
| `call_id` | string | Echo of the call_id from the request |

### Error Response

**Status Code:** `500 Internal Server Error`

**Content-Type:** `application/json`

**Body:**
```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

#### Error Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Always `false` for errors |
| `error` | string | Description of the error that occurred |

### Common Error Messages

| Error Message | Cause | Solution |
|---------------|-------|----------|
| "Missing required environment variables: ..." | Configuration issue | Verify all environment variables are set |
| "Teams webhook failed: 400 Bad Request" | Invalid Teams webhook URL | Verify webhook URL is correct and active |
| "Unauthorized" | Invalid or missing function key | Check the `code` query parameter |
| "Invalid JSON" | Malformed request body | Validate JSON syntax |

---

## Behavior

### Processing Flow

1. **Receive webhook** - Function receives POST request from Retell AI
2. **Parse payload** - Extract and validate JSON body
3. **Load configuration** - Retrieve environment variables
4. **Parallel notifications** - Simultaneously trigger:
   - SendGrid email to IRT
   - Microsoft Teams Adaptive Card
   - Twilio SMS to on-call number
5. **Return response** - Send success/error response to Retell AI

### Notification Details

#### Email Notification (SendGrid)

- **To:** Value of `IRT_EMAIL_ADDRESS` environment variable
- **From:** Value of `SENDGRID_FROM_EMAIL` environment variable
- **Subject:** `New Cybersecurity Incident Reported: [Company Name]`
- **Format:** HTML with styled sections
- **Content:** Complete incident details including:
  - Company and caller information
  - Contact details
  - Insurance status
  - Incident description
  - Call metadata

#### Teams Notification (Adaptive Card)

- **Destination:** Teams channel configured with webhook URL
- **Format:** Adaptive Card v1.4
- **Style:** Attention-style header (red)
- **Content:** Structured fact sets with:
  - Company and caller details
  - Contact information
  - Insurance status
  - Incident description
  - Call ID and timestamp

#### SMS Notification (Twilio)

- **To:** Value of `ONCALL_PHONE_NUMBER` environment variable
- **From:** Value of `TWILIO_FROM_NUMBER` environment variable
- **Format:** Plain text
- **Content:** Concise alert message:
  ```
  New ProCircular IR Alert: Incident reported by [Caller Name] from [Company Name]. Check email/Teams for details.
  ```

### Timing

- **Parallel execution:** All three notifications are sent simultaneously
- **Typical response time:** 2-5 seconds
- **Timeout:** Azure Functions default timeout (5 minutes for Consumption plan)

### Idempotency

The function is **not idempotent**. Each invocation will send new notifications regardless of whether the same `call_id` was previously processed. Retell AI should be configured to send each webhook event only once.

---

## Environment Variables

The function requires the following environment variables to be configured:

| Variable | Description | Example |
|----------|-------------|---------|
| `SENDGRID_API_KEY` | SendGrid API key for sending emails | `SG.abc123...` |
| `SENDGRID_FROM_EMAIL` | Verified sender email address | `noreply@procircular.com` |
| `IRT_EMAIL_ADDRESS` | Recipient email for incident reports | `IRT@procircular.com` |
| `TEAMS_WEBHOOK_URL` | Microsoft Teams incoming webhook URL | `https://...webhook.office.com/...` |
| `TWILIO_ACCOUNT_SID` | Twilio account SID | `ACxxxxxxxx...` |
| `TWILIO_AUTH_TOKEN` | Twilio authentication token | `abc123...` |
| `TWILIO_FROM_NUMBER` | Twilio phone number (E.164 format) | `+15551234567` |
| `ONCALL_PHONE_NUMBER` | On-call phone number (E.164 format) | `+15559876543` |

---

## Rate Limits

### Azure Functions
- **Consumption Plan:** No hard limit, but subject to dynamic scaling
- **Premium Plan:** Higher throughput available

### External Services
- **SendGrid:** Depends on your plan (Free: 100/day, Essentials: 40k-100k/month)
- **Twilio:** Depends on your account (Trial: limited, Pay-as-you-go: high limits)
- **Teams:** Approximately 4 requests per second per webhook

**Recommendation:** For high-volume scenarios, implement queuing or rate limiting.

---

## Security

### Authentication
- **Function Key:** Required in query string (`?code=...`)
- **Key Type:** Function-level (specific to this function)
- **Key Rotation:** Supported via Azure Portal or CLI

### Data Privacy
- **Logging:** Sensitive data (API keys, phone numbers) are not logged
- **Transmission:** All external API calls use HTTPS
- **Storage:** No data is persisted by the function

### Best Practices
1. Keep function keys secure (use password manager)
2. Rotate keys regularly (quarterly recommended)
3. Use Azure Key Vault for production secrets
4. Monitor function invocations for unusual activity
5. Restrict network access if possible (Premium plan feature)

---

## Monitoring

### Logs

View function logs:
```bash
func azure functionapp logstream procircular-ir-webhook
```

### Metrics

Available in Azure Portal under Function App → Monitor:
- Invocation count
- Success rate
- Average execution time
- Error rate

### Application Insights

If enabled, provides:
- Detailed telemetry
- Dependency tracking (SendGrid, Twilio, Teams)
- Custom metrics
- Distributed tracing

---

## Troubleshooting

### Debug Checklist

1. **Verify request format:**
   ```bash
   # Validate JSON
   cat payload.json | jq .
   ```

2. **Check function logs:**
   ```bash
   func azure functionapp logstream procircular-ir-webhook
   ```

3. **Test individual services:**
   - SendGrid: Check activity in SendGrid dashboard
   - Twilio: Check message logs in Twilio console
   - Teams: Verify webhook URL is active

4. **Verify environment variables:**
   ```bash
   az functionapp config appsettings list \
     --name procircular-ir-webhook \
     --resource-group ProCircularIR-RG
   ```

### Common Issues

See [TESTING_GUIDE.md](./TESTING_GUIDE.md) for detailed troubleshooting steps.

---

## Versioning

**Current Version:** 1.0.0

**API Stability:** Stable

**Breaking Changes:** Will be communicated via release notes

---

## Support

For technical support:
- Review documentation in this repository
- Check Azure Functions documentation
- Contact your system administrator

---

**Last Updated:** 2025-10-08

