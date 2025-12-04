# ProCircular IR Relay - Retell AI Webhook Processor

An Azure Function that processes Retell AI `call_analyzed` webhook events and intelligently routes notifications based on call type (IR vs Non-IR).

## 🎯 Overview

This serverless application receives webhook notifications from Retell AI when calls are analyzed. It intelligently determines the call type and routes notifications accordingly:

### **IR (Incident Response) Calls**
When a cybersecurity incident is reported:
1. **🎫 Creates a Jira ticket** automatically via webhook integration
2. **📧 Sends IR alert email** (Configurable)
3. **💬 Posts notification card** to Microsoft Teams channel (Optional)
4. **📱 Sends SMS alert** to on-call phone number (Optional)

### **Non-IR (General Inquiry) Calls**
When a general question or service inquiry is received:
1. **📧 Sends email summary** to designated recipient (Katie W)
2. **No Jira ticket, Teams, or SMS** - keeps IR channels clear

All notifications are triggered in parallel for maximum efficiency.

## 🏗️ Architecture

```
Retell AI Call Analyzed Event
         ↓
    [Webhook POST]
         ↓
Azure Function (HTTP Trigger)
         ↓
    [Parse Payload]
         ↓
    ┌────┴────┬────────┐
    ↓         ↓        ↓
SendGrid   Teams    Twilio
  Email     Card      SMS
```

## 🚀 Features

- **Intelligent Call Routing** - Automatically detects IR vs Non-IR calls and routes appropriately
- **Jira Integration** - Creates incident tickets automatically via webhook
- **Enhanced Data Capture** - Includes caller location (City, State) and security incident flag
- **Dual Email Providers** - Supports both SendGrid and Azure Communication Services
- **TypeScript V4 Programming Model** - Modern Azure Functions development
- **Feature Flags** - Granular control over notification channels via environment variables
- **Parallel Execution** - All notifications sent simultaneously using `Promise.all()`
- **Type Safety** - Full TypeScript interfaces for payload validation
- **Rich Formatting** - HTML emails and Adaptive Cards for Teams
- **Separate Non-IR Workflow** - Dedicated email summaries for general inquiries
- **Error Handling** - Comprehensive try-catch with detailed logging
- **Secure Configuration** - All secrets managed via environment variables
- **Production Ready** - Follows Azure Functions best practices

### 🎯 Production Deployment Configuration

**Currently Enabled for Production:**
- ✅ Jira Integration (automatic ticket creation for IR calls)
- ✅ Email Notifications (IR alerts to IRT@procircular.com, Non-IR summaries to jsherlock@procircular.com)

**Deferred to Future Phase (can be enabled via feature flags):**
- ⏸️ Microsoft Teams Notifications (set `ENABLE_TEAMS_NOTIFICATIONS=true` to enable)
- ⏸️ SMS Notifications (set `ENABLE_SMS_NOTIFICATIONS=true` to enable)

All notification channels are fully implemented and tested - they're simply disabled via feature flags for the initial production deployment.

## 📋 Prerequisites

- Node.js 18+ and npm
- Azure Functions Core Tools v4
- Azure CLI
- Active accounts for:
  - SendGrid (email)
  - Microsoft Teams (webhook)
  - Twilio (SMS)

## 🔧 Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd pc-ir-relay
npm install
```

### 2. Configure Environment

Copy the template and fill in your credentials:

```bash
cp local.settings.json.template local.settings.json
# Edit local.settings.json with your actual API keys
```

Required environment variables:

**Feature Flags** (control which channels are active):
- `ENABLE_EMAIL_NOTIFICATIONS` - Set to "true" to enable email (default: false)
- `ENABLE_TEAMS_NOTIFICATIONS` - Set to "true" to enable Teams (default: false)
- `ENABLE_SMS_NOTIFICATIONS` - Set to "true" to enable SMS (default: false)
- `ENABLE_JIRA_NOTIFICATIONS` - Set to "true" to enable Jira ticket creation (default: false)

**Email Configuration:**
- `EMAIL_PROVIDER` - Choose "sendgrid" or "azure" (default: sendgrid)
- `SENDGRID_API_KEY` - Your SendGrid API key (if using SendGrid)
- `SENDGRID_FROM_EMAIL` - Verified sender email (if using SendGrid)
- `AZURE_COMMUNICATION_CONNECTION_STRING` - Azure Communication Services connection string (if using Azure)
- `AZURE_COMMUNICATION_SENDER_EMAIL` - Azure sender email (if using Azure)
- `IRT_EMAIL_ADDRESS` - Incident Response Team email (for IR alerts)
- `NON_IR_EMAIL_RECIPIENT` - Email recipient for non-IR summaries (defaults to IRT_EMAIL_ADDRESS)

**Jira Integration:**
- `JIRA_WEBHOOK_URL` - Jira incoming webhook URL (required if Jira enabled)
- `JIRA_PROJECT_KEY` - Jira project key, e.g., "IRT" (optional, defaults to "IRT")

**Teams & SMS:**
- `TEAMS_WEBHOOK_URL` - Microsoft Teams incoming webhook URL
- `TWILIO_ACCOUNT_SID` - Twilio account SID
- `TWILIO_AUTH_TOKEN` - Twilio auth token
- `TWILIO_FROM_NUMBER` - Your Twilio phone number
- `ONCALL_PHONE_NUMBER` - On-call team member's phone

See [Docs/FEATURE_FLAGS.md](./Docs/FEATURE_FLAGS.md) for detailed information on feature flags.

### 3. Build and Run Locally

```bash
npm run build
npm start
```

The function will be available at:
```
http://localhost:7071/api/RetellWebhookProcessor
```

### 4. Test with Sample Payload

```bash
curl -X POST http://localhost:7071/api/RetellWebhookProcessor \
  -H "Content-Type: application/json" \
  -d '{
    "call_id": "test_123",
    "agent_id": "agent_test",
    "start_timestamp": 1760013120,
    "end_timestamp": 1760013256,
    "transcript": "Test call transcript",
    "summary": "Test incident summary",
    "analysis": {
      "caller_name": "John Doe",
      "company_name": "Test Company",
      "caller_phone_number": "5551234567",
      "caller_email_address": "john@test.com",
      "current_customer": "true",
      "incident_liability_insurance_status": "yes",
      "cybersecurity_insurance_provider_name": "Test Insurance",
      "IR_call_description": "Test incident description"
    }
  }'
```

## 📦 Project Structure

```
pc-ir-relay/
├── src/
│   ├── functions/
│   │   └── RetellWebhookProcessor.ts    # Main webhook handler
│   └── index.ts                          # Azure Functions setup
├── local.settings.json                   # Local environment config (gitignored)
├── package.json                          # Dependencies
├── tsconfig.json                         # TypeScript configuration
├── host.json                             # Azure Functions host config
├── SETUP_GUIDE.md                        # Detailed setup instructions
└── README.md                             # This file
```

## 🔐 Security

- **Function-level authorization** - Requires function key in URL
- **Environment variables** - All secrets stored securely
- **No hardcoded credentials** - Configuration validation at runtime
- **HTTPS only** - All external API calls use secure connections

## 📊 Payload Schema

The function expects a Retell AI `call_analyzed` webhook payload with the following structure:

```typescript
interface RetellAnalysisPayload {
  call_id: string;
  agent_id: string;
  start_timestamp: number;
  end_timestamp: number;
  transcript: string;
  summary: string;
  analysis: {
    caller_name?: string;
    company_name?: string;
    caller_phone_number?: string;
    caller_email_address?: string;
    caller_location?: string;  // NEW: City, State format (e.g., "Minneapolis, Minnesota")
    current_customer?: string;
    incident_is_customer_primary_contact?: string;
    incident_liability_insurance_status?: string;
    cybersecurity_insurance_provider_name?: string;
    is_security_incident?: boolean;  // NEW: Boolean flag indicating if this is a security incident
    IR_call_description?: string;
    non_IR_inquiry_reason?: string;
    non_IR_call_description?: string;
  };
  metadata?: Record<string, any>;
}
```

## 📧 Notification Examples

### Email (SendGrid)
- **Subject:** `New Cybersecurity Incident Reported: [Company Name]`
- **Format:** HTML with styled sections
- **Content:** All incident details, caller info, insurance status

### Teams (Adaptive Card)
- **Title:** 🚨 New Cybersecurity Incident Reported
- **Format:** Adaptive Card with fact sets
- **Content:** Key details in structured format

### SMS (Twilio)
- **Format:** Concise text message
- **Content:** `New ProCircular IR Alert: Incident reported by [Name] from [Company]. Check email/Teams for details.`

## 🚀 Deployment

### Deploy to Azure

```bash
# Login to Azure
az login

# Create resources
az group create --name ProCircularIR-RG --location eastus

# Create Function App
az functionapp create \
  --resource-group ProCircularIR-RG \
  --consumption-plan-location eastus \
  --runtime node \
  --runtime-version 18 \
  --functions-version 4 \
  --name procircular-ir-webhook \
  --storage-account <your-storage-account>

# Deploy
func azure functionapp publish procircular-ir-webhook
```

See [SETUP_GUIDE.md](./SETUP_GUIDE.md) for detailed deployment instructions.

## 🔍 Monitoring

### View Logs

```bash
# Stream logs from Azure
func azure functionapp logstream procircular-ir-webhook
```

### Azure Portal
1. Navigate to your Function App
2. Select **Functions** → **RetellWebhookProcessor**
3. Click **Monitor** for invocation history and logs

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Missing environment variables | Verify all required vars are set in `local.settings.json` or Azure App Settings |
| Email not sending | Check SendGrid API key and verify sender email |
| Teams card not appearing | Verify webhook URL is active and correct |
| SMS not sending | Verify Twilio credentials and phone number format (+1234567890) |
| 500 error | Check function logs for detailed error messages |

## 📚 Documentation

- [Docs/SETUP_GUIDE.md](./Docs/SETUP_GUIDE.md) - Comprehensive setup and configuration guide
- [Docs/FEATURE_FLAGS.md](./Docs/FEATURE_FLAGS.md) - Feature flags for notification channel control
- [Docs/TESTING_GUIDE.md](./Docs/TESTING_GUIDE.md) - Testing procedures and troubleshooting
- [Docs/DEPLOYMENT_CHECKLIST.md](./Docs/DEPLOYMENT_CHECKLIST.md) - Deployment workflow
- [Docs/API_REFERENCE.md](./Docs/API_REFERENCE.md) - API documentation
- [Docs/QUICK_REFERENCE.md](./Docs/QUICK_REFERENCE.md) - Quick reference card
- [Azure Functions Docs](https://learn.microsoft.com/en-us/azure/azure-functions/)
- [Retell AI Webhook Docs](https://docs.retellai.com/)
- [SendGrid API Docs](https://docs.sendgrid.com/)
- [Twilio API Docs](https://www.twilio.com/docs/)

## 🛠️ Development

### Available Scripts

```bash
npm run build      # Compile TypeScript
npm run watch      # Watch mode for development
npm run clean      # Remove dist folder
npm start          # Start local function host
```

### Adding New Features

1. Modify `src/functions/RetellWebhookProcessor.ts`
2. Add new helper functions as needed
3. Update TypeScript interfaces
4. Test locally before deploying
5. Update documentation

## 📄 License

[Your License Here]

## 👥 Contributors

ProCircular Incident Response Team

## 📞 Support

For issues or questions, contact your system administrator or refer to the [SETUP_GUIDE.md](./SETUP_GUIDE.md).

---

**Built with ❤️ using Azure Functions, TypeScript, and the Retell AI platform**

