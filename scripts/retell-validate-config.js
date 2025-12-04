#!/usr/bin/env node

/**
 * Validate RetellAI Agent Configuration
 * 
 * Validates that a JSON configuration file is properly formatted and contains
 * required fields for a RetellAI agent configuration.
 * 
 * Usage:
 *   node scripts/retell-validate-config.js <config-file>
 */

const fs = require('fs').promises;
const path = require('path');

const REQUIRED_FIELDS = [
    'agent_name',
    'language',
    'voice_id'
];

const OPTIONAL_FIELDS = [
    'llm_websocket_url',
    'enable_backchannel',
    'enable_transcription',
    'webhook_url',
    'system_prompt',
    'response_delay',
    'custom_llm_extra_body',
    'analysis',
    'enable_webhook_signature',
    'enable_webhook_authentication',
    'metadata'
];

async function validateConfig(configPath) {
    try {
        // Check if file exists
        try {
            await fs.access(configPath);
        } catch (error) {
            console.error(`❌ Error: File not found: ${configPath}`);
            process.exit(1);
        }

        // Read and parse JSON
        const content = await fs.readFile(configPath, 'utf8');
        let config;
        
        try {
            config = JSON.parse(content);
        } catch (error) {
            console.error(`❌ Error: Invalid JSON syntax: ${error.message}`);
            process.exit(1);
        }

        // Validate required fields
        const missingFields = [];
        for (const field of REQUIRED_FIELDS) {
            if (!(field in config)) {
                missingFields.push(field);
            }
        }

        if (missingFields.length > 0) {
            console.error(`❌ Error: Missing required fields: ${missingFields.join(', ')}`);
            process.exit(1);
        }

        // Validate field types
        const errors = [];
        
        if (typeof config.agent_name !== 'string' || config.agent_name.trim() === '') {
            errors.push('agent_name must be a non-empty string');
        }
        
        if (typeof config.language !== 'string' || config.language.trim() === '') {
            errors.push('language must be a non-empty string');
        }
        
        if (typeof config.voice_id !== 'string' || config.voice_id.trim() === '') {
            errors.push('voice_id must be a non-empty string');
        }

        if (config.webhook_url && typeof config.webhook_url !== 'string') {
            errors.push('webhook_url must be a string or null');
        }

        if (config.system_prompt && typeof config.system_prompt !== 'string') {
            errors.push('system_prompt must be a string or null');
        }

        if (config.response_delay !== undefined && typeof config.response_delay !== 'number') {
            errors.push('response_delay must be a number');
        }

        if (errors.length > 0) {
            console.error('❌ Validation errors:');
            errors.forEach(error => console.error(`   - ${error}`));
            process.exit(1);
        }

        // Success
        console.log(`✅ Configuration file is valid: ${configPath}`);
        console.log(`\nAgent Name: ${config.agent_name}`);
        console.log(`Language: ${config.language}`);
        console.log(`Voice: ${config.voice_id}`);
        if (config.webhook_url) {
            console.log(`Webhook: ${config.webhook_url}`);
        }
        if (config.metadata && config.metadata.environment) {
            console.log(`Environment: ${config.metadata.environment}`);
        }
        
        return true;
    } catch (error) {
        console.error(`❌ Unexpected error: ${error.message}`);
        process.exit(1);
    }
}

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
        console.log(`
Usage: node scripts/retell-validate-config.js <config-file>

Validates a RetellAI agent configuration JSON file.

Examples:
  node scripts/retell-validate-config.js retell-agents/agents/production.json
  node scripts/retell-validate-config.js retell-agents/agents/staging.json
        `);
        process.exit(0);
    }

    const configPath = args[0];
    await validateConfig(configPath);
}

if (require.main === module) {
    main().catch(error => {
        console.error('Unexpected error:', error);
        process.exit(1);
    });
}

module.exports = { validateConfig };

