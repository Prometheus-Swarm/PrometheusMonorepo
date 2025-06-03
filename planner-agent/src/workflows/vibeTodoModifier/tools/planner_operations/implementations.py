from typing import Dict, List, Any
import uuid
from ...utils import (
    IssueModel,
    insert_issue_to_mongodb,
    SwarmBountyType,
)


def generate_task(
    task: Dict[str, Any] = None,
    **kwargs,
) -> dict:
    """Generate a Task for the repository.

    Args:
        task: Task dictionary, each containing:
            - title: Task title
            - description: Task description
            - acceptance_criteria: List of acceptance criteria

    Returns:
        dict: Result of the operation containing:
            - success: Whether the operation succeeded
            - message: Success/error message
            - data: Dictionary containing:
                - task_count: Number of tasks written
                - tasks: List of task dictionaries
            - error: Error message if any
    """
    try:
        task_uuid = str(uuid.uuid4())
        task["uuid"] = task_uuid
        return {
            "success": True,
            "message": f"Successfully generated {len(task)} tasks",
            "data": {
                "task": task,
            },
            "error": None,
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Failed to generate tasks: {str(e)}",
            "data": None,
            "error": str(e),
        }





def create_task_dependency(
    task_uuid: str, dependency_tasks: List[str], **kwargs
) -> dict:
    """Create the task dependency for a task.

    Args:
        task_uuid: UUID of the task
        dependency_tasks: List of UUIDs of dependency tasks

    Returns:
        dict: Result of the operation containing:
            - success: Whether the operation succeeded
            - message: Success/error message
            - data: Dictionary containing:
                - task_uuid: UUID of the task
                - dependency_tasks: List of UUIDs of dependency tasks
    """
    try:
        # Create a new dict one is task_uuid and value is dependency_tasks
        dependency_tasks_dict = {task_uuid: dependency_tasks}
        return {
            "success": True,
            "message": f"Successfully updated dependency tasks for {task_uuid}",
            "data": dependency_tasks_dict,
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "message": f"Failed to update dependency tasks: {str(e)}",
            "data": None,
        }


def generate_issues(
    issues: List[Dict[str, Any]] = None,
    **kwargs,
) -> dict:
    """Generate issues for the repository.

    Args:
        issues: List of issue dictionaries, each containing:
            - title: Issue title
            - description: Issue description
            - acceptance_criteria: List of acceptance criteria

    Returns:
        dict: Result of the operation containing:
            - success: Whether the operation succeeded
            - message: Success/error message
            - data: Dictionary containing:
                - issue_count: Number of issues generated
                - issues: List of issue dictionaries with UUIDs
            - error: Error message if any
    """
    try:
        for issue in issues:
            issue_uuid = str(uuid.uuid4())
            issue["uuid"] = issue_uuid
        return {
            "success": True,
            "message": f"Successfully generated {len(issues)} issues",
            "data": {
                "issue_count": len(issues),
                "issues": issues,
                "approved": False,
            },
            "error": None,
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Failed to generate issues: {str(e)}",
            "data": {"approved": False},
            "error": str(e),
        }


def audit_tasks(
    result: bool,
    **kwargs,
) -> dict:
    """Audit the tasks."""
    try:
        return {
            "success": True,
            "message": "Successfully audited tasks",
            "data": {
                "result": result,
            },
            "error": None,
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Failed to validate tasks: {str(e)}",
            "data": None,
            "error": str(e),
        }


def generate_system_prompt(
    prompt: str,
    **kwargs,
) -> dict:
    """Generate a system prompt for the feature.

    Args:
        prompt: The system prompt text

    Returns:
        dict: Result of the operation containing:
            - success: Whether the operation succeeded
            - message: Success/error message
            - data: Dictionary containing:
                - prompt: The generated system prompt
            - error: Error message if any
    """
    try:
        return {
            "success": True,
            "message": "Successfully generated system prompt",
            "data": {
                "prompt": prompt,
            },
            "error": None,
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Failed to generate system prompt: {str(e)}",
            "data": None,
            "error": str(e),
        }


def approve_issues(
    issues: List[Dict[str, Any]] = None,
    repo_owner: str = None,
    repo_name: str = None,
    bounty_id: str = None,
    fork_owner: str = None,
    fork_url: str = None,
    **kwargs,
) -> dict:
    """Save approved issues to MongoDB."""
    try:
        previous_issue_uuid = None
        for issue in issues:
            issue_model = IssueModel(
                title=issue["title"],
                description=issue["description"],
                repoOwner=repo_owner,
                repoName=repo_name,
                uuid=issue["uuid"],
                bountyId=bounty_id,
                forkOwner=fork_owner,
                forkUrl=fork_url,
                predecessorUuid=previous_issue_uuid,
                bountyType=SwarmBountyType.BUILD_FEATURE,
            )
            insert_issue_to_mongodb(issue_model)
            previous_issue_uuid = issue["uuid"]
        return {
            "success": True,
            "message": "Successfully approved issues",
            "data": {"approved": True},
            "error": None,
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Failed to approve issues: {str(e)}",
            "data": {"approved": True},
            "error": str(e),
        }
