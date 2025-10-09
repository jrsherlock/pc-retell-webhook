# NPM Scripts Reference

Quick reference for all available npm scripts in this project.

## Development Scripts

### `npm run dev`
**Full development workflow** - Clean, build, and start the function in one command.

```bash
npm run dev
```

**What it does:**
1. Removes the `dist/` folder
2. Compiles TypeScript to JavaScript
3. Starts the Azure Functions local runtime

**Use when:** Starting development or after making code changes

---

### `npm start`
**Start the function** (with automatic clean and build).

```bash
npm start
```

**What it does:**
1. Runs `prestart` hook (clean + build)
2. Starts the Azure Functions local runtime

**Use when:** Starting the function after dependencies are installed

---

### `npm run build`
**Compile TypeScript** to JavaScript.

```bash
npm run build
```

**What it does:**
- Runs `tsc` to compile TypeScript files
- Outputs to `dist/` folder

**Use when:** You want to compile without starting the function

---

### `npm run watch`
**Watch mode** - Automatically recompile on file changes.

```bash
npm run watch
```

**What it does:**
- Runs `tsc -w` to watch for file changes
- Automatically recompiles when you save files

**Use when:** Developing and want automatic compilation (run in separate terminal)

---

### `npm run clean`
**Remove compiled files**.

```bash
npm run clean
```

**What it does:**
- Removes the `dist/` folder

**Use when:** You want a fresh build or troubleshooting build issues

---

## Testing Scripts

### `npm test`
**Run tests** (placeholder for now).

```bash
npm test
```

**Current status:** Placeholder - no tests implemented yet

**Future:** Will run unit tests when implemented

---

### `npm run test:flags`
**Interactive feature flags test**.

```bash
npm run test:flags
```

**What it does:**
- Runs the `test-feature-flags.sh` script
- Guides you through testing different feature flag combinations

**Use when:** Testing feature flags functionality

---

## Deployment Scripts

### `npm run deploy`
**Deploy to Azure**.

```bash
npm run deploy
```

**What it does:**
1. Builds the project
2. Deploys to Azure Function App: `procircular-ir-webhook`

**Prerequisites:**
- Azure CLI installed and logged in
- Function App created in Azure
- Correct permissions

**Use when:** Deploying to production

---

### `npm run logs`
**Stream Azure logs**.

```bash
npm run logs
```

**What it does:**
- Streams real-time logs from Azure Function App: `procircular-ir-webhook`

**Prerequisites:**
- Azure CLI installed and logged in
- Function App deployed

**Use when:** Monitoring production function

---

## Common Workflows

### First Time Setup
```bash
npm install
cp local.settings.json.template local.settings.json
# Edit local.settings.json with your credentials
npm run dev
```

### Daily Development
```bash
# Terminal 1: Watch for changes
npm run watch

# Terminal 2: Start function
func start

# Or use single command:
npm run dev
```

### Testing Feature Flags
```bash
# Edit local.settings.json to change flags
npm run dev

# In another terminal:
curl -X POST http://localhost:7071/api/RetellWebhookProcessor \
  -H "Content-Type: application/json" \
  -d @test-payload.json
```

### Deploy to Azure
```bash
# First time: Create Azure resources (see DEPLOYMENT_CHECKLIST.md)

# Deploy
npm run deploy

# Monitor logs
npm run logs
```

### Troubleshooting Build Issues
```bash
npm run clean
npm install
npm run build
```

---

## Script Details

| Script | Command | Description |
|--------|---------|-------------|
| `build` | `tsc` | Compile TypeScript |
| `watch` | `tsc -w` | Watch mode compilation |
| `clean` | `rimraf dist` | Remove dist folder |
| `prestart` | `npm run clean && npm run build` | Auto-runs before start |
| `start` | `func start` | Start Azure Functions |
| `dev` | `npm run clean && npm run build && func start` | Full dev workflow |
| `test` | `echo "No tests yet..."` | Run tests (placeholder) |
| `test:flags` | `./test-feature-flags.sh` | Test feature flags |
| `deploy` | `npm run build && func azure functionapp publish procircular-ir-webhook` | Deploy to Azure |
| `logs` | `func azure functionapp logstream procircular-ir-webhook` | Stream Azure logs |

---

## Environment Variables

All scripts respect environment variables from `local.settings.json`:

- `ENABLE_EMAIL_NOTIFICATIONS`
- `ENABLE_TEAMS_NOTIFICATIONS`
- `ENABLE_SMS_NOTIFICATIONS`
- `SENDGRID_API_KEY`
- `SENDGRID_FROM_EMAIL`
- `IRT_EMAIL_ADDRESS`
- `TEAMS_WEBHOOK_URL`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`
- `ONCALL_PHONE_NUMBER`

See `.env.example` or `local.settings.json.template` for details.

---

## Tips

### Speed Up Development
Use watch mode in one terminal and manually start the function in another:

```bash
# Terminal 1
npm run watch

# Terminal 2
func start
```

This avoids rebuilding on every start.

### Quick Test
```bash
# Start function
npm run dev

# In another terminal, test
curl -X POST http://localhost:7071/api/RetellWebhookProcessor \
  -H "Content-Type: application/json" \
  -d @test-payload.json | jq .
```

### View Available Scripts
```bash
npm run
```

### Update Dependencies
```bash
npm update
npm audit fix
```

---

## Troubleshooting

### "Missing script: dev"
**Solution:** Pull latest changes or manually add scripts to `package.json`

### "func: command not found"
**Solution:** Install Azure Functions Core Tools
```bash
brew install azure-functions-core-tools@4
```

### "Cannot find module"
**Solution:** Reinstall dependencies
```bash
rm -rf node_modules package-lock.json
npm install
```

### Build errors
**Solution:** Clean and rebuild
```bash
npm run clean
npm run build
```

### Port already in use
**Solution:** Kill existing process
```bash
lsof -ti:7071 | xargs kill -9
npm run dev
```

---

**Last Updated:** 2025-10-09

