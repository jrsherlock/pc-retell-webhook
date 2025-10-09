# Retell AI Webhook Processor - Setup Guide

This guide will walk you through setting up the Azure Function that processes Retell AI `call_analyzed` webhook events and sends notifications via Email (SendGrid), Microsoft Teams, and SMS (Twilio).

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Environment Configuration](#environment-configuration)
3. [Service Setup](#service-setup)
4. [Local Development](#local-development)
5. [Deployment to Azure](#deployment-to-azure)
6. [Testing the Webhook](#testing-the-webhook)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before you begin, ensure you have:

- **Node.js** (v18 or later) and npm installed
- **Azure Functions Core Tools** (v4.x) - [Installation Guide](https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local)
- **Azure CLI** - [Installation Guide](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli)
- An **Azure subscription** with permissions to create Function Apps
- Accounts with the following services:
  - **SendGrid** (for email notifications)
  - **Twilio** (for SMS notifications)
  - **Microsoft Teams** (with permissions to create incoming webhooks)

---

## Environment Configuration

### 1. SendGrid Setup

1. Sign up for a SendGrid account at https://sendgrid.com
2. Navigate to **Settings** → **API Keys**
3. Click **Create API Key**
4. Give it a name (e.g., "ProCircular IR Alerts") and select **Full Access**
5. Copy the API key (you won't be able to see it again!)
6. Verify a sender email address:
   - Go to **Settings** → **Sender Authentication**
   - Follow the steps to verify your domain or single sender email

**Required Environment Variables:**
```
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=noreply@procircular.com
IRT_EMAIL_ADDRESS=IRT@procircular.com
```

### 2. Microsoft Teams Webhook Setup

1. Open the Microsoft Teams channel where you want to receive notifications
2. Click the **•••** (More options) next to the channel name
3. Select **Connectors** (or **Workflows** in newer Teams versions)
4. Search for **Incoming Webhook**
5. Click **Add** or **Configure**
6. Give it a name (e.g., "ProCircular IR Alerts")
7. Optionally upload an icon
8. Click **Create**
9. Copy the webhook URL

**Required Environment Variable:**
```
TEAMS_WEBHOOK_URL=https://yourorg.webhook.office.com/webhookb2/xxxxx
```

### 3. Twilio Setup

1. Sign up for a Twilio account at https://www.twilio.com
2. From the Twilio Console dashboard, note your:
   - **Account SID**
   - **Auth Token**
3. Purchase a phone number:
   - Go to **Phone Numbers** → **Buy a Number**
   - Select a number with SMS capabilities
   - Complete the purchase

**Required Environment Variables:**
```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_FROM_NUMBER=+15551234567
ONCALL_PHONE_NUMBER=+15559876543
```

### 4. Update local.settings.json

Edit the `local.settings.json` file in your project root and replace all placeholder values with your actual credentials:

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    
    "SENDGRID_API_KEY": "SG.your_actual_key_here",
    "SENDGRID_FROM_EMAIL": "noreply@procircular.com",
    "IRT_EMAIL_ADDRESS": "IRT@procircular.com",
    
    "TEAMS_WEBHOOK_URL": "https://yourorg.webhook.office.com/webhookb2/xxxxx",
    
    "TWILIO_ACCOUNT_SID": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "TWILIO_AUTH_TOKEN": "your_auth_token_here",
    "TWILIO_FROM_NUMBER": "+15551234567",
    "ONCALL_PHONE_NUMBER": "+15559876543"
  }
}
```

⚠️ **Important:** Never commit `local.settings.json` to version control! It's already in `.gitignore`.

---

## Local Development

### 1. Install Dependencies

```bash
npm install
```

### 2. Build the Project

```bash
npm run build
```

### 3. Start the Function Locally

```bash
npm start
```

You should see output similar to:
```
Functions:
    RetellWebhookProcessor: [POST] http://localhost:7071/api/RetellWebhookProcessor
```

### 4. Test Locally with cURL

Create a test payload file `test-payload.json`:

```json
{
  "call_id": "test_call_123",
  "agent_id": "agent_test",
  "start_timestamp": 1760013120,
  "end_timestamp": 1760013256,
  "transcript": "Test transcript",
  "summary": "Test incident summary",
  "analysis": {
    "incident_liability_insurance_status": "yes",
    "caller_name": "John Doe",
    "incident_is_customer_primary_contact": "true",
    "current_customer": "true",
    "cybersecurity_insurance_provider_name": "Test Insurance Co",
    "caller_email_address": "john@example.com",
    "company_name": "Test Company Inc",
    "caller_phone_number": "5551234567",
    "IR_call_description": "Test incident description for local testing"
  },
  "metadata": {}
}
```

Send a test request:

```bash
curl -X POST http://localhost:7071/api/RetellWebhookProcessor \
  -H "Content-Type: application/json" \
  -d @test-payload.json
```

You should receive a response like:
```json
{
  "success": true,
  "message": "Webhook processed successfully",
  "call_id": "test_call_123"
}
```

Check your email, Teams channel, and phone for the notifications!

---

## Deployment to Azure

### 1. Login to Azure

```bash
az login
```

### 2. Create a Resource Group (if needed)

```bash
az group create --name ProCircularIR-RG --location eastus
```

### 3. Create a Storage Account

```bash
az storage account create \
  --name procircularirstorage \
  --resource-group ProCircularIR-RG \
  --location eastus \
  --sku Standard_LRS
```

### 4. Create the Function App

```bash
az functionapp create \
  --resource-group ProCircularIR-RG \
  --consumption-plan-location eastus \
  --runtime node \
  --runtime-version 18 \
  --functions-version 4 \
  --name procircular-ir-webhook \
  --storage-account procircularirstorage
```

### 5. Configure Application Settings

Set all environment variables in Azure:

```bash
az functionapp config appsettings set \
  --name procircular-ir-webhook \
  --resource-group ProCircularIR-RG \
  --settings \
    "SENDGRID_API_KEY=SG.your_key_here" \
    "SENDGRID_FROM_EMAIL=noreply@procircular.com" \
    "IRT_EMAIL_ADDRESS=IRT@procircular.com" \
    "TEAMS_WEBHOOK_URL=https://yourorg.webhook.office.com/webhookb2/xxxxx" \
    "TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
    "TWILIO_AUTH_TOKEN=your_auth_token_here" \
    "TWILIO_FROM_NUMBER=+15551234567" \
    "ONCALL_PHONE_NUMBER=+15559876543"
```

### 6. Deploy the Function

```bash
func azure functionapp publish procircular-ir-webhook
```

### 7. Get the Function URL

After deployment, get the function URL with the access key:

```bash
az functionapp function show \
  --name procircular-ir-webhook \
  --resource-group ProCircularIR-RG \
  --function-name RetellWebhookProcessor
```

Or retrieve the function key:

```bash
az functionapp keys list \
  --name procircular-ir-webhook \
  --resource-group ProCircularIR-RG
```

Your webhook URL will be:
```
https://procircular-ir-webhook.azurewebsites.net/api/RetellWebhookProcessor?code=YOUR_FUNCTION_KEY
```

---

## Testing the Webhook

### Configure Retell AI

1. Log in to your Retell AI dashboard
2. Navigate to your agent configuration
3. Find the **Webhook URL** setting
4. Enter your Azure Function URL (with the function key)
5. Save the configuration

### Monitor Logs

View real-time logs in Azure:

```bash
func azure functionapp logstream procircular-ir-webhook
```

Or use the Azure Portal:
1. Navigate to your Function App
2. Select **Functions** → **RetellWebhookProcessor**
3. Click **Monitor** to view invocation logs

---

## Troubleshooting

### Common Issues

**1. "Missing required environment variables" error**
- Verify all environment variables are set correctly
- Check for typos in variable names
- Ensure no extra spaces in values

**2. SendGrid email not sending**
- Verify your API key has full access permissions
- Check that the sender email is verified in SendGrid
- Review SendGrid activity logs in their dashboard

**3. Teams notification not appearing**
- Verify the webhook URL is correct and active
- Check that the webhook hasn't been deleted from Teams
- Test the webhook URL directly with a simple POST request

**4. Twilio SMS not sending**
- Verify Account SID and Auth Token are correct
- Ensure the from number is a valid Twilio number you own
- Check that the to number is in E.164 format (+1234567890)
- For trial accounts, verify the to number is verified

**5. Function returns 500 error**
- Check the function logs for detailed error messages
- Verify the request payload matches the expected schema
- Test each notification service independently

### Debug Mode

To enable verbose logging, you can temporarily add more context.log statements or use Application Insights for detailed telemetry.

---

## Security Best Practices

1. **Never commit secrets** - Keep `local.settings.json` out of version control
2. **Use Azure Key Vault** - For production, store secrets in Azure Key Vault
3. **Rotate keys regularly** - Update API keys and tokens periodically
4. **Monitor function invocations** - Set up alerts for unusual activity
5. **Use managed identities** - Where possible, use Azure Managed Identities instead of API keys

---

## Support

For issues or questions:
- Check the Azure Functions documentation: https://learn.microsoft.com/en-us/azure/azure-functions/
- Review Retell AI webhook documentation
- Contact your system administrator

---

**Last Updated:** 2025-10-08

