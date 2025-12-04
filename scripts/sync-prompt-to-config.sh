#!/bin/bash

# Sync enhanced-retell-agent-prompt.md to agent configuration JSON
# Usage: ./scripts/sync-prompt-to-config.sh [config-file]
# Example: ./scripts/sync-prompt-to-config.sh retell-agents/agents/production.json

set -e

PROMPT_FILE="enhanced-retell-agent-prompt.md"
CONFIG_FILE="${1:-retell-agents/agents/production.json}"

# Check if prompt file exists
if [ ! -f "$PROMPT_FILE" ]; then
    echo "❌ Error: Prompt file not found: $PROMPT_FILE"
    exit 1
fi

# Check if config file exists
if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ Error: Config file not found: $CONFIG_FILE"
    echo "   Usage: $0 [config-file]"
    echo "   Example: $0 retell-agents/agents/production.json"
    exit 1
fi

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "❌ Error: jq is required but not installed."
    echo "   Install with: brew install jq  # macOS"
    echo "   Or: apt-get install jq  # Linux"
    exit 1
fi

# Read prompt content
echo "📖 Reading prompt from: $PROMPT_FILE"
PROMPT_CONTENT=$(cat "$PROMPT_FILE")

# Create backup
BACKUP_FILE="${CONFIG_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
cp "$CONFIG_FILE" "$BACKUP_FILE"
echo "💾 Backup created: $BACKUP_FILE"

# Update JSON using jq
echo "🔄 Syncing prompt to: $CONFIG_FILE"
jq --arg prompt "$PROMPT_CONTENT" '.system_prompt = $prompt' "$CONFIG_FILE" > "${CONFIG_FILE}.tmp"
mv "${CONFIG_FILE}.tmp" "$CONFIG_FILE"

# Update metadata
jq '.metadata.last_prompt_sync = (now | todateiso8601)' "$CONFIG_FILE" > "${CONFIG_FILE}.tmp"
mv "${CONFIG_FILE}.tmp" "$CONFIG_FILE"

echo "✅ Successfully synced prompt to config file"
echo ""
echo "Next steps:"
echo "  1. Review the changes: git diff $CONFIG_FILE"
echo "  2. Validate: npm run retell:validate -- $CONFIG_FILE"
echo "  3. Commit: git add $PROMPT_FILE $CONFIG_FILE"
echo "  4. Deploy: npm run retell:deploy-agent -- --agent-id <id> --config $CONFIG_FILE"

