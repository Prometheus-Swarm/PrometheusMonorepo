from flask import Blueprint, jsonify, request
# from src.server.services import repo_classification_service
from src.server.services import repo_classification_kno
bp = Blueprint("repo_classify", __name__)


@bp.post("/repo_classify_kno")
def start_task():   
    logger = repo_classification_kno.logger
    logger.info("Task started")
    data = request.get_json()
    logger.info(f"Task data: {data}")    
    if not data.get("repo_url"):
        return jsonify({"error": "Missing repo_url"}), 401

    result = repo_classification_kno.handle_task_creation(
        repo_url=data["repo_url"],
    )

    return result


