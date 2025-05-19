"""Task decomposition workflow implementation."""

import json
import os
import contextlib
from github import Github
from prometheus_swarm.workflows.base import Workflow
from prometheus_swarm.utils.logging import log_key_value, log_error
# from src.workflows.repoClassifier import phases
from prometheus_swarm.workflows.utils import (
    check_required_env_vars,
    cleanup_repository,
    validate_github_auth,
    setup_repository
)
from .linguist import Linguist
from kno_sdk import index_repo, load_index, agent_query
from dotenv import load_dotenv
from pathlib import Path

load_dotenv()

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


class RepoMetadataKnoWorkflow(Workflow):
    def __init__(
        self,
        client,
        prompts,
        repo_url,
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
        )
        self._cleanup_required = False

    @contextlib.contextmanager
    def managed_workflow(self):
        """Context manager to ensure proper cleanup."""
        try:
            self.setup()
            self._cleanup_required = True
            yield self
        except Exception as e:
            log_error(e, "Error during workflow execution")
            raise
        finally:
            if self._cleanup_required:
                exit(1)
                # self.cleanup()

    def setup(self):
        try:
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
            setup_result = setup_repository(self.context["repo_url"], github_token=os.getenv("GITHUB_TOKEN"), github_username=os.getenv("GITHUB_USERNAME"))
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
        except Exception as e:
            log_error(e, "Error during setup")
            raise
        # Configure Git user info
        # setup_git_user_config(self.context["repo_path"])

        # Get current files for context

    def cleanup(self):
        """Cleanup workspace."""
        try:
            # Make sure we're not in the repo directory before cleaning up
            if os.getcwd() == self.context.get("repo_path", ""):
                os.chdir(self.original_dir)
            
            log_key_value("Cleaning up repository", self.context.get("repo_path", ""))
            
            # Clean up the repository directory
            if self.context.get("repo_path"):
                cleanup_repository(self.original_dir, self.context["repo_path"])
            
            # Clean up any temporary files or resources
            self._cleanup_temporary_resources()
            
            # Reset cleanup flag
            self._cleanup_required = False
            
        except Exception as e:
            log_error(e, "Error during cleanup")
            # Don't raise the exception to ensure cleanup continues
            pass

    def _cleanup_temporary_resources(self):
        """Clean up any temporary resources created during workflow execution."""
        # Add any additional cleanup steps here
        pass

    def run(self):
        with self.managed_workflow():
            linguist = Linguist()
            languages = linguist.analyze_project(self.context["repo_path"])
         
            index = index_repo(Path(self.context["repo_path"]))
            system_prompt = """
            You are a senior code-analysis agent working on the repository below.

            Your job is to systematically gather information and then summarize your findings.
            """
            
            prompt = f"""
                    Before making any changes, can you summarize the architecture and key components of this GitHub repo as you understand it from the current context? 
                    Please include the main technologies used, key folders/files, and the primary functionality implemented by reading all the important files.
                    If you are missing any crucial files or information, mention that too.
                    Below is the list of languages used in the repository:
                    {languages}
                """
                
            format = """f
                ```json
                {{
                "name": "example-project",
                "description": "A cross-platform desktop application for note-taking and task management.",
                "repository_url": "https://github.com/username/example-project",
                
                "primary_language": "C++",
                "languages_used": [
                    {{"language": "C++", "percentage": 85.0}},
                    {{"language": "QML", "percentage": 10.0}},
                    {{"language": "Shell", "percentage": 5.0}}
                ],

                "frameworks_used": [
                    {{"name": "Qt", "version": "6.5"}},
                    {{"name": "Boost", "version": "1.81"}}
                ],

                "build_tools_used": [
                    {{"name": "CMake", "version": "3.27"}},
                    {{"name": "Make"}}
                ],

                "test_frameworks_used": [
                    {{"name": "Catch2", "version": "3.3"}}
                ],

                "linters_used": [
                    {{"name": "clang-tidy"}},
                    {{"name": "cppcheck"}}
                ],

                "ci_cd_tools": ["GitHub Actions"],
                "ci_cd_config_files": [".github/workflows/build.yml"],

                "packaging_method": "CMake + CPack",
                "packaging_output_formats": [".tar.gz", ".deb"],

                "deployment_type": "desktop",
                "deployment_platforms": ["Linux", "Windows", "macOS"],

                "application_type": "Desktop",
                "core_features": [
                    "Note editing and formatting",
                    "Task tagging and reminders",
                    "Sync with local filesystem"
                ],

                "authentication_used": false,

                "data_storage_type": "Local",
                "data_storage_format": "SQLite database",
                "data_storage_models": 7,

                "external_dependencies": [
                    {{"name": "sqlite", "version": "3.39"}},
                    {{"name": "zlib", "version": "1.2.13"}}
                ]
                }}
            """

            index = load_index(Path(self.context["repo_path"]))
            print("loaded index", index)
            resp = agent_query(
                repo_index=index,
                llm_system_prompt=system_prompt,
                prompt=prompt,
                MODEL_API_KEY=os.environ.get("ANTHROPIC_API_KEY"),
                output_format=format
            )
            print(resp)
            # Response contains ```json```, we need to extract the json from it
            resp = resp.split("```json")[1].split("```")[0]
            print(resp)
            # Convert the json string to a json object
            resp = json.loads(resp)
            print(resp)
            return {
                "success": True,
                "message": "Repository indexing complete",
                "data": {
                     resp
                }
            }   