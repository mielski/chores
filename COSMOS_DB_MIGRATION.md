# Cosmos DB Migration Guide

## Overview

Your household tracker app has been updated to use Azure Cosmos DB for persistent storage. This eliminates the file loss issues you were experiencing when containers restart.

## What Changed

### 1. New Files
- **`src/cosmosdb_manager.py`** - Cosmos DB storage manager with the same interface as file-based storage
- **`COSMOS_DB_MIGRATION.md`** - This guide

### 2. Modified Files
- **`src/requirements.txt`** - Added `azure-cosmos==4.7.0`
- **`src/app.py`** - Added conditional logic to use Cosmos DB when configured
- **`infra/main.bicep`** - Added Cosmos DB account with serverless pricing
- **`docker-compose.yml`** - Added optional Cosmos DB environment variables

## Cost Estimate

Based on your usage pattern (~2 users, 20-50 task updates/day):

- **Monthly Request Units**: ~100,000 RUs
- **Storage**: ~0.01 GB
- **Total Cost**: **$0.03 - $0.05 per month** 🎉

Even with 10x usage: **~$0.50/month**

## Deployment Instructions

### Step 1: Deploy Infrastructure

From your project root, run:

```powershell
az deployment group create `
  --resource-group <your-resource-group> `
  --template-file infra/main.bicep `
  --parameters environmentName=household-tracker
```

This will create:
- ✅ Cosmos DB account (serverless)
- ✅ Database: `household-tracker`
- ✅ Containers: `configurations` and `task-states`

### Step 2: Get Cosmos DB Connection Info

The deployment outputs will include:
- `AZURE_COSMOS_DB_ENDPOINT`
- Cosmos DB key is automatically injected as a secret

### Step 3: Build and Push New Image

```bash
./build-and-push.sh
```

This will:
- Build image with new dependencies
- Push to Docker Hub with commit tag and `:latest`

### Step 4: Update Container App

The Bicep template automatically configures these environment variables:
- `USE_COSMOS_DB=true`
- `COSMOS_ENDPOINT=<your-endpoint>`
- `COSMOS_KEY=<secret-from-cosmos>`

After deployment, the Container App will automatically use Cosmos DB.

### Step 5: Migrate Existing Data (Optional)

If you want to preserve your current configuration and state:

1. **Export current data** (before deploying):
   ```powershell
   # Download from running container
   docker cp household-tracker:/app/data/task_config.json ./backup_config.json
   docker cp household-tracker:/app/data/household_state.json ./backup_state.json
   ```

2. **Import to Cosmos DB** (after deploying):
   ```python
   # Run this Python script locally with your Cosmos DB credentials
   import json
   from cosmosdb_manager import create_cosmos_managers
   import os
   
   # Set your Cosmos DB credentials
   os.environ['COSMOS_ENDPOINT'] = '<your-endpoint>'
   os.environ['COSMOS_KEY'] = '<your-key>'
   
   # Create managers
   config_manager, state_manager = create_cosmos_managers(user_id="household")
   
   # Load and save config
   with open('backup_config.json') as f:
       config = json.load(f)
   config_manager.save(config)
   
   # Load and save state
   with open('backup_state.json') as f:
       state = json.load(f)
   state_manager.save(state)
   
   print("✅ Data migrated successfully!")
   ```

## Local Development

### Option 1: Continue Using File-Based Storage (Default)

Your local development with `docker-compose` will continue to use file-based storage by default. No changes needed.

### Option 2: Test with Cosmos DB Locally

1. **Use Cosmos DB Emulator** (Windows only):
   - Install from: https://aka.ms/cosmosdb-emulator
   - Default endpoint: `https://localhost:8081`
   - Default key: `C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==`

2. **Update `.env` file**:
   ```env
   USE_COSMOS_DB=true
   COSMOS_ENDPOINT=https://localhost:8081
   COSMOS_KEY=C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==
   ```

3. **Uncomment Cosmos variables in `docker-compose.yml`**:
   ```yaml
   environment:
     - USE_COSMOS_DB=true
     - COSMOS_ENDPOINT=${COSMOS_ENDPOINT}
     - COSMOS_KEY=${COSMOS_KEY}
   ```

### Option 3: Test with Production Cosmos DB

Use your production Cosmos DB credentials in `.env` (but with a different user_id if desired).

## How It Works

### Automatic Fallback
The app automatically falls back to file-based storage if:
- `USE_COSMOS_DB` is not set or is `false`
- Cosmos DB credentials are missing
- Connection to Cosmos DB fails

### Storage Structure

**Configurations Container:**
```json
{
  "id": "config",
  "userId": "household",
  "data": {
    "users": {...},
    "generalTasks": [...],
    "personalTasks": [...],
    "messages": [...]
  }
}
```

**Task States Container:**
```json
{
  "id": "state",
  "userId": "household",
  "data": {
    "milou": [false, true, ...],
    "luca": [false, false, ...],
    "general": [true, false, ...]
  }
}
```

## Benefits

✅ **No more data loss** - Survives container restarts  
✅ **Automatic backups** - 7-day continuous backup included  
✅ **Extremely cheap** - ~$0.05/month for your usage  
✅ **Scalable** - Can handle growth without code changes  
✅ **Multi-region ready** - Easy to expand globally if needed  
✅ **Better performance** - Single-digit millisecond latency  

## Troubleshooting

### Check Storage Mode
Visit: `http://localhost:8080/api/health` or your production URL

Check the logs for:
- ✅ `Cosmos DB storage initialized successfully` - Using Cosmos DB
- ⚠️ `Using file-based storage` - Using local files

### View Cosmos DB Data
1. Go to Azure Portal
2. Navigate to your Cosmos DB account
3. Open "Data Explorer"
4. Expand `household-tracker` → containers → items

### Common Issues

**ImportError: azure-cosmos not installed**
```powershell
# Install locally for testing
pip install azure-cosmos
```

**Connection refused (localhost:8081)**
- Ensure Cosmos DB Emulator is running
- Accept the emulator's self-signed certificate

**Invalid credentials**
- Verify `COSMOS_ENDPOINT` starts with `https://`
- Verify `COSMOS_KEY` is set correctly

## Rollback

To rollback to file-based storage:

1. **In Azure**: Update Container App environment variable:
   ```bash
   az containerapp update \
     --name <your-app-name> \
     --resource-group <your-rg> \
     --set-env-vars USE_COSMOS_DB=false
   ```

2. **Locally**: Comment out Cosmos DB variables in `.env` or `docker-compose.yml`

The app will automatically use file-based storage again.

## Next Steps

After deployment:
1. Monitor costs in Azure Portal → Cost Management
2. Check Cosmos DB metrics in Azure Portal → Cosmos DB → Metrics
3. Set up budget alerts if desired (though costs should be negligible)

## Questions?

Check the logs for detailed information about which storage backend is being used and any errors encountered.
