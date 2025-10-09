# Feature Flags - Notification Channel Control

This document describes the feature flag system for controlling notification channels in the Retell AI Webhook Processor.

## Overview

The Azure Function supports granular control over which notification channels are active through environment variable-based feature flags. This allows you to:

- **Test individual channels** without modifying code
- **Disable problematic channels** in production without redeployment
- **Gradually roll out channels** as services are configured
- **Reduce costs** by disabling unused channels
- **Debug issues** by isolating specific notification types

## Feature Flags

### Available Flags

| Environment Variable | Description | Default | Required Services |
|---------------------|-------------|---------|-------------------|
| `ENABLE_EMAIL_NOTIFICATIONS` | Enable/disable SendGrid email notifications | `false` | SendGrid API key, sender email, recipient email |
| `ENABLE_TEAMS_NOTIFICATIONS` | Enable/disable Microsoft Teams notifications | `false` | Teams webhook URL |
| `ENABLE_SMS_NOTIFICATIONS` | Enable/disable Twilio SMS notifications | `false` | Twilio account SID, auth token, phone numbers |

### Flag Values

- **`"true"`** - Enable the notification channel (case-insensitive)
- **`"false"`** or **omitted** - Disable the notification channel (fail-safe default)

## Configuration

### Local Development

Edit `local.settings.json`:

```json
{
  "Values": {
    "ENABLE_EMAIL_NOTIFICATIONS": "true",
    "ENABLE_TEAMS_NOTIFICATIONS": "false",
    "ENABLE_SMS_NOTIFICATIONS": "false"
  }
}
```

### Azure Production

Set via Azure CLI:

```bash
az functionapp config appsettings set \
  --name procircular-ir-webhook \
  --resource-group ProCircularIR-RG \
  --settings \
    "ENABLE_EMAIL_NOTIFICATIONS=true" \
    "ENABLE_TEAMS_NOTIFICATIONS=true" \
    "ENABLE_SMS_NOTIFICATIONS=true"
```

Or via Azure Portal:
1. Navigate to Function App → Configuration
2. Add/edit Application Settings
3. Save and restart the function app

## Behavior

### Conditional Validation

The function only validates environment variables for **enabled** channels:

- If `ENABLE_EMAIL_NOTIFICATIONS=true`, requires: `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `IRT_EMAIL_ADDRESS`
- If `ENABLE_TEAMS_NOTIFICATIONS=true`, requires: `TEAMS_WEBHOOK_URL`
- If `ENABLE_SMS_NOTIFICATIONS=true`, requires: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `ONCALL_PHONE_NUMBER`

**Benefit:** You don't need to configure credentials for disabled channels.

### Execution Flow

1. Function receives webhook from Retell AI
2. Loads configuration and reads feature flags
3. Logs which channels are enabled/disabled
4. Builds array of enabled notification tasks
5. Executes only enabled tasks in parallel
6. Returns success with notification status

### Response Format

The function response includes which notifications were sent:

```json
{
  "success": true,
  "message": "Webhook processed successfully",
  "call_id": "584f904a8cda77eb733224",
  "notifications_sent": {
    "email": true,
    "teams": false,
    "sms": false
  }
}
```

### Logging

The function logs the status of each channel:

```
Notification channels status:
  - Email: ENABLED
  - Teams: DISABLED
  - SMS: DISABLED
Adding email notification to queue...
Triggering 1 notification(s) in parallel...
All enabled notifications sent successfully
```

### No Channels Enabled

If all channels are disabled, the function:
- Logs a warning: `WARNING: No notification channels are enabled. No notifications will be sent.`
- Still returns HTTP 200 (success)
- Includes notification status in response

This is **not considered an error** - it's valid configuration for testing or maintenance scenarios.

## Use Cases

### 1. Testing Individual Channels

Test only email notifications:

```json
{
  "ENABLE_EMAIL_NOTIFICATIONS": "true",
  "ENABLE_TEAMS_NOTIFICATIONS": "false",
  "ENABLE_SMS_NOTIFICATIONS": "false"
}
```

### 2. Production Rollout

Start with email only, then add Teams:

**Phase 1:**
```json
{
  "ENABLE_EMAIL_NOTIFICATIONS": "true",
  "ENABLE_TEAMS_NOTIFICATIONS": "false",
  "ENABLE_SMS_NOTIFICATIONS": "false"
}
```

**Phase 2:**
```json
{
  "ENABLE_EMAIL_NOTIFICATIONS": "true",
  "ENABLE_TEAMS_NOTIFICATIONS": "true",
  "ENABLE_SMS_NOTIFICATIONS": "false"
}
```

**Phase 3 (Full Production):**
```json
{
  "ENABLE_EMAIL_NOTIFICATIONS": "true",
  "ENABLE_TEAMS_NOTIFICATIONS": "true",
  "ENABLE_SMS_NOTIFICATIONS": "true"
}
```

### 3. Emergency Disable

If Teams webhook is broken, disable it without redeployment:

```bash
az functionapp config appsettings set \
  --name procircular-ir-webhook \
  --resource-group ProCircularIR-RG \
  --settings "ENABLE_TEAMS_NOTIFICATIONS=false"
```

The function will continue working with email and SMS only.

### 4. Cost Optimization

Disable SMS to reduce Twilio costs during testing:

```json
{
  "ENABLE_EMAIL_NOTIFICATIONS": "true",
  "ENABLE_TEAMS_NOTIFICATIONS": "true",
  "ENABLE_SMS_NOTIFICATIONS": "false"
}
```

### 5. Debugging

Isolate a failing channel by disabling others:

```json
{
  "ENABLE_EMAIL_NOTIFICATIONS": "false",
  "ENABLE_TEAMS_NOTIFICATIONS": "true",
  "ENABLE_SMS_NOTIFICATIONS": "false"
}
```

## Testing

### Test with All Channels Enabled

```bash
# Set all flags to true in local.settings.json
npm start

# Test
curl -X POST http://localhost:7071/api/RetellWebhookProcessor \
  -H "Content-Type: application/json" \
  -d @test-payload.json
```

Expected: Email, Teams card, and SMS all sent.

### Test with Only Email Enabled

```bash
# Set ENABLE_EMAIL_NOTIFICATIONS=true, others false
npm start

# Test
curl -X POST http://localhost:7071/api/RetellWebhookProcessor \
  -H "Content-Type: application/json" \
  -d @test-payload.json
```

Expected: Only email sent, no Teams or SMS.

### Test with No Channels Enabled

```bash
# Set all flags to false
npm start

# Test
curl -X POST http://localhost:7071/api/RetellWebhookProcessor \
  -H "Content-Type: application/json" \
  -d @test-payload.json
```

Expected: HTTP 200 response, warning in logs, no notifications sent.

## Best Practices

### 1. Start Conservative

Begin with only one channel enabled and verify it works before enabling others.

### 2. Document Changes

When changing feature flags in production, document:
- What was changed
- Why it was changed
- When it was changed
- Who changed it

### 3. Monitor Logs

After changing flags, monitor function logs to verify:
- Correct channels are enabled/disabled
- No unexpected errors
- Expected notifications are sent

### 4. Test Before Production

Always test flag changes locally before applying to production.

### 5. Use for Maintenance

During service maintenance (e.g., Teams webhook migration), temporarily disable the affected channel.

## Troubleshooting

### Issue: "Missing required environment variables for enabled features"

**Cause:** A channel is enabled but its required credentials are not configured.

**Solution:** Either:
- Disable the channel: Set flag to `"false"`
- Configure the credentials: Add the required environment variables

### Issue: No notifications sent but no error

**Cause:** All channels are disabled.

**Solution:** Enable at least one channel by setting its flag to `"true"`.

### Issue: Function returns 500 error

**Cause:** An enabled channel has invalid credentials or the service is unavailable.

**Solution:** 
1. Check function logs for specific error
2. Verify credentials for enabled channels
3. Temporarily disable the failing channel
4. Fix the underlying issue
5. Re-enable the channel

### Issue: Wrong channels are active

**Cause:** Flag values are case-sensitive or have extra spaces.

**Solution:** Ensure flags are exactly `"true"` (lowercase, no spaces).

## Migration Guide

### Upgrading from Previous Version

If you're upgrading from a version without feature flags:

1. **Add the three new environment variables** to your configuration:
   ```bash
   ENABLE_EMAIL_NOTIFICATIONS=true
   ENABLE_TEAMS_NOTIFICATIONS=true
   ENABLE_SMS_NOTIFICATIONS=true
   ```

2. **Redeploy the function** with the updated code

3. **Verify all channels work** as before

4. **Adjust flags** as needed for your use case

### Default Behavior Change

**Previous version:** All channels always active (if configured)

**New version:** All channels disabled by default (fail-safe)

**To maintain previous behavior:** Set all three flags to `"true"`

## Security Considerations

- Feature flags are **not** sensitive data and can be logged
- Disabled channels don't require credentials, reducing attack surface
- Flags don't bypass authentication - function key still required
- Changing flags doesn't expose any secrets

## Performance Impact

- **Minimal overhead:** Flag checks are simple boolean comparisons
- **Improved performance:** Disabled channels skip API calls entirely
- **Parallel execution:** Enabled channels still execute in parallel
- **No latency increase:** Configuration loading is fast

## Future Enhancements

Potential future improvements:

- Per-incident channel selection based on severity
- Time-based channel activation (e.g., SMS only during business hours)
- Retry logic for failed channels
- Channel-specific rate limiting
- Dynamic channel selection via webhook payload

---

**Last Updated:** 2025-10-08
**Version:** 1.1.0 (Feature Flags)

