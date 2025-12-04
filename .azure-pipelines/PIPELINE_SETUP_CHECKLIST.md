# Azure DevOps Pipeline Setup Checklist

Use this checklist to set up your CI/CD pipeline for the ProCircular IR Relay Function App.

## Prerequisites

- [ ] Azure DevOps project created: `https://dev.azure.com/procircular/dco`
- [ ] Azure subscription with Function App resources
- [ ] Azure Key Vault created: `pc-ir-relay-kv`
- [ ] Access to RetellAI, SendGrid, JIRA accounts for API keys/tokens

## Step 1: Create Variable Groups (15 minutes)

- [ ] Create `pc-ir-relay-common-vars` variable group
  - [ ] Add `NODE_VERSION = 20.x`
  - [ ] Add `BUILD_CONFIGURATION = Release`
  - [ ] Enable "Allow access to all pipelines"

- [ ] Create `pc-ir-relay-dev-vars` variable group
  - [ ] Add all DEV environment variables (see VARIABLE_GROUPS_SETUP.md)
  - [ ] Enable "Allow access to all pipelines"

- [ ] Create `pc-ir-relay-stg-vars` variable group
  - [ ] Add all STG environment variables
  - [ ] Enable "Allow access to all pipelines"

- [ ] Create `pc-ir-relay-prod-vars` variable group
  - [ ] Add all PROD environment variables
  - [ ] Enable "Allow access to all pipelines"

## Step 2: Set Up Azure Key Vault (10 minutes)

- [ ] Create Key Vault: `pc-ir-relay-kv` (if not exists)
- [ ] Add secrets to Key Vault:
  - [ ] `RETELL-API-KEY`
  - [ ] `SENDGRID-API-KEY`
  - [ ] `JIRA-API-TOKEN`
  - [ ] `TWILIO-ACCOUNT-SID` (if using SMS)
  - [ ] `TWILIO-AUTH-TOKEN` (if using SMS)
  - [ ] `AZURE-COMMUNICATION-CONNECTION-STRING` (if using Azure Email)

- [ ] Grant Key Vault access to Azure DevOps service principal:
  - [ ] Go to Key Vault → Access policies
  - [ ] Add access policy for service principal
  - [ ] Grant "Get" and "List" permissions for secrets

## Step 3: Create Service Connection (5 minutes)

- [ ] Go to Project Settings → Service connections
- [ ] Create new Azure Resource Manager connection
- [ ] Name: `Azure-ProCircular-Subscription`
- [ ] Select subscription and resource group
- [ ] Save connection

## Step 4: Create Pipeline Environments (5 minutes)

- [ ] Go to Pipelines → Environments
- [ ] Create "Development" environment
- [ ] Create "Staging" environment
- [ ] Create "Production" environment
  - [ ] (Optional) Add approval gates for production

## Step 5: Link Pipelines to Variable Groups (5 minutes)

- [ ] CI Pipeline:
  - [ ] Edit pipeline → Variables
  - [ ] Link `pc-ir-relay-common-vars`

- [ ] CD Pipeline:
  - [ ] Edit pipeline → Variables
  - [ ] Link all variable groups:
    - [ ] `pc-ir-relay-common-vars`
    - [ ] `pc-ir-relay-dev-vars`
    - [ ] `pc-ir-relay-stg-vars`
    - [ ] `pc-ir-relay-prod-vars`

## Step 6: Create Pipelines in Azure DevOps (10 minutes)

### CI Pipeline

- [ ] Go to Pipelines → Pipelines → New pipeline
- [ ] Select "Azure Repos Git" → Your repository
- [ ] Choose "Existing Azure Pipelines YAML file"
- [ ] Path: `.azure-pipelines/ci-pipeline.yml`
- [ ] Save and run

### CD Pipeline

- [ ] Go to Pipelines → Pipelines → New pipeline
- [ ] Select "Azure Repos Git" → Your repository
- [ ] Choose "Existing Azure Pipelines YAML file"
- [ ] Path: `.azure-pipelines/cd-pipeline.yml`
- [ ] Save and run

## Step 7: Verify Pipeline Works (10 minutes)

- [ ] Trigger CI pipeline (push to main or create PR)
- [ ] Verify build succeeds
- [ ] Verify security scans run
- [ ] Verify code quality checks pass
- [ ] Verify RetellAI agent validation runs

- [ ] Trigger CD pipeline (push to main)
- [ ] Verify deployment to staging succeeds
- [ ] Verify Function App settings are updated
- [ ] Verify Function App restarts

## Step 8: Test Configuration Updates (10 minutes)

- [ ] Update a variable in `pc-ir-relay-dev-vars`:
  - [ ] Change `IRT_EMAIL_ADDRESS` to test email
  - [ ] Save variable group
- [ ] Trigger deployment
- [ ] Verify Function App settings updated
- [ ] Verify email goes to new address

## Common Issues & Solutions

### Issue: Pipeline can't find variable group
**Solution:** 
- Verify variable group name matches exactly
- Check "Allow access to all pipelines" is enabled
- Verify pipeline has permission to access variable group

### Issue: Key Vault access denied
**Solution:**
- Verify service connection has access to Key Vault
- Check Key Vault access policies include service principal
- Verify secret names use hyphens (e.g., `RETELL-API-KEY`)

### Issue: Variables not updating in Function App
**Solution:**
- Check variable group is linked to pipeline
- Verify variable names match exactly (case-sensitive)
- Check deploy template includes the variable
- Restart Function App after deployment

## Next Steps

Once setup is complete:

1. **Document your configuration** - Note which email addresses, JIRA projects, etc. are configured
2. **Train team members** - Show them how to update variable groups
3. **Set up monitoring** - Configure alerts for pipeline failures
4. **Review security** - Ensure only authorized users can modify production variables

## Quick Reference

- **Variable Groups:** Pipelines → Library
- **Key Vault:** Azure Portal → Key Vaults
- **Service Connections:** Project Settings → Service connections
- **Environments:** Pipelines → Environments
- **Pipeline Runs:** Pipelines → Pipelines → Select pipeline → Runs

---

**Estimated Total Time:** ~60 minutes

**Need Help?** See [VARIABLE_GROUPS_SETUP.md](./VARIABLE_GROUPS_SETUP.md) for detailed instructions.

