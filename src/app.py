"""
Flask backend for Household Task Tracker
Serves static files and provides REST API for state management
"""
import os
import json
import logging
import traceback

from dotenv import load_dotenv
from flask import Flask, request, jsonify, send_from_directory, render_template, redirect, url_for
from flask_bootstrap import Bootstrap5
from flask_cors import CORS
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, SubmitField
from wtforms.validators import DataRequired


# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv('SECRET')
try:
    app.config["USERNAME"] = os.environ['USERNAME']
    app.config["PASSWORD"] = os.environ['PASSWORD']
except KeyError as e:
    logger.error(f"No username and/or password environment variables found: {e}")
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
    if user_id == app.config["USERNAME"]:
        return User(id=user_id)
    return None

# Configuration
STATE_FILE = os.getenv('STATE_FILE', 'household_state.json')
PORT = int(os.getenv('PORT', 8080))
DEBUG = os.getenv('DEBUG', 'false').lower() == 'true'

def init_state_file():
    """Initialize state file if it doesn't exist"""
    default_state = {
        "milou": [False] * 7,
        "luca": [False] * 7, 
        "general": [False] * 2
    }
    
    if not os.path.exists(STATE_FILE):
        logger.info(f"Creating new state file: {STATE_FILE}")
        with open(STATE_FILE, 'w') as f:
            json.dump(default_state, f)
    else:
        logger.info(f"Using existing state file: {STATE_FILE}")

def load_state():
    """Load state from JSON file with error handling"""
    try:
        with open(STATE_FILE, 'r') as f:
            state = json.load(f)
            logger.info("State loaded successfully")
            return state
    except (FileNotFoundError, json.JSONDecodeError) as e:
        logger.error(f"Error loading state: {e}")
        # Return default state and recreate file
        init_state_file()
        return load_state()

def save_state(state):
    """Save state to JSON file with error handling"""
    try:
        with open(STATE_FILE, 'w') as f:
            json.dump(state, f, indent=2)
            logger.info("State saved successfully")
        return True
    except Exception as e:
        logger.error(f"Error saving state: {e}")
        return False
    
class LoginForm(FlaskForm):
    """Form for user login"""

    username = StringField('Username', validators=[DataRequired()])
    password = PasswordField('Password', validators=[DataRequired()])
    submit = SubmitField('Login')

@app.route('/login', methods=['GET', 'POST'])
def login():
    form = LoginForm()
    if form.validate_on_submit():
        username = form.username.data
        password = form.password.data
        if username == app.config["USERNAME"] and password == app.config["PASSWORD"]:
            user = User(id=username)
            login_user(user)
            return redirect('/')
        else:
            return render_template('login.html', form=form, error='Invalid credentials')
    # Render a simple login form with CSRF token
    return render_template('login.html', form=form, error=None)

# Serve static files
@app.route('/')
def index():
    """Serve the main HTML file"""
    return send_from_directory('static', 'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    """Serve static files (CSS, JS, etc.)"""
    return send_from_directory('static', filename)

# API Endpoints
@app.route('/api/state', methods=['GET'])
def get_state():
    """Get current application state"""
    try:
        state = load_state()
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
        required_keys = ['milou', 'luca', 'general']
        if not all(key in new_state for key in required_keys):
            return jsonify({
                'success': False,
                'error': f'Missing required keys. Expected: {required_keys}'
            }), 400
        
        success = save_state(new_state)
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
    """Reset application state to default"""
    try:
        default_state = {
            "milou": [False] * 7,
            "luca": [False] * 7,
            "general": [False] * 2
        }
        
        success = save_state(default_state)
        if success:
            return jsonify({
                'success': True,
                'message': 'State reset successfully',
                'data': default_state
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to reset state'
            }), 500
            
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

if __name__ == '__main__':
    # Initialize state file on startup
    init_state_file()
    
    logger.info(f"Starting Flask app on port {PORT}")
    logger.info(f"Debug mode: {DEBUG}")
    logger.info(f"State file: {STATE_FILE}")
    
    app.run(
        host='0.0.0.0',
        port=PORT,
        debug=DEBUG
    )
