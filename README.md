# Household Task Tracker

A web application for tracking household tasks and allowances for multiple family members.

## Features

- ✅ Track tasks for multiple family members with configurable weekly goals
- 🪙 Track savings and weekly allowance
- 📊 Progress bars showing task completion
- 💾 Persistent state shared across all devices on the network
- 📱 Mobile-friendly responsive design
- 🔄 Real-time state synchronization
- 🔒 Protected with simple user/password authentication

## Architecture

The application consists of:

- **Frontend**: HTML/CSS/JavaScript single-page application with dynamic configuration loading
- **Backend**: Flask API for state management + Cosmos DB for state storage
- **Storage**: Simple JSON file storage for configuration and state 
- **Deployment**: Docker container for easy deployment, using public Docker Hub registry

## Quick Start

### Option 1: Local Development with Python
1. **Prerequisites**

   - Python 3.8+ installed
   - Git for cloning the repository
   - dependencies installed via pip:
     ```bash
     pip install -r src/requirements.txt
     ```
   - create a `.env` file in the root directory with the following content:

     ```plaintext
     SECRET=your_secret_key
     APP_USERNAME=your_username
     APP_PASSWORD=your_password
     ```
2. **Run the Application**

   ```bash
   cd src
   python app.py
   ```

3. **Access the Application**
   - Open http://localhost:8080 in your browser
   - Login with the credentials from your `.env` file
   - Click the ⚙️ (settings) button to configure tasks and users
   - The app will be accessible from any device on your local network using your computer's IP address

4. **Optionally, use cosmos db emulator**

   - Download and install the Cosmos DB emulator from https://learn.microsoft.com/en-us/azure/cosmos-db/local-emulator
   - Start the emulator and ensure it's running
   - Update your `.env` file with the following settings:
   
      ```plaintext
      USE_COSMOS_DB=true
      COSMOS_ENDPOINT=https://localhost:8081
      COSMOS_KEY=your_emulator_key
   
   - Restart the application to use Cosmos DB for state storage
   
   now you should see logs indicating connection to Cosmos DB
   you can also verify by checking the emulator data explorer

   Note: When using the Cosmos DB emulator, ensure that your firewall settings allow connections to the emulator ports.

   ```
   
### Option 2: Local Development with Docker

1. **Prerequisites**

   - Docker Desktop installed and running
   - Git for cloning the repository
   - create a `.env` file in the root directory with the following content:

     ```plaintext
     SECRET=your_secret_key
     APP_USERNAME=your_username
     APP_PASSWORD=your_password
     ```

   - Optionally, use the cosmos db emulator for local testing (see Development Environment Setup section)

2. **Deploy Locally**

   ```bash
   # Using PowerShell (Windows)
   .\deploy-local.ps1

   # Using Bash (Linux/Mac/WSL)
   chmod +x deploy-local.sh
   ./deploy-local.sh
   ```

3. **Access the Application**
   - Open http://localhost:8080 in your browser
   - Login with the credentials from your `.env` file
   - Click the ⚙️ (settings) button to configure tasks and users
   - The app will be accessible from any device on your local network using your computer's IP address

### Option 3: Deploy to Azure Container Apps

In this option, the app will be deployed to Azure Container Apps and the image will be pushed to
the public docker hub registry.

1. **Prerequisites**

   - Azure subscription
   - Azure CLI installed and logged in
   - Azure Developer CLI (azd) installed
   - Docker Desktop installed and running

2. **Initialize and Deploy**

   ```bash
   # Initialize azd (first time only)
   azd init

   # Deploy to Azure
   azd up
   ```

   - Follow the prompts to select the following
     - resource group and region
     - app secret, username, and password for authentication

3. **Access the Application**
   - The deployment will provide a public URL
   - Access from any device with internet connection

## Local Network Access

To access the app from other devices on your local network:

1. Find your computer's IP address:

   ```bash
   # Windows
   ipconfig

   # Linux/Mac
   ip addr show  # or ifconfig
   ```

2. Open `http://YOUR_IP_ADDRESS:8080` on any device connected to the same network

## Development

### Project Structure

```text
household-tracker/
├── Dockerfile               # Container configuration
├── azure.yaml               # Azure deployment configuration
├── src/
│   ├── app.py               # Flask application code
│   ├── cosmosdb_manager.py  # manager for Cosmos DB storage
│   ├── storage_factory.py   # Factory for storage backends (file or Cosmos DB)
│   ├── jsonfile_manager.py  # manager for JSON file storage
│   ├── aklowance_api.py     # Flask blueprint for allowance API
│   ├── requirements.txt     # Python dependencies
│   ├── static/
│   │   ├── index.html       # Main HTML file
│   │   ├── configpage.html  # Configuration interface
│   │   ├── configpage.js    # Configuration interface
│   │   ├── script.js        # Frontend JavaScript (dynamic)
│   │   ├── config.js        # Configuration interface JavaScript
│   │   └── style.css        # CSS styles (with dynamic colors)
│   └── templates/
│       └── login.html       # HTML template for login page
├── .dockerignore            # Docker ignore file
├── infra/
│   ├── main.bicep           # Azure infrastructure as code
│   └── main.parameters.json # Azure infrastructure parameters
├── deploy-local.*           # Local deployment scripts
├── deploy-infra.sh          # Azure infrastructure deployment script
└── build-and-push.sh        # Build and push image to Docker Hub and redeploy
```

### API Endpoints

See [Swagger API Documentation](src/static/openapi.json) for detailed API endpoints.
or the /docs endpoint when running the app.

### State Management

The application uses a store and repository data persistence:

**Task State (`household_state.json`):**
```json
{
   "Milou":  {
      "choreList": [
         {
         "date": "2025-12-10",
         "name": "Take out trash"
         },
         {
         "date": "2025-12-11",
         "name": "Wash dishes"
         }
      ],
   "Luca":  {
      ... // similar structure as Milou
   }
}
```

Note that the task state does not contain settings any more. This is now a part of the allowance API. For backward compatibility, the getstate endpoint will add the settings dynamically from the allowance API.

 For example:
```json
{
   "Milou": {
      "settings": {   // dynamically added
         "weeklyTasks": 7,
         "weeklyAllowance": 5.0,
         "currencySymbol": "$",
         "themeColor": "#4CAF50"
      },
      "choreList": [ ... ]
    },
   "Luca": {
      "settings": {...}, // dynamically added
      "choreList": [ ... ]
    }
   }
}
```

** Allowance API State: **

The allowance API stores user settings, account balance, and transaction history. Note that the structure may vary based on implementation. This example is for the file storage backend. This backend uses a single JSON file to store all user data.
   
```json
{
  "Milou": {
    "account": {
      "id": "account#Milou",
      "entityType": "account",
      "currentBalance": 0.0,
      "currency": "EUR",
      "settings": {
        "weeklyAllowance": 2.5,
        "tasksPerWeek": 9,
        "bonusPerExtraTask": 0.15,
        "maximumExtraTasks": 5
      },
      "lastUpdated": "2025-12-25T21:31:31.286417+00:00",
      "version": 17
    },
    "transactions": [
      {
        "id": "tx#Milou#2025-12-25T21:31:31.286417+00:00",
        "entityType": "transaction",
        "amount": 0.0,
        "type": "initial",
        "description": "Initial account creation",
        "timestamp": "2025-12-25T21:31:31.286417+00:00"
      }
    ]
  },
```
## Azure Deployment Details

### Resources Created

- **Container App**: Hosts the application
- **Container Apps Environment**: Provides the runtime environment
- **Cosmos DB Account**: Stores application state
- **Log Analytics Workspace**: Collects application logs

### Cost Optimization

- Uses Azure Container Apps consumption-based pricing
- Minimal resource allocation (0.25 CPU, 0.5GB memory)
- Auto-scaling from 1-3 replicas based on load
- Consumption-based Cosmos DB with low RU/s for cost-effective storage

### Security Features

- No hardcoded credentials
- CORS policy configured for web access
- Private networking support (optional)

## Troubleshooting

### Local Deployment Issues

1. **Docker not running**

   ```bash
   # Start Docker Desktop and wait for it to be ready
   docker info
   ```

2. **Port already in use**

   ```bash
   # Find what's using port 8080
   netstat -ano | findstr :8080  # Windows
   lsof -i :8080                 # Linux/Mac

   # Stop the conflicting service or change the port in deploy script
   ```

3. **Container won't start**

   ```bash
   # Check container logs
   docker logs household-tracker

   # Check if container is running
   docker ps -a
   ```

### Azure Deployment Issues

1. **Authentication errors**

   ```bash
   # Login to Azure
   az login
   azd auth login
   ```

2. **Resource quota issues**

   ```bash
   # Check available regions
   az account list-locations --output table

   # Try a different region in azure.yaml
   ```

3. **Deployment failures**

   ```bash
   # Check deployment logs
   azd logs

   # View resource status in Azure portal
   ```



## Development Environment Setup

For developers wanting to contribute or modify the application:

1. **Clone and Setup**
   ```bash
   git clone <repository-url>
   cd household-tracker
   python -m venv .venv
   source .venv/bin/activate  # Linux/Mac
   # or
   .venv\Scripts\activate     # Windows
   pip install -r src/requirements.txt
   ```

2. **Environment Variables**
   Create a `.env` file with:
   ```plaintext
   SECRET=your-development-secret-key
   APP_USERNAME=admin
   APP_PASSWORD=password
   DEBUG=true
   ```

3. **Run Development Server**
   ```bash
   cd src
   python app.py
   ```

4. **Access Development Features**
   - Main app: http://localhost:8080
   - Configuration: http://localhost:8080/config
   - API docs: Check the API endpoints section above

## Contributing

We welcome contributions! Here's how to get started:

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Set up development environment** (see Development Environment Setup above)
4. **Make your changes**
   - For configuration features: Test with the web interface
   - For backend changes: Test API endpoints with different configurations
   - For frontend changes: Test with multiple users and task configurations
5. **Test thoroughly**
   ```bash
   # Test locally with Docker
   .\deploy-local.ps1

   # Test different configurations through the web interface
   # Test state persistence across restarts
   ```
6. **Submit a pull request**

### Development Guidelines

- **Configuration Changes**: Always ensure backward compatibility
- **State Management**: Test state migration scenarios (adding/removing users, changing task counts)
- **Frontend**: Ensure responsive design works with different numbers of users and tasks
- **API**: Validate input data and provide meaningful error messages
- **Documentation**: Update README.md for new features

### Common Development Tasks

**Adding a New Configuration Option:**
1. Update `TaskConfigManager` default configuration in `statemanager.py`
2. Add UI controls in `config.html` and `config.js`
3. Update validation in the Flask API
4. Test configuration persistence and state adaptation

**Adding a New API Endpoint:**
1. Add route in `app.py`
2. Add authentication if needed (`@login_required`)
3. Add error handling and logging
4. Update API documentation in README

## License

This project is open source and available under the MIT License.
