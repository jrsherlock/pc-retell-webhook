#!/usr/bin/env node

/**
 * Fetch RetellAI Agent Configuration
 * 
 * Downloads the current agent configuration from RetellAI and saves it to a JSON file.
 * 
 * Usage:
 *   node scripts/retell-fetch-agent.js --agent-id <agent-id> --output <file>
 *   node scripts/retell-fetch-agent.js --agent-name <name> --output <file>
 *   node scripts/retell-fetch-agent.js --list
 */

const { Retell } = require('retell-sdk');
const fs = require('fs').promises;
const path = require('path');

// Parse command line arguments
function parseArgs() {
    const args = process.argv.slice(2);
    const parsed = {
        list: false,
        agentId: null,
        agentName: null,
        output: null
    };

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--list' || args[i] === '-l') {
            parsed.list = true;
        } else if (args[i] === '--agent-id' || args[i] === '-i') {
            parsed.agentId = args[++i];
        } else if (args[i] === '--agent-name' || args[i] === '-n') {
            parsed.agentName = args[++i];
        } else if (args[i] === '--output' || args[i] === '-o') {
            parsed.output = args[++i];
        } else if (args[i] === '--help' || args[i] === '-h') {
            console.log(`
Usage: node scripts/retell-fetch-agent.js [options]

Options:
  --list, -l                    List all agents
  --agent-id <id>, -i <id>      Fetch agent by ID
  --agent-name <name>, -n <name> Fetch agent by name
  --output <file>, -o <file>    Output file path (required for fetch)
  --help, -h                    Show this help message

Examples:
  node scripts/retell-fetch-agent.js --list
  node scripts/retell-fetch-agent.js --agent-id abc123 --output agents/production.json
  node scripts/retell-fetch-agent.js --agent-name "ProCircular IR Agent" --output agents/production.json
            `);
            process.exit(0);
        }
    }

    return parsed;
}

async function listAgents(client) {
    try {
        console.log('Fetching list of agents...');
        const response = await client.agent.list();
        
        // Handle pagination - response might be an object with data array
        const agents = Array.isArray(response) ? response : (response.data || response.agents || []);
        
        console.log('\n=== RetellAI Agents ===\n');
        if (agents.length === 0) {
            console.log('No agents found.');
            return;
        }

        agents.forEach((agent, index) => {
            console.log(`${index + 1}. ${agent.agent_name || 'Unnamed Agent'}`);
            console.log(`   ID: ${agent.agent_id}`);
            console.log(`   Language: ${agent.language || 'N/A'}`);
            console.log(`   Voice: ${agent.voice_id || 'N/A'}`);
            console.log(`   Webhook: ${agent.webhook_url || 'None'}`);
            console.log('');
        });
        
        // Check if there are more pages
        if (response.has_more || response.next_cursor) {
            console.log('⚠️  Note: There may be more agents. The API may paginate results.');
        }
    } catch (error) {
        console.error('Error listing agents:', error.message);
        if (error.response) {
            console.error('Response:', error.response.data);
        }
        process.exit(1);
    }
}

async function findAgentByName(client, agentName) {
    try {
        const agents = await client.agent.list();
        const agent = agents.find(a => 
            a.agent_name && a.agent_name.toLowerCase() === agentName.toLowerCase()
        );
        
        if (!agent) {
            console.error(`Agent not found: "${agentName}"`);
            console.log('\nAvailable agents:');
            agents.forEach(a => console.log(`  - ${a.agent_name || 'Unnamed'} (${a.agent_id})`));
            process.exit(1);
        }
        
        return agent.agent_id;
    } catch (error) {
        console.error('Error finding agent:', error.message);
        process.exit(1);
    }
}

async function fetchAgent(client, agentId, outputPath) {
    try {
        console.log(`Fetching agent configuration for ID: ${agentId}`);
        const agent = await client.agent.retrieve(agentId);
        
        // Save the COMPLETE agent configuration from the API response
        // This includes all fields returned by RetellAI, ensuring nothing is missed
        const config = JSON.parse(JSON.stringify(agent)); // Deep clone to avoid reference issues
        
        // Fetch LLM configuration if response_engine contains llm_id
        // The LLM data contains the system prompt (general_prompt) and other LLM settings
        if (config.response_engine && config.response_engine.llm_id) {
            try {
                console.log(`Fetching LLM configuration for LLM ID: ${config.response_engine.llm_id}`);
                const llmData = await client.llm.retrieve(config.response_engine.llm_id);
                
                // Add LLM data as retellLlmData (matching the manual export format)
                config.retellLlmData = JSON.parse(JSON.stringify(llmData)); // Deep clone
                
                console.log(`✅ LLM configuration retrieved (includes system prompt)`);
            } catch (llmError) {
                console.warn(`⚠️  Warning: Could not fetch LLM configuration: ${llmError.message}`);
                console.warn(`   The agent config will be saved without retellLlmData`);
            }
        }
        
        // Ensure metadata object exists
        if (!config.metadata) {
            config.metadata = {};
        }
        
        // Add sync metadata (for tracking when we fetched this config)
        config.metadata.last_fetched = new Date().toISOString();
        config.metadata.fetched_by = process.env.USER || 'unknown';

        // Ensure output directory exists
        const outputDir = path.dirname(outputPath);
        await fs.mkdir(outputDir, { recursive: true });

        // Write complete configuration to file
        await fs.writeFile(outputPath, JSON.stringify(config, null, 2));
        
        console.log(`\n✅ Complete agent configuration saved to: ${outputPath}`);
        console.log(`\nAgent Name: ${config.agent_name || 'N/A'}`);
        console.log(`Language: ${config.language || 'N/A'}`);
        console.log(`Voice: ${config.voice_id || 'N/A'}`);
        console.log(`Webhook: ${config.webhook_url || 'None'}`);
        if (config.retellLlmData) {
            console.log(`LLM: ${config.retellLlmData.model || 'N/A'} (includes system prompt)`);
        }
        console.log(`\n📋 Configuration includes all fields from RetellAI API`);
        
    } catch (error) {
        console.error('Error fetching agent:', error.message);
        if (error.status) {
            console.error(`Status: ${error.status}`);
        }
        if (error.body) {
            console.error('Response:', JSON.stringify(error.body, null, 2));
        }
        if (error.status === 404) {
            console.error(`\n⚠️  Agent not found: ${agentId}`);
            console.error('');
            console.error('Possible causes:');
            console.error('   1. Agent ID is incorrect');
            console.error('   2. API key is for a different workspace');
            console.error('   3. Agent was deleted or moved');
            console.error('');
            console.error('To verify:');
            console.error('   - Check your API key is for the correct workspace');
            console.error('   - List agents: npm run retell:list-agents');
            console.error('   - Verify agent ID in RetellAI dashboard');
        }
        process.exit(1);
    }
}

async function main() {
    const args = parseArgs();
    
    // Check for API key - try environment variable first, then local.settings.json
    let apiKey = process.env.RETELL_API_KEY;
    
    if (!apiKey) {
        // Try to read from local.settings.json as fallback
        try {
            const fs = require('fs');
            if (fs.existsSync('local.settings.json')) {
                const settings = JSON.parse(fs.readFileSync('local.settings.json', 'utf8'));
                if (settings.Values && settings.Values.RETELL_API_KEY) {
                    apiKey = settings.Values.RETELL_API_KEY;
                    console.log('ℹ️  Using RETELL_API_KEY from local.settings.json');
                }
            }
        } catch (error) {
            // Ignore errors reading local.settings.json
        }
    }
    
    if (!apiKey) {
        console.error('Error: RETELL_API_KEY not found');
        console.error('');
        console.error('Set it using one of these methods:');
        console.error('');
        console.error('Option 1: Environment variable (recommended for this session):');
        console.error('   export RETELL_API_KEY=your-api-key');
        console.error('');
        console.error('Option 2: Add to local.settings.json (persistent):');
        console.error('   Add this line to local.settings.json in the Values section:');
        console.error('   "RETELL_API_KEY": "your-api-key",');
        console.error('');
        console.error('Option 3: Add to your shell profile (persistent across sessions):');
        console.error('   echo \'export RETELL_API_KEY=your-api-key\' >> ~/.bashrc  # or ~/.zshrc');
        console.error('   source ~/.bashrc  # or source ~/.zshrc');
        process.exit(1);
    }

    const client = new Retell({
        apiKey: apiKey
    });
    
    // Note: API keys are scoped to a workspace. If you get 404 errors,
    // verify your API key is for the correct workspace.

    if (args.list) {
        await listAgents(client);
        return;
    }

    if (!args.output) {
        console.error('Error: --output is required when fetching an agent');
        console.error('Use --help for usage information');
        process.exit(1);
    }

    let agentId = args.agentId;
    
    if (args.agentName && !agentId) {
        agentId = await findAgentByName(client, args.agentName);
    }

    if (!agentId) {
        console.error('Error: Either --agent-id or --agent-name is required');
        console.error('Use --help for usage information');
        process.exit(1);
    }

    await fetchAgent(client, agentId, args.output);
}

if (require.main === module) {
    main().catch(error => {
        console.error('Unexpected error:', error);
        process.exit(1);
    });
}

module.exports = { fetchAgent, listAgents, findAgentByName };

