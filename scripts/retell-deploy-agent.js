#!/usr/bin/env node

/**
 * Deploy RetellAI Agent Configuration
 * 
 * Deploys a version-controlled agent configuration to RetellAI.
 * 
 * Usage:
 *   node scripts/retell-deploy-agent.js --agent-id <id> --config <file>
 *   node scripts/retell-deploy-agent.js --create --config <file>
 */

const { Retell } = require('retell-sdk');
const fs = require('fs').promises;
const path = require('path');

// Parse command line arguments
function parseArgs() {
    const args = process.argv.slice(2);
    const parsed = {
        create: false,
        agentId: null,
        config: null,
        dryRun: false
    };

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--create' || args[i] === '-c') {
            parsed.create = true;
        } else if (args[i] === '--agent-id' || args[i] === '-i') {
            parsed.agentId = args[++i];
        } else if (args[i] === '--config' || args[i] === '-f') {
            parsed.config = args[++i];
        } else if (args[i] === '--dry-run' || args[i] === '-d') {
            parsed.dryRun = true;
        } else if (args[i] === '--help' || args[i] === '-h') {
            console.log(`
Usage: node scripts/retell-deploy-agent.js [options]

Options:
  --create, -c                  Create a new agent (instead of updating)
  --agent-id <id>, -i <id>      Agent ID to update (required if not creating)
  --config <file>, -f <file>    Configuration file path (required)
  --dry-run, -d                 Show what would be deployed without actually deploying
  --help, -h                    Show this help message

Examples:
  node scripts/retell-deploy-agent.js --agent-id abc123 --config agents/production.json
  node scripts/retell-deploy-agent.js --create --config agents/production.json
  node scripts/retell-deploy-agent.js --agent-id abc123 --config agents/production.json --dry-run
            `);
            process.exit(0);
        }
    }

    return parsed;
}

async function loadConfig(configPath) {
    try {
        const content = await fs.readFile(configPath, 'utf8');
        const config = JSON.parse(content);
        
        // Remove metadata fields that shouldn't be sent to API
        const { agent_id, metadata, ...agentConfig } = config;
        
        return agentConfig;
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.error(`Error: Configuration file not found: ${configPath}`);
        } else if (error instanceof SyntaxError) {
            console.error(`Error: Invalid JSON in configuration file: ${error.message}`);
        } else {
            console.error(`Error reading configuration: ${error.message}`);
        }
        process.exit(1);
    }
}

async function backupAgent(client, agentId) {
    try {
        console.log(`Creating backup of current agent configuration...`);
        const agent = await client.agent.retrieve(agentId);
        
        const backupDir = path.join(process.cwd(), 'retell-agents', 'backups');
        await fs.mkdir(backupDir, { recursive: true });
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(backupDir, `agent-${agentId}-${timestamp}.json`);
        
        await fs.writeFile(backupFile, JSON.stringify(agent, null, 2));
        console.log(`✅ Backup saved to: ${backupFile}`);
        
        return backupFile;
    } catch (error) {
        console.warn(`Warning: Could not create backup: ${error.message}`);
        return null;
    }
}

async function createAgent(client, config) {
    try {
        console.log(`Creating new agent: ${config.agent_name || 'Unnamed'}`);
        
        if (process.env.DRY_RUN === 'true') {
            console.log('\n[DRY RUN] Would create agent with config:');
            console.log(JSON.stringify(config, null, 2));
            return { agent_id: 'dry-run-agent-id' };
        }
        
        const agent = await client.agent.create(config);
        console.log(`\n✅ Agent created successfully!`);
        console.log(`Agent ID: ${agent.agent_id}`);
        console.log(`Agent Name: ${agent.agent_name}`);
        
        return agent;
    } catch (error) {
        console.error('Error creating agent:', error.message);
        if (error.response) {
            console.error('Response:', JSON.stringify(error.response.data, null, 2));
        }
        process.exit(1);
    }
}

async function updateAgent(client, agentId, config) {
    try {
        console.log(`Updating agent: ${agentId}`);
        
        if (process.env.DRY_RUN === 'true') {
            console.log('\n[DRY RUN] Would update agent with config:');
            console.log(JSON.stringify(config, null, 2));
            return;
        }
        
        // Create backup before updating
        await backupAgent(client, agentId);
        
        const agent = await client.agent.update(agentId, config);
        console.log(`\n✅ Agent updated successfully!`);
        console.log(`Agent ID: ${agent.agent_id}`);
        console.log(`Agent Name: ${agent.agent_name}`);
        
        return agent;
    } catch (error) {
        console.error('Error updating agent:', error.message);
        if (error.response) {
            console.error('Response:', JSON.stringify(error.response.data, null, 2));
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

    if (!args.config) {
        console.error('Error: --config is required');
        console.error('Use --help for usage information');
        process.exit(1);
    }

    if (!args.create && !args.agentId) {
        console.error('Error: Either --create or --agent-id is required');
        console.error('Use --help for usage information');
        process.exit(1);
    }

    const client = new Retell({
        apiKey: apiKey
    });

    const config = await loadConfig(args.config);
    
    if (args.dryRun) {
        process.env.DRY_RUN = 'true';
        console.log('\n=== DRY RUN MODE ===\n');
    }

    if (args.create) {
        await createAgent(client, config);
    } else {
        await updateAgent(client, args.agentId, config);
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error('Unexpected error:', error);
        process.exit(1);
    });
}

module.exports = { createAgent, updateAgent, loadConfig };

