"""
Storage manager protocols and factory for the Household Task Tracker.

Defines common interfaces and provides a factory method for creating
storage managers with automatic fallback logic.
"""
import os
import logging
import time
from typing import Dict, Any, Tuple, Protocol, runtime_checkable

logger = logging.getLogger(__name__)


@runtime_checkable
class ConfigStoreProtocol(Protocol):
    """Protocol defining the interface for configuration stores."""
    
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
class StateStoreProtocol(Protocol):
    """Protocol defining the interface for state stores."""
    
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
) -> Tuple[ConfigStoreProtocol, StateStoreProtocol]:
    """
    Factory method to create storage managers with automatic fallback.
    
    Attempts to create Cosmos DB stores if USE_COSMOS_DB is enabled,
    otherwise falls back to file-based storage.
    
    Args:
        user_id: User identifier for Cosmos DB partition key
        
    Returns:
        Tuple of (config_store, state_store) conforming to protocols
        
    Raises:
        ImportError: If required dependencies are missing (after fallback)
    """
    use_cosmos = os.getenv('USE_COSMOS_DB', 'false').lower() == 'true'
    
    if use_cosmos:
        try:
            from cosmosdb_manager import create_cosmos_stores
            logger.info("Initializing Cosmos DB storage...")
            config_store, state_store = create_cosmos_stores(user_id=user_id)
            
            # Verify they conform to protocols
            assert isinstance(config_store, ConfigStoreProtocol)
            assert isinstance(state_store, StateStoreProtocol)
            
            logger.info("✅ Cosmos DB storage initialized successfully")
            return config_store, state_store
            
        except ImportError as e:
            logger.error(f"❌ Cosmos DB dependencies missing: {e}")
            logger.warning("Falling back to file-based storage")
        except Exception as e:
            logger.error(f"❌ Failed to initialize Cosmos DB storage: {e}")
            logger.warning("Falling back to file-based storage")
    
    # Fallback to file-based storage
    logger.info("Using file-based storage")
    try:
        from jsonfile_manager import state_store, config_store
        
        # Verify they conform to protocols
        assert isinstance(config_store, ConfigStoreProtocol)
        assert isinstance(state_store, StateStoreProtocol)
        
        return config_store, state_store
        
    except ImportError as e:
        logger.error(f"❌ File-based storage dependencies missing: {e}")
        raise ImportError(
            "Neither Cosmos DB nor file-based storage are available. "
            "Check your dependencies."
        ) from e


def get_storage_info(include_sensitive: bool = False) -> Dict[str, Any]:
    """
    Get information about the current storage configuration.
    
    Args:
        include_sensitive: Whether to include potentially sensitive configuration details
    
    Returns:
        Dict containing storage type and basic status (sanitized by default)
    """
    use_cosmos = os.getenv('USE_COSMOS_DB', 'false').lower() == 'true'
    
    # Basic info (safe to expose)
    info = {
        'intended_storage': 'cosmos' if use_cosmos else 'file',
        'timestamp': int(time.time()) if 'time' in globals() else None
    }
    
    # Sensitive info (only include if explicitly requested)
    if include_sensitive:
        endpoint = os.getenv('COSMOS_ENDPOINT', '')
        info.update({
            'cosmos_endpoint_domain': endpoint.split('/')[2] if endpoint.startswith('http') else None,
            'cosmos_configured': bool(os.getenv('COSMOS_ENDPOINT') and os.getenv('COSMOS_KEY')),
            'state_file_exists': os.path.exists(os.getenv('STATE_FILE', 'household_state.json'))
        })
    
    # Try to determine actual storage being used
    try:
        config_store, _ = create_storage_managers()
        
        # Check the actual type (safe to expose)
        from cosmosdb_manager import CosmosConfigStore
        if isinstance(config_store, CosmosConfigStore):
            info['actual_storage'] = 'cosmos'
        else:
            info['actual_storage'] = 'file'
            
    except Exception as e:
        info['actual_storage'] = 'unknown'
        # Don't log the full exception details in production
        logger.warning(f"Could not determine storage backend - {e.__class__.__name__}")
    
    return info