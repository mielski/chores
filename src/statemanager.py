import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class _StateManager:
    state_file = 'state.json'
    config_file = 'config.json'

    def load_state(self):
        """Load state from JSON file with error handling"""
        try:
            with open(self.state_file, 'r') as f:
                state = json.load(f)
                logger.info("State loaded successfully")
                return state
        except (FileNotFoundError, json.JSONDecodeError) as e:
            logger.error(f"Error loading state: {e}")
            # Return default state and recreate file
            return self._init_state_file()

    def _init_state_file(self):
        """Initialize state file with default values"""
        default_state = {
            "milou": [False] * 7,
            "luca": [False] * 7,
            "general": [False] * 2
        }
        try:
            with open(self.state_file, 'w') as f:
                json.dump(default_state, f, indent=2)
                logger.info("State file initialized with default values")
        except Exception as e:
            logger.error(f"Error initializing state file: {e}")
        return default_state
    
    def save_state(self):
        """Save state to JSON file with error handling"""
        try:
            with open(self.state_file, 'w') as f:
                json.dump(self.state, f, indent=2)
                logger.info("State saved successfully")
            return True
        except Exception as e:
            logger.error(f"Error saving state: {e}")
            return False

    def reset_state(self):
        """Reset state to default values"""
        self.state = {
            "milou": [False] * 7,
            "luca": [False] * 7,
            "general": [False] * 2
        }
        self.save_state()

state_manager = _StateManager()
