"""Task decomposition workflow implementation."""

import os
from github import Github
import requests
from prometheus_swarm.workflows.base import Workflow
from prometheus_swarm.utils.logging import log_section, log_key_value, log_error
from src.workflows.repoSummarizer import phases
from prometheus_swarm.workflows.utils import (
    check_required_env_vars,
    cleanup_repository,
    validate_github_auth,
    setup_repository,
)
from kno_sdk import index_repo
from prometheus_swarm.tools.kno_sdk_wrapper.implementations import build_tools_wrapper
from prometheus_swarm.tools.git_operations.implementations import commit_and_push
from src.workflows.repoSummarizer.prompts import PROMPTS
from src.workflows.repoSummarizer.docs_sections import (
    DOCS_SECTIONS,
    INITIAL_SECTIONS,
    FINAL_SECTIONS,
)
from pathlib import Path


class Task:
    def __init__(self, title: str, description: str, acceptance_criteria: list[str]):
        self.title = title
        self.description = description
        self.acceptance_criteria = acceptance_criteria

    def to_dict(self) -> dict:
        """Convert task to dictionary format."""
        return {
            "title": self.title,
            "description": self.description,
            "acceptance_criteria": self.acceptance_criteria,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Task":
        """Create task from dictionary."""
        return cls(
            title=data["title"],
            description=data["description"],
            acceptance_criteria=data["acceptance_criteria"],
        )


class RepoSummarizerWorkflow(Workflow):
    def __init__(
        self,
        client,
        prompts,
        repo_url,
        podcall_signature=None,
        task_id=None,
        tools=None,
    ):
        # Extract owner and repo name from URL
        # URL format: https://github.com/owner/repo
        parts = repo_url.strip("/").split("/")
        repo_owner = parts[-2]
        repo_name = parts[-1]

        super().__init__(
            client=client,
            prompts=prompts,
            repo_url=repo_url,
            repo_owner=repo_owner,
            repo_name=repo_name,
            podcall_signature=podcall_signature,
            task_id=task_id,
        )
        self.tools = tools
    def submit_draft_pr(self, pr_url):
        """Submit the draft PR."""
        try:
            response = requests.post(
                f"http://host.docker.internal:30017/task/{self.task_id}/add-todo-draft-pr",
                json={
                "prUrl": pr_url,
                "signature": self.podcall_signature,
                "swarmBountyId": self.swarmBountyId,
                "success": True,
                "message": "",
                },
            )
        except Exception as e:
            log_error(e, "Failed to submit draft PR")
            return {
                "success": False,
                "message": "Failed to submit draft PR",
                "data": None,
            }

    def setup(self):
        """Set up repository and workspace."""
        check_required_env_vars(["GITHUB_TOKEN", "GITHUB_USERNAME"])
        validate_github_auth(os.getenv("GITHUB_TOKEN"), os.getenv("GITHUB_USERNAME"))

        # Get the default branch from GitHub
        try:
            gh = Github(os.getenv("GITHUB_TOKEN"))
            self.context["repo_full_name"] = (
                f"{self.context['repo_owner']}/{self.context['repo_name']}"
            )

            repo = gh.get_repo(
                f"{self.context['repo_owner']}/{self.context['repo_name']}"
            )
            self.context["base"] = repo.default_branch
            log_key_value("Default branch", self.context["base"])
        except Exception as e:
            log_error(e, "Failed to get default branch, using 'main'")
            self.context["base"] = "main"

        # Set up repository directory
        setup_result = setup_repository(
            self.context["repo_url"],
            github_token=os.getenv("GITHUB_TOKEN"),
            github_username=os.getenv("GITHUB_USERNAME"),
        )
        if not setup_result["success"]:
            raise Exception(f"Failed to set up repository: {setup_result['message']}")
        self.context["github_token"] = os.getenv("GITHUB_TOKEN")
        self.context["repo_path"] = setup_result["data"]["clone_path"]
        self.original_dir = setup_result["data"]["original_dir"]
        self.context["fork_url"] = setup_result["data"]["fork_url"]
        self.context["fork_owner"] = setup_result["data"]["fork_owner"]
        self.context["fork_name"] = setup_result["data"]["fork_name"]

        # Enter repo directory
        os.chdir(self.context["repo_path"])
        tools_build_result = self.build_tools_setup()
        if not tools_build_result:
            log_error(Exception("Failed to build tools setup"), "Failed to build tools setup")
            return {
                "success": False,
                "message": "Failed to build tools setup",
                "data": None,
            }

    def build_tools_setup(self):
        index = index_repo(Path(self.context["repo_path"]))
        tools = build_tools_wrapper(index)
        return tools

    def cleanup(self):
        """Cleanup workspace."""
        # Make sure we're not in the repo directory before cleaning up
        if os.getcwd() == self.context.get("repo_path", ""):
            os.chdir(self.original_dir)

        # Clean up the repository directory
        cleanup_repository(self.original_dir, self.context.get("repo_path", ""))

    def run(self):
        self.setup()
        # Create a feature branch
        log_section("CREATING FEATURE BRANCH")
        branch_phase = phases.BranchCreationPhase(workflow=self)
        branch_result = branch_phase.execute()

        if not branch_result or not branch_result.get("success"):
            log_error(Exception("Branch creation failed"), "Branch creation failed")
            return {
                "success": False,
                "message": "Branch creation failed",
                "data": None,
            }

        # Store branch name in context
        self.context["head"] = branch_result["data"]["branch_name"]
        log_key_value("Branch created", self.context["head"])
        try:
            commit_and_push(message="empty commit", allow_empty=True)
            draft_pr_result = self.create_pull_request()
            if draft_pr_result.get("success"):
                print("DRAFT PR RESULT", draft_pr_result)
                self.submit_draft_pr(draft_pr_result.get("data").get("pr_url"))
            else:
                return {
                    "success": False,
                    "message": "Failed to create pull request",
                    "data": None,
                }
        except Exception as e:
            log_error(e, "Failed to commit and push")
            return {
                "success": False,
                "message": "Failed to commit and push",
                "data": None,
            }
        try:
            consolidated_phase_result = self.consolidated_phase()
            if not consolidated_phase_result or not consolidated_phase_result.get("success"):
                log_error(Exception("Consolidated phase failed"), "Consolidated phase failed")
                return {
                    "success": False,
                    "message": "Consolidated phase failed",
                    "data": None,
                }
            # return one_phase_only_result
        except Exception as e:
            log_error(e, "Failed to create pull request")
            return {
                "success": False,
                "message": "Failed to create pull request",
                "data": None,
            }
        try:
            final_pull_request_result = self.create_pull_request()
            return final_pull_request_result
        except Exception as e:
            log_error(e, "Failed to create pull request")
            return {
                "success": False,
                "message": "Failed to create pull request",
                "data": None,
            }
    def consolidated_phase(self):
        """Create a pull request for the README file."""
        try:
            consolidated_phase = phases.ConsolidatedPhase(workflow=self, tools=self.tools)
            return consolidated_phase.execute()
        except Exception as e:
            log_error(e, "Failed to create pull request")
            return {
                "success": False,
                "message": "Failed to create pull request",
                "data": None,
            }

    def create_pull_request(self):
        """Create a pull request for the README file."""
        try:
            log_section("CREATING PULL REQUEST")

            # Add required PR title and description parameters to context
            self.context["title"] = (
                f"Prometheus: Add README for {self.context['repo_name']}"
            )
            self.context["description"] = (
                f"This PR adds a README file for the {self.context['repo_name']} repository."
            )

            log_key_value(
                "Creating PR",
                f"from {self.context['head']} to {self.context['base']}",
            )

            print("CONTEXT", self.context)
            create_pull_request_phase = phases.CreatePullRequestPhase(workflow=self)
            return create_pull_request_phase.execute()
        except Exception as e:
            log_error(e, "Pull request creation workflow failed")
            return {
                "success": False,
                "message": f"Pull request creation workflow failed: {str(e)}",
                "data": None,
            }
