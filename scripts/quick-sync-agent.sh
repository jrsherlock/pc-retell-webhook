#!/bin/bash

# Quick sync script for RetellAI agent configuration
# Usage: ./scripts/quick-sync-agent.sh [agent-id]
# Example: ./scripts/quick-sync-agent.sh abc123xyz

set -e

# Get agent ID from argument or environment variable
AGENT_ID="${1:-${RETELL_AGENT_ID}}"
CONFIG_FILE="retell-agents/agents/production.json"

# Check if agent ID is provided
if [ -z "$AGENT_ID" ]; then
    echo "❌ Error: Agent ID required"
    echo ""
    echo "Usage: $0 <agent-id>"
    echo "   Or set RETELL_AGENT_ID environment variable"
    echo ""
    echo "To find your agent ID:"
    echo "   npm run retell:list-agents"
    exit 1
fi

# Check if API key is set - try environment variable first, then local.settings.json
if [ -z "$RETELL_API_KEY" ]; then
    # Try to read from local.settings.json as fallback
    if [ -f "local.settings.json" ]; then
        # Try using jq first (more reliable)
        if command -v jq &> /dev/null; then
            RETELL_API_KEY=$(jq -r '.Values.RETELL_API_KEY // empty' local.settings.json 2>/dev/null || true)
        else
            # Fallback to grep/sed if jq not available
            RETELL_API_KEY=$(grep -o '"RETELL_API_KEY"[[:space:]]*:[[:space:]]*"[^"]*"' local.settings.json 2>/dev/null | sed -E 's/.*"RETELL_API_KEY"[[:space:]]*:[[:space:]]*"([^"]*)".*/\1/' || true)
        fi
        
        if [ -n "$RETELL_API_KEY" ] && [ "$RETELL_API_KEY" != "null" ]; then
            echo "ℹ️  Using RETELL_API_KEY from local.settings.json"
            export RETELL_API_KEY
        fi
    fi
fi

# Final check
if [ -z "$RETELL_API_KEY" ]; then
    echo "❌ Error: RETELL_API_KEY not found"
    echo ""
    echo "Set it using one of these methods:"
    echo ""
    echo "Option 1: Environment variable (recommended for this session):"
    echo "   export RETELL_API_KEY=your-api-key"
    echo ""
    echo "Option 2: Add to local.settings.json (persistent):"
    echo "   Add this line to local.settings.json in the Values section:"
    echo "   \"RETELL_API_KEY\": \"your-api-key\","
    echo ""
    echo "Option 3: Add to your shell profile (persistent across sessions):"
    echo "   echo 'export RETELL_API_KEY=your-api-key' >> ~/.bashrc  # or ~/.zshrc"
    echo "   source ~/.bashrc  # or source ~/.zshrc"
    exit 1
fi

echo "🔄 Syncing agent configuration from RetellAI..."
echo "   Agent ID: $AGENT_ID"
echo "   Config file: $CONFIG_FILE"
echo ""

# Fetch the configuration
npm run retell:fetch-agent -- --agent-id "$AGENT_ID" --output "$CONFIG_FILE"

echo ""
echo "📋 Checking for changes..."

# Check if file is tracked in git
if git ls-files --error-unmatch "$CONFIG_FILE" >/dev/null 2>&1; then
    # File is tracked, check for changes
    if git diff --quiet "$CONFIG_FILE"; then
        echo "✅ No changes detected - configuration is already in sync"
    else
        # Check if only metadata timestamp changed (not a meaningful change)
        DIFF_OUTPUT=$(git diff "$CONFIG_FILE")
        # Get all changed lines (lines starting with + or -)
        CHANGED_LINES=$(echo "$DIFF_OUTPUT" | grep -E "^[+-]" | grep -v "^[+-][+-][+-]" || true)
        # Check if all changed lines are only metadata fields
        # Use precise JSON key matching (not substring matching) to avoid false positives
        # Match JSON keys like: "last_fetched":, "fetched_by":, "last_prompt_sync":
        # This ensures we only filter actual metadata fields, not content containing these strings
        # Pattern matches: "key": where key is one of the metadata field names
        METADATA_PATTERN='("last_fetched"|"fetched_by"|"last_prompt_sync")\s*:'
        NON_METADATA_CHANGES=$(echo "$CHANGED_LINES" | grep -vE "$METADATA_PATTERN" | grep -v "^[+-]\s*$" || true)
        
        if [ -z "$NON_METADATA_CHANGES" ] && [ -n "$CHANGED_LINES" ]; then
            echo "ℹ️  Only metadata timestamp changed (not a meaningful change)"
            echo "   No actual agent configuration changes detected"
            echo "   You don't need to commit this - it's just a sync timestamp"
        else
            echo "📝 Changes detected:"
            echo ""
            echo "$DIFF_OUTPUT" | head -50
            if [ $(echo "$DIFF_OUTPUT" | wc -l) -gt 50 ]; then
                echo ""
                echo "... (showing first 50 lines, run 'git diff $CONFIG_FILE' to see all)"
            fi
            echo ""
            echo "✅ Next steps:"
            echo "   1. Review changes: git diff $CONFIG_FILE"
            echo "   2. Stage changes: git add $CONFIG_FILE"
            echo "   3. Commit: git commit -m 'Sync agent changes from RetellAI: [description]'"
            echo "   4. Push: git push"
        fi
    fi
else
    # File is not tracked yet
    echo "📝 New configuration file (not yet tracked in git)"
    echo ""
    echo "✅ Next steps:"
    echo "   1. Review the file: cat $CONFIG_FILE"
    echo "   2. Stage: git add $CONFIG_FILE"
    echo "   3. Commit: git commit -m 'Add agent configuration from RetellAI'"
    echo "   4. Push: git push"
fi

