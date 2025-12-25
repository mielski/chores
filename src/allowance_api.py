"""Flask blueprint for allowance (savings account) APIs.

This module only defines the route structure and basic request/response
shapes. The actual implementations are intentionally left open so you
can practice wiring in the repository and business logic yourself.

Expected repository interface (see storage_factory.AllowanceRepositoryProtocol):

- get_account(user_id: str) -> dict
- get_recent_transactions(user_id: str, limit: int = 20) -> list[dict]
- add_transaction(user_id: str, amount: float, type: str, description: str | None = None) -> tuple[dict, dict]
- update_settings(user_id: str, new_settings: dict) -> dict
- remove_last_transaction(user_id: str) -> dict

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
import logging

from flask import Blueprint, jsonify, request, current_app
from flask_login import login_required

from storage_factory import AllowanceRepositoryProtocol


allowance_bp = Blueprint("allowance", __name__, url_prefix="/api/allowance")


def _get_repo() -> AllowanceRepositoryProtocol:
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

    Error responses:
        403: {"success": False, "error": "not found"}
        500: {"success": False, "error": "A system error occured"}
    """
    try:
        repo = _get_repo()
        account = repo.get_account(user_id=user_id)
        if account:
            return jsonify({
                "success": True,
                "data": account,
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": "not found"
            }), 404
    except Exception as e:
        logging.exception("Error fetching allowance account", exc_info=e)
        return jsonify({
            "success": False,
            "error": "A system error occured",
        }), 500



@allowance_bp.route("/<user_id>/transactions", methods=["GET"])
@login_required
def get_allowance_transactions(user_id: str):
    """Get recent allowance transactions for a user.

    Path parameters:
        - user_id: the uder for which to return transactions.
    Query parameters:
        - limit (int, optional): maximum number of transactions to return.

    Expected JSON response shape on success:
        {"success": True, "data": [ ... transaction documents ... ]}

    """
    # Example of how to parse the limit parameter (you can reuse this):
    try:
        limit = int(request.args.get("limit", 20))
        if limit <= 0:
            raise ValueError()
    except ValueError:
        return jsonify({
            "success": False,
            "error": "Invalid 'limit' query parameter",
        }), 400

    repo = _get_repo()
    try:
        transactions = repo.get_recent_transactions(user_id=user_id, limit=limit)
    except Exception as e:
        logging.exception("Error getting transactions from server side", exc_info=e)
        return jsonify({
            "success": False,
            "error": "Unknown system error in getting recent transactions",
            "limit": limit,
        }), 500
    
    return jsonify({
        "success": True,
        "transactions": transactions,

    }), 200


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

    """
    payload = request.get_json() or {}

    # Example of basic validation you can extend:
    if "amount" not in payload:
        return jsonify({
            "success": False,
            "error": "Missing required field 'amount'",
        }), 400
    
    if "type" not in payload:
        payload["type"] = "MANUAL"  # default type
    if payload["type"] not in ("ALLOWANCE", "BONUS", "MANUAL"):
        return jsonify({
            "success": False,
            "error": "Invalid transaction type",
        }), 400
    if not isinstance(payload["amount"], (int, float)):
        return jsonify({
            "success": False,
            "error": "'amount' must be a number",
        }), 400
    repo = _get_repo()

    try:
        account, transaction = repo.add_transaction(
            user_id=user_id,
            amount=payload["amount"],
            tx_type=payload["type"],
            description=payload.get("description")
        )
    except Exception as e:
        logging.exception("Error adding transaction on server side", exc_info=e)
        return jsonify({
            "success": False,
            "error": "Unknown system error in creating transaction",
            "payload": payload,
        }), 500
    return jsonify({
        "success": True,
        "account": account,
        "transaction": transaction,
    }), 200

@allowance_bp.route("/<user_id>/transactions/last", methods=["DELETE"])
@login_required
def delete_last_allowance_transaction(user_id: str):
    """
    delete_last_allowance_transaction for the user
    
    Path parameters:
        - user_id: the uder for which to return transactions.
    
    Expected JSON response shape on success:
        {
            "success": True,
            "account": { ... updated account ... },
            "transaction": { ... deleted transaction ... }
        }
    """

    repo = _get_repo()
    try:
        account, transaction = repo.delete_last_transaction(user_id=user_id)
    except Exception as e:
        logging.exception("Error deleting last transaction on server side", exc_info=e)
        return jsonify({
            "success": False,
            "error": "Unknown system error in deleting last transaction",
        }), 500
    if transaction == {}:
        return jsonify({
            "success": False,
            "error": "No transactions to delete",
        }), 400
    
    return jsonify({
        "success": True,
        "account": account,
        "transaction": transaction,
    }), 200


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
