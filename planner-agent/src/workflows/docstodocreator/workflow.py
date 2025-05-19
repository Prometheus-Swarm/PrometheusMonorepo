"""Task decomposition workflow implementation."""

import os
import uuid
from github import Github
from prometheus_swarm.workflows.base import Workflow
from prometheus_swarm.utils.logging import log_key_value, log_error
from src.workflows.docstodocreator import phases
from prometheus_swarm.workflows.utils import (
    check_required_env_vars,
    cleanup_repository,
    validate_github_auth,
    setup_repository,
    get_current_files,
)
from src.workflows.todocreator.utils import IssueModel, SwarmBountyType, SystemPromptModel, insert_issue_to_mongodb, insert_system_prompt_to_mongodb, insert_task_to_mongodb, TaskModel


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


class TodoCreatorWorkflow(Workflow):
    def __init__(
        self,
        client,
        prompts,
        source_url,
        fork_url,
        bounty_id,
    ):
        # Extract owner and repo name from URL
        # URL format: https://github.com/owner/repo
        parts = source_url.strip("/").split("/")
        repo_owner = parts[-2]
        repo_name = parts[-1]
        fork_parts = fork_url.strip("/").split("/")
        fork_owner = fork_parts[-2]

        super().__init__(
            client=client,
            prompts=prompts,
            repo_url=source_url,
            repo_owner=repo_owner,
            repo_name=repo_name,
            fork_owner=fork_owner,
            fork_url=fork_url,
            bounty_id=bounty_id,
        )


    def setup(self):
        """Set up repository and workspace."""
        check_required_env_vars(["GITHUB_TOKEN", "GITHUB_USERNAME"])
        validate_github_auth(os.getenv("GITHUB_TOKEN"), os.getenv("GITHUB_USERNAME"))

        # Get the default branch from GitHub
        try:
            gh = Github(os.getenv("GITHUB_TOKEN"))
            repo = gh.get_repo(
                f"{self.context['repo_owner']}/{self.context['repo_name']}"
            )
            self.context["base_branch"] = repo.default_branch
            log_key_value("Default branch", self.context["base_branch"])
        except Exception as e:
            log_error(e, "Failed to get default branch, using 'main'")
            self.context["base_branch"] = "main"

        # Set up repository directory
        setup_result = setup_repository(
            self.context["repo_url"],
            github_token=os.getenv("GITHUB_TOKEN"),
            github_username=os.getenv("GITHUB_USERNAME"),
        )
        if not setup_result["success"]:
            raise Exception(f"Failed to set up repository: {setup_result['message']}")

        self.context["repo_path"] = setup_result["data"]["clone_path"]
        self.original_dir = setup_result["data"]["original_dir"]

        # Enter repo directory
        os.chdir(self.context["repo_path"])

        # Get current files for context
        self.context["current_files"] = get_current_files()

        # Add feature spec to context


    def cleanup(self):
        """Cleanup workspace."""
        # Make sure we're not in the repo directory before cleaning up
        cleanup_repository(self.original_dir, self.context.get("repo_path", ""))
    def generate_sections(self):
        for _ in range(3):
            generate_sections_phase = phases.RepoSectionGenerationPhase(workflow=self)
            generate_sections_result = generate_sections_phase.execute()
            self.context["sections"] = generate_sections_result["data"]["sections"]
            
            validate_sections_phase = phases.RepoSectionValidationPhase(workflow=self)
            validate_sections_result = validate_sections_phase.execute()
            if not validate_sections_result or not validate_sections_result.get("success"):
                log_error(
                    Exception(validate_sections_result.get("error", "No result")),
                    "Section validation failed",
                )
                continue

            return {
                "success": True,
                "message": "Section generation workflow completed",
                "data": {
                    "sections": self.context["sections"],
                },
            }
        return {
            "success": False,
            "message": "Section generation workflow failed after 3 attempts",
            "data": {
                "sections": self.context["sections"],
            },
        }
    def run(self):
        generate_sections_result = self.generate_sections()
        if (generate_sections_result.get("success") == False):
            return generate_sections_result
        generate_system_prompt_result = self.generate_system_prompt()
        if (generate_system_prompt_result.get("success") == False):
            return generate_system_prompt_result
        log_key_value("generate_sections_result", self.context["sections"])
        insert_docs_issue_result = self.insert_docs_issue_to_mongodb()
        if (insert_docs_issue_result.get("success") == False):
            return insert_docs_issue_result
        insert_sections_result = self.insert_sections_to_mongodb()
        if (insert_sections_result.get("success") == False):
            return insert_sections_result
        insert_docs_system_prompt_result = self.insert_docs_system_prompt_to_mongodb()
        if (insert_docs_system_prompt_result.get("success") == False):
            return insert_docs_system_prompt_result
        return {
            "success": True,
            "message": "Documentation creation workflow completed",
            "data": {
                "issue": insert_docs_issue_result,
                "sections": insert_sections_result,
                "system_prompt": insert_docs_system_prompt_result,
            }
        }

    def generate_system_prompt(self):
        try: 
            system_prompt_phase = phases.SystemPromptGenerationPhase(workflow=self)
            system_prompt_result = system_prompt_phase.execute()
            self.context["prompt"] = system_prompt_result.get("data").get("prompt")
            return system_prompt_result
        except Exception as e:
            log_error(e, "Failed to generate system prompt")
            return {
                "success": False,
                "message": "Failed to generate system prompt",
            }

    def insert_docs_system_prompt_to_mongodb(self):
        """Generate system prompt."""

        try:
            system_prompt = SystemPromptModel(
                prompt=self.context["prompt"],
                bountyId=self.context["bounty_id"],
                bountyType=SwarmBountyType.DOCUMENT_SUMMARIZER,
            )
            log_key_value("system_prompt", system_prompt)
            insert_system_prompt_to_mongodb(system_prompt)
            return {
                "success": True,
                "message": "System prompt inserted into MongoDB",
                "data": {
                    "system_prompt": system_prompt
                }
            }
        except Exception as e:
            log_error(e, "Failed to insert system prompt into MongoDB")
            return {
                "success": False,
                "message": "Failed to insert system prompt into MongoDB",
            }
    def  insert_docs_issue_to_mongodb(self):
        """Insert issue to MongoDB."""
        self.context["issue_uuid"] = str(uuid.uuid4())
        
        # Create documentation issue
        self.context["issue"] = {
            "title": "Create Documentation",
            "description": "Create comprehensive documentation for the project, including setup instructions, usage guidelines, and API documentation.",
            "bountyType": SwarmBountyType.DOCUMENT_SUMMARIZER,
            "repoOwner": self.context["repo_owner"],
            "repoName": self.context["repo_name"],
            "forkOwner": self.context["fork_owner"],
            "forkUrl": self.context["fork_url"],
            "uuid": self.context["issue_uuid"],
            "bountyId": self.context["bounty_id"]
        }
        
        issue = IssueModel(
            title=self.context["issue"]["title"],
            description=self.context["issue"]["description"],
            bountyType=self.context["issue"]["bountyType"],
            repoOwner=self.context["issue"]["repoOwner"],
            repoName=self.context["issue"]["repoName"],
            forkOwner=self.context["issue"]["forkOwner"],
            forkUrl=self.context["issue"]["forkUrl"],
            uuid=self.context["issue"]["uuid"],
            bountyId=self.context["issue"]["bountyId"]
        )
        log_key_value("issue", issue)
        insert_issue_to_mongodb(issue)
        return issue
    def insert_sections_to_mongodb(self):
        """Insert sections to MongoDB."""
        # Insert into MongoDB
        for section in self.context["sections"]:
            try:
                task_model = TaskModel(
                    title="Documentation",
                    description=section,
                    bountyType=SwarmBountyType.DOCUMENT_SUMMARIZER,
                    acceptanceCriteria=[],
                    repoOwner=self.context["repo_owner"],
                    repoName=self.context["repo_name"],
                    dependencyTasks=[],
                    uuid=str(uuid.uuid4()),
                    issueUuid=str(uuid.uuid4()),
                    bountyId=self.context["bounty_id"],
                )

                log_key_value("task_model", task_model)
                insert_task_to_mongodb(task_model)
            except Exception as e:
                log_error(
                    e,
                    f"Failed to process task {section}",
                )
                continue

        # Return the final result
        return {
            "success": True,
            "message": f"Created {len(self.context['sections'])} tasks for the feature",
            "data": {"tasks": self.context["sections"]},
        }


  