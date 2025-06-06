"""Task decomposition workflow implementation for creating and managing tasks from issues."""

import os
from typing import List, Dict, Optional, Any
from github import Github
from prometheus_swarm.workflows.base import Workflow
from prometheus_swarm.utils.logging import log_key_value, log_error
from prometheus_swarm.utils.tools import get_tool_names, get_all_definitions
from . import phases
from prometheus_swarm.workflows.utils import (
    check_required_env_vars,
    cleanup_repository,
    validate_github_auth,
    setup_repository,
    get_current_files,
)
from .utils import (
    PhaseData,
    SwarmBountyType,
    update_task_phaseData,
)
from src.workflows.vibeTodoCreator.node_prompts import FEATURE_BUILDER_PROMPTS, DOCUMENT_SUMMARIZER_PROMPTS, RECOMMENDED_TOOLS_FOR_FEATURE_BUILDER, RECOMMENDED_TOOLS_FOR_DOCUMENT_SUMMARIZER

class Task:
    """Represents a single task with info, tools and acceptance criteria."""
    
    def __init__(self, info: str, tools: List[str], acceptance_criteria: List[str]):
            self.info = info
            self.tools = tools
            self.acceptance_criteria = acceptance_criteria

    def to_dict(self) -> Dict[str, Any]:
        """Convert task to dictionary format."""
        return {
            "info": self.info,
            "tools": self.tools,
            "acceptance_criteria": self.acceptance_criteria,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Task":
        """Create task from dictionary."""
        return cls(
            info=data["info"],
            tools=data["tools"],
            acceptance_criteria=data["acceptance_criteria"],
        )


class TodoCreatorWorkflow(Workflow):
    """Workflow for creating and managing tasks from issues."""

    def __init__(
        self,
        client: Any,
        prompts: Dict[str, Any],
        source_url: str,
        fork_url: str,
        task_spec: Dict[str, Any],
        task_uuid: str,
        previous_phasesData: List[PhaseData],
        error_message: str,
        bounty_id: str,
        bounty_type: SwarmBountyType,
    ):
        # Extract repository information from URLs
        parts = source_url.strip("/").split("/")
        fork_parts = fork_url.strip("/").split("/")
        
        super().__init__(
            client=client,
            prompts=prompts,
            repo_url=source_url,
            repo_owner=parts[-2],
            repo_name=parts[-1],
            fork_owner=fork_parts[-2],
            fork_url=fork_url,
            bounty_id=bounty_id,
        )

        self.bounty_type = bounty_type
        self.task_spec = task_spec
        self.previous_phasesData = previous_phasesData  
        self.error_message = error_message
        self.context["previous_phasesData"] = previous_phasesData
        self.context["error_message"] = error_message
        self.context["task_spec"] = task_spec
        self.context["toolsNames"] = get_all_definitions()
        

    def setup(self) -> None:
        """Set up repository and workspace."""
        check_required_env_vars(["GITHUB_TOKEN", "GITHUB_USERNAME"])
        validate_github_auth(os.getenv("GITHUB_TOKEN"), os.getenv("GITHUB_USERNAME"))

        try:
            self._setup_github_repo()
            self._setup_repository_directory()
            self._setup_context()
        except Exception as e:
            log_error(e, "Failed to set up workflow")
            raise

    def _setup_github_repo(self) -> None:
        """Set up GitHub repository connection and get default branch."""
        gh = Github(os.getenv("GITHUB_TOKEN"))
        repo = gh.get_repo(f"{self.context['repo_owner']}/{self.context['repo_name']}")
        self.context["base_branch"] = repo.default_branch
        log_key_value("Default branch", self.context["base_branch"])

    def _setup_repository_directory(self) -> None:
        """Set up local repository directory."""
        setup_result = setup_repository(
            self.context["repo_url"],
            github_token=os.getenv("GITHUB_TOKEN"),
            github_username=os.getenv("GITHUB_USERNAME"),
        )
        if not setup_result["success"]:
            raise Exception(f"Failed to set up repository: {setup_result['message']}")

        self.context["repo_path"] = setup_result["data"]["clone_path"]
        self.original_dir = setup_result["data"]["original_dir"]
        os.chdir(self.context["repo_path"])

    def _setup_context(self) -> None:
        """Set up workflow context with current files and issue spec."""
        self.context["current_files"] = get_current_files()
        self.context["task_spec"] = self.task_spec

    def cleanup(self) -> None:
        """Clean up workspace."""
        cleanup_repository(self.original_dir, self.context.get("repo_path", ""))

    def run(self) -> Dict[str, Any]:
        """Execute the complete workflow."""
        try:
            # Set task spec in context
            self.context["task_spec"] = self.task_spec
            
            # Generate tasks
            task_result = self.generate_tasks()
            if not task_result or not task_result.get("success"):
                raise Exception("Failed to generate tasks")

            tasks = task_result["data"]["tasks"]



            # Log results
            self._log_workflow_results( [tasks])

            return {
                "success": True,
                "message": "Task generation workflow completed",
                "data": {
                    "tasks": tasks,
      
  
                    "repo_owner": self.context["repo_owner"],
                    "repo_name": self.context["repo_name"],
                },
            }
        except Exception as e:
            log_error(e, "Workflow execution failed")
            return {
                "success": False,
                "message": f"Workflow execution failed: {str(e)}",
                "data": None,
            }

    def _log_workflow_results(self, tasks: List[List[Dict[str, Any]]]) -> None:
        """Log the results of the workflow execution."""
        # log_key_value("Total Tasks Created", len(tasks))
        # for idx, task in enumerate(tasks, 1):
        #     log_key_value(f"Task {idx}", f"Title: {task['info']}")
        #     log_key_value(f"Task {idx} Description", task['tools'])

        total_tasks = sum(len(task_list) for task_list in tasks if task_list)
        log_key_value("Total Tasks Created", total_tasks)
        
        for task_list in tasks:
            if task_list:
                for idx, task in enumerate(task_list, 1):
                    log_key_value(f"Task {idx}", f"Title: {task['info']}")
                    log_key_value(f"Task {idx} Description", task['tools'])
                    if task.get('dependency_tasks'):
                        log_key_value(f"Task {idx} Dependencies", task['dependency_tasks'])

    def generate_tasks(self) -> Optional[Dict[str, Any]]:
        """Generate tasks for a specific issue."""
        try:
            self.setup()
            phaseData = self._generate_and_validate_tasks()
            if not phaseData:
                return None

            self._update_task_in_mongodb(self.task_uuid, phaseData)
            
            return {
                "success": True,
                "message": f"Created {len(phaseData)} tasks for the feature",
                "data": {"phaseData": phaseData},
            }
        except Exception as e:
            log_error(e, "Task decomposition workflow failed")
            return {
                "success": False,
                "message": f"Task decomposition workflow failed: {str(e)}",
                "data": None,
            }
        finally:
            self.cleanup()

    def _generate_and_validate_tasks(self) -> Optional[List[Dict[str, Any]]]:
        """Generate and validate tasks through the decomposition phase."""
        task_generation_phase = phases.TaskRegenerationPhase(workflow=self, bounty_type=self.bounty_type)
        task_generation_result = task_generation_phase.execute()

        if not task_generation_result or not task_generation_result.get("success"):
            log_error(Exception(task_generation_result.get("error", "No result")), "Task decomposition failed")
            return None

        task_data = task_generation_result["data"].get("tasks", [])
        log_key_value("Created Tasks", task_data)
        return task_data

    def _decode_decomposition_tasks_result(self, tasks_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Decode the decomposition result."""

        return tasks_data

 
    def _validate_dependencies(
        self, 
        task_uuid: str, 
        proposed_dependencies: List[str], 
        all_tasks: List[Dict[str, Any]]
    ) -> List[str]:
        """Validate and filter dependencies to avoid circular dependencies."""
        valid_dependencies = []
        for dep in proposed_dependencies:
            temp_deps = valid_dependencies + [dep]
            if not self.check_circular_dependency(task_uuid, temp_deps, all_tasks):
                valid_dependencies.append(dep)
            else:
                log_error(
                    Exception("Circular dependency detected"),
                    f"Dependency {dep} would create a circular dependency, skipping"
                )
        return valid_dependencies

    def _remove_mutual_dependencies(self, tasks_data: List[Dict[str, Any]]) -> None:
        """Remove mutual dependencies between tasks."""
        for task in tasks_data:
            if task["dependency_tasks"]:
                for dep in task["dependency_tasks"][:]:
                    dep_task = next((t for t in tasks_data if t["uuid"] == dep), None)
                    if dep_task and task["uuid"] in dep_task.get("dependency_tasks", []):
                        log_error(
                            Exception("Mutual dependency detected"),
                            f"Removing mutual dependency between {task['info']} and {dep_task['info']}"
                        )
                        task["dependency_tasks"].remove(dep)

    def _update_task_in_mongodb(self, task_uuid: str, phasesData: List[PhaseData]) -> None:
        """Update the task in MongoDB."""
        update_task_phaseData(task_uuid, phasesData)

    def _get_phase_data(self, info:str, tools:List[str], acceptance_criteria:List[str]) -> List[PhaseData]:
        """Get the phase data for the task."""

        phase_data = []
        if self.bounty_type == SwarmBountyType.BUILD_FEATURE:
            for key in RECOMMENDED_TOOLS_FOR_FEATURE_BUILDER:
                log_key_value("Key Value", key)
                prompt = str(FEATURE_BUILDER_PROMPTS[key])  # Ensure prompt is a string
                tools = RECOMMENDED_TOOLS_FOR_FEATURE_BUILDER[key]
                
                # Create a dictionary with all possible fields
                format_dict = {
                    'info': info,
                    'acceptance_criteria': acceptance_criteria,
                    'current_files': '{{current_files}}',
                    # 'previous_issues': '{{previous_issues}}'
                }
                
                # Use format_map which won't error on unused fields
                prompt = prompt.format_map(format_dict)
                phase_data.append(PhaseData(
                    prompt=prompt,
                    tools=tools,
                ))
            return phase_data
        if self.bounty_type == SwarmBountyType.DOCUMENT_SUMMARIZER:
            for key in RECOMMENDED_TOOLS_FOR_DOCUMENT_SUMMARIZER:
                prompt = str(DOCUMENT_SUMMARIZER_PROMPTS[key])  # Ensure prompt is a string
                tools = RECOMMENDED_TOOLS_FOR_DOCUMENT_SUMMARIZER[key]
                
                # Create a dictionary with all possible fields
                format_dict = {
                    'info': info,
                    'acceptance_criteria': acceptance_criteria,
                    'current_files': self.context.get('current_files', ''),
                    'previous_issues': self.context.get('previous_issues', '')
                }
                
                # Use format_map which won't error on unused fields
                prompt = prompt.format_map(format_dict)
                phase_data.append(PhaseData(
                    prompt=prompt,
                    tools=tools,
                ))
            return phase_data
        return None

    def node_prompts(self) -> Dict[str, Any]:
        """Get the prompts for the node based on bounty type."""
        if self.bounty_type == SwarmBountyType.BUILD_FEATURE:
            return FEATURE_BUILDER_PROMPTS
        if self.bounty_type == SwarmBountyType.FIND_BUGS:
            return None
        if self.bounty_type == SwarmBountyType.DOCUMENT_SUMMARIZER:
            return DOCUMENT_SUMMARIZER_PROMPTS
        
        return None
        