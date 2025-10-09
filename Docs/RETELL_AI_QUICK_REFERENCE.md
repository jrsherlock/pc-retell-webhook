# Retell AI MCP Server - Quick Reference

## Quick Start

After restarting Claude Desktop, you can use these Retell AI tools directly in your conversations.

## Tool Categories

### 📞 Call Tools

#### list_calls
List all calls in your Retell AI account.

#### create_phone_call
Create a new phone call.
- Requires: phone number, agent configuration
- Returns: call ID and details

#### create_web_call
Create a new web-based call.
- Requires: agent configuration
- Returns: call ID and web call URL

#### get_call
Get details of a specific call.
- Requires: call ID
- Returns: full call details, status, recordings, etc.

#### delete_call
Delete a call from your account.
- Requires: call ID

---

### 🤖 Agent Tools

#### list_agents
List all AI agents in your account.

#### create_agent
Create a new AI agent.
- Configure: voice, language model, prompts, behaviors
- Returns: agent ID and configuration

#### get_agent
Get details of a specific agent.
- Requires: agent ID
- Returns: full agent configuration

#### update_agent
Update an existing agent's configuration.
- Requires: agent ID
- Can update: voice, prompts, behaviors, settings

#### delete_agent
Delete an agent.
- Requires: agent ID

#### get_agent_versions
Get version history of an agent.
- Requires: agent ID
- Returns: all versions and their configurations

---

### 📱 Phone Number Tools

#### list_phone_numbers
List all phone numbers in your account.

#### create_phone_number
Register a new phone number.
- Configure: number, agent assignment, settings
- Returns: phone number details

#### get_phone_number
Get details of a specific phone number.
- Requires: phone number ID
- Returns: configuration and status

#### update_phone_number
Update phone number settings.
- Requires: phone number ID
- Can update: agent assignment, settings

#### delete_phone_number
Remove a phone number from your account.
- Requires: phone number ID

---

### 🎙️ Voice Tools

#### list_voices
List all available voices for your agents.
- Returns: voice IDs, names, languages, providers

#### get_voice
Get details of a specific voice.
- Requires: voice ID
- Returns: voice characteristics, language, provider

---

## Example Usage Patterns

### Creating a Simple Agent
1. Use `list_voices` to find available voices
2. Use `create_agent` with your desired configuration
3. Use `get_agent` to verify the agent was created correctly

### Setting Up a Phone Number
1. Use `create_phone_number` to register a number
2. Use `list_agents` to find your agent
3. Use `update_phone_number` to assign the agent to the number

### Making a Call
1. Use `list_agents` to find your agent ID
2. Use `create_phone_call` or `create_web_call` with the agent ID
3. Use `get_call` to check call status and details

### Managing Agent Versions
1. Use `get_agent_versions` to see version history
2. Use `update_agent` to make changes (creates new version)
3. Use `get_agent` to verify current version

---

## Tips

- **Agent IDs** are returned when you create agents and are needed for most operations
- **Call IDs** are returned when you create calls and can be used to track call status
- **Phone Number IDs** are different from the actual phone numbers - use the ID for API operations
- **Voice IDs** can be found using `list_voices` before creating agents

---

## Next Steps

1. **Restart Claude Desktop** to load the MCP server
2. **Test the connection** by asking Claude to list your Retell AI agents or voices
3. **Start building** your voice AI applications!

---

For detailed configuration information, see `RETELL_AI_MCP_SETUP.md`

