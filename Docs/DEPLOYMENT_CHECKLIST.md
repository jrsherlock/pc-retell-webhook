# Deployment Checklist - Retell AI Webhook Processor

Use this checklist to ensure a smooth deployment to Azure.

## Pre-Deployment

### 1. Code Preparation
- [ ] All code changes committed to version control
- [ ] Code reviewed and approved
- [ ] No sensitive data in source code
- [ ] TypeScript compiles without errors (`npm run build`)
- [ ] All dependencies installed (`npm install`)
- [ ] Package.json versions are production-ready

### 2. Environment Configuration
- [ ] `local.settings.json` configured for local testing
- [ ] All required environment variables documented
- [ ] Secrets obtained from service providers:
  - [ ] SendGrid API key
  - [ ] Twilio Account SID and Auth Token
  - [ ] Teams Webhook URL
- [ ] Email addresses verified in SendGrid
- [ ] Twilio phone number purchased and configured
- [ ] Teams webhook created and tested

### 3. Local Testing
- [ ] Function runs locally without errors
- [ ] Test payload successfully processed
- [ ] Email notification received
- [ ] Teams notification received
- [ ] SMS notification received
- [ ] Error handling tested
- [ ] Logs reviewed for warnings

### 4. Azure Prerequisites
- [ ] Azure subscription active
- [ ] Azure CLI installed and configured
- [ ] Logged in to Azure (`az login`)
- [ ] Appropriate permissions to create resources
- [ ] Resource naming convention decided
- [ ] Azure region selected (e.g., eastus, westus2)

---

## Deployment Steps

### 5. Create Azure Resources

#### Resource Group
```bash
az group create \
  --name ProCircularIR-RG \
  --location eastus
```
- [ ] Resource group created successfully
- [ ] Resource group name documented

#### Storage Account
```bash
az storage account create \
  --name procircularirstorage \
  --resource-group ProCircularIR-RG \
  --location eastus \
  --sku Standard_LRS
```
- [ ] Storage account created
- [ ] Storage account name is globally unique
- [ ] Storage account name documented

#### Function App
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
- [ ] Function app created successfully
- [ ] Function app name is globally unique
- [ ] Function app URL documented
- [ ] Runtime version confirmed (Node 18)

### 6. Configure Application Settings

```bash
az functionapp config appsettings set \
  --name procircular-ir-webhook \
  --resource-group ProCircularIR-RG \
  --settings \
    "SENDGRID_API_KEY=<your-key>" \
    "SENDGRID_FROM_EMAIL=noreply@procircular.com" \
    "IRT_EMAIL_ADDRESS=IRT@procircular.com" \
    "TEAMS_WEBHOOK_URL=<your-webhook-url>" \
    "TWILIO_ACCOUNT_SID=<your-sid>" \
    "TWILIO_AUTH_TOKEN=<your-token>" \
    "TWILIO_FROM_NUMBER=+1234567890" \
    "ONCALL_PHONE_NUMBER=+1234567890"
```

- [ ] All environment variables set
- [ ] No typos in variable names
- [ ] Values verified (no placeholder text)
- [ ] Sensitive values not logged or exposed

### 7. Deploy Function Code

```bash
func azure functionapp publish procircular-ir-webhook
```

- [ ] Deployment completed successfully
- [ ] No build errors during deployment
- [ ] Function endpoint URL displayed
- [ ] Deployment output saved

### 8. Retrieve Function Key

```bash
az functionapp keys list \
  --name procircular-ir-webhook \
  --resource-group ProCircularIR-RG
```

Or get the specific function URL:
```bash
az functionapp function show \
  --name procircular-ir-webhook \
  --resource-group ProCircularIR-RG \
  --function-name RetellWebhookProcessor
```

- [ ] Function key retrieved
- [ ] Function key stored securely (password manager)
- [ ] Complete webhook URL documented
- [ ] URL format verified: `https://<app-name>.azurewebsites.net/api/RetellWebhookProcessor?code=<function-key>`

---

## Post-Deployment Testing

### 9. Verify Deployment

#### Test the deployed function:
```bash
curl -X POST "https://procircular-ir-webhook.azurewebsites.net/api/RetellWebhookProcessor?code=<YOUR_KEY>" \
  -H "Content-Type: application/json" \
  -d @test-payload.json
```

- [ ] Function responds with HTTP 200
- [ ] Response body contains `"success": true`
- [ ] Email notification received
- [ ] Teams notification received
- [ ] SMS notification received

#### Monitor logs:
```bash
func azure functionapp logstream procircular-ir-webhook
```

- [ ] Logs streaming successfully
- [ ] No errors in logs
- [ ] All three notifications logged as sent
- [ ] Execution time acceptable (< 10 seconds)

### 10. Azure Portal Verification

Navigate to Azure Portal → Function App → procircular-ir-webhook

- [ ] Function app is running
- [ ] Application settings visible (values hidden)
- [ ] Function listed under "Functions"
- [ ] Monitor tab shows successful invocations
- [ ] No errors in Application Insights (if enabled)

---

## Integration with Retell AI

### 11. Configure Retell AI Webhook

1. Log in to Retell AI dashboard
2. Navigate to your agent configuration
3. Find webhook settings
4. Enter the Azure Function URL with function key

- [ ] Webhook URL configured in Retell AI
- [ ] URL includes function key parameter
- [ ] Webhook URL tested with Retell AI test feature
- [ ] Webhook configuration saved

### 12. End-to-End Test

Make a test call through Retell AI:

- [ ] Test call completed successfully
- [ ] Call analyzed by Retell AI
- [ ] Webhook triggered automatically
- [ ] Email received with correct data
- [ ] Teams card posted with correct data
- [ ] SMS received with correct data
- [ ] All data matches the call analysis

---

## Security and Compliance

### 13. Security Review

- [ ] Function uses function-level authorization
- [ ] Function key is not exposed publicly
- [ ] All API keys stored in App Settings (not code)
- [ ] HTTPS enforced for all communications
- [ ] No sensitive data logged
- [ ] Access restricted to authorized personnel

### 14. Backup and Documentation

- [ ] Function key backed up securely
- [ ] All environment variables documented
- [ ] Deployment steps documented
- [ ] Architecture diagram created (if needed)
- [ ] Runbook created for operations team
- [ ] Contact information for service providers documented

---

## Monitoring and Alerts

### 15. Set Up Monitoring

#### Application Insights (Optional but Recommended)
```bash
az monitor app-insights component create \
  --app procircular-ir-insights \
  --location eastus \
  --resource-group ProCircularIR-RG
```

- [ ] Application Insights created
- [ ] Connected to Function App
- [ ] Custom metrics configured
- [ ] Dashboards created

#### Azure Monitor Alerts
- [ ] Alert for function failures
- [ ] Alert for high latency (> 30 seconds)
- [ ] Alert for missing invocations (if expected regularly)
- [ ] Alert recipients configured
- [ ] Test alerts sent and verified

### 16. Health Checks

Set up regular health monitoring:

- [ ] Weekly test webhook call scheduled
- [ ] SendGrid delivery monitoring enabled
- [ ] Twilio message status monitoring enabled
- [ ] Teams webhook health check scheduled
- [ ] Automated health check script created (optional)

---

## Rollback Plan

### 17. Prepare Rollback Procedure

In case of issues:

- [ ] Previous deployment slot available (if using slots)
- [ ] Previous version tagged in version control
- [ ] Rollback procedure documented
- [ ] Rollback tested in non-production environment
- [ ] Team trained on rollback procedure

Quick rollback command:
```bash
# Redeploy previous version
git checkout <previous-version-tag>
npm install
npm run build
func azure functionapp publish procircular-ir-webhook
```

---

## Go-Live

### 18. Final Checks

- [ ] All checklist items completed
- [ ] Stakeholders notified of deployment
- [ ] Operations team briefed
- [ ] On-call schedule updated
- [ ] Documentation shared with team
- [ ] Support contacts available

### 19. Go-Live Approval

- [ ] Technical lead approval
- [ ] Security review passed
- [ ] Compliance requirements met
- [ ] Business stakeholder approval
- [ ] Go-live date/time confirmed

### 20. Post-Go-Live Monitoring

First 24 hours:
- [ ] Monitor logs continuously
- [ ] Verify first real webhook call
- [ ] Check notification delivery rates
- [ ] Review any errors or warnings
- [ ] Confirm performance metrics acceptable

First week:
- [ ] Daily log review
- [ ] Weekly metrics report
- [ ] User feedback collected
- [ ] Any issues documented and resolved

---

## Maintenance

### 21. Ongoing Maintenance Tasks

Monthly:
- [ ] Review and rotate API keys
- [ ] Check for Azure Functions runtime updates
- [ ] Review and optimize costs
- [ ] Update dependencies (`npm update`)
- [ ] Review logs for patterns or issues

Quarterly:
- [ ] Security audit
- [ ] Performance review
- [ ] Disaster recovery test
- [ ] Documentation update
- [ ] Team training refresh

---

## Sign-Off

### Deployment Completed By:
- **Name:** ___________________________
- **Date:** ___________________________
- **Signature:** ___________________________

### Verified By:
- **Name:** ___________________________
- **Date:** ___________________________
- **Signature:** ___________________________

---

## Notes and Issues

Document any issues encountered during deployment:

```
Issue 1:
Description:
Resolution:
Date:

Issue 2:
Description:
Resolution:
Date:
```

---

## Useful Commands Reference

```bash
# View logs
func azure functionapp logstream procircular-ir-webhook

# Restart function app
az functionapp restart --name procircular-ir-webhook --resource-group ProCircularIR-RG

# View app settings
az functionapp config appsettings list --name procircular-ir-webhook --resource-group ProCircularIR-RG

# Update a single setting
az functionapp config appsettings set --name procircular-ir-webhook --resource-group ProCircularIR-RG --settings "KEY=VALUE"

# Delete function app (if needed)
az functionapp delete --name procircular-ir-webhook --resource-group ProCircularIR-RG

# Delete resource group (if needed)
az group delete --name ProCircularIR-RG
```

---

**Last Updated:** 2025-10-08

