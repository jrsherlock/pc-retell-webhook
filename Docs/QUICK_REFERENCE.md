# Quick Reference - Retell AI Webhook Processor

## 🚀 Quick Start

### Local Development
```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start locally
npm start

# Test with sample payload
curl -X POST http://localhost:7071/api/RetellWebhookProcessor \
  -H "Content-Type: application/json" \
  -d @test-payload.json
```

---

## 📋 Required Environment Variables

```bash
SENDGRID_API_KEY=SG.your_key_here
SENDGRID_FROM_EMAIL=noreply@procircular.com
IRT_EMAIL_ADDRESS=IRT@procircular.com
TEAMS_WEBHOOK_URL=https://yourorg.webhook.office.com/webhookb2/xxxxx
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_FROM_NUMBER=+15551234567
ONCALL_PHONE_NUMBER=+15559876543
```

---

## 🔧 Common Commands

### Build & Run
```bash
npm run build          # Compile TypeScript
npm run watch          # Watch mode for development
npm run clean          # Remove dist folder
npm start              # Start function locally
```

### Azure Deployment
```bash
# Login to Azure
az login

# Deploy function
func azure functionapp publish procircular-ir-webhook

# View logs
func azure functionapp logstream procircular-ir-webhook

# Restart function app
az functionapp restart \
  --name procircular-ir-webhook \
  --resource-group ProCircularIR-RG
```

### Configuration
```bash
# List all app settings
az functionapp config appsettings list \
  --name procircular-ir-webhook \
  --resource-group ProCircularIR-RG

# Update a single setting
az functionapp config appsettings set \
  --name procircular-ir-webhook \
  --resource-group ProCircularIR-RG \
  --settings "KEY=VALUE"

# Get function keys
az functionapp keys list \
  --name procircular-ir-webhook \
  --resource-group ProCircularIR-RG
```

---

## 🧪 Testing

### Local Test
```bash
curl -X POST http://localhost:7071/api/RetellWebhookProcessor \
  -H "Content-Type: application/json" \
  -d @test-payload.json
```

### Production Test
```bash
curl -X POST "https://procircular-ir-webhook.azurewebsites.net/api/RetellWebhookProcessor?code=YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d @test-payload.json
```

### Expected Response
```json
{
  "success": true,
  "message": "Webhook processed successfully",
  "call_id": "584f904a8cda77eb733224"
}
```

---

## 📧 Notification Outputs

### Email (SendGrid)
- **To:** IRT@procircular.com
- **Subject:** New Cybersecurity Incident Reported: [Company]
- **Format:** HTML with full incident details

### Teams (Adaptive Card)
- **Format:** Rich card with structured data
- **Style:** Red attention header
- **Content:** Key facts and incident description

### SMS (Twilio)
- **To:** On-call phone number
- **Format:** Concise text alert
- **Content:** "New ProCircular IR Alert: Incident reported by [Name] from [Company]..."

---

## 🔍 Troubleshooting

### Check Logs
```bash
# Azure logs (real-time)
func azure functionapp logstream procircular-ir-webhook

# Or in Azure Portal
# Function App → Functions → RetellWebhookProcessor → Monitor
```

### Common Issues

| Issue | Quick Fix |
|-------|-----------|
| 500 error | Check environment variables are set |
| Email not sending | Verify SendGrid API key and sender email |
| Teams not posting | Verify webhook URL is active |
| SMS not sending | Check phone number format: +1234567890 |
| Build fails | Run `npm install` and `npm run build` |

### Verify Configuration
```bash
# Check if all env vars are set
az functionapp config appsettings list \
  --name procircular-ir-webhook \
  --resource-group ProCircularIR-RG \
  | grep -E "SENDGRID|TEAMS|TWILIO|IRT|ONCALL"
```

---

## 📁 Project Structure

```
pc-ir-relay/
├── src/
│   ├── functions/
│   │   └── RetellWebhookProcessor.ts    # Main webhook handler
│   └── index.ts                          # Azure Functions setup
├── dist/                                 # Compiled JavaScript (gitignored)
├── local.settings.json                   # Local config (gitignored)
├── local.settings.json.template          # Template for local config
├── test-payload.json                     # Sample test data
├── package.json                          # Dependencies
├── tsconfig.json                         # TypeScript config
├── README.md                             # Main documentation
├── SETUP_GUIDE.md                        # Detailed setup instructions
├── TESTING_GUIDE.md                      # Testing procedures
├── DEPLOYMENT_CHECKLIST.md               # Deployment steps
├── API_REFERENCE.md                      # API documentation
└── QUICK_REFERENCE.md                    # This file
```

---

## 🔐 Security Reminders

- ✅ Never commit `local.settings.json`
- ✅ Keep function keys secure
- ✅ Rotate API keys quarterly
- ✅ Use HTTPS for all external calls
- ✅ Monitor function invocations

---

## 📞 Service Dashboards

### SendGrid
- Dashboard: https://app.sendgrid.com
- Activity: Settings → Activity Feed
- API Keys: Settings → API Keys

### Twilio
- Console: https://console.twilio.com
- Messages: Monitor → Logs → Messaging
- Phone Numbers: Phone Numbers → Manage → Active Numbers

### Microsoft Teams
- Manage webhooks in Teams channel settings
- More options (•••) → Connectors → Incoming Webhook

### Azure Portal
- Function App: https://portal.azure.com
- Navigate to: Resource Groups → ProCircularIR-RG → procircular-ir-webhook

---

## 📊 Monitoring

### Key Metrics to Watch
- Invocation count (should match Retell AI calls)
- Success rate (should be > 99%)
- Average execution time (should be < 10 seconds)
- Error rate (should be near 0%)

### Set Up Alerts
```bash
# Example: Alert on function failures
az monitor metrics alert create \
  --name "IR-Webhook-Failures" \
  --resource-group ProCircularIR-RG \
  --scopes /subscriptions/.../procircular-ir-webhook \
  --condition "count failedRequests > 5" \
  --description "Alert when webhook has more than 5 failures"
```

---

## 🆘 Emergency Contacts

### Service Support
- **SendGrid Support:** https://support.sendgrid.com
- **Twilio Support:** https://support.twilio.com
- **Azure Support:** https://portal.azure.com → Help + support

### Internal Contacts
- **Technical Lead:** [Name/Email]
- **On-Call Engineer:** [Phone/Email]
- **System Administrator:** [Name/Email]

---

## 📚 Documentation Links

- [README.md](./README.md) - Project overview
- [SETUP_GUIDE.md](./SETUP_GUIDE.md) - Complete setup instructions
- [TESTING_GUIDE.md](./TESTING_GUIDE.md) - Testing procedures
- [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) - Deployment steps
- [API_REFERENCE.md](./API_REFERENCE.md) - API documentation

### External Documentation
- [Azure Functions Docs](https://learn.microsoft.com/en-us/azure/azure-functions/)
- [Retell AI Docs](https://docs.retellai.com/)
- [SendGrid API Docs](https://docs.sendgrid.com/)
- [Twilio API Docs](https://www.twilio.com/docs/)
- [Teams Adaptive Cards](https://adaptivecards.io/)

---

## 🔄 Regular Maintenance

### Weekly
- [ ] Review function logs for errors
- [ ] Verify test webhook still works

### Monthly
- [ ] Check for npm package updates
- [ ] Review and optimize costs
- [ ] Verify all notifications still working

### Quarterly
- [ ] Rotate API keys
- [ ] Security audit
- [ ] Update documentation
- [ ] Team training refresh

---

## 💡 Tips & Best Practices

1. **Always test locally first** before deploying to Azure
2. **Use the template** `local.settings.json.template` for new setups
3. **Monitor logs** during first few production calls
4. **Keep documentation updated** when making changes
5. **Use version control** for all code changes
6. **Test each service independently** when troubleshooting
7. **Set up alerts** for critical failures
8. **Document any issues** and their resolutions

---

## 🎯 Success Criteria

A successful deployment should:
- ✅ Respond to webhooks within 5 seconds
- ✅ Send all three notifications successfully
- ✅ Have no errors in logs
- ✅ Match data from Retell AI payload
- ✅ Be monitored and alerting properly

---

**Last Updated:** 2025-10-08
**Version:** 1.0.0

