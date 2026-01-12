// Main Bicep template for Household Tracker application
// Deploys Azure Container Apps with Container Registry and Log Analytics

targetScope = 'resourceGroup'

@minLength(1)
@maxLength(4)
@description('Name of the environment')
param environmentName string = 'dev'

@minLength(1)
@description('Primary location for all resources')
param location string = resourceGroup().location

@description('Resource token to make resource names unique')
param resourceToken string = substring(
  toLower(uniqueString(subscription().id, resourceGroup().id, environmentName)),
  0,
  8
)

@description('Full container image name to deploy (e.g. docker.io/username/repo:tag or username/repo:tag)')
param imageName string = 'mielski/household-web-app:latest'

// Tags for resource management
var tags = {
  application: 'household-tracker'
}

// Variables for resource naming
var prefix = '${environmentName}-${resourceToken}'
var containerAppName = '${prefix}-app'
var containerAppsEnvironmentName = '${prefix}-env'
var keyVaultName = '${prefix}-kv'
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

resource KeyVault 'Microsoft.KeyVault/vaults@2022-07-01' = {
  name: keyVaultName
  location: location
  tags: tags
  properties: {
    tenantId: subscription().tenantId
    sku: {
      name: 'standard'
      family: 'A'
    }
    accessPolicies: []
    enabledForDeployment: false
    enabledForDiskEncryption: false
    enabledForTemplateDeployment: false
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
  }
}

// Azure Cosmos DB Account (Serverless for cost-effective storage)
resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' = {
  name: '${prefix}-cosmos'
  location: location
  tags: tags
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    capabilities: [
      {
        name: 'EnableServerless'
      }
    ]
    backupPolicy: {
      type: 'Continuous'
      continuousModeProperties: {
        tier: 'Continuous7Days'
      }
    }
  }
}

// Cosmos DB Database
resource cosmosDatabase 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' = {
  parent: cosmosAccount
  name: 'household-tracker'
  properties: {
    resource: {
      id: 'household-tracker'
    }
  }
}

// Cosmos DB Container for configurations
resource cosmosConfigContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: cosmosDatabase
  name: 'configurations'
  properties: {
    resource: {
      id: 'configurations'
      partitionKey: {
        paths: ['/userId']
        kind: 'Hash'
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          {
            path: '/*'
          }
        ]
      }
    }
  }
}

// Cosmos DB Container for task states
resource cosmosStateContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: cosmosDatabase
  name: 'task-states'
  properties: {
    resource: {
      id: 'task-states'
      partitionKey: {
        paths: ['/userId']
        kind: 'Hash'
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          {
            path: '/*'
          }
        ]
      }
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
  identity: {
    type: 'SystemAssigned'
  }
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
          {
            action: 'Allow'
            name: 'AllowHomeNetwork'
            description: 'Allows access from home network'
            ipAddressRange: '188.90.180.102'
          }
        ]
      }
      // For publicly available images on Docker Hub no registry configuration
      // is required. If you use a private Docker Hub repository, add an entry
      // here and supply registry credentials as secrets.

      secrets: [
        {
          name: 'app-secret'
          keyVaultUrl: '${KeyVault.properties.vaultUri}secrets/appSecret'
          identity: 'system'
        }
        {
          name: 'app-password'
          keyVaultUrl: '${KeyVault.properties.vaultUri}secrets/appPassword'
          identity: 'system'
        }
        {
          name: 'app-action-passcode'
          keyVaultUrl: '${KeyVault.properties.vaultUri}secrets/appActionPasscode'
          identity: 'system'
        }
        {
          name: 'app-username'
          keyVaultUrl: '${KeyVault.properties.vaultUri}secrets/appUsername'
          identity: 'system'
        }
        {
          name: 'cosmos-key'
          value: cosmosAccount.listKeys().primaryMasterKey
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
              secretRef: 'app-username'
            }
            {
              name: 'APP_PASSWORD'
              secretRef: 'app-password'
            }
            {
              name: 'APP_ACTION_PASSCODE'
              secretRef: 'app-action-passcode'
            }
            {
              name: 'USE_COSMOS_DB'
              value: 'true'
            }
            {
              name: 'COSMOS_ENDPOINT'
              value: cosmosAccount.properties.documentEndpoint
            }
            {
              name: 'COSMOS_KEY'
              secretRef: 'cosmos-key'
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

var roleDefinitionId = '/subscriptions/${subscription().subscriptionId}/providers/Microsoft.Authorization/roleDefinitions/4633458b-17de-408a-b874-0445c86b69e6' // Key Vault Secrets User
var roleAssignmentName = guid(containerApp.id, roleDefinitionId, resourceGroup().id)
// assign Key Vault access policy to Container App's managed identity
resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: roleAssignmentName
  properties: {
    roleDefinitionId: roleDefinitionId
    principalId: containerApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// Output values for use by azd and other tools
output RESOURCE_GROUP_ID string = resourceGroup().id
output AZURE_CONTAINER_APPS_ENVIRONMENT_NAME string = containerAppsEnvironment.name
output AZURE_CONTAINER_APP_NAME string = containerApp.name
output AZURE_LOG_ANALYTICS_WORKSPACE_NAME string = logAnalyticsWorkspace.name
output AZURE_COSMOS_DB_ACCOUNT_NAME string = cosmosAccount.name
output AZURE_COSMOS_DB_ENDPOINT string = cosmosAccount.properties.documentEndpoint
output WEB_URI string = 'https://${containerApp.properties.configuration.ingress.fqdn}'
