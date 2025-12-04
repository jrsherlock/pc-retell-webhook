import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import sgMail from "@sendgrid/mail";
import { EmailClient, KnownEmailSendStatus } from "@azure/communication-email";
import twilio from "twilio";
import { Retell } from "retell-sdk";

/**
 * TypeScript interface for the Retell AI call object
 */
interface RetellCallObject {
    call_id: string;
    agent_id: string;
    start_timestamp: number;
    end_timestamp: number;
    transcript: string;
    summary?: string;
    // Support both old format (analysis) and new format (call_analysis)
    analysis?: {
        incident_liability_insurance_status?: string;
        caller_name?: string;
        incident_is_customer_primary_contact?: string | boolean;
        current_customer?: string | boolean;
        cybersecurity_insurance_provider_name?: string;
        non_IR_inquiry_reason?: string;
        caller_email_address?: string;
        company_name?: string;
        caller_phone_number?: string | number;
        IR_call_description?: string;
        non_IR_call_description?: string;
        caller_location?: string;  // NEW: City, State format
        is_security_incident?: boolean;  // NEW: Boolean indicating if this is a security incident
    };
    call_analysis?: {
        call_summary?: string;
        user_sentiment?: string;  // NEW: Caller's sentiment (Positive/Negative/Neutral)
        call_successful?: boolean;  // NEW: Whether the call was completed successfully
        in_voicemail?: boolean;  // NEW: Whether the call went to voicemail
        custom_analysis_data?: {
            incident_liability_insurance_status?: string;
            caller_name?: string;
            incident_is_customer_primary_contact?: boolean | string;
            current_customer?: boolean | string;
            cybersecurity_insurance_provider_name?: string;
            non_IR_inquiry_reason?: string;
            caller_email_address?: string;
            company_name?: string;
            caller_phone_number?: number | string;
            IR_call_description?: string;
            non_IR_call_description?: string;
            caller_location?: string;  // NEW: City, State format
            is_security_incident?: boolean;  // NEW: Boolean indicating if this is a security incident
        };
    };
    metadata?: Record<string, any>;
    // Optional fields present in RetellAI call payloads
    recording_url?: string;
    recording_multi_channel_url?: string;
    // Transcript object is an array of speaker turns with role + content
    transcript_object?: Array<{ role: string; content: string; [key: string]: any }>;
    public_log_url?: string;
    // Call metadata
    duration_ms?: number;  // NEW: Call duration in milliseconds
    disconnection_reason?: string;  // NEW: How the call ended (user_hangup, agent_hangup, etc.)
    call_status?: string;  // NEW: Call status (ended, in_progress, etc.)
    call_type?: string;  // NEW: Type of call (phone_call, web_call, etc.)
    agent_name?: string;  // NEW: Name of the agent that handled the call
    // Call cost information (cost is in cents)
    call_cost?: {
        combined_cost?: number;
        total_duration_seconds?: number;
        total_duration_unit_price?: number;
        product_costs?: Array<{
            product: string;
            unit_price: number;
            cost: number;
        }>;
    };
}

/**
 * TypeScript interface for the Retell AI webhook payload
 * The webhook wraps the call object in an event envelope
 */
interface RetellWebhookPayload {
    event: 'call_started' | 'call_ended' | 'call_analyzed';
    call: RetellCallObject;
}

// For backward compatibility, keep the old interface name as an alias
type RetellAnalysisPayload = RetellCallObject;

/**
 * Configuration object for all external service credentials
 */
interface ServiceConfig {
    emailProvider: 'sendgrid' | 'azure';  // Email provider selection
    sendgrid: {
        apiKey: string;
        fromEmail: string;  // Default/fallback FROM email
        fromEmailIr: string;  // FROM email for IR emails
        fromEmailNonIr: string;  // FROM email for non-IR emails
        toEmail: string;
    };
    azureEmail: {
        connectionString: string;
        senderEmail: string;  // Default/fallback sender email
        senderEmailIr: string;  // Sender email for IR emails
        senderEmailNonIr: string;  // Sender email for non-IR emails
        recipientEmail: string;
    };
    teams: {
        webhookUrl: string;
    };
    twilio: {
        accountSid: string;
        authToken: string;
        fromNumber: string;
        toNumber: string;
    };
    jira: {
        apiUrl: string;
        userEmail: string;
        apiToken: string;
        projectKey: string;
        requestTypeDev: string;  // Request Type ID for dev environment (e.g., "250")
        requestTypeProd: string;  // Request Type ID for production (e.g., "151")
        issueType: string;  // JIRA issue type (e.g., "[System] Incident")
        toEmail: string;  // Email address for "TO:" field in JIRA ticket description
        failureNotificationRecipients: string;  // Email recipients for JIRA failure notifications (comma-separated)
    };
    nonIrEmail: {
        recipientEmail: string;
    };
    email: {
        fromNameIr: string;  // FROM name for IR emails (e.g., "ProCircular Incident Response")
        fromNameNonIr: string;  // FROM name for non-IR emails (e.g., "Procircular General Inquiry")
        unsubscribeEmail: string;  // Unsubscribe email address for List-Unsubscribe header
    };
    featureFlags: {
        enableEmail: boolean;
        enableTeams: boolean;
        enableSms: boolean;
        enableJira: boolean;
    };
}

/**
 * Load and validate all required environment variables
 */
function loadConfiguration(): ServiceConfig {
    // Read feature flags (default to false for fail-safe behavior)
    const enableEmail = process.env.ENABLE_EMAIL_NOTIFICATIONS?.toLowerCase() === 'true';
    const enableTeams = process.env.ENABLE_TEAMS_NOTIFICATIONS?.toLowerCase() === 'true';
    const enableSms = process.env.ENABLE_SMS_NOTIFICATIONS?.toLowerCase() === 'true';
    const enableJira = process.env.ENABLE_JIRA_NOTIFICATIONS?.toLowerCase() === 'true';

    // Determine email provider (default to sendgrid for backward compatibility)
    const emailProvider = (process.env.EMAIL_PROVIDER?.toLowerCase() === 'azure' ? 'azure' : 'sendgrid') as 'sendgrid' | 'azure';

    // Build list of required environment variables based on enabled features
    const requiredEnvVars: string[] = [];

    if (enableEmail) {
        if (emailProvider === 'sendgrid') {
            requiredEnvVars.push('SENDGRID_API_KEY', 'SENDGRID_FROM_EMAIL', 'IRT_EMAIL_ADDRESS');
        } else if (emailProvider === 'azure') {
            requiredEnvVars.push('AZURE_COMMUNICATION_CONNECTION_STRING', 'AZURE_COMMUNICATION_SENDER_EMAIL', 'IRT_EMAIL_ADDRESS');
        }
    }

    if (enableTeams) {
        requiredEnvVars.push('TEAMS_WEBHOOK_URL');
    }

    if (enableSms) {
        requiredEnvVars.push('TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER', 'ONCALL_PHONE_NUMBER');
    }

    if (enableJira) {
        requiredEnvVars.push('JIRA_API_URL', 'JIRA_USER_EMAIL', 'JIRA_API_TOKEN', 'JIRA_PROJECT_KEY');
    }

    // Non-IR email recipient is optional (defaults to IRT_EMAIL_ADDRESS if not set)
    // No validation needed since it's optional

    // Validate that required variables for enabled features are present
    const missing = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables for enabled features: ${missing.join(', ')}`);
    }

    return {
        emailProvider,
        sendgrid: {
            apiKey: process.env.SENDGRID_API_KEY || '',
            fromEmail: process.env.SENDGRID_FROM_EMAIL || 'DONOTREPLY@procircular.com',  // Default/fallback
            fromEmailIr: process.env.SENDGRID_FROM_EMAIL_IR || process.env.SENDGRID_FROM_EMAIL || 'DONOTREPLY@procircular.com',
            fromEmailNonIr: process.env.SENDGRID_FROM_EMAIL_NON_IR || process.env.SENDGRID_FROM_EMAIL || 'DONOTREPLY@procircular.com',
            toEmail: process.env.IRT_EMAIL_ADDRESS || ''
        },
        azureEmail: {
            connectionString: process.env.AZURE_COMMUNICATION_CONNECTION_STRING || '',
            senderEmail: process.env.AZURE_COMMUNICATION_SENDER_EMAIL || 'DONOTREPLY@procircular.com',  // Default/fallback
            senderEmailIr: process.env.AZURE_COMMUNICATION_SENDER_EMAIL_IR || process.env.AZURE_COMMUNICATION_SENDER_EMAIL || 'DONOTREPLY@procircular.com',
            senderEmailNonIr: process.env.AZURE_COMMUNICATION_SENDER_EMAIL_NON_IR || process.env.AZURE_COMMUNICATION_SENDER_EMAIL || 'DONOTREPLY@procircular.com',
            recipientEmail: process.env.IRT_EMAIL_ADDRESS || ''
        },
        teams: {
            webhookUrl: process.env.TEAMS_WEBHOOK_URL || ''
        },
        twilio: {
            accountSid: process.env.TWILIO_ACCOUNT_SID || '',
            authToken: process.env.TWILIO_AUTH_TOKEN || '',
            fromNumber: process.env.TWILIO_FROM_NUMBER || '',
            toNumber: process.env.ONCALL_PHONE_NUMBER || ''
        },
        jira: {
            apiUrl: process.env.JIRA_API_URL || '',
            userEmail: process.env.JIRA_USER_EMAIL || '',
            apiToken: process.env.JIRA_API_TOKEN || '',
            projectKey: process.env.JIRA_PROJECT_KEY || 'IRT',
            requestTypeDev: process.env.JIRA_REQUEST_TYPE_DEV || '250',  // Default: DEV - Report a Cybersecurity Incident
            requestTypeProd: process.env.JIRA_REQUEST_TYPE_PROD || '151',  // Default: IR Email Report
            issueType: process.env.JIRA_ISSUE_TYPE || '[System] Incident',
            toEmail: process.env.JIRA_TO_EMAIL || process.env.IRT_EMAIL_ADDRESS || 'IRT@procircular.com',
            failureNotificationRecipients: process.env.JIRA_FAILURE_NOTIFICATION_RECIPIENTS || 'csirt@procircular.com,jsherlock@procircular.com'  // Default recipients for JIRA failure alerts
        },
        nonIrEmail: {
            recipientEmail: process.env.NON_IR_EMAIL_RECIPIENT || process.env.IRT_EMAIL_ADDRESS || ''
        },
        email: {
            fromNameIr: process.env.EMAIL_FROM_NAME_IR || 'ProCircular Incident Response',
            fromNameNonIr: process.env.EMAIL_FROM_NAME_NON_IR || 'Procircular General Inquiry',
            unsubscribeEmail: process.env.UNSUBSCRIBE_EMAIL || 'unsubscribe@procircular.com'
        },
        featureFlags: {
            enableEmail,
            enableTeams,
            enableSms,
            enableJira
        }
    };
}

/**
 * Determine if a call is an IR (Incident Response) call
 */
function isIrCall(payload: RetellAnalysisPayload): boolean {
    const analysis = payload.analysis || payload.call_analysis?.custom_analysis_data || {};

    // A call is considered IR if:
    // 1. It has an IR_call_description that is not empty, OR
    // 2. The is_security_incident flag is explicitly true
    const irDescription = analysis.IR_call_description?.trim();
    const isSecurityIncident = analysis.is_security_incident === true;
    
    return !!(irDescription && irDescription.length > 0) || isSecurityIncident;
}

/**
 * Determine if a call is a non-IR call
 */
function isNonIrCall(payload: RetellAnalysisPayload): boolean {
    const analysis = payload.analysis || payload.call_analysis?.custom_analysis_data || {};

    // A call is considered non-IR if:
    // 1. It has a non_IR_inquiry_reason or non_IR_call_description, AND
    // 2. is_security_incident is NOT true (to avoid false positives)
    const nonIrReason = analysis.non_IR_inquiry_reason?.trim();
    const nonIrDescription = analysis.non_IR_call_description?.trim();
    const isSecurityIncident = analysis.is_security_incident === true;

    // Only classify as non-IR if security incident flag is not true
    if (isSecurityIncident) {
        return false; // If it's a security incident, it's IR, not non-IR
    }

    return !!(
        (nonIrReason && nonIrReason.length > 0) ||
        (nonIrDescription && nonIrDescription.length > 0)
    );
}

/**
 * Build plain text transcript from payload
 */
function buildPlainTextTranscript(payload: RetellAnalysisPayload): string {
    let transcriptText = '';

    if (payload.transcript_object && Array.isArray(payload.transcript_object) && payload.transcript_object.length > 0) {
        transcriptText += '\n';
        transcriptText += '═'.repeat(70) + '\n';
        transcriptText += '📝 COMPLETE CALL TRANSCRIPT\n';
        transcriptText += '═'.repeat(70) + '\n\n';

        for (const turn of payload.transcript_object) {
            const role = (turn.role || 'unknown').toLowerCase();
            const isAgent = role === 'agent';
            const speaker = isAgent ? '🤖 AI Voice Agent' : '👤 Caller';
            const content = turn.content || '';

            transcriptText += `${speaker}:\n`;
            transcriptText += `${content}\n\n`;
        }

        transcriptText += '═'.repeat(70) + '\n';
    } else if (payload.transcript) {
        transcriptText += '\n';
        transcriptText += '═'.repeat(70) + '\n';
        transcriptText += '📝 COMPLETE CALL TRANSCRIPT\n';
        transcriptText += '═'.repeat(70) + '\n\n';
        transcriptText += payload.transcript + '\n\n';
        transcriptText += '═'.repeat(70) + '\n';
    } else {
        transcriptText += '\n📝 COMPLETE CALL TRANSCRIPT\n';
        transcriptText += '(No transcript available)\n';
    }

    return transcriptText;
}

/**
 * Build plain text email body from payload
 */
function buildPlainTextEmail(payload: RetellAnalysisPayload): string {
    const analysis = payload.analysis || payload.call_analysis?.custom_analysis_data || {};
    const summary = payload.summary || payload.call_analysis?.call_summary || 'No summary available';

    let text = '';

    // Header
    text += '╔' + '═'.repeat(68) + '╗\n';
    text += '║' + ' '.repeat(68) + '║\n';
    text += '║' + '🚨 NEW CYBERSECURITY INCIDENT REPORTED'.padStart(52).padEnd(68) + '║\n';
    text += '║' + ' '.repeat(68) + '║\n';
    text += '╚' + '═'.repeat(68) + '╝\n\n';

    // Call Recording & Resources
    if (payload.recording_url || payload.recording_multi_channel_url || payload.public_log_url) {
        text += '─'.repeat(70) + '\n';
        text += '🎧 CALL RECORDING & RESOURCES\n';
        text += '─'.repeat(70) + '\n\n';

        if (payload.recording_url) {
            text += '🎵 Listen / Download Recording:\n';
            text += `   ${payload.recording_url}\n\n`;
        }

        if (payload.recording_multi_channel_url) {
            text += '🎙️ Multi-channel Audio:\n';
            text += `   ${payload.recording_multi_channel_url}\n\n`;
        }

        if (payload.public_log_url) {
            text += '📋 Public Log:\n';
            text += `   ${payload.public_log_url}\n\n`;
        }

        text += '─'.repeat(70) + '\n\n';
    }

    // Incident Details
    text += '─'.repeat(70) + '\n';
    text += 'INCIDENT DETAILS\n';
    text += '─'.repeat(70) + '\n\n';

    text += `Company Name:              ${analysis.company_name || 'N/A'}\n`;
    text += `Caller Name:               ${analysis.caller_name || 'N/A'}\n`;
    text += `Caller Email:              ${analysis.caller_email_address || 'N/A'}\n`;
    text += `Caller Phone:              ${analysis.caller_phone_number ? String(analysis.caller_phone_number) : 'N/A'}\n`;
    text += `Caller Location:           ${analysis.caller_location || 'Not provided'}\n`;
    text += `Current Customer:          ${analysis.current_customer === true || analysis.current_customer === 'true' ? 'Yes' : 'No'}\n`;
    text += `Primary Contact:           ${analysis.incident_is_customer_primary_contact === true || analysis.incident_is_customer_primary_contact === 'true' ? 'Yes' : 'No'}\n`;
    text += `Cyber Liability Insurance: ${analysis.incident_liability_insurance_status === 'yes' ? 'Yes' : 'No'}\n`;
    text += `Insurance Provider:        ${analysis.cybersecurity_insurance_provider_name || 'N/A'}\n\n`;

    // Incident Description
    text += '─'.repeat(70) + '\n';
    text += '⚠️  INCIDENT DESCRIPTION\n';
    text += '─'.repeat(70) + '\n\n';
    text += `${analysis.IR_call_description || 'No description provided'}\n\n`;

    // Call Information
    text += '─'.repeat(70) + '\n';
    text += 'CALL INFORMATION\n';
    text += '─'.repeat(70) + '\n\n';

    text += `Call ID:      ${payload.call_id}\n`;
    text += `Call Summary: ${summary}\n`;

    if (payload.call_cost?.combined_cost) {
        const costInDollars = (payload.call_cost.combined_cost / 100).toFixed(3);
        const duration = payload.call_cost.total_duration_seconds || 0;
        text += `Call Cost:    $${costInDollars} (${duration}s)\n`;
    }

    text += '\n';

    // Transcript
    text += buildPlainTextTranscript(payload);

    // Footer
    text += '\n\n';
    text += '─'.repeat(70) + '\n';
    text += 'This is an automated notification from the ProCircular Incident\n';
    text += 'Response System.\n\n';
    text += `Timestamp: ${new Date(payload.start_timestamp * 1000).toLocaleString()}\n`;
    text += '─'.repeat(70) + '\n';

    return text;
}

/**
 * Build HTML email body from payload
 */
function buildHtmlEmailBody(payload: RetellAnalysisPayload): string {
    // Support both old format (analysis) and new format (call_analysis.custom_analysis_data)
    const analysis = payload.analysis || payload.call_analysis?.custom_analysis_data || {};
    const summary = payload.summary || payload.call_analysis?.call_summary || 'No summary available';

    // Build a formatted transcript HTML (prefer structured transcript_object if available)
    let transcriptHtml = '';
    if (payload.transcript_object && Array.isArray(payload.transcript_object) && payload.transcript_object.length > 0) {
        transcriptHtml += '<div class="transcript-container">';
        transcriptHtml += '<h3 class="transcript-header">📝 Complete Call Transcript</h3>';
        transcriptHtml += '<div class="transcript">';
        for (const turn of payload.transcript_object) {
            const role = (turn.role || 'unknown').toLowerCase();
            const isAgent = role === 'agent';
            const speaker = isAgent ? '🤖 AI Voice Agent' : '👤 Caller';
            const speakerClass = isAgent ? 'speaker-agent' : 'speaker-caller';
            // sanitize content minimally by replacing < with &lt; to avoid injection
            const content = (turn.content || '').replace(/</g, '&lt;');
            transcriptHtml += `\n<div class="turn ${speakerClass}"><div class="speaker">${speaker}:</div><div class="utterance">${content}</div></div>`;
        }
        transcriptHtml += '\n</div>';
        transcriptHtml += '</div>';
    } else if (payload.transcript) {
        // fallback: plain transcript text
        const safeTranscript = payload.transcript.replace(/</g, '&lt;').replace(/\n/g, '<br/>');
        transcriptHtml = `<div class="transcript-container"><h3 class="transcript-header">📝 Complete Call Transcript</h3><div class="transcript"><div class="utterance">${safeTranscript}</div></div></div>`;
    } else {
        transcriptHtml = '<div class="transcript-container"><h3 class="transcript-header">📝 Complete Call Transcript</h3><div class="transcript"><em>No transcript available</em></div></div>';
    }

    const htmlBody = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #d32f2f; color: white; padding: 20px; text-align: center; }
                .content { background-color: #f5f5f5; padding: 20px; margin-top: 20px; }
                .links { margin-bottom: 20px; padding: 15px; background: #e3f2fd; border-radius: 6px; }
                .links-header { font-weight: bold; color: #1976d2; margin-bottom: 10px; font-size: 14px; }
                .link-button {
                    display: inline-block;
                    background: #1976d2;
                    color: #fff !important;
                    padding: 10px 16px;
                    border-radius: 4px;
                    text-decoration: none !important;
                    margin-right: 8px;
                    margin-bottom: 8px;
                    font-weight: 500;
                    border: none;
                }
                .link-button:hover { background: #1565c0; }
                .link-button:visited { color: #fff !important; }
                .transcript-container { margin-top: 25px; background: #ffffff; border: 2px solid #1976d2; border-radius: 6px; padding: 20px; }
                .transcript-header { margin: 0 0 15px 0; color: #1976d2; font-size: 18px; border-bottom: 2px solid #e0e0e0; padding-bottom: 10px; }
                .transcript { background: #fafafa; border-radius: 4px; padding: 15px; max-height: 600px; overflow-y: auto; }
                .turn { margin-bottom: 15px; padding: 10px; border-radius: 4px; }
                .speaker-agent { background: #e8f5e9; border-left: 4px solid #4caf50; }
                .speaker-caller { background: #e3f2fd; border-left: 4px solid #2196f3; }
                .speaker { font-weight: bold; margin-bottom: 6px; font-size: 14px; }
                .speaker-agent .speaker { color: #2e7d32; }
                .speaker-caller .speaker { color: #1565c0; }
                .utterance { white-space: pre-wrap; line-height: 1.5; color: #333; }
                .field { margin-bottom: 15px; }
                .label { font-weight: bold; color: #555; }
                .value { margin-top: 5px; }
                .description-box { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-top: 20px; }
                .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #777; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🚨 New Cybersecurity Incident Reported</h1>
                </div>
                <div class="content">
                    <div class="links">
                        <div class="links-header">🎧 Call Recording & Resources</div>
                        <div style="margin-top: 10px;">
                            ${payload.recording_url ? `
                                <a class="link-button" href="${payload.recording_url}" target="_blank" rel="noopener noreferrer">🎵 Listen / Download Recording</a>
                            ` : ''}
                            ${payload.recording_multi_channel_url ? `
                                <a class="link-button" href="${payload.recording_multi_channel_url}" target="_blank" rel="noopener noreferrer">🎙️ Multi-channel Audio</a>
                            ` : ''}
                            ${payload.public_log_url ? `
                                <a class="link-button" href="${payload.public_log_url}" target="_blank" rel="noopener noreferrer">📋 Public Log</a>
                            ` : ''}
                        </div>
                        ${payload.recording_url || payload.recording_multi_channel_url || payload.public_log_url ? `
                            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #bbdefb; font-size: 12px; color: #666;">
                                <strong>Direct Links:</strong><br/>
                                ${payload.recording_url ? `🎵 Recording: <a href="${payload.recording_url}" target="_blank" style="color: #1976d2; word-break: break-all;">${payload.recording_url}</a><br/>` : ''}
                                ${payload.recording_multi_channel_url ? `🎙️ Multi-channel: <a href="${payload.recording_multi_channel_url}" target="_blank" style="color: #1976d2; word-break: break-all;">${payload.recording_multi_channel_url}</a><br/>` : ''}
                                ${payload.public_log_url ? `📋 Public Log: <a href="${payload.public_log_url}" target="_blank" style="color: #1976d2; word-break: break-all;">${payload.public_log_url}</a>` : ''}
                            </div>
                        ` : ''}
                    </div>
                    <div class="field">
                        <div class="label">Company Name:</div>
                        <div class="value">${analysis.company_name || 'N/A'}</div>
                    </div>
                    <div class="field">
                        <div class="label">Caller Name:</div>
                        <div class="value">${analysis.caller_name || 'N/A'}</div>
                    </div>
                    <div class="field">
                        <div class="label">Caller Email:</div>
                        <div class="value">${analysis.caller_email_address || 'N/A'}</div>
                    </div>
                    <div class="field">
                        <div class="label">Caller Phone:</div>
                        <div class="value">${analysis.caller_phone_number ? String(analysis.caller_phone_number) : 'N/A'}</div>
                    </div>
                    <div class="field">
                        <div class="label">Caller Location:</div>
                        <div class="value">${analysis.caller_location || 'Not provided'}</div>
                    </div>
                    <div class="field">
                        <div class="label">Current Customer:</div>
                        <div class="value">${analysis.current_customer === true || analysis.current_customer === 'true' ? 'Yes' : 'No'}</div>
                    </div>
                    <div class="field">
                        <div class="label">Primary Contact:</div>
                        <div class="value">${analysis.incident_is_customer_primary_contact === true || analysis.incident_is_customer_primary_contact === 'true' ? 'Yes' : 'No'}</div>
                    </div>
                    <div class="field">
                        <div class="label">Cyber Liability Insurance:</div>
                        <div class="value">${analysis.incident_liability_insurance_status === 'yes' ? 'Yes' : 'No'}</div>
                    </div>
                    <div class="field">
                        <div class="label">Insurance Provider:</div>
                        <div class="value">${analysis.cybersecurity_insurance_provider_name || 'N/A'}</div>
                    </div>
                    <div class="description-box">
                        <div class="label">Incident Description:</div>
                        <div class="value">${analysis.IR_call_description || 'No description provided'}</div>
                    </div>
                    <div class="field" style="margin-top: 20px;">
                        <div class="label">Call ID:</div>
                        <div class="value">${payload.call_id}</div>
                    </div>
                    <div class="field">
                        <div class="label">Call Summary:</div>
                        <div class="value">${summary}</div>
                    </div>
                    ${payload.call_cost?.combined_cost ? `
                    <div class="field">
                        <div class="label">Call Cost:</div>
                        <div class="value">$${(payload.call_cost.combined_cost / 100).toFixed(3)} (${payload.call_cost.total_duration_seconds || 0}s)</div>
                    </div>
                    ` : ''}

                    ${transcriptHtml}
                </div>
                <div class="footer">
                    <p>This is an automated notification from the ProCircular Incident Response System.</p>
                    <p>Timestamp: ${new Date(payload.start_timestamp * 1000).toLocaleString()}</p>
                </div>
            </div>
        </body>
        </html>
    `;

    return htmlBody;
}

/**
 * Send formatted email notification via Azure Communication Services
 */
async function sendEmailViaAzure(payload: RetellAnalysisPayload, config: ServiceConfig, context: InvocationContext): Promise<void> {
    context.log(`Sending email notification via Azure Communication Services...`);
    context.log(`  Provider: Azure`);
    context.log(`  Sender: ${config.azureEmail.senderEmail}`);
    context.log(`  Recipient: ${config.azureEmail.recipientEmail}`);

    // Validate minimum required data for IR calls (safety check - main validation already done)
    const validation = validateIrCallData(payload);
    if (!validation.valid) {
        context.log('❌ IR email skipped - missing required data:');
        validation.missingFields.forEach(field => context.log(`   - ${field}`));
        context.log('⚠️  Email will NOT be sent.');
        return; // Return early without throwing
    }

    context.log('✅ Minimum required data validated for IR email');

    // Initialize Azure Email Client
    const emailClient = new EmailClient(config.azureEmail.connectionString);

    // Support both old format (analysis) and new format (call_analysis.custom_analysis_data)
    const analysis = payload.analysis || payload.call_analysis?.custom_analysis_data || {};
    const companyName = analysis.company_name || 'Unknown Company';

    // Build HTML and plain text email bodies
    const htmlBody = buildHtmlEmailBody(payload);
    const plainTextBody = buildPlainTextEmail(payload);

    // Build email message with Azure Communication Services format
    const message = {
        senderAddress: config.azureEmail.senderEmailIr,  // Sender email for IR (from AZURE_COMMUNICATION_SENDER_EMAIL_IR or AZURE_COMMUNICATION_SENDER_EMAIL)
        content: {
            subject: `[INCIDENT] ${companyName} - Cybersecurity Alert`,
            plainText: plainTextBody,
            html: htmlBody
        },
        recipients: {
            to: (() => {
                // Support multiple recipients (comma-separated)
                const emails = config.azureEmail.recipientEmail.includes(',')
                    ? config.azureEmail.recipientEmail.split(',').map(email => email.trim())
                    : [config.azureEmail.recipientEmail];
                
                return emails.map(email => ({
                    address: email.trim(),
                    displayName: email === 'IRT@procircular.com' ? "Incident Response Team" : "Monitoring"
                }));
            })()
        },
        headers: {
            // Custom headers for better deliverability
            "X-Priority": "1",  // High priority
            "Importance": "high",  // Outlook-specific
            "X-MSMail-Priority": "High",  // Microsoft Mail priority
            "X-Mailer": "ProCircular IR System",  // Identify sender
            "X-Entity-Ref-ID": payload.call_id,  // Unique reference
            "List-Unsubscribe": `<mailto:${config.email.unsubscribeEmail}>`  // Required for corporate filters
        },
        userEngagementTrackingDisabled: true  // Disable tracking for corporate compatibility
    };

    try {
        // Send email and get poller
        context.log('Initiating email send via Azure Communication Services...');
        const poller = await emailClient.beginSend(message);

        // Poll for completion (with timeout)
        context.log('Polling for email send status...');
        const result = await poller.pollUntilDone();

        // Check result status
        if (result.status === KnownEmailSendStatus.Succeeded) {
            context.log(`✅ Email sent successfully via Azure Communication Services`);
            context.log(`   Message ID: ${result.id}`);
        } else {
            context.error(`❌ Email send failed via Azure Communication Services`);
            context.error(`   Status: ${result.status}`);
            context.error(`   Error: ${result.error?.message || 'Unknown error'}`);
            throw new Error(`Azure email send failed: ${result.status}`);
        }
    } catch (error) {
        context.error(`❌ Exception while sending email via Azure Communication Services:`);
        context.error(`   ${error instanceof Error ? error.message : String(error)}`);
        throw error;
    }
}

/**
 * Send formatted email notification via SendGrid
 */
async function sendEmailViaSendGrid(payload: RetellAnalysisPayload, config: ServiceConfig, context: InvocationContext): Promise<void> {
    context.log(`Sending email notification via SendGrid...`);
    context.log(`  Provider: SendGrid`);
    context.log(`  Sender: ${config.sendgrid.fromEmail}`);
    context.log(`  Recipient: ${config.sendgrid.toEmail}`);

    // Validate minimum required data for IR calls (safety check - main validation already done)
    const validation = validateIrCallData(payload);
    if (!validation.valid) {
        context.log('❌ IR email skipped - missing required data:');
        validation.missingFields.forEach(field => context.log(`   - ${field}`));
        context.log('⚠️  Email will NOT be sent.');
        return; // Return early without throwing
    }

    context.log('✅ Minimum required data validated for IR email');

    sgMail.setApiKey(config.sendgrid.apiKey);

    // Support both old format (analysis) and new format (call_analysis.custom_analysis_data)
    const analysis = payload.analysis || payload.call_analysis?.custom_analysis_data || {};
    const companyName = analysis.company_name || 'Unknown Company';

    // Build HTML and plain text email bodies
    const htmlBody = buildHtmlEmailBody(payload);
    const plainTextBody = buildPlainTextEmail(payload);

    // Enhanced SendGrid message configuration for corporate email deliverability
    // Support multiple recipients (comma-separated or array)
    const recipients = config.sendgrid.toEmail.includes(',') 
        ? config.sendgrid.toEmail.split(',').map(email => email.trim())
        : config.sendgrid.toEmail;
    
    const msg = {
        to: recipients,
        from: {
            email: config.sendgrid.fromEmailIr,  // FROM email for IR (from SENDGRID_FROM_EMAIL_IR or SENDGRID_FROM_EMAIL)
            name: config.email.fromNameIr  // Friendly sender name (from EMAIL_FROM_NAME_IR env var)
        },
        replyTo: config.sendgrid.fromEmailIr,  // Reply-to uses same as FROM
        subject: `[INCIDENT] ${companyName} - Cybersecurity Alert`,  // Clear, professional subject
        text: plainTextBody,  // Plain text version (for Outlook and other clients that strip HTML)
        html: htmlBody,       // HTML version (for clients that support it)

        // Email categories for SendGrid analytics and filtering
        categories: ['incident-notification', 'cybersecurity', 'automated'],

        // Custom headers to improve deliverability and bypass spam filters
        headers: {
            'X-Priority': '1',  // High priority (1 = Highest, 3 = Normal, 5 = Lowest)
            'Importance': 'high',  // Outlook-specific importance flag
            'X-MSMail-Priority': 'High',  // Microsoft Mail priority
            'X-Mailer': 'ProCircular IR System',  // Identify the sending application
            'X-Entity-Ref-ID': payload.call_id,  // Unique reference for tracking
            'List-Unsubscribe': `<mailto:${config.email.unsubscribeEmail}>`,  // Required for corporate filters
            'Precedence': 'bulk',  // Indicate this is automated but important
        },

        // Tracking settings - DISABLE for corporate email compatibility
        trackingSettings: {
            clickTracking: {
                enable: false,  // Disabled - corporate filters often block link rewriting
                enableText: false
            },
            openTracking: {
                enable: false  // Disabled - corporate filters block tracking pixels
            },
            subscriptionTracking: {
                enable: false  // Disabled - we handle unsubscribe manually
            }
        },

        // Mail settings for better deliverability
        mailSettings: {
            bypassListManagement: {
                enable: false  // Respect SendGrid's suppression lists
            },
            footer: {
                enable: false  // No footer - keeps email clean
            },
            sandboxMode: {
                enable: false  // Ensure emails are actually sent
            }
        },

        // Custom arguments for webhook tracking (doesn't affect deliverability)
        customArgs: {
            call_id: payload.call_id,
            company: companyName,
            notification_type: 'incident_alert'
        }
    };

    await sgMail.send(msg);
    context.log('✅ Email sent successfully via SendGrid (HTML + Plain Text)');
}

/**
 * Main email router function - routes to appropriate provider
 */
async function sendEmail(payload: RetellAnalysisPayload, config: ServiceConfig, context: InvocationContext): Promise<void> {
    context.log(`Email notification requested - Provider: ${config.emailProvider}`);

    if (config.emailProvider === 'azure') {
        await sendEmailViaAzure(payload, config, context);
    } else {
        await sendEmailViaSendGrid(payload, config, context);
    }
}

/**
 * Post notification to Microsoft Teams via Incoming Webhook using Adaptive Card
 */
async function sendTeamsMessage(payload: RetellAnalysisPayload, config: ServiceConfig, context: InvocationContext): Promise<void> {
    context.log('Sending Teams notification...');

    const { analysis } = payload;
    const companyName = analysis.company_name || 'Unknown Company';
    const callerName = analysis.caller_name || 'Unknown Caller';

    // Create an Adaptive Card for rich formatting
    const adaptiveCard = {
        type: "message",
        attachments: [
            {
                contentType: "application/vnd.microsoft.card.adaptive",
                content: {
                    type: "AdaptiveCard",
                    version: "1.4",
                    body: [
                        {
                            type: "Container",
                            style: "attention",
                            items: [
                                {
                                    type: "TextBlock",
                                    text: "🚨 New Cybersecurity Incident Reported",
                                    weight: "bolder",
                                    size: "large",
                                    wrap: true,
                                    color: "attention"
                                }
                            ]
                        },
                        {
                            type: "FactSet",
                            facts: [
                                {
                                    title: "Company:",
                                    value: companyName
                                },
                                {
                                    title: "Caller:",
                                    value: callerName
                                },
                                {
                                    title: "Phone:",
                                    value: analysis.caller_phone_number || 'N/A'
                                },
                                {
                                    title: "Email:",
                                    value: analysis.caller_email_address || 'N/A'
                                },
                                {
                                    title: "Current Customer:",
                                    value: analysis.current_customer === 'true' ? 'Yes' : 'No'
                                },
                                {
                                    title: "Cyber Insurance:",
                                    value: analysis.incident_liability_insurance_status === 'yes' ? 'Yes' : 'No'
                                },
                                {
                                    title: "Insurance Provider:",
                                    value: analysis.cybersecurity_insurance_provider_name || 'N/A'
                                }
                            ]
                        },
                        {
                            type: "Container",
                            style: "warning",
                            items: [
                                {
                                    type: "TextBlock",
                                    text: "Incident Description",
                                    weight: "bolder",
                                    wrap: true
                                },
                                {
                                    type: "TextBlock",
                                    text: analysis.IR_call_description || 'No description provided',
                                    wrap: true,
                                    spacing: "small"
                                }
                            ]
                        },
                        {
                            type: "TextBlock",
                            text: `Call ID: ${payload.call_id}`,
                            size: "small",
                            isSubtle: true,
                            wrap: true,
                            spacing: "medium"
                        },
                        {
                            type: "TextBlock",
                            text: `Received: ${new Date(payload.start_timestamp * 1000).toLocaleString()}`,
                            size: "small",
                            isSubtle: true,
                            wrap: true
                        }
                    ]
                }
            }
        ]
    };

    const response = await fetch(config.teams.webhookUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(adaptiveCard)
    });

    if (!response.ok) {
        throw new Error(`Teams webhook failed: ${response.status} ${response.statusText}`);
    }

    context.log('Teams notification sent successfully');
}

/**
 * Send SMS alert via Twilio
 */
async function sendSms(payload: RetellAnalysisPayload, config: ServiceConfig, context: InvocationContext): Promise<void> {
    context.log('Sending SMS notification...');

    const client = twilio(config.twilio.accountSid, config.twilio.authToken);
    const { analysis } = payload;

    const callerName = analysis.caller_name || 'Unknown Caller';
    const companyName = analysis.company_name || 'Unknown Company';

    const message = `New ProCircular IR Alert: Incident reported by ${callerName} from ${companyName}. Check email/Teams for details.`;

    await client.messages.create({
        body: message,
        from: config.twilio.fromNumber,
        to: config.twilio.toNumber
    });

    context.log('SMS sent successfully');
}

/**
 * Helper function to safely convert values to strings with defaults
 */
function getString(value: any, defaultValue: string = 'Not provided'): string {
    if (value === null || value === undefined || value === '') return defaultValue;
    return String(value);
}

/**
 * Helper function to convert boolean/string values to Yes/No
 */
function getYesNo(value: any): string {
    if (value === true || value === 'true' || value === 'yes') return 'Yes';
    if (value === false || value === 'false' || value === 'no') return 'No';
    return 'Unknown';
}

/**
 * Validate that IR call has minimum required data
 * Required: confirmed incident, caller name, company, phone number
 */
function validateIrCallData(payload: RetellAnalysisPayload): { valid: boolean; missingFields: string[] } {
    const analysis = payload.analysis || payload.call_analysis?.custom_analysis_data || {};
    const missingFields: string[] = [];

    // Check for confirmed security incident
    if (analysis.is_security_incident !== true) {
        missingFields.push('confirmed security incident (is_security_incident must be true)');
    }

    // Check for caller name (first and last name)
    const callerName = analysis.caller_name;
    if (!callerName || String(callerName).trim() === '' || String(callerName).trim().toLowerCase() === 'not provided') {
        missingFields.push('caller first and last name');
    }

    // Check for company name
    const companyName = analysis.company_name;
    if (!companyName || String(companyName).trim() === '' || String(companyName).trim().toLowerCase() === 'not provided') {
        missingFields.push('company name');
    }

    // Check for phone number
    const phoneNumber = analysis.caller_phone_number;
    if (!phoneNumber || String(phoneNumber).trim() === '' || String(phoneNumber).trim().toLowerCase() === 'not provided') {
        missingFields.push('phone number');
    }

    return {
        valid: missingFields.length === 0,
        missingFields
    };
}

/**
 * Validate that non-IR call has minimum required data
 * Required: confirmed NOT a security incident, caller name, and either phone number OR email
 * Note: company_name is optional for non-IR calls as it may not always be relevant
 */
function validateNonIrCallData(payload: RetellAnalysisPayload): { valid: boolean; missingFields: string[] } {
    const analysis = payload.analysis || payload.call_analysis?.custom_analysis_data || {};
    const missingFields: string[] = [];

    // Check that call is NOT a security incident (must be explicitly false or not true)
    if (analysis.is_security_incident === true) {
        missingFields.push('call must not be a security incident (is_security_incident must be false or not set)');
    }

    // Check for caller name
    const callerName = analysis.caller_name;
    if (!callerName || String(callerName).trim() === '' || String(callerName).trim().toLowerCase() === 'not provided') {
        missingFields.push('caller name');
    }

    // Note: company_name is NOT required for non-IR calls as it may not always be relevant
    // (e.g., someone calling to verify an address may not be associated with a company)

    // Check for contact information (phone OR email - at least one required)
    const phoneNumber = analysis.caller_phone_number;
    const emailAddress = analysis.caller_email_address;
    
    const hasPhone = phoneNumber && String(phoneNumber).trim() !== '' && String(phoneNumber).trim().toLowerCase() !== 'not provided';
    const hasEmail = emailAddress && String(emailAddress).trim() !== '' && String(emailAddress).trim().toLowerCase() !== 'not provided';
    
    if (!hasPhone && !hasEmail) {
        missingFields.push('contact information (phone number OR email address)');
    }

    return {
        valid: missingFields.length === 0,
        missingFields
    };
}

/**
 * Convert plain text to Atlassian Document Format (ADF) for JIRA API v3
 * JIRA API v3 requires descriptions in ADF format, not plain text
 */
function convertTextToAtlassianDocumentFormat(text: string): any {
    // Split text by newlines and create paragraphs
    const lines = text.split('\n').filter(line => line.trim() !== '');
    
    if (lines.length === 0) {
        // Return empty paragraph if no content
        return {
            type: 'doc',
            version: 1,
            content: [
                {
                    type: 'paragraph',
                    content: [
                        {
                            type: 'text',
                            text: 'No description provided'
                        }
                    ]
                }
            ]
        };
    }
    
    // Convert each line to a paragraph
    const content = lines.map(line => ({
        type: 'paragraph',
        content: [
            {
                type: 'text',
                text: line.trim()
            }
        ]
    }));
    
    return {
        type: 'doc',
        version: 1,
        content: content
    };
}

/**
 * Send email notification when JIRA ticket creation fails
 */
async function sendJiraFailureNotificationEmail(
    payload: RetellAnalysisPayload,
    error: Error,
    config: ServiceConfig,
    context: InvocationContext
): Promise<void> {
    context.log('📧 Sending JIRA failure notification email...');

    const analysis = payload.analysis || payload.call_analysis?.custom_analysis_data || {};
    const companyName = getString(analysis.company_name, 'Unknown Company');
    const callerName = getString(analysis.caller_name, 'Unknown Caller');
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Build HTML email body
    const htmlBody = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #d32f2f; color: white; padding: 20px; text-align: center; }
                .content { background-color: #f5f5f5; padding: 20px; margin-top: 20px; }
                .error-box { background-color: #ffebee; border-left: 4px solid #d32f2f; padding: 15px; margin: 20px 0; }
                .field { margin-bottom: 15px; }
                .label { font-weight: bold; color: #555; }
                .value { margin-top: 5px; }
                .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #777; }
                pre { background-color: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>⚠️ JIRA Ticket Creation Failed</h1>
                </div>
                <div class="content">
                    <div class="error-box">
                        <strong>⚠️ ALERT:</strong> A call_analyzed event was received but the system was unable to create a JIRA ticket.
                    </div>
                    <div class="field">
                        <div class="label">Call ID:</div>
                        <div class="value">${payload.call_id}</div>
                    </div>
                    <div class="field">
                        <div class="label">Company Name:</div>
                        <div class="value">${companyName}</div>
                    </div>
                    <div class="field">
                        <div class="label">Caller Name:</div>
                        <div class="value">${callerName}</div>
                    </div>
                    <div class="field">
                        <div class="label">Caller Phone:</div>
                        <div class="value">${getString(analysis.caller_phone_number, 'N/A')}</div>
                    </div>
                    <div class="field">
                        <div class="label">Caller Email:</div>
                        <div class="value">${getString(analysis.caller_email_address, 'N/A')}</div>
                    </div>
                    <div class="field">
                        <div class="label">JIRA Project:</div>
                        <div class="value">${config.jira.projectKey}</div>
                    </div>
                    <div class="field">
                        <div class="label">JIRA User:</div>
                        <div class="value">${config.jira.userEmail}</div>
                    </div>
                    <div class="error-box">
                        <div class="label">Error Message:</div>
                        <pre>${errorMessage}</pre>
                    </div>
                    <div class="field">
                        <div class="label">Timestamp:</div>
                        <div class="value">${new Date().toLocaleString()}</div>
                    </div>
                    ${payload.recording_url || payload.public_log_url ? `
                    <div class="field">
                        <div class="label">Call Resources:</div>
                        <div class="value">
                            ${payload.recording_url ? `<a href="${payload.recording_url}" target="_blank">Recording</a> | ` : ''}
                            ${payload.public_log_url ? `<a href="${payload.public_log_url}" target="_blank">Public Log</a>` : ''}
                        </div>
                    </div>
                    ` : ''}
                    <div class="footer">
                        <p><strong>Action Required:</strong> Please manually create a JIRA ticket for this incident or investigate the error.</p>
                        <p>This is an automated notification from the ProCircular Incident Response System.</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;

    // Build plain text email body
    const plainTextBody = `
╔════════════════════════════════════════════════════════════════╗
║          ⚠️  JIRA TICKET CREATION FAILED                       ║
╚════════════════════════════════════════════════════════════════╝

ALERT: A call_analyzed event was received but the system was unable to create a JIRA ticket.

CALL INFORMATION
─────────────────────────────────────────────────────────────────
Call ID:        ${payload.call_id}
Company Name:   ${companyName}
Caller Name:    ${callerName}
Caller Phone:   ${getString(analysis.caller_phone_number, 'N/A')}
Caller Email:   ${getString(analysis.caller_email_address, 'N/A')}

JIRA CONFIGURATION
─────────────────────────────────────────────────────────────────
JIRA Project:  ${config.jira.projectKey}
JIRA User:     ${config.jira.userEmail}
JIRA API URL:  ${config.jira.apiUrl}

ERROR DETAILS
─────────────────────────────────────────────────────────────────
${errorMessage}

TIMESTAMP
─────────────────────────────────────────────────────────────────
${new Date().toLocaleString()}

${payload.recording_url ? `Call Recording: ${payload.recording_url}\n` : ''}
${payload.public_log_url ? `Public Log: ${payload.public_log_url}\n` : ''}

─────────────────────────────────────────────────────────────────
ACTION REQUIRED: Please manually create a JIRA ticket for this incident
or investigate the error.

This is an automated notification from the ProCircular Incident
Response System.
─────────────────────────────────────────────────────────────────
    `;

    // Support multiple recipients (comma-separated) - use JIRA failure notification recipients
    const recipients = config.jira.failureNotificationRecipients.includes(',')
        ? config.jira.failureNotificationRecipients.split(',').map(email => email.trim())
        : [config.jira.failureNotificationRecipients];

    if (config.emailProvider === 'azure') {
        // Send via Azure Communication Services
        const emailClient = new EmailClient(config.azureEmail.connectionString);

        const message = {
            senderAddress: config.azureEmail.senderEmailIr,
            content: {
                subject: `[ALERT] JIRA Ticket Creation Failed - ${companyName}`,
                plainText: plainTextBody,
                html: htmlBody
            },
            recipients: {
                to: recipients.map(email => ({
                    address: email.trim(),
                    displayName: email === 'IRT@procircular.com' ? "Incident Response Team" : "Monitoring"
                }))
            },
            headers: {
                "X-Priority": "1",
                "Importance": "high",
                "X-MSMail-Priority": "High",
                "X-Mailer": "ProCircular IR System",
                "X-Entity-Ref-ID": payload.call_id,
                "List-Unsubscribe": `<mailto:${config.email.unsubscribeEmail}>`
            },
            userEngagementTrackingDisabled: true
        };

        try {
            const poller = await emailClient.beginSend(message);
            const result = await poller.pollUntilDone();

            if (result.status === KnownEmailSendStatus.Succeeded) {
                context.log(`✅ JIRA failure notification email sent successfully via Azure Communication Services`);
            } else {
                context.error(`❌ Failed to send JIRA failure notification email: ${result.status}`);
            }
        } catch (emailError) {
            context.error(`❌ Exception sending JIRA failure notification email: ${emailError instanceof Error ? emailError.message : String(emailError)}`);
            // Don't throw - we don't want email failures to mask the original JIRA error
        }
    } else {
        // Send via SendGrid
        try {
            sgMail.setApiKey(config.sendgrid.apiKey);

            const msg = {
                to: recipients,
                from: {
                    email: config.sendgrid.fromEmailIr,
                    name: config.email.fromNameIr
                },
                replyTo: config.sendgrid.fromEmailIr,
                subject: `[ALERT] JIRA Ticket Creation Failed - ${companyName}`,
                text: plainTextBody,
                html: htmlBody,
                categories: ['jira-failure', 'system-alert', 'automated'],
                headers: {
                    'X-Priority': '1',
                    'Importance': 'high',
                    'X-MSMail-Priority': 'High',
                    'X-Mailer': 'ProCircular IR System',
                    'X-Entity-Ref-ID': payload.call_id,
                    'List-Unsubscribe': `<mailto:${config.email.unsubscribeEmail}>`
                },
                trackingSettings: {
                    clickTracking: { enable: false, enableText: false },
                    openTracking: { enable: false },
                    subscriptionTracking: { enable: false }
                },
                customArgs: {
                    call_id: payload.call_id,
                    company: companyName,
                    notification_type: 'jira_failure_alert'
                }
            };

            await sgMail.send(msg);
            context.log('✅ JIRA failure notification email sent successfully via SendGrid');
        } catch (emailError) {
            context.error(`❌ Exception sending JIRA failure notification email: ${emailError instanceof Error ? emailError.message : String(emailError)}`);
            // Don't throw - we don't want email failures to mask the original JIRA error
        }
    }
}

/**
 * Create Jira ticket via REST API (replaces webhook integration)
 */
async function createJiraTicketViaApi(
    payload: RetellAnalysisPayload,
    config: ServiceConfig,
    context: InvocationContext
): Promise<void> {
    context.log('📤 Creating Jira ticket via REST API...');

    // Validate minimum required data for IR calls (safety check - main validation already done)
    const validation = validateIrCallData(payload);
    if (!validation.valid) {
        context.log('❌ JIRA ticket creation skipped - missing required data:');
        validation.missingFields.forEach(field => context.log(`   - ${field}`));
        context.log('⚠️  JIRA ticket will NOT be created.');
        return; // Return early without throwing
    }

    context.log('✅ Minimum required data validated for JIRA ticket creation');

    const analysis = payload.analysis || payload.call_analysis?.custom_analysis_data || {};

    // Create Basic Authentication header
    const authToken = Buffer.from(`${config.jira.userEmail}:${config.jira.apiToken}`).toString('base64');
    const endpoint = `${config.jira.apiUrl}/rest/api/3/issue`;

    // Get current date/time in the format VoiceNation uses
    const now = new Date();
    const dateStr = `${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getDate().toString().padStart(2, '0')}/${now.getFullYear().toString().slice(-2)}`;
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).toLowerCase();

    // Build description with only the "Brief Description of Issue" text
    const briefDescription = getString(analysis.IR_call_description, 'No description provided');

    // Build Jira API payload with proper field structure
    // JIRA API v3 requires description in Atlassian Document Format (ADF)
    const jiraPayload = {
        fields: {
            project: {
                key: config.jira.projectKey
            },
            issuetype: {
                name: config.jira.issueType
            },
            summary: `${getString(analysis.company_name, 'Unknown Company')} - Incident ${dateStr}`,

            // Note: Request Type (customfield_10010) is NOT set explicitly - JIRA automation will handle it

            // Set custom fields explicitly
            customfield_10106: getString(analysis.company_name),  // Company
            customfield_10113: getString(analysis.caller_location),  // Location (City/State)
            customfield_10109: getString(analysis.caller_name),  // FirstLastName
            customfield_10110: getString(analysis.caller_email_address),  // Email Address
            customfield_10111: getString(analysis.caller_phone_number),  // Phone Number
            customfield_10107: { value: getYesNo(analysis.incident_liability_insurance_status) },  // CyberInsurance (radio button)
            customfield_10108: { value: getYesNo(analysis.current_customer) },  // ActiveIRContract (radio button)

            // Description field contains only the "Brief Description of Issue" text
            description: convertTextToAtlassianDocumentFormat(briefDescription)
        }
    };

    context.log(`📤 Sending Jira API request to: ${endpoint}`);
    context.log(`📋 Ticket summary: ${jiraPayload.fields.summary}`);

    let emailNotificationSent = false;

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${authToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(jiraPayload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            context.error(`❌ Jira API request failed with status ${response.status}: ${errorText}`);
            const error = new Error(`Jira API request failed: ${response.status} - ${errorText}`);
            
            // Send failure notification email (only if email is enabled)
            if (config.featureFlags.enableEmail) {
                try {
                    await sendJiraFailureNotificationEmail(payload, error, config, context);
                    emailNotificationSent = true;
                } catch (emailError) {
                    context.error(`❌ Failed to send JIRA failure notification email: ${emailError instanceof Error ? emailError.message : String(emailError)}`);
                    // Continue to throw the original JIRA error
                }
            }
            
            throw error;
        }

        const responseData: any = await response.json();
        const ticketKey = responseData.key;
        const ticketUrl = `${config.jira.apiUrl}/browse/${ticketKey}`;

        context.log(`✅ Jira ticket created successfully: ${ticketKey}`);
        context.log(`🔗 View ticket: ${ticketUrl}`);

    } catch (error) {
        context.error(`❌ Error creating Jira ticket: ${error instanceof Error ? error.message : String(error)}`);
        
        // Send failure notification email (only if email is enabled and we haven't already sent it)
        if (config.featureFlags.enableEmail && !emailNotificationSent) {
            try {
                await sendJiraFailureNotificationEmail(payload, error instanceof Error ? error : new Error(String(error)), config, context);
            } catch (emailError) {
                context.error(`❌ Failed to send JIRA failure notification email: ${emailError instanceof Error ? emailError.message : String(emailError)}`);
                // Continue to throw the original JIRA error
            }
        }
        
        throw error;
    }
}

/**
 * Build HTML email body for non-IR calls
 */
function buildNonIrHtmlEmailBody(payload: RetellAnalysisPayload): string {
    const analysis = payload.analysis || payload.call_analysis?.custom_analysis_data || {};
    const summary = payload.summary || payload.call_analysis?.call_summary || 'No summary available';

    // Build a formatted transcript HTML
    let transcriptHtml = '';
    if (payload.transcript_object && Array.isArray(payload.transcript_object) && payload.transcript_object.length > 0) {
        transcriptHtml += '<div class="transcript-container">';
        transcriptHtml += '<h3 class="transcript-header">📝 Complete Call Transcript</h3>';
        transcriptHtml += '<div class="transcript">';
        for (const turn of payload.transcript_object) {
            const role = (turn.role || 'unknown').toLowerCase();
            const isAgent = role === 'agent';
            const speaker = isAgent ? '🤖 AI Voice Agent' : '👤 Caller';
            const speakerClass = isAgent ? 'speaker-agent' : 'speaker-caller';
            const content = (turn.content || '').replace(/</g, '&lt;');
            transcriptHtml += `\n<div class="turn ${speakerClass}"><div class="speaker">${speaker}:</div><div class="utterance">${content}</div></div>`;
        }
        transcriptHtml += '\n</div>';
        transcriptHtml += '</div>';
    } else if (payload.transcript) {
        const safeTranscript = payload.transcript.replace(/</g, '&lt;').replace(/\n/g, '<br/>');
        transcriptHtml = `<div class="transcript-container"><h3 class="transcript-header">📝 Complete Call Transcript</h3><div class="transcript"><div class="utterance">${safeTranscript}</div></div></div>`;
    } else {
        transcriptHtml = '<div class="transcript-container"><h3 class="transcript-header">📝 Complete Call Transcript</h3><div class="transcript"><em>No transcript available</em></div></div>';
    }

    const htmlBody = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #1976d2; color: white; padding: 20px; text-align: center; }
                .content { background-color: #f5f5f5; padding: 20px; margin-top: 20px; }
                .links { margin-bottom: 20px; padding: 15px; background: #e3f2fd; border-radius: 6px; }
                .links-header { font-weight: bold; color: #1976d2; margin-bottom: 10px; font-size: 14px; }
                .link-button {
                    display: inline-block;
                    background: #1976d2;
                    color: #fff !important;
                    padding: 10px 16px;
                    border-radius: 4px;
                    text-decoration: none !important;
                    margin-right: 8px;
                    margin-bottom: 8px;
                    font-weight: 500;
                    border: none;
                }
                .link-button:hover { background: #1565c0; }
                .link-button:visited { color: #fff !important; }
                .transcript-container { margin-top: 25px; background: #ffffff; border: 2px solid #1976d2; border-radius: 6px; padding: 20px; }
                .transcript-header { margin: 0 0 15px 0; color: #1976d2; font-size: 18px; border-bottom: 2px solid #e0e0e0; padding-bottom: 10px; }
                .transcript { background: #fafafa; border-radius: 4px; padding: 15px; max-height: 600px; overflow-y: auto; }
                .turn { margin-bottom: 15px; padding: 10px; border-radius: 4px; }
                .speaker-agent { background: #e8f5e9; border-left: 4px solid #4caf50; }
                .speaker-caller { background: #e3f2fd; border-left: 4px solid #2196f3; }
                .speaker { font-weight: bold; margin-bottom: 6px; font-size: 14px; }
                .speaker-agent .speaker { color: #2e7d32; }
                .speaker-caller .speaker { color: #1565c0; }
                .utterance { white-space: pre-wrap; line-height: 1.5; color: #333; }
                .field { margin-bottom: 15px; }
                .label { font-weight: bold; color: #555; }
                .value { margin-top: 5px; }
                .summary-box { background-color: #e3f2fd; border-left: 4px solid #1976d2; padding: 15px; margin-top: 20px; }
                .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #777; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>📞 General Inquiry Call Summary</h1>
                </div>
                <div class="content">
                    ${payload.recording_url || payload.recording_multi_channel_url || payload.public_log_url ? `
                    <div class="links">
                        <div class="links-header">🎧 Call Recording & Resources</div>
                        <div style="margin-top: 10px;">
                            ${payload.recording_url ? `
                                <a class="link-button" href="${payload.recording_url}" target="_blank" rel="noopener noreferrer">🎵 Listen / Download Recording</a>
                            ` : ''}
                            ${payload.recording_multi_channel_url ? `
                                <a class="link-button" href="${payload.recording_multi_channel_url}" target="_blank" rel="noopener noreferrer">🎙️ Multi-channel Audio</a>
                            ` : ''}
                            ${payload.public_log_url ? `
                                <a class="link-button" href="${payload.public_log_url}" target="_blank" rel="noopener noreferrer">📋 Public Log</a>
                            ` : ''}
                        </div>
                    </div>
                    ` : ''}
                    <div class="field">
                        <div class="label">Company Name:</div>
                        <div class="value">${analysis.company_name || 'N/A'}</div>
                    </div>
                    <div class="field">
                        <div class="label">Caller Name:</div>
                        <div class="value">${analysis.caller_name || 'N/A'}</div>
                    </div>
                    <div class="field">
                        <div class="label">Caller Email:</div>
                        <div class="value">${analysis.caller_email_address || 'N/A'}</div>
                    </div>
                    <div class="field">
                        <div class="label">Caller Phone:</div>
                        <div class="value">${analysis.caller_phone_number ? String(analysis.caller_phone_number) : 'N/A'}</div>
                    </div>
                    <div class="field">
                        <div class="label">Caller Location:</div>
                        <div class="value">${analysis.caller_location || 'Not provided'}</div>
                    </div>
                    ${analysis.non_IR_inquiry_reason ? `
                    <div class="field">
                        <div class="label">Inquiry Type:</div>
                        <div class="value">${analysis.non_IR_inquiry_reason}</div>
                    </div>
                    ` : ''}
                    ${analysis.non_IR_call_description ? `
                    <div class="summary-box">
                        <strong>Description:</strong><br/>
                        ${analysis.non_IR_call_description.replace(/\n/g, '<br/>')}
                    </div>
                    ` : ''}
                    <div class="summary-box">
                        <strong>Call Summary:</strong><br/>
                        ${summary.replace(/\n/g, '<br/>')}
                    </div>
                    <div class="field">
                        <div class="label">Call ID:</div>
                        <div class="value">${payload.call_id}</div>
                    </div>
                    ${transcriptHtml}
                    <div class="footer">
                        This is an automated notification from the ProCircular Incident Response System.<br/>
                        Timestamp: ${new Date(payload.start_timestamp * 1000).toLocaleString()}
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;

    return htmlBody;
}

/**
 * Build plain text email body for non-IR calls
 */
function buildNonIrPlainTextEmail(payload: RetellAnalysisPayload): string {
    const analysis = payload.analysis || payload.call_analysis?.custom_analysis_data || {};
    const summary = payload.summary || payload.call_analysis?.call_summary || 'No summary available';

    let text = '';

    // Header
    text += '╔' + '═'.repeat(68) + '╗\n';
    text += '║' + ' '.repeat(68) + '║\n';
    text += '║' + '📞 GENERAL INQUIRY CALL SUMMARY'.padStart(50).padEnd(68) + '║\n';
    text += '║' + ' '.repeat(68) + '║\n';
    text += '╚' + '═'.repeat(68) + '╝\n\n';

    // Call Recording & Resources
    if (payload.recording_url || payload.recording_multi_channel_url || payload.public_log_url) {
        text += '─'.repeat(70) + '\n';
        text += '🎧 CALL RECORDING & RESOURCES\n';
        text += '─'.repeat(70) + '\n\n';

        if (payload.recording_url) {
            text += '🎵 Listen / Download Recording:\n';
            text += `   ${payload.recording_url}\n\n`;
        }

        if (payload.recording_multi_channel_url) {
            text += '🎙️ Multi-channel Audio:\n';
            text += `   ${payload.recording_multi_channel_url}\n\n`;
        }

        if (payload.public_log_url) {
            text += '📋 Public Log:\n';
            text += `   ${payload.public_log_url}\n\n`;
        }

        text += '─'.repeat(70) + '\n\n';
    }

    // Caller Details
    text += '─'.repeat(70) + '\n';
    text += 'CALLER INFORMATION\n';
    text += '─'.repeat(70) + '\n\n';

    text += `Company Name:     ${analysis.company_name || 'N/A'}\n`;
    text += `Caller Name:      ${analysis.caller_name || 'N/A'}\n`;
    text += `Caller Email:     ${analysis.caller_email_address || 'N/A'}\n`;
    text += `Caller Phone:     ${analysis.caller_phone_number ? String(analysis.caller_phone_number) : 'N/A'}\n`;
    text += `Caller Location:  ${analysis.caller_location || 'Not provided'}\n\n`;

    // Inquiry Details
    text += '─'.repeat(70) + '\n';
    text += 'INQUIRY DETAILS\n';
    text += '─'.repeat(70) + '\n\n';

    if (analysis.non_IR_inquiry_reason) {
        text += `Inquiry Type: ${analysis.non_IR_inquiry_reason}\n\n`;
    }

    if (analysis.non_IR_call_description) {
        text += `Description:\n${analysis.non_IR_call_description}\n\n`;
    }

    // Call Summary
    text += '─'.repeat(70) + '\n';
    text += 'CALL SUMMARY\n';
    text += '─'.repeat(70) + '\n\n';
    text += `${summary}\n\n`;

    // Call Information
    text += '─'.repeat(70) + '\n';
    text += 'CALL INFORMATION\n';
    text += '─'.repeat(70) + '\n\n';

    text += `Call ID: ${payload.call_id}\n`;

    if (payload.call_cost?.combined_cost) {
        const costInDollars = (payload.call_cost.combined_cost / 100).toFixed(3);
        const duration = payload.call_cost.total_duration_seconds || 0;
        text += `Call Cost: $${costInDollars} (${duration}s)\n`;
    }

    text += '\n';

    // Transcript
    text += buildPlainTextTranscript(payload);

    // Footer
    text += '\n\n';
    text += '─'.repeat(70) + '\n';
    text += 'This is an automated notification from the ProCircular\n';
    text += 'Incident Response System.\n\n';
    text += `Timestamp: ${new Date(payload.start_timestamp * 1000).toLocaleString()}\n`;
    text += '─'.repeat(70) + '\n';

    return text;
}

/**
 * Send non-IR email summary via SendGrid or Azure
 */
async function sendNonIrEmail(payload: RetellAnalysisPayload, config: ServiceConfig, context: InvocationContext): Promise<void> {
    context.log('Sending non-IR email summary...');
    context.log(`  Provider: ${config.emailProvider}`);
    context.log(`  Recipient: ${config.nonIrEmail.recipientEmail}`);

    // Validate minimum required data for non-IR calls (safety check - main validation already done)
    const validation = validateNonIrCallData(payload);
    if (!validation.valid) {
        context.log('❌ Non-IR email skipped - missing required data:');
        validation.missingFields.forEach(field => context.log(`   - ${field}`));
        context.log('⚠️  Email will NOT be sent.');
        return; // Return early without throwing
    }

    context.log('✅ Minimum required data validated for non-IR email');

    const analysis = payload.analysis || payload.call_analysis?.custom_analysis_data || {};
    const companyName = analysis.company_name || 'Unknown Company';

    // Build HTML and plain text email bodies
    const htmlBody = buildNonIrHtmlEmailBody(payload);
    const plainTextBody = buildNonIrPlainTextEmail(payload);

    // Support multiple recipients (comma-separated)
    const recipients = config.nonIrEmail.recipientEmail.includes(',')
        ? config.nonIrEmail.recipientEmail.split(',').map(email => email.trim())
        : [config.nonIrEmail.recipientEmail];

    context.log(`  Sending to ${recipients.length} recipient(s): ${recipients.join(', ')}`);

    if (config.emailProvider === 'azure') {
        // Send via Azure Communication Services
        const emailClient = new EmailClient(config.azureEmail.connectionString);

        const message = {
            senderAddress: config.azureEmail.senderEmailNonIr,  // Sender email for non-IR (from AZURE_COMMUNICATION_SENDER_EMAIL_NON_IR or AZURE_COMMUNICATION_SENDER_EMAIL)
            content: {
                subject: `[NON-IR] General Inquiry - ${companyName}`,
                plainText: plainTextBody,
                html: htmlBody
            },
            recipients: {
                to: recipients.map(email => ({
                    address: email.trim(),
                    displayName: email.includes('kwahlstrom') ? "ProCircular Team" : "Monitoring"
                }))
            },
            userEngagementTrackingDisabled: true
        };

        const poller = await emailClient.beginSend(message);
        const result = await poller.pollUntilDone();

        if (result.status === KnownEmailSendStatus.Succeeded) {
            context.log(`✅ Non-IR email sent successfully via Azure Communication Services to ${recipients.length} recipient(s)`);
        } else {
            throw new Error(`Azure email send failed: ${result.status}`);
        }
    } else {
        // Send via SendGrid
        sgMail.setApiKey(config.sendgrid.apiKey);

        const msg = {
            to: recipients,
            from: {
                email: config.sendgrid.fromEmailNonIr,  // FROM email for non-IR (from SENDGRID_FROM_EMAIL_NON_IR or SENDGRID_FROM_EMAIL)
                name: config.email.fromNameNonIr  // FROM name (from EMAIL_FROM_NAME_NON_IR env var)
            },
            replyTo: config.sendgrid.fromEmailNonIr,  // Reply-to uses same as FROM
            subject: `[NON-IR] General Inquiry - ${companyName}`,
            text: plainTextBody,
            html: htmlBody,
            categories: ['non-ir-inquiry', 'general-question', 'automated'],
            trackingSettings: {
                clickTracking: { enable: false, enableText: false },
                openTracking: { enable: false },
                subscriptionTracking: { enable: false }
            },
            customArgs: {
                call_id: payload.call_id,
                company: companyName,
                notification_type: 'non_ir_summary'
            }
        };

        await sgMail.send(msg);
        context.log('✅ Non-IR email sent successfully via SendGrid');
    }
}

/**
 * Main Azure Function handler for Retell AI webhook
 * Build Version: 2025-01-XX (Production Ready - Request Type Support)
 */
export async function RetellWebhookProcessor(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log('Retell AI webhook received');
    context.log('Function Version: 2025-10-27-15:25:56 | Local Build MD5: 22306599a638a2dae3cf90f587a22e0a');

    try {
        // --- START: RETELL SIGNATURE VERIFICATION ---
        const retellApiKey = process.env.RETELL_API_KEY;
        const signature = request.headers.get("x-retell-signature");

        let webhookPayload: RetellWebhookPayload;

        if (!retellApiKey) {
            context.error("CRITICAL: RETELL_API_KEY is not set. Rejecting request for security.");
            return {
                status: 500,
                jsonBody: { success: false, error: "Server configuration error." }
            };
        }

        if (!signature) {
            context.warn("Missing 'x-retell-signature' header. RetellAI may not be configured to send it. Rejecting request.");
            return {
                status: 400,
                jsonBody: { success: false, error: "Missing x-retell-signature header." }
            };
        } else {
            // Must read the body as raw text for verification
            const rawBody = await request.text();

            // Log for debugging (first 100 chars of body and signature)
            context.log(`DEBUG: Body length: ${rawBody.length}, Body preview: ${rawBody.substring(0, 100)}`);
            context.log(`DEBUG: Signature: ${signature.substring(0, 20)}...`);
            context.log(`DEBUG: API Key (first 10): ${retellApiKey.substring(0, 10)}...`);

            if (!Retell.verify(rawBody, retellApiKey, signature)) {
                context.error("❌ Invalid Retell signature. Rejecting request.");
                context.error(`DEBUG: Verification failed with key starting: ${retellApiKey.substring(0, 15)}`);
                return {
                    status: 401,
                    jsonBody: { success: false, error: "Invalid signature." }
                };
            }
            context.log("✅ Retell signature verified successfully.");

            // IMPORTANT: Parse the JSON *after* verifying the raw string
            webhookPayload = JSON.parse(rawBody);
        }
        // --- END: RETELL SIGNATURE VERIFICATION ---

        // --- START: EVENT TYPE FILTERING ---
        // RetellAI sends 3 event types: call_started, call_ended, call_analyzed
        // We ONLY process call_analyzed events (which contain the analysis data)
        const eventType = webhookPayload.event;

        if (eventType !== 'call_analyzed') {
            context.log(`Ignoring ${eventType} event for call ID: ${webhookPayload.call?.call_id || 'unknown'}`);
            return {
                status: 200,
                jsonBody: {
                    success: true,
                    message: `Event type ${eventType} acknowledged but not processed`
                }
            };
        }
        // --- END: EVENT TYPE FILTERING ---

        // Extract the actual call object from the webhook envelope
        const payload: RetellAnalysisPayload = webhookPayload.call;

        context.log(`Processing call_analyzed event for call ID: ${payload.call_id}`);

        // --- START: DETAILED PAYLOAD LOGGING ---
        // Log the complete webhook payload to see exactly what RetellAI sends
        context.log('=== COMPLETE WEBHOOK PAYLOAD ===');
        context.log(JSON.stringify(webhookPayload, null, 2));
        context.log('=== END WEBHOOK PAYLOAD ===');

        // Log specific data extraction paths
        context.log('Data extraction check:');
        context.log(`  - payload.analysis exists: ${!!payload.analysis}`);
        context.log(`  - payload.call_analysis exists: ${!!payload.call_analysis}`);
        context.log(`  - payload.call_analysis?.custom_analysis_data exists: ${!!payload.call_analysis?.custom_analysis_data}`);

        if (payload.call_analysis?.custom_analysis_data) {
            context.log('  - custom_analysis_data contents:');
            context.log(JSON.stringify(payload.call_analysis.custom_analysis_data, null, 2));
        }
        // --- END: DETAILED PAYLOAD LOGGING ---

        const analysis = payload.analysis || payload.call_analysis?.custom_analysis_data || {};
        context.log(`Company: ${analysis.company_name || 'Unknown'}, Caller: ${analysis.caller_name || 'Unknown'}`);
        context.log(`IR Description: ${analysis.IR_call_description || 'Not provided'}`);
        context.log(`Non-IR Description: ${analysis.non_IR_call_description || 'Not provided'}`);

        // Load configuration from environment variables
        const config = loadConfiguration();

        // Determine call type
        const isIr = isIrCall(payload);
        const isNonIr = isNonIrCall(payload);

        context.log(`Call type determination:`);
        context.log(`  - IR Call: ${isIr ? 'YES' : 'NO'}`);
        context.log(`  - Non-IR Call: ${isNonIr ? 'YES' : 'NO'}`);

        // Log which notification channels are enabled
        context.log('Notification channels status:');
        context.log(`  - Email: ${config.featureFlags.enableEmail ? 'ENABLED' : 'DISABLED'}`);
        context.log(`  - Teams: ${config.featureFlags.enableTeams ? 'ENABLED' : 'DISABLED'}`);
        context.log(`  - SMS: ${config.featureFlags.enableSms ? 'ENABLED' : 'DISABLED'}`);
        context.log(`  - Jira: ${config.featureFlags.enableJira ? 'ENABLED' : 'DISABLED'}`);

        // Build array of notification tasks based on call type
        const notificationTasks: Promise<void>[] = [];
        let callType = 'unknown';
        let results: PromiseSettledResult<void>[] = [];

        if (isIr) {
            // IR CALL WORKFLOW
            callType = 'IR';
            context.log('🚨 Processing as IR (Incident Response) call');

            // Validate minimum required data before processing
            const irValidation = validateIrCallData(payload);
            if (!irValidation.valid) {
                context.log('❌ IR call processing ABORTED - missing required data:');
                irValidation.missingFields.forEach(field => context.log(`   - ${field}`));
                context.log('⚠️  No JIRA ticket will be created. No email will be sent.');
                
                return {
                    status: 200,
                    jsonBody: {
                        success: false,
                        message: 'IR call processing skipped - missing required data',
                        missingFields: irValidation.missingFields,
                        call_id: payload.call_id
                    }
                };
            }

            context.log('✅ IR call validation passed - minimum required data present');

            // Add Jira ticket creation for IR calls
            if (config.featureFlags.enableJira) {
                context.log('Adding Jira ticket creation to queue...');
                notificationTasks.push(createJiraTicketViaApi(payload, config, context).catch(error => {
                    context.error(`JIRA ticket creation failed: ${error.message}`);
                    throw error;
                }));
            }

            // Add IR alert email
            if (config.featureFlags.enableEmail) {
                context.log('Adding IR alert email to queue...');
                notificationTasks.push(sendEmail(payload, config, context).catch(error => {
                    context.error(`IR email send failed: ${error.message}`);
                    throw error;
                }));
            }

            // Add Teams notification
            if (config.featureFlags.enableTeams) {
                context.log('Adding Teams notification to queue...');
                notificationTasks.push(sendTeamsMessage(payload, config, context));
            }

            // Add SMS alert
            if (config.featureFlags.enableSms) {
                context.log('Adding SMS notification to queue...');
                notificationTasks.push(sendSms(payload, config, context));
            }

        } else if (isNonIr) {
            // NON-IR CALL WORKFLOW
            callType = 'NON-IR';
            context.log('📞 Processing as Non-IR (General Inquiry) call');

            // Validate minimum required data before processing
            const nonIrValidation = validateNonIrCallData(payload);
            if (!nonIrValidation.valid) {
                context.log('❌ Non-IR call processing ABORTED - missing required data:');
                nonIrValidation.missingFields.forEach(field => context.log(`   - ${field}`));
                context.log('⚠️  No email will be sent.');
                
                return {
                    status: 200,
                    jsonBody: {
                        success: false,
                        message: 'Non-IR call processing skipped - missing required data',
                        missingFields: nonIrValidation.missingFields,
                        call_id: payload.call_id
                    }
                };
            }

            context.log('✅ Non-IR call validation passed - minimum required data present');

            // Only send non-IR email summary (no Jira, Teams, or SMS)
            context.log('Adding non-IR email summary to queue...');
            notificationTasks.push(sendNonIrEmail(payload, config, context).catch(error => {
                context.error(`Non-IR email send failed: ${error.message}`);
                throw error;
            }));

        } else {
            // UNCLASSIFIED CALL - Default to IR workflow for safety
            callType = 'UNCLASSIFIED (defaulting to IR)';
            context.log('⚠️  WARNING: Call type could not be determined. Defaulting to IR workflow for safety.');

            // Default to IR workflow
            if (config.featureFlags.enableJira) {
                context.log('Adding Jira ticket creation to queue (default)...');
                notificationTasks.push(createJiraTicketViaApi(payload, config, context));
            }

            if (config.featureFlags.enableEmail) {
                context.log('Adding IR alert email to queue (default)...');
                notificationTasks.push(sendEmail(payload, config, context));
            }

            if (config.featureFlags.enableTeams) {
                context.log('Adding Teams notification to queue (default)...');
                notificationTasks.push(sendTeamsMessage(payload, config, context));
            }

            if (config.featureFlags.enableSms) {
                context.log('Adding SMS notification to queue (default)...');
                notificationTasks.push(sendSms(payload, config, context));
            }
        }

        // Execute notification tasks in parallel with resilient error handling
        if (notificationTasks.length > 0) {
            context.log(`Triggering ${notificationTasks.length} notification(s) in parallel...`);

            // Use Promise.allSettled to allow partial success
            results = await Promise.allSettled(notificationTasks);

            // Count successes and failures
            const successes = results.filter(r => r.status === 'fulfilled');
            const failures = results.filter(r => r.status === 'rejected');

            // Log results
            context.log(`✅ ${successes.length}/${notificationTasks.length} notification(s) sent successfully`);

            if (failures.length > 0) {
                context.warn(`⚠️  ${failures.length} notification(s) failed:`);
                failures.forEach((failure, index) => {
                    if (failure.status === 'rejected') {
                        context.error(`  - Notification ${index + 1}: ${failure.reason}`);
                    }
                });
            }
        } else {
            context.log('WARNING: No notification channels are enabled. No notifications will be sent.');
        }

        // Build notification status summary
        const notificationStatus = notificationTasks.length > 0 ? {
            total: notificationTasks.length,
            successful: results ? results.filter(r => r.status === 'fulfilled').length : 0,
            failed: results ? results.filter(r => r.status === 'rejected').length : 0
        } : { total: 0, successful: 0, failed: 0 };

        return {
            status: 200,
            jsonBody: {
                success: true,
                message: 'Webhook processed successfully',
                call_id: payload.call_id,
                call_type: callType,
                notifications_attempted: {
                    jira: isIr && config.featureFlags.enableJira,
                    email: (isIr && config.featureFlags.enableEmail) || isNonIr,
                    teams: isIr && config.featureFlags.enableTeams,
                    sms: isIr && config.featureFlags.enableSms
                },
                notification_results: notificationStatus
            }
        };

    } catch (error) {
        context.error('Error processing webhook:', error);

        return {
            status: 500,
            jsonBody: {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            }
        };
    }
}

// Register the function with Azure Functions runtime
// Note: Using 'anonymous' auth level because RetellAI uses signature verification for security
app.http('RetellWebhookProcessor', {
    methods: ['POST'],
    authLevel: 'anonymous',  // RetellAI webhooks use signature verification, not function keys
    handler: RetellWebhookProcessor
});
