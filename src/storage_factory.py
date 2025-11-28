"""
Storage manager protocols and factory for the Household Task Tracker.

Defines common interfaces and provides a factory method for creating
storage managers with automatic fallback logic.
"""
import os
import logging
from typing import Dict, Any, Tuple, Protocol, runtime_checkable

logger = logging.getLogger(__name__)


@runtime_checkable
class ConfigManagerProtocol(Protocol):
    """Protocol defining the interface for configuration managers."""
    
    def load(self) -> Dict[str, Any]:
        """Load configuration data."""
        ...
    
    def save(self, data: Dict[str, Any]) -> bool:
        """Save configuration data. Returns True if successful."""
        ...
    
    def reset(self) -> None:
        """Reset configuration to default values."""
        ...


@runtime_checkable
class StateManagerProtocol(Protocol):
    """Protocol defining the interface for state managers."""
    
    def load(self) -> Dict[str, Any]:
        """Load state data."""
        ...
    
    def save(self, data: Dict[str, Any]) -> bool:
        """Save state data. Returns True if successful."""
        ...
    
    def reset(self) -> Dict[str, Any]:
        """Reset state to default values. Returns the new state."""
        ...


def create_storage_managers(
    user_id: str = "household"
) -> Tuple[ConfigManagerProtocol, StateManagerProtocol]:
    """
    Factory method to create storage managers with automatic fallback.
    
    Attempts to create Cosmos DB managers if USE_COSMOS_DB is enabled,
    otherwise falls back to file-based storage.
    
    Args:
        user_id: User identifier for Cosmos DB partition key
        
    Returns:
        Tuple of (config_manager, state_manager) conforming to protocols
        
    Raises:
        ImportError: If required dependencies are missing (after fallback)
    """
    use_cosmos = os.getenv('USE_COSMOS_DB', 'false').lower() == 'true'
    
    if use_cosmos:
        try:
            from cosmosdb_manager import create_cosmos_managers
            logger.info("Initializing Cosmos DB storage...")
            config_manager, state_manager = create_cosmos_managers(user_id=user_id)
            
            # Verify they conform to protocols
            assert isinstance(config_manager, ConfigManagerProtocol)
            assert isinstance(state_manager, StateManagerProtocol)
            
            logger.info("✅ Cosmos DB storage initialized successfully")
            return config_manager, state_manager
            
        except ImportError as e:
            logger.error(f"❌ Cosmos DB dependencies missing: {e}")
            logger.warning("Falling back to file-based storage")
        except Exception as e:
            logger.error(f"❌ Failed to initialize Cosmos DB storage: {e}")
            logger.warning("Falling back to file-based storage")
    
    # Fallback to file-based storage
    logger.info("Using file-based storage")
    try:
        from statemanager import state_manager, task_config_manager
        
        # Verify they conform to protocols
        assert isinstance(task_config_manager, ConfigManagerProtocol)
        assert isinstance(state_manager, StateManagerProtocol)
        
        return task_config_manager, state_manager
        
    except ImportError as e:
        logger.error(f"❌ File-based storage dependencies missing: {e}")
        raise ImportError(
            "Neither Cosmos DB nor file-based storage are available. "
            "Check your dependencies."
        ) from e


def get_storage_info() -> Dict[str, Any]:
    """
    Get information about the current storage configuration.
    
    Returns:
        Dict containing storage type, configuration, and status
    """
    use_cosmos = os.getenv('USE_COSMOS_DB', 'false').lower() == 'true'
    
    info = {
        'intended_storage': 'cosmos' if use_cosmos else 'file',
        'cosmos_endpoint': os.getenv('COSMOS_ENDPOINT'),
        'cosmos_configured': bool(os.getenv('COSMOS_ENDPOINT') and os.getenv('COSMOS_KEY')),
        'state_file': os.getenv('STATE_FILE', 'household_state.json')
    }
    
    # Try to determine actual storage being used
    try:
        config_manager, state_manager = create_storage_managers()
        
        # Check the actual type
        from cosmosdb_manager import CosmosAppConfigManager
        if isinstance(config_manager, CosmosAppConfigManager):
            info['actual_storage'] = 'cosmos'
        else:
            info['actual_storage'] = 'file'
            
    except Exception as e:
        info['actual_storage'] = 'unknown'
        info['error'] = str(e)
    
    return info