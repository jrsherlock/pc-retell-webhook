import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import sgMail from "@sendgrid/mail";
import twilio from "twilio";

/**
 * TypeScript interface for the Retell AI call_analyzed webhook payload
 */
interface RetellAnalysisPayload {
    call_id: string;
    agent_id: string;
    start_timestamp: number;
    end_timestamp: number;
    transcript: string;
    summary: string;
    analysis: {
        incident_liability_insurance_status?: string;
        caller_name?: string;
        incident_is_customer_primary_contact?: string;
        current_customer?: string;
        cybersecurity_insurance_provider_name?: string;
        non_IR_inquiry_reason?: string;
        caller_email_address?: string;
        company_name?: string;
        caller_phone_number?: string;
        IR_call_description?: string;
    };
    metadata?: Record<string, any>;
}

/**
 * Configuration object for all external service credentials
 */
interface ServiceConfig {
    sendgrid: {
        apiKey: string;
        fromEmail: string;
        toEmail: string;
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
    featureFlags: {
        enableEmail: boolean;
        enableTeams: boolean;
        enableSms: boolean;
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

    // Build list of required environment variables based on enabled features
    const requiredEnvVars: string[] = [];

    if (enableEmail) {
        requiredEnvVars.push('SENDGRID_API_KEY', 'SENDGRID_FROM_EMAIL', 'IRT_EMAIL_ADDRESS');
    }

    if (enableTeams) {
        requiredEnvVars.push('TEAMS_WEBHOOK_URL');
    }

    if (enableSms) {
        requiredEnvVars.push('TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER', 'ONCALL_PHONE_NUMBER');
    }

    // Validate that required variables for enabled features are present
    const missing = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables for enabled features: ${missing.join(', ')}`);
    }

    return {
        sendgrid: {
            apiKey: process.env.SENDGRID_API_KEY || '',
            fromEmail: process.env.SENDGRID_FROM_EMAIL || '',
            toEmail: process.env.IRT_EMAIL_ADDRESS || ''
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
        featureFlags: {
            enableEmail,
            enableTeams,
            enableSms
        }
    };
}

/**
 * Send formatted email notification via SendGrid
 */
async function sendEmail(payload: RetellAnalysisPayload, config: ServiceConfig, context: InvocationContext): Promise<void> {
    context.log('Sending email notification...');

    sgMail.setApiKey(config.sendgrid.apiKey);

    const { analysis } = payload;
    const companyName = analysis.company_name || 'Unknown Company';

    const htmlBody = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #d32f2f; color: white; padding: 20px; text-align: center; }
                .content { background-color: #f5f5f5; padding: 20px; margin-top: 20px; }
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
                        <div class="value">${analysis.caller_phone_number || 'N/A'}</div>
                    </div>
                    <div class="field">
                        <div class="label">Current Customer:</div>
                        <div class="value">${analysis.current_customer === 'true' ? 'Yes' : 'No'}</div>
                    </div>
                    <div class="field">
                        <div class="label">Primary Contact:</div>
                        <div class="value">${analysis.incident_is_customer_primary_contact === 'true' ? 'Yes' : 'No'}</div>
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
                        <div class="value">${payload.summary}</div>
                    </div>
                </div>
                <div class="footer">
                    <p>This is an automated notification from the ProCircular Incident Response System.</p>
                    <p>Timestamp: ${new Date(payload.start_timestamp * 1000).toLocaleString()}</p>
                </div>
            </div>
        </body>
        </html>
    `;

    const msg = {
        to: config.sendgrid.toEmail,
        from: config.sendgrid.fromEmail,
        subject: `New Cybersecurity Incident Reported: ${companyName}`,
        html: htmlBody
    };

    await sgMail.send(msg);
    context.log('Email sent successfully');
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
 * Main Azure Function handler for Retell AI webhook
 */
export async function RetellWebhookProcessor(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log('Retell AI webhook received');

    try {
        // Parse the incoming JSON payload
        const payload: RetellAnalysisPayload = await request.json() as RetellAnalysisPayload;

        context.log(`Processing call_analyzed event for call ID: ${payload.call_id}`);
        context.log(`Company: ${payload.analysis.company_name}, Caller: ${payload.analysis.caller_name}`);

        // Load configuration from environment variables
        const config = loadConfiguration();

        // Log which notification channels are enabled
        context.log('Notification channels status:');
        context.log(`  - Email: ${config.featureFlags.enableEmail ? 'ENABLED' : 'DISABLED'}`);
        context.log(`  - Teams: ${config.featureFlags.enableTeams ? 'ENABLED' : 'DISABLED'}`);
        context.log(`  - SMS: ${config.featureFlags.enableSms ? 'ENABLED' : 'DISABLED'}`);

        // Build array of enabled notification tasks
        const notificationTasks: Promise<void>[] = [];

        if (config.featureFlags.enableEmail) {
            context.log('Adding email notification to queue...');
            notificationTasks.push(sendEmail(payload, config, context));
        }

        if (config.featureFlags.enableTeams) {
            context.log('Adding Teams notification to queue...');
            notificationTasks.push(sendTeamsMessage(payload, config, context));
        }

        if (config.featureFlags.enableSms) {
            context.log('Adding SMS notification to queue...');
            notificationTasks.push(sendSms(payload, config, context));
        }

        // Execute enabled notification tasks in parallel
        if (notificationTasks.length > 0) {
            context.log(`Triggering ${notificationTasks.length} notification(s) in parallel...`);
            await Promise.all(notificationTasks);
            context.log('All enabled notifications sent successfully');
        } else {
            context.log('WARNING: No notification channels are enabled. No notifications will be sent.');
        }

        return {
            status: 200,
            jsonBody: {
                success: true,
                message: 'Webhook processed successfully',
                call_id: payload.call_id,
                notifications_sent: {
                    email: config.featureFlags.enableEmail,
                    teams: config.featureFlags.enableTeams,
                    sms: config.featureFlags.enableSms
                }
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
app.http('RetellWebhookProcessor', {
    methods: ['POST'],
    authLevel: 'function',
    handler: RetellWebhookProcessor
});
