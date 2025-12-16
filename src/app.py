"""
Flask backend for Household Task Tracker
Serves static files and provides REST API for state management
"""
import os
import logging

from dotenv import load_dotenv
from flask import Flask, request, jsonify, send_from_directory, render_template, redirect, url_for
from flask_bootstrap import Bootstrap5
from flask_cors import CORS
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required
from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, SubmitField
from wtforms.validators import DataRequired
from storage_factory import create_storage_managers, get_storage_info


# Constants for environment variable keys
APP_USERNAME = 'APP_USERNAME'
APP_PASSWORD = 'APP_PASSWORD'

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize storage managers using factory method
config_store, state_store = create_storage_managers(user_id="household")

app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv('SECRET')
try:
    app.config[APP_USERNAME] = os.environ[APP_USERNAME]
    app.config[APP_PASSWORD] = os.environ[APP_PASSWORD]
except KeyError as e:
    logger.error(f"No username and/or password environment variables found, terminating application")
    exit(1)
CORS(app)

# setup Flask-Login
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# setup Flask-Bootstrap
bootstrap = Bootstrap5(app)

class User(UserMixin):
    """User class for Flask-Login"""
    def __init__(self, id):
        self.id = id

    def is_authenticated(self):
        return True

    def is_active(self):
        return True

    def is_anonymous(self):
        return False
    
@login_manager.user_loader
def load_user(user_id):
    """checks if user ID can be found and return a user object"""
    if user_id == app.config[APP_USERNAME]:
        return User(id=user_id)
    return None

# Configuration
STATE_FILE = os.getenv('STATE_FILE', 'household_state_v2.json')
PORT = int(os.getenv('PORT', 8080))
DEBUG = os.getenv('DEBUG', 'false').lower() == 'true'
APP_VERSION = os.getenv('APP_VERSION', 'dev')


class LoginForm(FlaskForm):
    """Form for user login"""

    username = StringField('Username', validators=[DataRequired()])
    password = PasswordField('Password', validators=[DataRequired()])
    submit = SubmitField('Login')

@app.route('/login', methods=['GET', 'POST'])
def login():
    """Render login page and handle login logic
    
    credentials are checked against environment variables
    If login is successful, user is redirected to the main page
    """
    form = LoginForm()
    if form.validate_on_submit():
        username = form.username.data
        password = form.password.data
        if username == app.config[APP_USERNAME] and password == app.config[APP_PASSWORD]:
            user = User(id=username)
            login_user(user)
            return redirect('/')
        else:
            return render_template('login.html', form=form, error='Invalid credentials')
    # Render a simple login form with CSRF token
    return render_template('login.html', form=form, error=None)

@app.route('/logout')
@login_required
def logout():
    """Logout the current user and redirect to login"""
    logout_user()
    return redirect(url_for('login'))

@app.route('/')
@login_required
def index():
    """Serve the main HTML file"""
    return send_from_directory('static', 'index.html')

@app.route('/config')
@login_required
def config_page():
    """Serve the configuration page"""
    return send_from_directory('static', 'configpage.html')

@app.route('/<path:filename>')
def static_files(filename):
    """Serve static files (CSS, JS, etc.)"""
    return send_from_directory('static', filename)

# API Endpoints
@app.route('/api/config', methods=['GET'])
@login_required
def get_config():
    """Get current task configuration"""
    try:
        config = config_store.load()
        return jsonify({
            'success': True,
            'data': config
        })
    except Exception as e:
        logger.error(f"Error getting config: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/config', methods=['POST'])
@login_required
def update_config():
    """Update task configuration"""
    try:
        new_config = request.get_json()
        
        if not new_config:
            return jsonify({
                'success': False,
                'error': 'No data provided'
            }), 400
        
        # Validate config structure (basic validation)
        required_keys = ['users', 'generalTasks', 'personalTasks']
        if not all(key in new_config for key in required_keys):
            return jsonify({
                'success': False,
                'error': f'Missing required keys. Expected: {required_keys}'
            }), 400
        
        # Save new configuration
        success = config_store.save(new_config)
        
        if success:
            # Reset task state in case the number of tasks/users changed and state is now inconsistent
            state_store.reset()
            
            return jsonify({
                'success': True,
                'message': 'Configuration updated successfully'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to save configuration'
            }), 500

    except Exception as e:
        logger.error(f"Error updating config: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/state', methods=['GET'])
def get_state():
    """Get current application state"""
    try:
        state = state_store.load()
        return jsonify({
            'success': True,
            'data': state
        })
    except Exception as e:
        logger.error(f"Error getting state: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/state', methods=['POST'])
def update_state():
    """Update application state"""
    try:
        new_state = request.get_json()
        
        if not new_state:
            return jsonify({
                'success': False,
                'error': 'No data provided'
            }), 400
        
        # Validate state structure
        required_keys = ['Milou', 'Luca']
        if not all(key in new_state for key in required_keys):
            return jsonify({
                'success': False,
                'error': f'Missing required keys. Expected: {required_keys}'
            }), 400
        
        success = state_store.save(new_state)
        if success:
            return jsonify({
                'success': True,
                'message': 'State updated successfully'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to save state'
            }), 500

    except Exception as e:
        logger.error(f"Error updating state: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/reset', methods=['POST'])
def reset_state():
    """Reset application state to default based on current configuration"""
    try:
        default_state = state_store.reset()
        
        return jsonify({
            'success': True,
            'message': 'State reset successfully',
            'data': default_state
        })
            
    except Exception as e:
        logger.error(f"Error resetting state: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'household-tracker'
    })

@app.route('/api/version', methods=['GET'])
def get_version():
    """Get application version"""
    return jsonify({
        'version': APP_VERSION
    })

@app.route('/api/storage', methods=['GET'])
@login_required  # Add authentication requirement
def get_storage():
    """Get storage backend information (authenticated users only)"""

    
    # Only include sensitive info in debug mode or for development
    include_sensitive = DEBUG or os.getenv('INCLUDE_STORAGE_DETAILS', 'false').lower() == 'true'
    
    return jsonify(get_storage_info(include_sensitive=include_sensitive))

if __name__ == '__main__':
    # Initialize state file on startup
    config_store._init_file()
    state_store._init_file()

    logger.info(f"Starting Flask app on port {PORT}")
    logger.info(f"Debug mode: {DEBUG}")
    logger.info(f"State file: {STATE_FILE}")
    
    app.run(
        host='0.0.0.0',
        port=PORT,
        debug=DEBUG
    )
