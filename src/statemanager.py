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

    def save(self, data):
        """Save content to JSON file with error handling"""
        try:
            with open(self.file_name, 'w') as f:
                json.dump(data, f, indent=2)
                logger.info(f"{self.file_name} saved successfully")
            return True
        except Exception as e:
            logger.error(f"Error saving {self.file_name}: {e}")
            return False

    def reset(self):
        """Reset content to default values"""
        self.save(self.default_content.copy())


class AppConfigManager(BaseJsonManager):
    """
    Manages the app configuration
    users - dict of user_id to user config (name, tasksPerWeek)
    generalTasks - list of general tasks accomplished once over users
    personalTasks - list of personal tasks accomplished once per user
    """

    def __init__(self):
        default_config = {
            "users": {},
            "generalTasks": [],
            "personalTasks": [],
            "messages": []
        }
        super().__init__('task_config.json', default_config)




class AppTaskStateManager(BaseJsonManager):
    """
    Manages the task completion state.
    """
    def __init__(self, config_manager):
        # Initialize with a basic default, will be updated by task config
        # param config_manager: Instance of AppConfigManager
        self.config_manager = config_manager
        
        super().__init__('household_state.json', default_content=None)

    def reset(self):
        """Reset state using the app configuration to define the 
        structure."""

        config = self.config_manager.load()
        state = {}
        
        # Create state for each user based on their task count
        for user_id in config['users'].keys():
            task_count = len(config['personalTasks']) * 7
            state[user_id] = [False] * task_count
        
        # Create state for general tasks
        state['general'] = [False] * len(config['generalTasks']) * 7

        self.save(state)
        logger.info("State reset to match task configuration")
        logger.info(state)


# Initialize managers
task_config_manager = AppConfigManager()
state_manager = AppTaskStateManager(config_manager=task_config_manager)
