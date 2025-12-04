# Fix: Service Connection Missing

## Error
```
The pipeline is not valid. Job DeployFunctionAppDev: Step input azureSubscription 
references service connection Azure-ProCircular-Subscription which could not be found.
```

## Quick Fix (5 minutes)

### Step 1: Go to Service Connections
1. Open: https://dev.azure.com/procircular/dco/_settings/adminservices
2. Click **+ New service connection**

### Step 2: Create Azure Resource Manager Connection
1. Select **Azure Resource Manager**
2. Click **Next**

### Step 3: Choose Authentication Method
1. Select **Workload Identity federation (automatic)** (Recommended - no secrets to manage)
   - OR select **Service principal (automatic)** if Workload Identity is not available
2. Click **Next**

### Step 4: Configure Connection
Fill in the details:

- **Subscription:** `procircular-dev-subscription`
- **Subscription ID:** `daac0a78-7f06-423c-96a0-14dec5e1ffcd`
- **Resource group:** `pcretellwebhook` (optional - leave empty for subscription-level access)
- **Service connection name:** `Azure-ProCircular-Subscription` ⚠️ **Must match exactly**
- **Description:** (optional) "Azure subscription for ProCircular IR Relay deployments"

### Step 5: Save
1. Click **Save**
2. If prompted, authorize the service connection for all pipelines

## Verify It Works

1. Go to: https://dev.azure.com/procircular/dco/_build?definitionId=80
2. Click **Run pipeline**
3. The pipeline should now validate successfully

## Alternative: Use Existing Service Connection

If you already have a service connection for this subscription:

1. Go to: https://dev.azure.com/procircular/dco/_settings/adminservices
2. Find your existing Azure service connection
3. Note the exact name
4. Update `.azure-pipelines/cd-pipeline.yml`:
   - Change `azureSubscription: 'Azure-ProCircular-Subscription'` to match your existing connection name

## Troubleshooting

### "Authorization required"
- After creating the service connection, you may need to authorize it for use in pipelines
- Go to the service connection → **Security** → **Grant access permission to all pipelines**

### "Subscription not found"
- Verify you're logged into the correct Azure account
- Check the subscription ID matches: `daac0a78-7f06-423c-96a0-14dec5e1ffcd`

### "Insufficient permissions"
- The service principal needs Contributor role on the subscription or resource group
- Go to Azure Portal → Subscriptions → Access control (IAM)
- Verify Azure DevOps service principal has Contributor role

---

**Quick Link:** https://dev.azure.com/procircular/dco/_settings/adminservices

