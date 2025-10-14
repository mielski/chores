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


class TaskConfigManager(BaseJsonManager):
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

    def get_default_state_for_config(self):
        """Generate default state based on current configuration"""
        config = self.content
        state = {}
        
        # Create state for each user based on their task count
        for user_id, user_config in config['users'].items():
            task_count = user_config['tasksPerWeek']
            state[user_id] = [False] * task_count
        
        # Create state for general tasks
        state['general'] = [False] * len(config['generalTasks'])
        
        return state


class StateManager(BaseJsonManager):
    """
    Manages the state of the user tasks.
    """
    def __init__(self):
        # Initialize with a basic default, will be updated by task config
        default_state = {
            "milou": [False] * 7,
            "luca": [False] * 7,
            "general": [False] * 2
        }
        super().__init__('household_state.json', default_state)

    def load_state(self):
        """Load state, ensuring it matches current task configuration"""
        # Load the current state
        current_state = super().load()
        
        # Get expected state structure from task config
        expected_state = task_config_manager.get_default_state_for_config()
        
        # Validate and adjust state if needed
        adjusted_state = {}
        for user_id, expected_tasks in expected_state.items():
            if user_id in current_state:
                current_tasks = current_state[user_id]
                expected_length = len(expected_tasks)
                current_length = len(current_tasks)
                
                if current_length == expected_length:
                    # Perfect match
                    adjusted_state[user_id] = current_tasks
                elif current_length > expected_length:
                    # Truncate if too long
                    adjusted_state[user_id] = current_tasks[:expected_length]
                    logger.info(f"Truncated {user_id} tasks from {current_length} to {expected_length}")
                else:
                    # Extend if too short
                    adjusted_state[user_id] = current_tasks + [False] * (expected_length - current_length)
                    logger.info(f"Extended {user_id} tasks from {current_length} to {expected_length}")
            else:
                # User doesn't exist in current state, use default
                adjusted_state[user_id] = expected_tasks.copy()
                logger.info(f"Added new user {user_id} with {len(expected_tasks)} tasks")
        
        # Save adjusted state if it changed
        if adjusted_state != current_state:
            self.content = adjusted_state
            self.save()
            logger.info("State adjusted to match task configuration")
        
        return adjusted_state

    def save_state(self, new_state):
        """Save new state"""
        self.content = new_state
        return self.save()

    def reset_to_config(self):
        """Reset state to match current task configuration"""
        default_state = task_config_manager.get_default_state_for_config()
        self.content = default_state
        self.save()
        logger.info("State reset to match task configuration")
        return default_state


class ConfigManager(BaseJsonManager):
    def __init__(self):
        default_config = {
            "username": "admin",
            "password": "password"
        }
        super().__init__('config.json', default_config)

# Initialize managers
task_config_manager = TaskConfigManager()
state_manager = StateManager()
config_manager = ConfigManager()
