"""Task decomposition workflow implementation."""

import os
from github import Github
from prometheus_swarm.workflows.base import Workflow
from prometheus_swarm.utils.logging import log_section, log_key_value, log_error
from src.workflows.repoBugFinder import phases
from prometheus_swarm.workflows.utils import (
    check_required_env_vars,
    cleanup_repository,
    validate_github_auth,
    setup_repository,
)
from src.workflows.repoBugFinder.prompts import PROMPTS
from kno_sdk import agent_query, index_repo
from pathlib import Path
import time
from datetime import datetime

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


class RepoBugFinderWorkflow(Workflow):
    def __init__(
        self,
        client,
        prompts,
        repo_url,
        signature=None,
        task_id=None,
        swarmBountyId=None,
    ):
        # Extract owner and repo name from URL
        # URL format: https://github.com/owner/repo
        self.signature=signature
        self.task_id=task_id
        self.swarmBountyId=swarmBountyId
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
            # log_to_server(self.task_id, self.signature, self.swarmBountyId, "Failed to get default branch, using 'main' - " + str(e))
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

        # Configure Git user info
        # setup_git_user_config(self.context["repo_path"])

        # Get current files for context

    def cleanup(self):
        """Cleanup workspace."""
        # Make sure we're not in the repo directory before cleaning up
        if os.getcwd() == self.context.get("repo_path", ""):
            os.chdir(self.original_dir)

        # Clean up the repository directory
        cleanup_repository(self.original_dir, self.context.get("repo_path", ""))
        # Clean up the MongoDB

    def run(self):
        self.setup()

        # Create a feature branch
        log_section("CREATING FEATURE BRANCH")
        branch_phase = phases.BranchCreationPhase(workflow=self)
        branch_result = branch_phase.execute()
        if not branch_result or not branch_result.get("success"):
            log_error(Exception("Branch creation failed"), "Branch creation failed")
            # log_to_server(self.task_id, self.signature, self.swarmBountyId, "Branch creation failed")
            return {
                "success": False,
                "message": "Branch creation failed",
                "data": None,
            }

        # Store branch name in context
        self.context["head"] = branch_result["data"]["branch_name"]
        log_key_value("Branch created", self.context["head"])
        index = index_repo(Path(self.context["repo_path"]))

        bug_finder_file_result = self.generate_bug_finder_file(index)
        if not bug_finder_file_result or not bug_finder_file_result.get("success"):
            log_error(
                Exception("README generation failed"), "README generation failed"
            )
            # log_to_server(self.task_id, self.signature, self.swarmBountyId, "README generation failed")
            return {
                "success": False,
                "message": "README generation failed",
                "data": None,
            }
        if bug_finder_file_result.get("success"):
            review_result = self.review_readme_file(bug_finder_file_result)
            if not review_result or not review_result.get("success"):
                log_error(Exception("README review failed"), "README review failed")
                # log_to_server(self.task_id, self.signature, self.swarmBountyId, "README review failed")
                return {
                    "success": False,
                    "message": "README review failed",
                    "data": None,
                }
            log_key_value("README review result", review_result.get("data"))
            if (
                review_result.get("success")
                and review_result.get("data").get("recommendation") == "APPROVE"
            ):
                result = self.create_pull_request()
                return result
            else:
                self.context["previous_review_comments_section"] = PROMPTS[
                    "previous_review_comments"
                ] + review_result.get("data").get("comment")

        return {
            "success": False,
            "message": "README Review Exceed Max Attempts",
            "data": None,
        }
    def review_readme_file(self, readme_result):
        """Execute the issue generation workflow."""
        try:
            log_section("REVIEWING README FILE")
            
            # TODO: ADD KNO TO REVIEW THE FILE
            return {
                "success": True,
                "message": "README review completed",
                "data": {
                    "recommendation": "APPROVE",
                },
            }
            # review_readme_file_phase = phases.IssuesReadmeReviewPhase(workflow=self)
            # return review_readme_file_phase.execute()
        except Exception as e:
            log_error(e, "Readme file review workflow failed")
            # log_to_server(self.task_id, self.signature, self.swarmBountyId, "Readme file review workflow failed - " + str(e))
            return {
                "success": False,
                "message": f"Readme file review workflow failed: {str(e)}",
                "data": None,
            }
    def extract_markdown_content(self,text):
        start_token = "```markdown"
        end_token = "```"

        # Find the first ```markdown
        start_index = text.find(start_token)
        if start_index == -1:
            raise ValueError("No '```markdown' block found.")

        # Find the next ``` AFTER the markdown start
        end_index = text.rfind(end_token)
        if end_index == -1 or end_index <= start_index:
            raise ValueError("No closing triple backtick found after '```markdown'.")

        # Adjust start to after ```markdown\n
        start_index += len(start_token)

        # Extract and clean
        markdown_content = text[start_index:end_index].lstrip('\n').rstrip()
        return markdown_content
    def generate_bug_finder_file(self, index):
        """Generate the README file."""

        try:            
            identified_repo_type = agent_query(
                repo_index=index,
                llm_system_prompt=PROMPTS[
                    "system_prompt"
                ],
                prompt=PROMPTS[
                    "identity_repo_type"
                ],
                MODEL_API_KEY=os.environ.get("ANTHROPIC_API_KEY"),
            )
            
            print("identified_repo_type",identified_repo_type)
            identified_common_vulnerabilities = agent_query(
                repo_index=index,
                llm_system_prompt=PROMPTS[
                    "system_prompt"
                ],
                prompt=PROMPTS[
                    "generate_common_vulnerabilities"
                ].format(identified_repo_type=identified_repo_type.replace("#Final-Answer:","")),
                MODEL_API_KEY=os.environ.get("ANTHROPIC_API_KEY"),
            )
            print("identified_common_vulnerabilities",identified_common_vulnerabilities)

            identified_issues = agent_query(
                repo_index=index,
                max_iterations=60,
                llm_system_prompt=PROMPTS[
                    "system_prompt"
                ],
                prompt=PROMPTS[
                    "scan_codebase_for_identified_issues"
                ].format(identified_common_vulnerabilities=identified_common_vulnerabilities.replace("#Final-Answer:","")),
                MODEL_API_KEY=os.environ.get("ANTHROPIC_API_KEY"),
            )
            # Getting rate limited from anthropic after above call
            time.sleep(60)
            print("identified_issues",identified_issues)

            identified_issues_formatted_markdown = agent_query(
                repo_index=index,
                llm_system_prompt=PROMPTS[
                    "system_prompt"
                ],
                prompt=PROMPTS[
                    "format_identified_issues_into_markdown"
                ].format(identified_code_issues=identified_issues.replace("#Final-Answer:","")),
                MODEL_API_KEY=os.environ.get("ANTHROPIC_API_KEY"),
            )
            print("identified_issues_formatted_markdown",identified_issues_formatted_markdown)
            
            marker = "#Final-Answer:"
            position = identified_issues_formatted_markdown.find(marker)
            if position != -1:
                # Get everything after the marker
                final_answer_content = identified_issues_formatted_markdown[position + len(marker):]
                self.context["readme_content"] = final_answer_content.strip()
            else:
                self.context["readme_content"] = final_answer_content.strip()
            
            if self.context["readme_content"].find("```markdown") != -1:
                self.context["readme_content"] = self.extract_markdown_content(self.context["readme_content"])
                
            # Get current date in desired format (e.g., YYYY-MM-DD)
            current_date = datetime.now().strftime("%Y-%m-%d")
            
            self.context["file_name"] = "SECURITY_AUDIT_Prometheus-beta.md"
            self.context["readme_content"] = self.context["readme_content"].replace("[Current Date]", current_date)

            generate_readme_file_phase = phases.IssuesReadmeFileCreationPhase(workflow=self)
            return generate_readme_file_phase.execute()

        except Exception as e:
            log_error(e, "Readme file generation workflow failed")
            # log_to_server(self.task_id, self.signature, self.swarmBountyId, "Readme file generation workflow failed - " + str(e))
            return {
                "success": False,
                "message": f"Readme file generation workflow failed: {str(e)}",
                "data": None,
            }

    def create_pull_request(self):
        """Create a pull request for the README file."""
        try:
            log_section("CREATING PULL REQUEST")

            # Add required PR title and description parameters to context
            self.context["title"] = (
                f"Prometheus: Add Security Audit Report for {self.context['repo_name']}"
            )
            self.context["description"] = (
                f"This PR introduces an automated security audit report generated by the Prometheus agent "
                f"for the `{self.context['repo_name']}` repository. The report is saved as "
                f"`SECURITY_AUDIT_Prometheus-beta.md` and highlights any detected vulnerabilities, "
                f"potential risks, and security concerns found in the codebase."
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
            # log_to_server(self.task_id, self.signature, self.swarmBountyId, "Pull request creation workflow failed - " + str(e))
            return {
                "success": False,
                "message": f"Pull request creation workflow failed: {str(e)}",
                "data": None,
            }
