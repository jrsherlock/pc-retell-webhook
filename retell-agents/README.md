# RetellAI Agent Configuration Version Control

This directory contains version-controlled RetellAI agent configurations. All agent configurations are stored as JSON files and can be synced to/from RetellAI using the provided scripts.

## Directory Structure

```
retell-agents/
├── README.md                    # This file
├── agents/                      # Agent configuration files
│   ├── production.json          # Production agent config
│   ├── staging.json            # Staging agent config
│   └── development.json        # Development agent config
├── templates/                   # Agent configuration templates
│   └── agent-template.json     # Template for new agents
└── .gitignore                  # Git ignore rules for this directory
```

## Agent Configuration Files

Each agent configuration file should be named after the environment (e.g., `production.json`, `staging.json`) and contain the complete agent configuration as returned by the RetellAI API.

### File Naming Convention

- `production.json` - Production agent configuration
- `staging.json` - Staging agent configuration  
- `development.json` - Development agent configuration
- `{agent-name}.json` - Custom named agents

## Usage

### Fetching Agent Configuration from RetellAI

To download the current agent configuration from RetellAI:

```bash
# Fetch by agent ID
npm run retell:fetch-agent -- --agent-id <agent-id> --output agents/production.json

# Fetch by agent name (requires listing agents first)
npm run retell:fetch-agent -- --agent-name "ProCircular IR Agent" --output agents/production.json
```

### Deploying Agent Configuration to RetellAI

To deploy a version-controlled agent configuration to RetellAI:

```bash
# Deploy to existing agent
npm run retell:deploy-agent -- --agent-id <agent-id> --config agents/production.json

# Create new agent from config
npm run retell:deploy-agent -- --create --config agents/production.json
```

### Listing Agents

To list all agents in your RetellAI account:

```bash
npm run retell:list-agents
```

## Integration with Azure DevOps

The agent configurations are automatically synced during the CI/CD pipeline:

1. **CI Pipeline**: Validates agent configuration JSON files
2. **CD Pipeline**: Optionally deploys agent configurations to RetellAI (if enabled)

See `.azure-pipelines/ci-pipeline.yml` and `.azure-pipelines/cd-pipeline.yml` for details.

## Best Practices

1. **Always fetch before editing**: Run `npm run retell:fetch-agent` to get the latest config before making changes
2. **Commit changes**: Commit agent configuration changes to version control
3. **Test in staging**: Deploy to staging first before production
4. **Document changes**: Include notes about what changed and why in commit messages
5. **Backup before deploy**: The scripts automatically create backups before deploying

## Configuration Structure

Agent configurations follow the RetellAI API structure. Key fields include:

- `agent_name` - Name of the agent
- `language` - Language code (e.g., "en-US")
- `voice_id` - Voice ID for the agent
- `llm_websocket_url` - WebSocket URL for LLM integration
- `enable_backchannel` - Enable backchannel communication
- `enable_transcription` - Enable transcription
- `webhook_url` - Webhook URL for call events
- `system_prompt` - System prompt for the agent
- `response_delay` - Response delay in milliseconds
- `custom_llm_extra_body` - Custom LLM configuration
- `analysis` - Analysis configuration for extracting structured data

See `templates/agent-template.json` for a complete example.

## Security Notes

- **Never commit API keys**: Agent configs may contain sensitive data. Review before committing.
- **Use environment variables**: The scripts use `RETELL_API_KEY` from environment variables
- **Validate before deploy**: Always validate JSON syntax before deploying

## Troubleshooting

### Agent not found
- Verify the agent ID is correct: `npm run retell:list-agents`
- Check that the agent exists in your RetellAI account

### Deployment fails
- Verify API key is set: `echo $RETELL_API_KEY`
- Check JSON syntax: `npm run retell:validate -- agents/production.json`
- Review RetellAI API documentation for required fields

### Configuration mismatch
- Fetch the latest config: `npm run retell:fetch-agent`
- Compare with version control: `git diff agents/production.json`

