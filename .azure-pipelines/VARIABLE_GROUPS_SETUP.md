# Azure DevOps Variable Groups Setup Guide

This guide will help you set up and configure variable groups in Azure DevOps so team members can easily configure email recipients, JIRA tokens, and other settings without changing code.

## Overview

The pipeline uses **Variable Groups** to manage configuration for different environments:
- `pc-ir-relay-common-vars` - Shared variables across all environments
- `pc-ir-relay-dev-vars` - Development environment variables
- `pc-ir-relay-stg-vars` - Staging environment variables  
- `pc-ir-relay-prod-vars` - Production environment variables

**Secrets** (API keys, tokens) are stored in **Azure Key Vault** (`pc-ir-relay-kv`) and referenced by the pipeline.

## Step 1: Create Variable Groups in Azure DevOps

### Navigate to Variable Groups

1. Go to your Azure DevOps project: `https://dev.azure.com/procircular/dco`
2. Click **Pipelines** → **Library** (in the left sidebar)
3. Click **+ Variable group** to create a new variable group

### Create Common Variables Group

**Name:** `pc-ir-relay-common-vars`

**Variables to add:**
```
NODE_VERSION = 20.x
BUILD_CONFIGURATION = Release
```

**Permissions:**
- Allow access to all pipelines
- Grant "User/Group" permissions to team members who need to edit

### Create Environment-Specific Variable Groups

For each environment (DEV, STG, PROD), create a variable group:

#### Development: `pc-ir-relay-dev-vars`

```
# Feature Flags
ENABLE_EMAIL_NOTIFICATIONS = true
ENABLE_JIRA_NOTIFICATIONS = true
ENABLE_TEAMS_NOTIFICATIONS = false
ENABLE_SMS_NOTIFICATIONS = false

# Email Configuration
EMAIL_PROVIDER = sendgrid
IRT_EMAIL_ADDRESS = jsherlock@procircular.com
NON_IR_EMAIL_RECIPIENT = jsherlock@procircular.com
SENDGRID_FROM_EMAIL = jsherlock@procircular.com
EMAIL_FROM_NAME_IR = ProCircular IR Alert
EMAIL_FROM_NAME_NON_IR = ProCircular General Inquiry

# JIRA Configuration
JIRA_API_URL = https://procircular.atlassian.net
JIRA_PROJECT_KEY = IRTDEV
JIRA_USER_EMAIL = jsherlock@procircular.com
JIRA_FAILURE_NOTIFICATION_RECIPIENTS = jsherlock@procircular.com

# Optional: Teams
TEAMS_WEBHOOK_URL = (leave empty if not using)

# Optional: SMS
TWILIO_FROM_NUMBER = (leave empty if not using)
ONCALL_PHONE_NUMBER = (leave empty if not using)
```

#### Staging: `pc-ir-relay-stg-vars`

```
# Feature Flags
ENABLE_EMAIL_NOTIFICATIONS = true
ENABLE_JIRA_NOTIFICATIONS = true
ENABLE_TEAMS_NOTIFICATIONS = false
ENABLE_SMS_NOTIFICATIONS = false

# Email Configuration
EMAIL_PROVIDER = sendgrid
IRT_EMAIL_ADDRESS = IRT@procircular.com
NON_IR_EMAIL_RECIPIENT = jsherlock@procircular.com
SENDGRID_FROM_EMAIL = DONOTREPLY@procircular.com
EMAIL_FROM_NAME_IR = ProCircular IR Alert
EMAIL_FROM_NAME_NON_IR = ProCircular General Inquiry

# JIRA Configuration
JIRA_API_URL = https://procircular.atlassian.net
JIRA_PROJECT_KEY = IRTSTG
JIRA_USER_EMAIL = jsherlock@procircular.com
JIRA_FAILURE_NOTIFICATION_RECIPIENTS = jsherlock@procircular.com
```

#### Production: `pc-ir-relay-prod-vars`

```
# Feature Flags
ENABLE_EMAIL_NOTIFICATIONS = true
ENABLE_JIRA_NOTIFICATIONS = true
ENABLE_TEAMS_NOTIFICATIONS = false
ENABLE_SMS_NOTIFICATIONS = false

# Email Configuration
EMAIL_PROVIDER = sendgrid
IRT_EMAIL_ADDRESS = IRT@procircular.com
NON_IR_EMAIL_RECIPIENT = jsherlock@procircular.com
SENDGRID_FROM_EMAIL = DONOTREPLY@procircular.com
EMAIL_FROM_NAME_IR = ProCircular IR Alert
EMAIL_FROM_NAME_NON_IR = ProCircular General Inquiry

# JIRA Configuration
JIRA_API_URL = https://procircular.atlassian.net
JIRA_PROJECT_KEY = IRT
JIRA_USER_EMAIL = jsherlock@procircular.com
JIRA_FAILURE_NOTIFICATION_RECIPIENTS = jsherlock@procircular.com
```

## Step 2: Set Up Azure Key Vault for Secrets

### Create Key Vault

1. Go to Azure Portal → **Key Vaults**
2. Create new Key Vault: `pc-ir-relay-kv`
3. Note the **Resource Group** and **Location**

### Add Secrets to Key Vault

Add these secrets to your Key Vault:

```
RETELL-API-KEY = (your RetellAI API key)
SENDGRID-API-KEY = (your SendGrid API key)
JIRA-API-TOKEN = (your JIRA API token)
JIRA-USER-EMAIL = (JIRA user email - if different from variable group)
TWILIO-ACCOUNT-SID = (if using SMS)
TWILIO-AUTH-TOKEN = (if using SMS)
AZURE-COMMUNICATION-CONNECTION-STRING = (if using Azure Email)
```

**Important:** Secret names in Key Vault use **hyphens** (e.g., `RETELL-API-KEY`), not underscores.

### Grant Pipeline Access to Key Vault

1. In Azure Portal, go to your Key Vault → **Access policies**
2. Click **+ Add Access Policy**
3. Select the **Service Principal** used by your Azure DevOps service connection
4. Grant **Get** and **List** permissions for secrets
5. Click **Add** then **Save**

## Step 3: Link Variable Groups to Pipelines

### Link to CI Pipeline

1. Go to **Pipelines** → **Pipelines** → Select your CI pipeline
2. Click **Edit** → **Variables** (top right)
3. Click **Variable groups** → **Link variable group**
4. Select `pc-ir-relay-common-vars`
5. Click **OK**

### Link to CD Pipeline

1. Go to **Pipelines** → **Pipelines** → Select your CD pipeline
2. Click **Edit** → **Variables** (top right)
3. Link all variable groups:
   - `pc-ir-relay-common-vars`
   - `pc-ir-relay-dev-vars`
   - `pc-ir-relay-stg-vars`
   - `pc-ir-relay-prod-vars`

## Step 4: Configure Service Connection

### Create Azure Service Connection

1. Go to **Project Settings** → **Service connections**
2. Click **+ New service connection** → **Azure Resource Manager**
3. Select **Service principal (automatic)**
4. **Scope level:** Subscription
5. **Subscription:** Select your Azure subscription
6. **Resource group:** Leave empty (or select specific RG)
7. **Service connection name:** `Azure-ProCircular-Subscription`
8. Click **Save**

## Step 5: Create Pipeline Environments

### Create Environments

1. Go to **Pipelines** → **Environments**
2. Click **+ Create environment**
3. Create these environments:
   - **Development** (for DEV deployments)
   - **Staging** (for STG deployments)
   - **Production** (for PROD deployments)

### Add Approvers (Optional)

For Production environment:
1. Click **Production** environment
2. Click **Approvals and checks**
3. Click **+** → **Approvals**
4. Add approvers who must approve production deployments

## How Team Members Can Update Configuration

### Updating Email Recipients

1. Go to **Pipelines** → **Library**
2. Click on the variable group (e.g., `pc-ir-relay-prod-vars`)
3. Click **Edit**
4. Update the variable value:
   - `IRT_EMAIL_ADDRESS` - For IR incident emails
   - `NON_IR_EMAIL_RECIPIENT` - For general inquiry emails
   - `JIRA_FAILURE_NOTIFICATION_RECIPIENTS` - For JIRA failure notifications
5. Click **Save**

### Updating JIRA Configuration

1. Go to **Pipelines** → **Library**
2. Click on the variable group
3. Click **Edit**
4. Update:
   - `JIRA_PROJECT_KEY` - Change project (e.g., IRT, IRTDEV, IRTSTG)
   - `JIRA_USER_EMAIL` - Change JIRA user
5. For `JIRA_API_TOKEN` (secret):
   - Go to Azure Portal → Key Vault → `pc-ir-relay-kv`
   - Update the `JIRA-API-TOKEN` secret
6. Click **Save**

### Updating API Keys (Secrets)

**Never store secrets in variable groups!** Always use Azure Key Vault:

1. Go to Azure Portal → **Key Vaults** → `pc-ir-relay-kv`
2. Click **Secrets** → Select the secret to update
3. Click **New version**
4. Enter the new secret value
5. Click **Create**

The next pipeline run will automatically use the new secret.

## Variable Reference

### Feature Flags

| Variable | Description | Values |
|----------|-------------|--------|
| `ENABLE_EMAIL_NOTIFICATIONS` | Enable email notifications | `true` / `false` |
| `ENABLE_JIRA_NOTIFICATIONS` | Enable JIRA ticket creation | `true` / `false` |
| `ENABLE_TEAMS_NOTIFICATIONS` | Enable Teams notifications | `true` / `false` |
| `ENABLE_SMS_NOTIFICATIONS` | Enable SMS notifications | `true` / `false` |

### Email Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `EMAIL_PROVIDER` | Email provider to use | `sendgrid` / `azure` |
| `IRT_EMAIL_ADDRESS` | IR incident email recipient | `IRT@procircular.com` |
| `NON_IR_EMAIL_RECIPIENT` | General inquiry email recipient | `jsherlock@procircular.com` |
| `SENDGRID_FROM_EMAIL` | SendGrid sender email | `DONOTREPLY@procircular.com` |
| `EMAIL_FROM_NAME_IR` | Display name for IR emails | `ProCircular IR Alert` |
| `EMAIL_FROM_NAME_NON_IR` | Display name for non-IR emails | `ProCircular General Inquiry` |

### JIRA Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `JIRA_API_URL` | JIRA instance URL | `https://procircular.atlassian.net` |
| `JIRA_PROJECT_KEY` | JIRA project key | `IRT`, `IRTDEV`, `IRTSTG` |
| `JIRA_USER_EMAIL` | JIRA user email | `jsherlock@procircular.com` |
| `JIRA_FAILURE_NOTIFICATION_RECIPIENTS` | Email for JIRA failure alerts | `jsherlock@procircular.com` |

### Secrets (Key Vault)

| Secret Name | Description | Where to Get |
|-------------|-------------|--------------|
| `RETELL-API-KEY` | RetellAI API key | RetellAI Dashboard → Settings → API Keys |
| `SENDGRID-API-KEY` | SendGrid API key | SendGrid Dashboard → Settings → API Keys |
| `JIRA-API-TOKEN` | JIRA API token | JIRA → Account Settings → Security → API Tokens |
| `TWILIO-ACCOUNT-SID` | Twilio Account SID | Twilio Console |
| `TWILIO-AUTH-TOKEN` | Twilio Auth Token | Twilio Console |
| `AZURE-COMMUNICATION-CONNECTION-STRING` | Azure Email connection string | Azure Portal → Communication Services |

## Troubleshooting

### Pipeline Can't Access Variable Group

**Error:** `Variable group 'pc-ir-relay-prod-vars' could not be found`

**Solution:**
1. Verify variable group name matches exactly
2. Check pipeline has permission to access the variable group
3. In variable group settings, ensure "Allow access to all pipelines" is enabled

### Pipeline Can't Access Key Vault

**Error:** `Access denied to Key Vault`

**Solution:**
1. Verify service connection has access to Key Vault
2. Check Key Vault access policies include the service principal
3. Verify secret names use hyphens (e.g., `RETELL-API-KEY` not `RETELL_API_KEY`)

### Variables Not Updating in Function App

**Solution:**
1. Check variable group is linked to the pipeline
2. Verify variable names match exactly (case-sensitive)
3. Check the deploy template includes the variable in app settings
4. Restart the Function App after deployment

## Best Practices

1. **Never commit secrets** - Always use Key Vault for sensitive values
2. **Use separate variable groups** - One per environment for isolation
3. **Document changes** - Add comments in variable groups when updating
4. **Test in DEV first** - Update DEV variables before PROD
5. **Use descriptive names** - Make variable purposes clear
6. **Review before PROD** - Have approvals for production variable changes

## Quick Reference: Common Updates

### Change IR Email Recipient
```
Variable Group: pc-ir-relay-prod-vars
Variable: IRT_EMAIL_ADDRESS
New Value: new-email@procircular.com
```

### Change JIRA Project
```
Variable Group: pc-ir-relay-prod-vars
Variable: JIRA_PROJECT_KEY
New Value: IRT (or IRTDEV, IRTSTG)
```

### Update JIRA API Token
```
Azure Portal → Key Vault → pc-ir-relay-kv
Secret: JIRA-API-TOKEN
Action: Create new version
```

### Enable Teams Notifications
```
Variable Group: pc-ir-relay-prod-vars
Variable: ENABLE_TEAMS_NOTIFICATIONS
New Value: true
Also add: TEAMS_WEBHOOK_URL (in variable group or Key Vault)
```

---

**Need Help?** Contact your DevOps administrator or refer to the [Azure DevOps Variable Groups Documentation](https://docs.microsoft.com/en-us/azure/devops/pipelines/library/variable-groups).

