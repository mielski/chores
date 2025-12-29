"""
Azure Cosmos DB manager for persistent storage of configuration and state.

This provides a drop-in replacement for file-based storage with automatic
persistence, backups, and no risk of data loss on container restarts.
"""
import os
import logging
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime, timezone
import uuid

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

        # Container for allowance accounts and transactions
        self.allowance_container = self.database.create_container_if_not_exists(
            id="allowance-ledger",
            partition_key=PartitionKey(path="/userId")
        )
        
        logger.info(f"Cosmos DB manager initialized for database: {self.database_name}")


class CosmosStateStore:
    """
    Manages task completion state using Cosmos DB.
    Compatible interface with FileStateStore.
    """
    
    def __init__(self, cosmos_manager: CosmosDBManager,
                 user_id: str = "default"):
        """
        Args:
            cosmos_manager: Initialized CosmosDBManager instance
            config_store: Configuration store instance
            user_id: Partition key for data isolation (default: "default")
        """
        self.cosmos = cosmos_manager
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
        state = {
            "Milou": {
                "choreList": [
                ]
            },
            "Luca": {
                "choreList": [
                ]
            }
        }
        
        self.save(state)
        logger.info("Task state reset to match configuration")
        return state


def create_cosmos_store(user_id: str = "default"):
    """
    Factory function to create Cosmos DB stores.
    
    Args:
        user_id: Partition key for data isolation
        
    Returns:
        state_store: CosmosStateStore instance
        
    Raises:
        ImportError: If azure-cosmos is not installed
        ValueError: If Cosmos DB credentials are not configured
    """
    cosmos_manager = CosmosDBManager()
    state_store = CosmosStateStore(cosmos_manager, user_id)
    
    return state_store

class CosmosAllowanceRepository:
    """Allowance repository implementation backed by Azure Cosmos DB.

    Stores one account document and multiple transaction documents per user,
    all in the shared allowance-ledger container partitioned by userId.
    """

    def __init__(self, cosmos_manager: CosmosDBManager, ttl_days: Optional[int] = None):
        self.cosmos = cosmos_manager
        self.container = cosmos_manager.allowance_container
        self.ttl_seconds: Optional[int] = None
        if ttl_days is not None and ttl_days > 0:
            self.ttl_seconds = int(ttl_days * 24 * 60 * 60)

    def _default_account(self, user_id: str) -> Dict[str, Any]:
        """returns a default JSON object for an account definition."""
        return {
            "id": f"account_{user_id}",
            "entityType": "account",
            "userId": user_id,
            "currentBalance": 0.0,
            "currency": "EUR",
            "settings": {
                "weeklyAllowance": 2.0,
                "tasksPerWeek": 7,
                "bonusPerExtraTask": 0.5,
                "maximumExtraTasks": 4,
            },
            "lastUpdated": None,
            "version": 1,
        }

    def _get_or_create_account(self, user_id: str) -> Dict[str, Any]:
        account_id = f"account_{user_id}"
        try:
            item = self.container.read_item(item=account_id, partition_key=user_id)
            return item
        except exceptions.CosmosResourceNotFoundError:
            account = self._default_account(user_id)
            self.container.upsert_item(account)
            logger.info(f"Allowance account initialized in Cosmos DB for user {user_id}")
            return account

    def get_account(self, user_id: str) -> Dict[str, Any]:
        """Return the allowance account document for a user."""
        try:
            return self._get_or_create_account(user_id)
        except Exception as e:
            logger.error(f"Error getting allowance account for {user_id} from Cosmos DB: {e}")
            raise

    def get_recent_transactions(self, user_id: str, limit: int = 20) -> List[Dict[str, Any]]:
        """Return the most recent transactions for a user, newest first."""
        query = (
            "SELECT TOP @limit * FROM c "
            "WHERE c.entityType = 'transaction' AND c.userId = @userId "
            "ORDER BY c.timestamp DESC"
        )
        params = [
            {"name": "@limit", "value": int(limit)},
            {"name": "@userId", "value": user_id},
        ]

        try:
            items = list(
                self.container.query_items(
                    query=query,
                    parameters=params,
                    enable_cross_partition_query=False,
                )
            )
            return items
        except Exception as e:
            logger.error(f"Error querying allowance transactions for {user_id} from Cosmos DB: {e}")
            raise

    def add_transaction(
        self,
        user_id: str,
        amount: float,
        tx_type: str,
        description: Optional[str] = None,
    ) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """Create a new transaction and update the account balance.

        Note: For simplicity this uses sequential writes. For stricter
        consistency you could migrate this to a transactional batch.
        """

        account = self._get_or_create_account(user_id)
        old_balance = float(account.get("currentBalance", 0.0))
        new_balance = old_balance + float(amount)

        now = datetime.now(timezone.utc).isoformat()

        tx_doc: Dict[str, Any] = {
            "id": f"tx_{user_id}_{uuid.uuid4()}",
            "entityType": "transaction",
            "userId": user_id,
            "timestamp": now,
            "amount": float(amount),
            "direction": "credit" if amount >= 0 else "debit",
            "type": tx_type,
            "description": description,
            "balanceAfter": new_balance,
        }

        if self.ttl_seconds is not None:
            tx_doc["ttl"] = self.ttl_seconds

        try:
            # Write transaction
            self.container.upsert_item(tx_doc)

            # Update account
            account["currentBalance"] = new_balance
            account["lastUpdated"] = now
            account["version"] = int(account.get("version", 1)) + 1
            self.container.upsert_item(account)

            logger.info(f"Allowance transaction stored in Cosmos DB for {user_id}")
            return account, tx_doc
        except Exception as e:
            logger.error(f"Error adding allowance transaction for {user_id} in Cosmos DB: {e}")
            raise

    def update_settings(self, user_id: str, new_settings: Dict[str, Any], replace: bool = False) -> Dict[str, Any]:
        """Update account-level settings for a user and return the updated account.
        
        parameters:
            user_id: User identifier
            new_settings: Dict of settings to update
            replace: If True, replace existing settings entirely; if False, update selectively.
        """
        account = self._get_or_create_account(user_id)
        if replace:
            account["settings"] = new_settings
        else:
            settings = account.setdefault("settings", {})
            settings.update(new_settings)

        now = datetime.now(timezone.utc).isoformat()
        account["lastUpdated"] = now
        account["version"] = int(account.get("version", 1)) + 1

        try:
            self.container.upsert_item(account)
            logger.info(f"Allowance settings updated in Cosmos DB for {user_id}")
            return account
        except Exception as e:
            logger.error(f"Error updating allowance settings for {user_id} in Cosmos DB: {e}")
            raise
    
    def delete_last_transaction(self, user_id: str) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """Delete the most recent transaction for a user.

        Returns a tuple of (updated_account, deleted_transaction).

        If no transactions exist, an empty dict is returned for deleted_transaction.
        """
        account = self.get_account(user_id)
        transactions = self.container.query_items(
            query=(
                "SELECT TOP 1 * FROM c "
                "WHERE c.entityType = 'transaction' AND c.userId = @userId "
                "ORDER BY c.timestamp DESC"
            ),
            parameters=[{"name": "@userId", "value": user_id}],
            enable_cross_partition_query=False,
        )
        if not transactions:
            return account, {}

        # get the transaction value
        transaction = transactions.next()
        amount = transaction['amount']
        old_balance = float(account.get("currentBalance", 0.0))
        new_balance = old_balance - float(amount)
        account["currentBalance"] = new_balance
        account["lastUpdated"] = datetime.now(timezone.utc).isoformat()
        
        self.container.upsert_item(account)

        self.container.delete_item(transaction['id'], partition_key=user_id)
        logger.info(f"Deleted last allowance transaction in Cosmos DB for {user_id}")
        return account, transaction


def create_cosmos_allowance_repository(user_id: str = "default") -> CosmosAllowanceRepository:
    """Factory for the Cosmos-based allowance repository.

    Uses the same CosmosDBManager instance as the other stores and
    optionally honors an ALLOWANCE_TX_TTL_DAYS environment variable
    to control rolling transaction history.
    """

    ttl_env = os.getenv("ALLOWANCE_TX_TTL_DAYS")
    ttl_days: Optional[int]
    try:
        ttl_days = int(ttl_env) if ttl_env is not None else None
    except ValueError:
        ttl_days = None

    cosmos_manager = CosmosDBManager()
    repo = CosmosAllowanceRepository(cosmos_manager, ttl_days=ttl_days)

    # Touch the account to ensure the partition exists
    repo.get_account(user_id)

    return repo
