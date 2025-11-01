// Main Bicep template for Household Tracker application
// Deploys Azure Container Apps with Container Registry and Log Analytics

targetScope = 'resourceGroup'

@minLength(1)
@maxLength(64)
@description('Name of the environment')
param environmentName string = 'household-tracker'

@minLength(1)
@description('Primary location for all resources')
param location string = resourceGroup().location

@description('Resource token to make resource names unique')
param resourceToken string = substring(toLower(uniqueString(subscription().id, resourceGroup().id, environmentName)), 0, 8)

@description('Secret key for Flask application')
@secure()
param appSecret string

@description('Username for application login')
param appUsername string

@description('Password for application login')
@secure()
param appPassword string

@description('Full container image name to deploy (e.g. docker.io/username/repo:tag or username/repo:tag)')
param imageName string = 'mielski/household-web-app:latest'

// Tags for resource management
var tags = {
  'azd-env-name': environmentName
  'application': 'household-tracker'
  'component': 'infrastructure'
}

// Variables for resource naming
var prefix = '${environmentName}-${resourceToken}'
var containerAppName = '${prefix}-app'
var containerAppsEnvironmentName = '${prefix}-env'
var logAnalyticsWorkspaceName = '${prefix}-logs'

// Log Analytics Workspace for Container Apps monitoring
resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logAnalyticsWorkspaceName
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
  }
}


// Container Apps Environment
resource containerAppsEnvironment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: containerAppsEnvironmentName
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalyticsWorkspace.properties.customerId
        sharedKey: logAnalyticsWorkspace.listKeys().primarySharedKey
      }
    }
    zoneRedundant: false
  }
}

// Container App
resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: containerAppName
  location: location
  tags: union(tags, {
    'azd-service-name': 'web'
  })
  properties: {
    managedEnvironmentId: containerAppsEnvironment.id
    configuration: {
      ingress: {
        external: true
        targetPort: 8080
        transport: 'http'
        corsPolicy: {
          allowedOrigins: ['*']
          allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
          allowedHeaders: ['*']
          allowCredentials: false
        }
        ipSecurityRestrictions: [
          {action: 'Allow', name: 'AllowHomeNetwork', description: 'Allows access from home network', ipAddressRange: '188.90.180.102'}
        ]
      }
      // For publicly available images on Docker Hub no registry configuration
      // is required. If you use a private Docker Hub repository, add an entry
      // here and supply registry credentials as secrets.
      secrets: [
        {
          name: 'app-secret'
          value: appSecret
        }
        {
          name: 'app-password'
          value: appPassword
        }
      ]
    }
    template: {
      containers: [
        {
          // Use the image provided via the `imageName` parameter so deployments
          // reference your Docker Hub image (e.g. 'mielski/household-web-app:1.0.0').
          image: imageName
          name: 'household-tracker'
          env: [
            {
              name: 'PORT'
              value: '8080'
            }
            {
              name: 'STATE_FILE'
              value: '/app/data/household_state.json'
            }
            {
              name: 'SECRET'
              secretRef: 'app-secret'
            }
            {
              name: 'APP_USERNAME'
              value: appUsername
            }
            {
              name: 'APP_PASSWORD'
              secretRef: 'app-password'
            }
          ]
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 3
        rules: [
          {
            name: 'http-scale'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
    }
  }
  // No ACR dependencies
}

// Output values for use by azd and other tools
output RESOURCE_GROUP_ID string = resourceGroup().id
output AZURE_CONTAINER_APPS_ENVIRONMENT_NAME string = containerAppsEnvironment.name
output AZURE_CONTAINER_APP_NAME string = containerApp.name
output AZURE_LOG_ANALYTICS_WORKSPACE_NAME string = logAnalyticsWorkspace.name
output WEB_URI string = 'https://${containerApp.properties.configuration.ingress.fqdn}'
