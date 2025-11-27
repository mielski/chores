"""
Azure Cosmos DB manager for persistent storage of configuration and state.

This provides a drop-in replacement for file-based storage with automatic
persistence, backups, and no risk of data loss on container restarts.
"""
import os
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

# Try to import Cosmos DB client, but don't fail if not available
try:
    from azure.cosmos import CosmosClient, PartitionKey, exceptions
    COSMOS_AVAILABLE = True
except ImportError:
    COSMOS_AVAILABLE = False
    logger.warning("azure-cosmos package not installed. Cosmos DB storage not available.")


class CosmosDBManager:
    """
    Manages configuration and state using Azure Cosmos DB.
    
    Provides the same interface as BaseJsonManager for seamless integration.
    Uses a single userId partition key for efficient querying and isolation.
    """
    
    def __init__(self, endpoint: Optional[str] = None, key: Optional[str] = None):
        """
        Initialize Cosmos DB connection.
        
        Args:
            endpoint: Cosmos DB endpoint URL (defaults to COSMOS_ENDPOINT env var)
            key: Cosmos DB access key (defaults to COSMOS_KEY env var)
        """
        if not COSMOS_AVAILABLE:
            raise ImportError("azure-cosmos package is required for Cosmos DB storage")
        
        self.endpoint = endpoint or os.getenv('COSMOS_ENDPOINT')
        self.key = key or os.getenv('COSMOS_KEY')
        
        if not self.endpoint or not self.key:
            raise ValueError(
                "Cosmos DB endpoint and key must be provided via parameters or "
                "COSMOS_ENDPOINT and COSMOS_KEY environment variables"
            )
        
        # Initialize client and database
        self.client = CosmosClient(self.endpoint, self.key)
        self.database_name = "household-tracker"
        self.database = self.client.create_database_if_not_exists(id=self.database_name)
        
        # Create containers with partition key for user isolation
        self.config_container = self.database.create_container_if_not_exists(
            id="configurations",
            partition_key=PartitionKey(path="/userId")
        )
        
        self.state_container = self.database.create_container_if_not_exists(
            id="task-states",
            partition_key=PartitionKey(path="/userId")
        )
        
        logger.info(f"Cosmos DB manager initialized for database: {self.database_name}")


class CosmosAppConfigManager:
    """
    Manages app configuration using Cosmos DB.
    Compatible interface with AppConfigManager.
    """
    
    def __init__(self, cosmos_manager: CosmosDBManager, user_id: str = "default"):
        """
        Args:
            cosmos_manager: Initialized CosmosDBManager instance
            user_id: Partition key for data isolation (default: "default")
        """
        self.cosmos = cosmos_manager
        self.user_id = user_id
        self.container = cosmos_manager.config_container
        self.doc_id = "config"
        
        self.default_content = {
            "users": {},
            "generalTasks": [],
            "personalTasks": [],
            "messages": []
        }
    
    def load(self) -> Dict[str, Any]:
        """Load configuration from Cosmos DB"""
        try:
            item = self.container.read_item(
                item=self.doc_id,
                partition_key=self.user_id
            )
            logger.info(f"Configuration loaded from Cosmos DB")
            return item.get('data', self.default_content)
        except exceptions.CosmosResourceNotFoundError:
            logger.info("Configuration not found in Cosmos DB, initializing with defaults")
            return self._init_file()
        except Exception as e:
            logger.error(f"Error loading configuration from Cosmos DB: {e}")
            return self.default_content
    
    def _init_file(self) -> Dict[str, Any]:
        """Initialize Cosmos DB document with default values"""
        try:
            item = {
                "id": self.doc_id,
                "userId": self.user_id,
                "data": self.default_content
            }
            self.container.upsert_item(item)
            logger.info("Configuration initialized in Cosmos DB with default values")
            return self.default_content
        except Exception as e:
            logger.error(f"Error initializing configuration in Cosmos DB: {e}")
            return self.default_content
    
    def save(self, data: Dict[str, Any]) -> bool:
        """Save configuration to Cosmos DB"""
        try:
            item = {
                "id": self.doc_id,
                "userId": self.user_id,
                "data": data
            }
            self.container.upsert_item(item)
            logger.info("Configuration saved to Cosmos DB")
            return True
        except Exception as e:
            logger.error(f"Error saving configuration to Cosmos DB: {e}")
            return False
    
    def reset(self):
        """Reset configuration to default values"""
        self.save(self.default_content.copy())


class CosmosAppTaskStateManager:
    """
    Manages task completion state using Cosmos DB.
    Compatible interface with AppTaskStateManager.
    """
    
    def __init__(self, cosmos_manager: CosmosDBManager, config_manager: CosmosAppConfigManager, 
                 user_id: str = "default"):
        """
        Args:
            cosmos_manager: Initialized CosmosDBManager instance
            config_manager: Configuration manager instance
            user_id: Partition key for data isolation (default: "default")
        """
        self.cosmos = cosmos_manager
        self.config_manager = config_manager
        self.user_id = user_id
        self.container = cosmos_manager.state_container
        self.doc_id = "state"
    
    def load(self) -> Dict[str, Any]:
        """Load task state from Cosmos DB"""
        try:
            item = self.container.read_item(
                item=self.doc_id,
                partition_key=self.user_id
            )
            logger.info("Task state loaded from Cosmos DB")
            return item.get('data', {})
        except exceptions.CosmosResourceNotFoundError:
            logger.info("Task state not found in Cosmos DB, resetting to defaults")
            return self.reset()
        except Exception as e:
            logger.error(f"Error loading task state from Cosmos DB: {e}")
            return {}
    
    def save(self, data: Dict[str, Any]) -> bool:
        """Save task state to Cosmos DB"""
        try:
            item = {
                "id": self.doc_id,
                "userId": self.user_id,
                "data": data
            }
            self.container.upsert_item(item)
            logger.info("Task state saved to Cosmos DB")
            return True
        except Exception as e:
            logger.error(f"Error saving task state to Cosmos DB: {e}")
            return False
    
    def reset(self) -> Dict[str, Any]:
        """Reset state using the app configuration to define the structure"""
        config = self.config_manager.load()
        state = {}
        
        # Create state for each user based on their task count
        for user_id in config['users'].keys():
            task_count = len(config['personalTasks']) * 7
            state[user_id] = [False] * task_count
        
        # Create state for general tasks
        state['general'] = [False] * len(config['generalTasks']) * 7
        
        self.save(state)
        logger.info("Task state reset to match configuration")
        logger.info(state)
        return state


def create_cosmos_managers(user_id: str = "default"):
    """
    Factory function to create Cosmos DB managers.
    
    Args:
        user_id: Partition key for data isolation
        
    Returns:
        Tuple of (config_manager, state_manager)
        
    Raises:
        ImportError: If azure-cosmos is not installed
        ValueError: If Cosmos DB credentials are not configured
    """
    cosmos_manager = CosmosDBManager()
    config_manager = CosmosAppConfigManager(cosmos_manager, user_id)
    state_manager = CosmosAppTaskStateManager(cosmos_manager, config_manager, user_id)
    
    return config_manager, state_manager
