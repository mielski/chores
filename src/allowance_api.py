"""Flask blueprint for allowance (savings account) APIs.

This module only defines the route structure and basic request/response
shapes. The actual implementations are intentionally left open so you
can practice wiring in the repository and business logic yourself.

Expected repository interface (see storage_factory.AllowanceRepositoryProtocol):

- get_account(user_id: str) -> dict
- get_recent_transactions(user_id: str, limit: int = 20) -> list[dict]
- add_transaction(user_id: str, amount: float, tx_type: str, description: str | None = None) -> tuple[dict, dict]
- update_settings(user_id: str, new_settings: dict) -> dict

Suggested wiring pattern in app setup:

    from storage_factory import create_allowance_repository
    from allowance_api import allowance_bp

    allowance_repo = create_allowance_repository(user_id="household2")
    app.config["ALLOWANCE_REPOSITORY"] = allowance_repo
    app.register_blueprint(allowance_bp)

Inside the route handlers below you can retrieve the repository with:

    repo = current_app.config["ALLOWANCE_REPOSITORY"]

and then call the methods listed above.
"""

from flask import Blueprint, jsonify, request, current_app
from flask_login import login_required


allowance_bp = Blueprint("allowance", __name__, url_prefix="/api/allowance")


def _get_repo():
    """Helper to fetch the allowance repository from app config.

    You can change this if you prefer a different injection pattern.
    """
    repo = current_app.config.get("ALLOWANCE_REPOSITORY")
    if repo is None:
        # You can replace this with lazy initialization if you prefer.
        raise RuntimeError("ALLOWANCE_REPOSITORY is not configured on the Flask app")
    return repo


@allowance_bp.route("/<user_id>/account", methods=["GET"])
@login_required
def get_allowance_account(user_id: str):
    """Get the current allowance account for a user.

    Expected JSON response shape on success:
        {"success": True, "data": { ... account document ... }}

    TODO: implement using repo.get_account(user_id).
    """
    # TODO: replace this stub implementation
    return jsonify({
        "success": False,
        "error": "Not implemented yet: GET /api/allowance/<user_id>/account",
    }), 501


@allowance_bp.route("/<user_id>/transactions", methods=["GET"])
@login_required
def get_allowance_transactions(user_id: str):
    """Get recent allowance transactions for a user.

    Query parameters:
        - limit (int, optional): maximum number of transactions to return.

    Expected JSON response shape on success:
        {"success": True, "data": [ ... transaction documents ... ]}

    TODO: implement using repo.get_recent_transactions(user_id, limit).
    """
    # Example of how to parse the limit parameter (you can reuse this):
    try:
        limit = int(request.args.get("limit", 20))
    except ValueError:
        return jsonify({
            "success": False,
            "error": "Invalid 'limit' query parameter",
        }), 400

    # TODO: replace this stub implementation
    return jsonify({
        "success": False,
        "error": "Not implemented yet: GET /api/allowance/<user_id>/transactions",
        "limit": limit,
    }), 501


@allowance_bp.route("/<user_id>/transactions", methods=["POST"])
@login_required
def create_allowance_transaction(user_id: str):
    """Create a new allowance transaction for a user.

    Expected JSON request body:
        {
            "amount": <number>,          # required, positive or negative
            "type": "ALLOWANCE" | "BONUS" | "MANUAL",  # optional, default MANUAL
            "description": <string>      # optional
        }

    Expected JSON response shape on success:
        {
            "success": True,
            "account": { ... updated account ... },
            "transaction": { ... created transaction ... }
        }

    TODO: implement using repo.add_transaction(...).
    """
    payload = request.get_json(silent=True) or {}

    # Example of basic validation you can extend:
    if "amount" not in payload:
        return jsonify({
            "success": False,
            "error": "Missing required field 'amount'",
        }), 400

    # TODO: replace this stub implementation
    return jsonify({
        "success": False,
        "error": "Not implemented yet: POST /api/allowance/<user_id>/transactions",
        "payload": payload,
    }), 501


@allowance_bp.route("/<user_id>/settings", methods=["PATCH", "PUT"])
@login_required
def update_allowance_settings(user_id: str):
    """Update allowance settings for a user.

    Expected JSON request body (example):
        {
            "weeklyAllowance": 2.5,
            "autoPayDayOfWeek": 5
        }

    Expected JSON response shape on success:
        {"success": True, "data": { ... updated account ... }}

    TODO: implement using repo.update_settings(user_id, new_settings).
    """
    new_settings = request.get_json(silent=True) or {}

    # Basic guard against empty body
    if not new_settings:
        return jsonify({
            "success": False,
            "error": "No settings provided",
        }), 400

    # TODO: replace this stub implementation
    return jsonify({
        "success": False,
        "error": "Not implemented yet: PATCH /api/allowance/<user_id>/settings",
        "payload": new_settings,
    }), 501
