import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class BaseJsonManager:
    """Base class for loading and saving JSON files with error handling.
    
    This is used to manage state and configuration files for the application."""
    def __init__(self, file_name, default_content):
        self.file_name = file_name
        self.default_content = default_content
        self.content = self.load()

    def load(self):
        """Load content from JSON file with error handling"""
        try:
            with open(self.file_name, 'r') as f:
                data = json.load(f)
                logger.info(f"{self.file_name} loaded successfully")
                return data
        except (FileNotFoundError, json.JSONDecodeError) as e:
            logger.error(f"Error loading {self.file_name}: {e}")
            return self._init_file()

    def _init_file(self):
        """Initialize file with default values"""
        try:
            with open(self.file_name, 'w') as f:
                json.dump(self.default_content, f, indent=2)
                logger.info(f"{self.file_name} initialized with default values")
        except Exception as e:
            logger.error(f"Error initializing {self.file_name}: {e}")
        return self.default_content

    def save(self):
        """Save content to JSON file with error handling"""
        try:
            with open(self.file_name, 'w') as f:
                json.dump(self.content, f, indent=2)
                logger.info(f"{self.file_name} saved successfully")
            return True
        except Exception as e:
            logger.error(f"Error saving {self.file_name}: {e}")
            return False

    def reset(self):
        """Reset content to default values"""
        self.content = self.default_content.copy()
        self.save()


class StateManager(BaseJsonManager):
    def __init__(self):
        default_state = {
            "milou": [False] * 7,
            "luca": [False] * 7,
            "general": [False] * 2
        }
        super().__init__('state.json', default_state)


class ConfigManager(BaseJsonManager):
    def __init__(self):
        default_config = {
            "username": "admin",
            "password": "password"
        }
        super().__init__('config.json', default_config)

state_manager = StateManager()
config_manager = ConfigManager()
