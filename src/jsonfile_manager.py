import json
from datetime import datetime
import logging

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

    def __init__(self, config_store):
        # param config_store: Instance of FileConfigStore
        self.config_store = config_store

    def get_default_content(self) -> dict:
        """Generate default state structure based on current configuration."""
        
        return {
            "Milou": {
                "config": {
                    "tasksPerWeek": 5,
                    "allowance": 2.0,
                    "reward": 0.2
                },
                "choreList": [
                    {"name": "Take out trash", "date": datetime.fromisoformat("2025-12-10")},
                    {"name": "Wash dishes", "date": datetime.fromisoformat("2025-12-11")}
                ]
            },
            "Luca": {
                "config": {
                    "tasksPerWeek": 4,
                    "allowance": 1.0,
                    "reward": 0.1
                },
                "choreList": [
                    {"name": "Clean room", "date": datetime.fromisoformat("2025-12-10")},
                    {"name": "Do homework", "date": datetime.fromisoformat("2025-12-11")}
                ]
            }
        }
        config = self.config_store.load()
        content = {}
        

        # Create state for each user based on their task count
        for user_id in config['users'].keys():
            task_count = len(config['personalTasks']) * 7
            content[user_id] = [False] * task_count
        
        # Create state for general tasks
        content['general'] = [False] * len(config['generalTasks']) * 7
        return content



# Initialize stores with new names
config_store = FileConfigStore()
state_store = FileStateStore(config_store=config_store)
