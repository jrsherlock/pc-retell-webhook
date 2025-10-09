# Retell AI MCP Server Configuration

## Overview
This document describes the Retell AI MCP (Model Context Protocol) server integration for this project.

## Configuration Location
The MCP server configuration is located in:
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

## Configuration Details

### Retell AI MCP Server Entry
```json
{
  "mcpServers": {
    "retellai-mcp-server": {
      "command": "npx",
      "args": [
        "-y",
        "@abhaybabbar/retellai-mcp-server"
      ],
      "env": {
        "RETELL_API_KEY": "key_73d490e5dd22bcf4406c816b8fed"
      }
    }
  }
}
```

## Available Tools

Once configured, the following Retell AI tools are available through the MCP server:

### Call Management Tools
- **list_calls** - List all calls
- **create_phone_call** - Create a new phone call
- **create_web_call** - Create a new web call
- **get_call** - Get details of a specific call
- **delete_call** - Delete a call

### Agent Management Tools
- **list_agents** - List all agents
- **create_agent** - Create a new agent
- **get_agent** - Get details of a specific agent
- **update_agent** - Update an existing agent
- **delete_agent** - Delete an agent
- **get_agent_versions** - Get version history of an agent

### Phone Number Management Tools
- **list_phone_numbers** - List all phone numbers
- **create_phone_number** - Create/register a new phone number
- **get_phone_number** - Get details of a specific phone number
- **update_phone_number** - Update phone number settings
- **delete_phone_number** - Delete a phone number

### Voice Management Tools
- **list_voices** - List available voices
- **get_voice** - Get details of a specific voice

## System Requirements

### Dependencies
- **Node.js**: v18.20.8 (installed at `/opt/homebrew/opt/node@18/bin/node`)
- **npx**: v10.8.2 (installed at `/opt/homebrew/opt/node@18/bin/npx`)

### Package
- **@abhaybabbar/retellai-mcp-server** - Installed via npx on-demand

## Activation

To activate the Retell AI MCP server:

1. **Restart Claude Desktop** - The configuration is loaded when Claude Desktop starts
2. **Verify Connection** - Check that the Retell AI tools appear in your available MCP tools

## Backup

A backup of the previous configuration has been saved to:
```
~/Library/Application Support/Claude/claude_desktop_config.json.backup
```

## Troubleshooting

### If the MCP server doesn't appear:
1. Verify the configuration file syntax is valid JSON
2. Restart Claude Desktop completely (quit and reopen)
3. Check that npx is accessible from your PATH
4. Verify the API key is correct

### To test the configuration manually:
```bash
npx -y @abhaybabbar/retellai-mcp-server
```

### To view current configuration:
```bash
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

### To restore from backup:
```bash
cp ~/Library/Application\ Support/Claude/claude_desktop_config.json.backup \
   ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

## Security Notes

- The API key is stored in the configuration file
- The configuration file is located in your user's Application Support directory
- Keep the API key confidential and do not commit it to version control

## References

- **Package**: [@abhaybabbar/retellai-mcp-server](https://www.npmjs.com/package/@abhaybabbar/retellai-mcp-server)
- **MCP Documentation**: [Model Context Protocol](https://modelcontextprotocol.io/)
- **Retell AI**: [Retell AI Platform](https://www.retellai.com/)

## Configuration Date
- **Configured**: October 8, 2025
- **API Key**: key_73d490e5dd22bcf4406c816b8fed

