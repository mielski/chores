# Household Task Tracker

A simple web application for tracking household tasks between family members with shared state across devices.

## Features

- ✅ Track tasks for multiple family members (Luca and Milou)
- 📊 Progress bars showing task completion
- 🎉 Celebratory messages for completed tasks
- 💾 Persistent state shared across all devices on the network
- 📱 Mobile-friendly responsive design
- 🔄 Real-time state synchronization

## Architecture

The application consists of:

- **Frontend**: HTML/CSS/JavaScript single-page application
- **Backend**: Flask API for state management
- **Storage**: Simple JSON file for state persistence
- **Deployment**: Docker container for easy deployment

## Quick Start

### Option 1: Local Development with Docker

1. **Prerequisites**

   - Docker Desktop installed and running
   - Git for cloning the repository

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
├── index.html              # Main HTML file
├── script.js               # Frontend JavaScript
├── style.css               # CSS styles
├── app.py                  # Flask backend API
├── requirements.txt        # Python dependencies
├── Dockerfile             # Container configuration
├── azure.yaml             # Azure deployment configuration
├── infra/
│   ├── main.bicep         # Azure infrastructure as code
│   └── main.parameters.json
└── deploy-local.*         # Local deployment scripts
```

### API Endpoints

- `GET /` - Serve the main application
- `GET /api/state` - Get current task state
- `POST /api/state` - Update task state
- `POST /api/reset` - Reset all tasks
- `GET /api/health` - Health check

### State Management

The application stores task state in a JSON format:

```json
{
  "milou": [false, false, false, false, false, false, false],
  "luca": [false, false, false, false, false, false, false],
  "general": [false, false]
}
```

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

## Customization

### Adding New Tasks

Edit the `personalTaskNames` array in `script.js`:

```javascript
const personalTaskNames = [
  "Vaatwasser inruimen",
  "Vaatwasser uitruimen",
  "Koken",
  // Add your tasks here
];
```

### Changing Colors

Modify CSS variables in `style.css`:

```css
:root {
  --my-luca-color: #29b100;
  --my-milou-color: #0ef706dc;
}
```

### Adding Family Members

1. Update the HTML structure in `index.html`
2. Add corresponding CSS classes in `style.css`
3. Update JavaScript arrays and logic in `script.js`
4. Modify the default state in `app.py`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally using `deploy-local.ps1`
5. Submit a pull request

## License

This project is open source and available under the MIT License.
