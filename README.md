# Household Task Tracker

A simple web application for tracking household tasks between family members with shared state across devices.

## Features

- ✅ Track tasks for multiple family members with configurable weekly goals
- 📊 Progress bars showing task completion with customizable colors
- 🎉 Celebratory messages for completed tasks with configurable messages
- 💾 Persistent state shared across all devices on the network
- 📱 Mobile-friendly responsive design
- 🔄 Real-time state synchronization
- 🔒 Protected with simple user/password authentication
- 🌍 Web-based configuration interface for full customization
- ⚙️ Customizable UI themes and tasks

## Architecture

The application consists of:

- **Frontend**: HTML/CSS/JavaScript single-page application with dynamic configuration loading
- **Backend**: Flask API for state and configuration management
- **Storage**: JSON files for state persistence and configuration
- **Deployment**: Docker container for easy deployment
- **Configuration**: Web-based UI for customizing tasks, users, and settings

## Quick Start

### Option 1: Local Development with Docker

1. **Prerequisites**

   - Docker Desktop installed and running
   - Git for cloning the repository
   - create a `.env` file in the root directory with the following content:

     ```plaintext
     SECRET=your_secret_key
     APP_USERNAME=your_username
     APP_PASSWORD=your_password
     ```

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

### Option 2: Deploy to Azure Container Apps

1. **Prerequisites**

   - Azure subscription
   - Azure CLI installed and logged in
   - Azure Developer CLI (azd) installed

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

```
household-tracker/
├── Dockerfile             # Container configuration
├── azure.yaml             # Azure deployment configuration
├── src/
│   ├── app.py              # Flask application code
│   ├── statemanager.py     # State and configuration management
│   ├── requirements.txt    # Python dependencies
│   ├── task_config.json    # Configuration file (auto-generated)
│   ├── household_state.json # State file (auto-generated)
│   ├── static/
│   │   ├── index.html      # Main HTML file
│   │   ├── config.html     # Configuration interface
│   │   ├── script.js       # Frontend JavaScript (dynamic)
│   │   ├── config.js       # Configuration interface JavaScript
│   │   └── style.css       # CSS styles (with dynamic colors)
│   └── templates/
│       └── login.html      # HTML template for login page
├── .dockerignore           # Docker ignore file
├── infra/
│   ├── main.bicep         # Azure infrastructure as code
│   └── main.parameters.json
└── deploy-local.*         # Local deployment scripts
```

### API Endpoints

- `GET /` - Serve the main application
- `GET /config` - Serve the configuration interface
- `GET /api/config` - Get current app configuration
- `POST /api/config` - Update app configuration
- `GET /api/state` - Get current task state
- `POST /api/state` - Update task state
- `POST /api/reset` - Reset all tasks
- `GET /api/health` - Health check

### State Management

The application uses two JSON files for data persistence:

**Task Configuration (`task_config.json`):**
```json
{
  "users": {
    "milou": {
      "tasksPerWeek": 7,
      "color": "#0ef706dc",
      "displayName": "Milou"
    },
    "luca": {
      "tasksPerWeek": 5,
      "color": "#29b100", 
      "displayName": "Luca"
    }
  },
  "personalTasks": ["Vaatwasser", "Koken", "Boodschappen", ...],
  "generalTasks": {
    "count": 2,
    "tasks": ["Huiskamer opruimen", "Takken verzorgen"]
  },
  "messages": ["lekker bezig! 🚀", "ga zo door! 🌟", ...]
}
```

**Task State (`household_state.json`):**
```json
{
  "milou": [false, false, false, false, false, false, false],
  "luca": [false, false, false, false, false],
  "general": [false, false]
}
```

The state automatically adjusts when configuration changes. For example, if you change Milou's weekly tasks from 7 to 5, the state array will be resized accordingly.

## Azure Deployment Details

### Resources Created

- **Container App**: Hosts the application
- **Container Apps Environment**: Provides the runtime environment
- **Container Registry**: Stores the container image
- **Log Analytics Workspace**: Collects application logs
- **Managed Identity**: Provides secure access to container registry

### Cost Optimization

- Uses Azure Container Apps consumption-based pricing
- Basic Container Registry tier
- Minimal resource allocation (0.25 CPU, 0.5GB memory)
- Auto-scaling from 1-3 replicas based on load

### Security Features

- Managed Identity for secure registry access
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

## Configuration

### Web-based Configuration Interface

Access the configuration interface by clicking the ⚙️ (settings) button in the main application or visiting `/config` directly.

**Available Configuration Options:**

1. **Users Management**
   - Add/remove family members
   - Set individual weekly task goals (1-14 tasks per week)
   - Customize progress bar colors
   - Set display names

2. **Personal Tasks**
   - Add/remove personal tasks that appear in the main table
   - Tasks are shared across all family members
   - Examples: "Vaatwasser", "Koken", "Boodschappen"

3. **General Tasks**
   - Add/remove household tasks that don't assign to specific people
   - Examples: "Huiskamer opruimen", "Takken verzorgen"

4. **Celebration Messages**
   - Customize the compliments shown when tasks are completed
   - Add motivational messages in any language

### Configuration Tips

- **Weekly Task Goals**: Set realistic goals. If someone consistently completes more than their goal, consider increasing it.
- **Colors**: Choose contrasting colors for better visibility, especially on mobile devices.
- **Task Names**: Keep them short for better display on mobile screens.
- **Reset Warning**: Changing configuration resets all current task progress.

## Customization

### Quick Customization via Web Interface

The easiest way to customize the application is through the web interface:

1. Navigate to `/config` or click the ⚙️ button
2. Modify users, tasks, or messages as needed
3. Click "Save Configuration"
4. Task states will automatically reset to match the new configuration

### Advanced Customization

For advanced users who want to modify the configuration programmatically:

#### Data Management Best Practices

**Configuration Changes:**
- Always use the web interface for safety and validation
- Configuration changes automatically trigger state resets
- Backup your `task_config.json` before major changes

**State Management:**
- The application automatically handles state resizing when configuration changes
- If you add a user, their state starts with all tasks incomplete
- If you reduce someone's weekly tasks, excess completed tasks are removed
- If you increase someone's weekly tasks, new tasks start as incomplete

**File Locations:**
- Configuration: `src/task_config.json` (create your own or let app generate defaults)
- State: `src/household_state.json` (automatically managed)
- Both files are automatically created if missing

### Migrating from Static Configuration

If you're upgrading from a previous version with hardcoded tasks:

1. Start the application - it will create default configuration files
2. Use the web interface to recreate your previous task setup
3. The new system is fully backward compatible

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
