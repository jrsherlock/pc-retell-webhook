# RetellAI Agent Management - Quick Reference

## Common Commands

### List All Agents
```bash
npm run retell:list-agents
```

### Fetch Agent Configuration
```bash
# By ID
npm run retell:fetch-agent -- --agent-id <id> --output retell-agents/agents/production.json

# By Name
npm run retell:fetch-agent -- --agent-name "Agent Name" --output retell-agents/agents/production.json
```

### Validate Configuration
```bash
npm run retell:validate -- retell-agents/agents/production.json
```

### Deploy Configuration
```bash
# Update existing agent
npm run retell:deploy-agent -- --agent-id <id> --config retell-agents/agents/production.json

# Create new agent
npm run retell:deploy-agent -- --create --config retell-agents/agents/production.json

# Dry run (test without deploying)
npm run retell:deploy-agent -- --agent-id <id> --config retell-agents/agents/production.json --dry-run
```

## Workflow

### Making Changes
1. Fetch latest: `npm run retell:fetch-agent -- --agent-id <id> --output <file>`
2. Edit the JSON file
3. Validate: `npm run retell:validate -- <file>`
4. Commit: `git add <file> && git commit -m "Update agent config"`
5. Deploy: `npm run retell:deploy-agent -- --agent-id <id> --config <file>`

### Environment Setup
```bash
export RETELL_API_KEY=your-api-key
```

## File Locations

- **Configs**: `retell-agents/agents/*.json`
- **Templates**: `retell-agents/templates/agent-template.json`
- **Backups**: `retell-agents/backups/` (git-ignored)

## Required Fields

- `agent_name` - Agent display name
- `language` - Language code (e.g., "en-US")
- `voice_id` - Voice identifier

## Common Issues

**Agent not found**: Run `npm run retell:list-agents` to verify ID  
**Validation fails**: Check JSON syntax with `jq . <file>`  
**Deployment fails**: Verify API key with `echo $RETELL_API_KEY`  

## See Also

- Full guide: `RETELL_AGENT_VERSION_CONTROL.md`
- Directory docs: `retell-agents/README.md`

