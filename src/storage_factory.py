"""
Storage manager protocols and factory for the Household Task Tracker.

Defines common interfaces and provides a factory method for creating
storage managers with automatic fallback logic.
"""
import os
import logging
import time
from typing import Dict, Any, Tuple, Protocol, runtime_checkable, List, Optional

logger = logging.getLogger(__name__)


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


@runtime_checkable
class AllowanceRepositoryProtocol(Protocol):
    """Protocol defining the interface for allowance repositories.

    Implementations can be backed by Cosmos DB or local files,
    but must expose a consistent API for the Flask layer.
    """

    def get_account(self, user_id: str) -> Dict[str, Any]:
        """Return the allowance account document for a user.
        
        If no account exists, return a default account structure."""
        ...

    def get_recent_transactions(self, user_id: str, limit: int = 20) -> List[Dict[str, Any]]:
        """Return the most recent allowance transactions for a user."""
        ...

    def add_transaction(
        self,
        user_id: str,
        amount: float,
        tx_type: str,
        description: Optional[str] = None,
    ) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """Create a new transaction and update the account.

        parameters:
            user_id: User identifier
            amount: Transaction amount (positive or negative)
            tx_type: Type/category of transaction
            description: Optional description of the transaction

        Returns a tuple of (updated_account, created_transaction).
        """
        ...

    def update_settings(self, user_id: str, new_settings: Dict[str, Any], replace: bool = False) -> Dict[str, Any]:
        """Update account-level settings for a user and return the updated account.
        
        parameters:
            user_id: User identifier
            new_settings: Dict of settings to update
            replace: If True, replace existing settings entirely; if False, update selectively.
        """
        ...
    
    def delete_last_transaction(self, user_id: str) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """Delete the most recent transaction for a user.

        Returns a tuple of (updated_account, deleted_transaction).

        If no transactions exist, an empty dict is returned for deleted_transaction.
        """
        ...


def create_state_store(
    user_id: str = "household"
) -> StateStoreProtocol:
    """
    Factory method to create storage managers with automatic fallback.
    
    Attempts to create Cosmos DB stores if USE_COSMOS_DB is enabled,
    otherwise falls back to file-based storage.
    
    Args:
        user_id: User identifier for Cosmos DB partition key
        
    Returns:
        StateStoreProtocol
        
    Raises:
        ImportError: If required dependencies are missing (after fallback)
    """
    use_cosmos = os.getenv('USE_COSMOS_DB', 'false').lower() == 'true'
    
    if use_cosmos:
        try:
            from cosmosdb_manager import create_cosmos_store
            logger.info("Initializing Cosmos DB storage...")
            state_store = create_cosmos_store(user_id=user_id)
            
            # Verify they conform to protocols
            assert isinstance(state_store, StateStoreProtocol)
            
            logger.info("✅ Cosmos DB storage initialized successfully")
            return state_store
            
        except ImportError as e:
            logger.error(f"❌ Cosmos DB dependencies missing: {e}")
            logger.warning("Falling back to file-based storage")
        except Exception as e:
            logger.error(f"❌ Failed to initialize Cosmos DB storage: {e}")
            logger.warning("Falling back to file-based storage")
    
    # Fallback to file-based storage
    logger.info("Using file-based storage")
    try:
        from jsonfile_manager import state_store
        
        # Verify they conform to protocols
        assert isinstance(state_store, StateStoreProtocol)
        
        return state_store
        
    except ImportError as e:
        logger.error(f"❌ File-based storage dependencies missing: {e}")
        raise ImportError(
            "Neither Cosmos DB nor file-based storage are available. "
            "Check your dependencies."
        ) from e


def create_allowance_repository(
    user_id: str = "household",
) -> AllowanceRepositoryProtocol:
    """Factory to create an allowance repository with automatic fallback.

    Uses Cosmos DB when configured, otherwise falls back to a file-based
    implementation. The returned object conforms to AllowanceRepositoryProtocol.

    Args:
        user_id: User identifier used as partition key in Cosmos DB.

    Returns:
        An implementation of AllowanceRepositoryProtocol.
    """

    use_cosmos = os.getenv("USE_COSMOS_DB", "false").lower() == "true"

    if use_cosmos:
        try:
            from cosmosdb_manager import create_cosmos_allowance_repository

            logger.info("Initializing Cosmos DB allowance repository...")
            repo = create_cosmos_allowance_repository(user_id=user_id)

            assert isinstance(repo, AllowanceRepositoryProtocol)

            logger.info("✅ Cosmos DB allowance repository initialized successfully")
            return repo

        except ImportError as e:
            logger.error(f"❌ Cosmos DB dependencies missing for allowance: {e}")
            logger.warning("Falling back to file-based allowance repository")
        except Exception as e:
            logger.error(f"❌ Failed to initialize Cosmos DB allowance repository: {e}")
            logger.warning("Falling back to file-based allowance repository")

    logger.info("Using file-based allowance repository")
    try:
        from jsonfile_manager import create_file_allowance_repository

        repo = create_file_allowance_repository()
        assert isinstance(repo, AllowanceRepositoryProtocol)

        return repo

    except ImportError as e:
        logger.error(f"❌ File-based allowance repository dependencies missing: {e}")
        raise ImportError(
            "Neither Cosmos DB nor file-based allowance repositories are available. "
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
        config_store, _ = create_state_store()
        
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