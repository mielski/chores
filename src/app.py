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

from storage_factory import create_state_store, get_storage_info, create_allowance_repository
from allowance_api import allowance_bp

# Constants for environment variable keys
APP_USERNAME = 'APP_USERNAME'
APP_PASSWORD = 'APP_PASSWORD'
APP_ACTION_PASSCODE = 'APP_ACTION_PASSCODE'

# Load environment variables from .env file
load_dotenv()


APP_VERSION = os.getenv('APP_VERSION', 'dev')

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
logging.getLogger('azure.core.pipeline.policies.http_logging_policy').setLevel(logging.WARNING)

# Initialize storage managers using factory method
state_store = create_state_store(user_id="household2")
allowance_repository = create_allowance_repository(user_id="Milou")

# Initialize app & secrets
app = Flask(__name__)
# Configuration


app.config["SECRET_KEY"] = os.getenv('SECRET')
try:
    app.config[APP_USERNAME] = os.environ[APP_USERNAME]
    app.config[APP_PASSWORD] = os.environ[APP_PASSWORD]
except KeyError as e:
    logger.error(f"No username and/or password environment variables found, terminating application")
    exit(1)

# Optional extra passcode for sensitive actions
app.config[APP_ACTION_PASSCODE] = os.getenv(APP_ACTION_PASSCODE)
if not app.config[APP_ACTION_PASSCODE]:
    logger.info("No ACTION_PASSCODE configured; passcode verification endpoint will always succeed.")
CORS(app)

# add allowance API blueprint
app.config["ALLOWANCE_REPOSITORY"] = allowance_repository
app.register_blueprint(allowance_bp)


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


@app.route('/docs')
@login_required
def api_docs():
    """Serve Swagger UI for the Household API."""
    return render_template('swagger.html')

@app.route('/<path:filename>')
def static_files(filename):
    """Serve static files (CSS, JS, etc.)"""
    return send_from_directory('static', filename)

@app.route('/api/state', methods=['GET'])
def get_state():
    """Get current application state, which combines task state and allowance settings"""
    try:
        state = state_store.load()

        # replace the config in the state with the config from the allowance repository for future consistency,
        # having a central configuration for both the tasks API and allowance is work in progress.

        repo = app.config["ALLOWANCE_REPOSITORY"]
        for user_id in state.keys():
            account = repo.get_account(user_id)
            state[user_id]['settings'] = account["settings"]


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
        state_store.reset()
        
        return jsonify({
            'success': True,
            'message': 'State reset successfully',
            'data': get_state().json['data']
        })
            
    except Exception as e:
        logger.error(f"Error resetting state: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
    
@app.route('/api/end-week', methods=['POST'])
def end_week():
    """ends the week and performs necessary state updates:
    - resets weekly tasks
    - updates allowance balances with weekly allowance amounts + bonuses
    """

    repo = app.config["ALLOWANCE_REPOSITORY"]
    if not repo:
        return jsonify({
            'success': False,
            'error': 'Allowance repository not configured'
        }), 500
    
    state = state_store.load()
    for user_id, user_state in state.items():
        account = repo.get_account(user_id)
        
        # get weekly allowance and bonus settings
        weekly_allowance = float(account["settings"].get("weeklyAllowance", 0))
        bonus_per_extra_task = float(account["settings"].get("bonusPerExtraTask", 0))
        tasks_per_week = int(account["settings"].get("tasksPerWeek", 1))
        maximum_extra_tasks = int(account["settings"].get("maximumExtraTasks", 0))

        # add weekly allowance transaction
        repo.add_transaction(
            user_id=user_id,
            amount=weekly_allowance,
            description="zakgeld",
            tx_type="ALLOWANCE")
        
        # calculate and add bonus for extra tasks
        tasks_completed = len(user_state.get("choreList", []))
        extra_tasks_completed = min(max(0, tasks_completed - tasks_per_week), maximum_extra_tasks)
        if extra_tasks_completed:
            repo.add_transaction(
                user_id=user_id,
                amount=extra_tasks_completed * bonus_per_extra_task,
                description="bonus voor extra taakjes",
                tx_type="BONUS"
            )
    
    # reset task state when done
    state_store.reset()
    return jsonify({
        'success': True,
        'message': 'Week ended successfully. State reset and allowances updated.'
    }), 200


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


@app.route('/api/verify-passcode', methods=['POST'])
@login_required
def verify_passcode():
    """Verify a simple action passcode against an environment variable.

    The expected JSON body is: {"code": "..."}.

    If ACTION_PASSCODE is not configured in the environment, verification
    always succeeds so the feature can be considered disabled.
    """
    try:
        data = request.get_json(silent=True) or {}
        provided_code = str(data.get('code', ''))

        configured_code = app.config.get(APP_ACTION_PASSCODE)

        # If no passcode configured, treat verification as always successful
        if not configured_code:
            return jsonify({
                'success': True,
                'valid': True,
                'configured': False
            }), 200

        is_valid = provided_code == configured_code
        return jsonify({
            'success': True,
            'valid': is_valid,
            'configured': True
        }), 200
    except Exception as e:
        logger.error(f"Error verifying passcode: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to verify passcode'
        }), 500

@app.route('/api/storage', methods=['GET'])
@login_required  # Add authentication requirement
def get_storage():
    """Get storage backend information (authenticated users only)"""

    
    # Only include sensitive info in debug mode or for development
    include_sensitive = DEBUG or os.getenv('INCLUDE_STORAGE_DETAILS', 'false').lower() == 'true'
    
    return jsonify(get_storage_info(include_sensitive=include_sensitive))

if __name__ == '__main__':
    # Initialize state file on startup
    state_store._init_file()

    STATE_FILE = os.getenv('STATE_FILE', 'household_state_v2.json')
    PORT = int(os.getenv('PORT', 8080))
    DEBUG = os.getenv('DEBUG', 'false').lower() == 'true'

    logger.info(f"Starting Flask app on port {PORT}")
    logger.info(f"Debug mode: {DEBUG}")
    logger.info(f"State file: {STATE_FILE}")
    
    app.run(
        host='0.0.0.0',
        port=PORT,
        debug=DEBUG
    )
