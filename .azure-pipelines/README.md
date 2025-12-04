# Azure DevOps Pipelines

This directory contains CI/CD pipeline configurations for the ProCircular IR Relay Function App.

## Pipeline Files

- **`ci-pipeline.yml`** - Continuous Integration pipeline
  - Builds and tests code
  - Runs security scans
  - Validates code quality
  - Validates RetellAI agent configurations

- **`cd-pipeline.yml`** - Continuous Deployment pipeline
  - Deploys to Development, Staging, and Production
  - Updates Function App settings from variable groups
  - Retrieves secrets from Azure Key Vault

- **`templates/deploy-function-app.yml`** - Reusable deployment template
  - Builds and archives Function App
  - Deploys to Azure
  - Updates app settings from variable groups and Key Vault
  - Restarts Function App

## Setup Guides

### For First-Time Setup

1. **[PIPELINE_SETUP_CHECKLIST.md](./PIPELINE_SETUP_CHECKLIST.md)** - Step-by-step checklist to set up pipelines
2. **[VARIABLE_GROUPS_SETUP.md](./VARIABLE_GROUPS_SETUP.md)** - Detailed guide on configuring variable groups and Key Vault

### For Team Members

- **Updating Configuration:** See [VARIABLE_GROUPS_SETUP.md](./VARIABLE_GROUPS_SETUP.md#how-team-members-can-update-configuration)
- **Variable Reference:** See [VARIABLE_GROUPS_SETUP.md](./VARIABLE_GROUPS_SETUP.md#variable-reference)

## Quick Start

### Setting Up Pipelines

1. Follow the [PIPELINE_SETUP_CHECKLIST.md](./PIPELINE_SETUP_CHECKLIST.md)
2. Create variable groups in Azure DevOps
3. Add secrets to Azure Key Vault
4. Link variable groups to pipelines
5. Create pipelines from YAML files

### Updating Email Recipients

1. Go to **Pipelines** → **Library**
2. Select variable group (e.g., `pc-ir-relay-prod-vars`)
3. Edit `IRT_EMAIL_ADDRESS` or `NON_IR_EMAIL_RECIPIENT`
4. Save - next deployment will use new values

### Updating JIRA Configuration

1. Go to **Pipelines** → **Library**
2. Select variable group
3. Edit `JIRA_PROJECT_KEY` or `JIRA_USER_EMAIL`
4. For API token: Update `JIRA-API-TOKEN` in Azure Key Vault
5. Save - next deployment will use new values

## Variable Groups

The pipeline uses these variable groups:

- **`pc-ir-relay-common-vars`** - Shared variables (Node version, build config)
- **`pc-ir-relay-dev-vars`** - Development environment variables
- **`pc-ir-relay-stg-vars`** - Staging environment variables
- **`pc-ir-relay-prod-vars`** - Production environment variables

## Azure Key Vault

Secrets are stored in Azure Key Vault: `pc-ir-relay-kv`

**Secret Names (use hyphens):**
- `RETELL-API-KEY`
- `SENDGRID-API-KEY`
- `JIRA-API-TOKEN`
- `TWILIO-ACCOUNT-SID`
- `TWILIO-AUTH-TOKEN`
- `AZURE-COMMUNICATION-CONNECTION-STRING`

## Pipeline Triggers

### CI Pipeline
- Triggers on: Commits to `main` or `develop` branches
- Triggers on: Pull requests to `main` or `develop`
- Excludes: Documentation changes (`*.md`, `docs/**`)

### CD Pipeline
- **Development:** Triggers on commits to `develop` branch
- **Staging:** Triggers on commits to `main` branch
- **Production:** Triggers on commits to `main` branch (with approvals if configured)

## Environments

- **Development** - `pc-retell-webhook-dev`
- **Staging** - `pc-retell-webhook-stg`
- **Production** - `pc-retell-webhook`

## Service Connection

- **Name:** `Azure-ProCircular-Subscription`
- **Type:** Azure Resource Manager
- **Scope:** Subscription level

## Troubleshooting

See [VARIABLE_GROUPS_SETUP.md](./VARIABLE_GROUPS_SETUP.md#troubleshooting) for common issues and solutions.

## Additional Resources

- [Azure DevOps Pipelines Documentation](https://docs.microsoft.com/en-us/azure/devops/pipelines/)
- [Variable Groups Documentation](https://docs.microsoft.com/en-us/azure/devops/pipelines/library/variable-groups)
- [Azure Key Vault Integration](https://docs.microsoft.com/en-us/azure/devops/pipelines/release/azure-key-vault)

