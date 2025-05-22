"""Merge conflict resolver workflow phases."""

from typing import List
from prometheus_swarm.workflows.base import WorkflowPhase, Workflow, requires_context


@requires_context(
    templates={
        "current_files": List[str],  # List of files in the repository
    },
    tools={
        "repo_path": str,  # Path to the repository for git operations
    },
)
class ConflictResolutionPhase(WorkflowPhase):
    def __init__(self, workflow: Workflow, conversation_id: str = None):
        super().__init__(
            workflow=workflow,
            prompt_name="resolve_conflicts",
            available_tools=[
                "read_file",
                "list_files",
                "resolve_conflict",
            ],
            conversation_id=conversation_id,
            name="Conflict Resolution",
        )


# @requires_context(
#     templates={
#         "source_fork": dict,  # Source fork info (url, owner, name, branch)
#         "working_fork": dict,  # Working fork info (url, owner, name)
#         "upstream": dict,  # Upstream repo info (url, owner, name, default_branch)
#         "pr_details": List[
#             dict
#         ],  # List of {number, title, url, source_owner, source_repo, description} for merged PRs
#         "is_draft": bool,  # Whether to create a draft PR (default: False)
#     },
#     tools={
#         "repo_owner": str,  # Owner of the source repository
#         "repo_name": str,  # Name of the source repository
#         "staking_key": str,  # Leader's staking key
#         "pub_key": str,  # Leader's public key
#         "staking_signature": str,  # Leader's staking signature
#         "public_signature": str,  # Leader's public signature
#         "head_branch": str,  # Head branch for the PR
#         "github_token": str,  # GitHub token for authentication
#         "github_username": str,  # GitHub username for PR creation
#         "is_draft": bool,  # Whether to create a draft PR
#     },
# )
class DraftPullRequestPhase(WorkflowPhase):
    """Create an initial draft pull request.

    This phase creates a draft PR at the beginning of the workflow to track progress.
    The PR will be created with [WIP] prefix and draft status.
    """

    def __init__(self, workflow: Workflow, conversation_id: str = None):
        super().__init__(
            workflow=workflow,
            prompt_name="create_draft_pr",
            available_tools=[
                "read_file",
                "list_files",
                "create_leader_pull_request",
            ],
            conversation_id=conversation_id,
            name="Create Draft Pull Request",
        )


# @requires_context(
#     templates={
#         "source_fork": dict,  # Source fork info (url, owner, name, branch)
#         "working_fork": dict,  # Working fork info (url, owner, name)
#         "upstream": dict,  # Upstream repo info (url, owner, name, default_branch)
#         "pr_details": List[
#             dict
#         ],  # List of {number, title, url, source_owner, source_repo, description} for merged PRs
#         "is_draft": bool,  # Whether to create a draft PR (default: False)
#     },
#     tools={
#         "repo_owner": str,  # Owner of the source repository
#         "repo_name": str,  # Name of the source repository
#         "staking_key": str,  # Leader's staking key
#         "pub_key": str,  # Leader's public key
#         "staking_signature": str,  # Leader's staking signature
#         "public_signature": str,  # Leader's public signature
#         "head_branch": str,  # Head branch for the PR
#         "github_token": str,  # GitHub token for authentication
#         "github_username": str,  # GitHub username for PR creation
#         "is_draft": bool,  # Whether to create a draft PR
#     },
# )
class CreatePullRequestPhase(WorkflowPhase):
    """Create a pull request for the consolidated changes.

    This phase creates the final pull request after all PRs have been merged.
    The PR will be created as a regular (non-draft) PR.
    """

    def __init__(self, workflow: Workflow, conversation_id: str = None):
        super().__init__(
            workflow=workflow,
            prompt_name="create_consolidated_pr",
            available_tools=[
                "read_file",
                "list_files",
                "create_leader_pull_request",
            ],
            conversation_id=conversation_id,
            name="Create Pull Request",
        )


@requires_context(
    templates={
        "current_files": List[str],
    }
)
class TestVerificationPhase(WorkflowPhase):
    """Run tests and fix any issues after merging PRs."""

    def __init__(self, workflow=None, conversation_id: str = None):
        super().__init__(
            workflow=workflow,
            prompt_name="verify_tests",
            available_tools=[
                "run_tests",
                "read_file",
                "write_file",
                "list_files",
            ],
            conversation_id=conversation_id,
            name="Test Verification",
        )
