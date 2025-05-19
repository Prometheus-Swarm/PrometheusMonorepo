from src.server.create_app import create_app
import os
from flask import request, jsonify
from prometheus_swarm.utils.logging import logger
from prometheus_swarm.clients import setup_client
from src.workflows.todocreator.workflow import TodoCreatorWorkflow
from src.workflows.todocreator.prompts import PROMPTS
from prometheus_swarm.utils.logging import log_error
from dotenv import load_dotenv
from concurrent.futures import ThreadPoolExecutor

# from src.workflows.audit.workflow import AuditWorkflow
# from src.workflows.audit.prompts import PROMPTS as AUDIT_PROMPTS

# import requests

load_dotenv()

app = create_app()
executor = ThreadPoolExecutor(max_workers=2)


def audit_issues_and_tasks(future):
    # """Review PR and decide if it should be accepted, revised, or rejected."""
    # try:
    #     # Get the result from the completed future
    #     result = future.result()
    #     if not result.get("success"):
    #         logger.error(f"Todo creation failed: {result.get('error')}")
    #         return

    #     # Extract data from the result
    #     data = result.get("data", {})
    #     issues = data.get("issues")
    #     tasks = data.get("tasks")
    #     issue_spec = data.get("issue_spec")
    #     repo_owner = data.get("repo_owner")
    #     repo_name = data.get("repo_name")

    #     # Set up client and workflow
    #     client = setup_client("anthropic")
    #     workflow = AuditWorkflow(
    #         client=client,
    #         prompts=AUDIT_PROMPTS,
    #         issues=issues,
    #         tasks=tasks,
    #         issueSpec=issue_spec,
    #         repo_owner=repo_owner,
    #         repo_name=repo_name,
    #     )

    #     # Run workflow and get result
    #     result = workflow.run()
    #     return result
    # except Exception as e:
    #     logger.error(f"PR review failed: {str(e)}")
    #     raise Exception("PR review failed")'
    pass


def create_todos(source_url: str, fork_url: str, issue_spec: dict, bounty_id: str):
    """Run the workflow in a background thread"""
    try:
        workflow = TodoCreatorWorkflow(
            client=setup_client("anthropic"),
            prompts=PROMPTS,
            source_url=source_url,
            fork_url=fork_url,
            issue_spec=issue_spec,
            bounty_id=bounty_id,
        )
        result = workflow.run()
        if not result or not result.get("success"):
            log_error(
                Exception(result.get("error", "No result")), "Task creation failed"
            )
            return {"success": False, "error": result.get("error", "No result")}
        return {
            "success": True,
            "data": {
                "issues": result.get("data", {}).get("issues", []),
                "tasks": result.get("data", {}).get("tasks", []),
                "issue_spec": issue_spec,
                # Extract repo owner and name from repo_url
                "repo_owner": source_url.split("/")[-2],
                "repo_name": source_url.split("/")[-1],
            },
        }
    except Exception as e:
        logger.error(f"Workflow execution failed: {str(e)}")
        return {"success": False, "error": str(e)}


@app.post("/create-plan")
def create_plan():
    try:
        data = request.get_json()
        logger.info(f"Task data: {data}")
        required_fields = [
            "sourceUrl",
            "forkUrl",
            "issueSpec",
            "bountyId",
        ]
        if any(data.get(field) is None for field in required_fields):
            return jsonify({"error": "Missing data"}), 401

        # Submit task to background executor
        future = executor.submit(
            create_todos,
            source_url=data["sourceUrl"],
            fork_url=data["forkUrl"],
            issue_spec=data["issueSpec"],
            bounty_id=data["bountyId"],
        )
        future.add_done_callback(audit_issues_and_tasks)

        return (
            jsonify({"success": True, "message": "Task submitted for processing"}),
            202,
        )  # 202 Accepted indicates the request was accepted for processing
    except Exception as e:
        logger.error(f"Workflow execution failed: {str(e)}")
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port, debug=True)
