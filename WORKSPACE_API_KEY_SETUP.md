# RetellAI Workspace and API Key Setup

## Issue: Wrong Workspace

If you're getting 404 errors when trying to access agents, your API key might be for a different workspace.

**Your Workspace ID:** `org_LejRX5QqWX2Ws5hf`

## Solution: Get the Correct API Key

### Step 1: Log into RetellAI Dashboard

1. Go to [RetellAI Dashboard](https://dashboard.retellai.com/)
2. Make sure you're in the correct workspace (`org_LejRX5QqWX2Ws5hf`)

### Step 2: Get Your API Key

1. Navigate to **Settings** → **API Keys**
2. Find or create an API key for your workspace
3. Copy the API key

### Step 3: Update local.settings.json

Update the `RETELL_API_KEY` in your `local.settings.json`:

```json
{
  "Values": {
    "RETELL_API_KEY": "your-workspace-api-key-here"
  }
}
```

### Step 4: Verify It Works

```bash
# List agents in your workspace
npm run retell:list-agents

# Fetch your agent
npm run retell:fetch-agent -- --agent-id agent_d1811032b0e5282793a991fe6b --output retell-agents/agents/production.json
```

## Verify Workspace

To verify you're using the correct workspace:

1. Check the workspace ID in RetellAI dashboard (should be `org_LejRX5QqWX2Ws5hf`)
2. Ensure your API key was created in that workspace
3. API keys are workspace-specific - they only work for agents in that workspace

## Current API Key Location

Your current API key is stored in:
- `local.settings.json` → `Values.RETELL_API_KEY`

The scripts will automatically use this API key if the environment variable isn't set.

## Environment Variable (Alternative)

You can also set it as an environment variable:

```bash
export RETELL_API_KEY=your-workspace-api-key
```

This takes precedence over `local.settings.json`.

## Troubleshooting

**If agents still don't appear:**
- Verify the API key is for workspace `org_LejRX5QqWX2Ws5hf`
- Check that the agent exists in that workspace
- Try creating a new API key in the correct workspace
- Verify you have the correct permissions in that workspace

