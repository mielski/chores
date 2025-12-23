import json
import logging
from datetime import datetime, timezone
from typing import List, Dict, Tuple, Optional
import uuid

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class BaseJsonStore:
    """Base class for loading and saving JSON files with error handling.

    This class is reused for storing the configuration and state data.
    Using different implementations for the filename and default content.
    
    subclass must define:
    _file_name: str - filename for the JSON file
    _default_content: dict - default content to initialize the file"""

    _file_name: str

    def get_default_content(self) -> dict:
        """Get a copy of the default content, should be overridden in subclasses"""
        raise NotImplementedError
    
    def load(self) -> dict:
        """Load content from JSON file with error handling"""
        try:
            with open(self._file_name, 'r') as f:
                data = json.load(f)
                logger.info(f"{self._file_name} loaded successfully")
                return data
        except (FileNotFoundError, json.JSONDecodeError) as e:
            logger.error(f"Error loading {self._file_name}: {e}")
            return self._init_file()

    def _init_file(self) -> dict:
        """Initialize file with default values using save method"""
        if self.reset():
            logger.info(f"{self._file_name} initialized with default values")
        else:
            logger.error(f"Failed to initialize {self._file_name} with default values")
        return self.get_default_content()

    def save(self, data: dict) -> bool:
        """Save content to JSON file with error handling"""
        try:
            with open(self._file_name, 'w') as f:
                json.dump(data, f, indent=2)
                logger.info(f"{self._file_name} saved successfully")
            return True
        except Exception as e:
            logger.error(f"Error saving {self._file_name}: {e}")
            return False

    def reset(self) -> bool:
        """Reset content to default values"""
        return self.save(self.get_default_content())


class FileConfigStore(BaseJsonStore):
    """
    FileStore for the app configuration.

    Configuration structure:
    users - dict of user_id to user config (name, tasksPerWeek)
    generalTasks - list of general tasks accomplished once over users
    personalTasks - list of personal tasks accomplished once per user
    """

    _file_name = 'task_config.json'

    def get_default_content(self) -> dict:
        return {
        "users": {},
        "generalTasks": [],
        "personalTasks": [],
        "messages": []
    }
    

class FileStateStore(BaseJsonStore):
    """
    FileStore for the task completion state.

    State structure:
    user_id - list of booleans representing task completion over a week
    general - list of booleans representing general task completion over a week
    """
    _file_name = 'household_state.json'

    def get_default_content(self) -> dict:
        """Generate default state structure based on current configuration."""
        
        return {
            "Milou": {
                "config": {
                    "tasksPerWeek": 9,
                    "allowance": 3.0,
                    "reward": 0.2
                },
                "choreList": [
                    {"name": "Take out trash", "date": "2025-12-10"},
                    {"name": "Wash dishes", "date": "2025-12-11"}
                ]
            },
            "Luca": {
                "config": {
                    "tasksPerWeek": 6,
                    "allowance": 1.0,
                    "reward": 0.1
                },
                "choreList": [
                    {"name": "Clean room", "date": "2025-12-10"},
                    {"name": "Do homework", "date": "2025-12-11"}
                ]
            }
        }



class FileAllowanceStore(BaseJsonStore):
    """File-based store for allowance accounts and transactions.

    File structure (example):
    {
      "Milou": {
        "account": { ... },
        "transactions": [ {...}, ... ]
      },
      "Luca": { ... }
    }
    """

    _file_name = "allowance_state.json"

    def get_default_content(self) -> dict:
        def default_account():
            return {
                "id": None,
                "entityType": "account",
                "currentBalance": 0.0,
                "currency": "EUR",
                "settings": {
                    "weeklyAllowance": 0.0,
                    "autoPayDayOfWeek": 5,
                },
                "lastUpdated": None,
                "version": 1,
            }

        return {
            "Milou": {
                "account": default_account(),
                "transactions": [],
            },
            "Luca": {
                "account": default_account(),
                "transactions": [],
            },
        }


class FileAllowanceRepository:
    """Allowance repository implementation backed by a local JSON file."""

    def __init__(self, store: FileAllowanceStore):
        self.store = store

    def _ensure_user(self, data: dict, user_id: str) -> None:
        if user_id not in data:
            # Initialize with default structure for new users
            template = self.store.get_default_content()
            if user_id in template:
                data[user_id] = template[user_id]
            else:
                data[user_id] = {
                    "account": {
                        "id": None,
                        "entityType": "account",
                        "currentBalance": 0.0,
                        "currency": "EUR",
                        "settings": {
                            "weeklyAllowance": 0.0,
                            "autoPayDayOfWeek": 5,
                        },
                        "lastUpdated": None,
                        "version": 1,
                    },
                    "transactions": [],
                }

        # Ensure there is an id on the account for consistency
        account = data[user_id]["account"]
        if account.get("id") is None:
            account["id"] = f"account#{user_id}"

    def get_account(self, user_id: str) -> dict:
        data = self.store.load()
        self._ensure_user(data, user_id)
        self.store.save(data)
        return data[user_id]["account"]

    def get_recent_transactions(self, user_id: str, limit: int = 20) -> List[Dict]:
        data = self.store.load()
        self._ensure_user(data, user_id)
        transactions = data[user_id]["transactions"]

        # Sort newest first by timestamp when available
        def ts(tx: dict) -> str:
            return tx.get("timestamp", "")

        transactions_sorted = sorted(transactions, key=ts, reverse=True)
        return transactions_sorted[: int(limit)]

    def add_transaction(
        self,
        user_id: str,
        amount: float,
        tx_type: str,
        description: Optional[str] = None,
    ) -> Tuple[Dict, Dict]:
        data = self.store.load()
        self._ensure_user(data, user_id)

        account = data[user_id]["account"]
        old_balance = float(account.get("currentBalance", 0.0))
        new_balance = old_balance + float(amount)

        now = datetime.now(timezone.utc).isoformat()

        tx_doc: dict = {
            "id": f"tx#{user_id}#{uuid.uuid4()}",
            "entityType": "transaction",
            "userId": user_id,
            "timestamp": now,
            "amount": float(amount),
            "direction": "credit" if amount >= 0 else "debit",
            "type": tx_type,
            "description": description,
            "balanceAfter": new_balance,
        }

        data[user_id]["transactions"].append(tx_doc)

        account["currentBalance"] = new_balance
        account["lastUpdated"] = now
        account["version"] = int(account.get("version", 1)) + 1

        self.store.save(data)
        logger.info(f"Allowance transaction stored in file backend for {user_id}")
        return account, tx_doc

    def update_settings(self, user_id: str, new_settings: dict) -> dict:
        data = self.store.load()
        self._ensure_user(data, user_id)

        account = data[user_id]["account"]
        settings = account.setdefault("settings", {})
        settings.update(new_settings)

        now = datetime.now(timezone.utc).isoformat()
        account["lastUpdated"] = now
        account["version"] = int(account.get("version", 1)) + 1

        self.store.save(data)
        logger.info(f"Allowance settings updated in file backend for {user_id}")
        return account


def create_file_allowance_repository() -> FileAllowanceRepository:
    """Factory for the file-based allowance repository."""
    store = FileAllowanceStore()
    return FileAllowanceRepository(store)


# Initialize stores with new names
config_store = FileConfigStore()
state_store = FileStateStore()
