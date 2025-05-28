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
    NewTaskModel,
    PhaseData,
    insert_task_to_mongodb,
    SystemPromptModel,
    insert_system_prompt_to_mongodb,
    SwarmBountyType,
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
        issue_spec: Dict[str, Any],
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
        self.issue_spec = issue_spec
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
        self.context["issue_spec"] = self.issue_spec

    def cleanup(self) -> None:
        """Clean up workspace."""
        cleanup_repository(self.original_dir, self.context.get("repo_path", ""))

    def run(self) -> Dict[str, Any]:
        """Execute the complete workflow."""
        try:
            # Generate issues
            issues_result = self.generate_issues()
            if not issues_result or not issues_result.get("success"):
                raise Exception("Failed to generate issues")

            issues = issues_result["data"]["issues"]
            self.context["issues"] = issues
            tasks = []

            # Generate tasks for each issue
            for issue in issues:
                self.context["current_issue"] = issue
                task_result = self.generate_tasks(issue["uuid"])
                if task_result:
                    tasks.append(task_result["data"]["tasks"])

            # Generate system prompts
            system_prompt_result = self.generate_system_prompts(issues, tasks)

            # Log results
            self._log_workflow_results(issues, tasks)

            return {
                "success": True,
                "message": "Issue generation workflow completed",
                "data": {
                    "issues": issues,
                    "tasks": tasks,
                    "system_prompt": system_prompt_result["data"]["prompt"] if system_prompt_result else None,
                    "issue_spec": self.issue_spec,
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

    def _log_workflow_results(self, issues: List[Dict[str, Any]], tasks: List[List[Dict[str, Any]]]) -> None:
        """Log the results of the workflow execution."""
        log_key_value("Total Issues Created", len(issues))
        for idx, issue in enumerate(issues, 1):
            log_key_value(f"Issue {idx}", f"Title: {issue['title']}")
            log_key_value(f"Issue {idx} Description", issue['description'])

        total_tasks = sum(len(task_list) for task_list in tasks if task_list)
        log_key_value("Total Tasks Created", total_tasks)
        
        for task_list in tasks:
            if task_list:
                for idx, task in enumerate(task_list, 1):
                    log_key_value(f"Task {idx}", f"Title: {task['info']}")
                    log_key_value(f"Task {idx} Description", task['tools'])
                    if task.get('dependency_tasks'):
                        log_key_value(f"Task {idx} Dependencies", task['dependency_tasks'])

    def generate_issues(self) -> Optional[Dict[str, Any]]:
        """Generate issues based on the workflow context."""
        try:
            self.setup()
            generate_issues_phase = phases.IssueGenerationPhase(workflow=self, bounty_type=self.bounty_type)
            result = generate_issues_phase.execute()

            if not result or not result.get("success"):
                log_error(Exception(result.get("error", "No result")), "Issue generation failed")
                return None
            return result
        except Exception as e:
            log_error(e, "Issue generation workflow failed")
            return {
                "success": False,
                "message": f"Issue generation workflow failed: {str(e)}",
                "data": {"issues": []},
            }

    def generate_tasks(self, issue_uuid: str) -> Optional[Dict[str, Any]]:
        """Generate tasks for a specific issue."""
        try:
            self.setup()
            tasks_data = self._generate_and_validate_tasks()
            if not tasks_data:
                return None

            self._process_task_dependencies(tasks_data)
            self._save_tasks_to_mongodb(tasks_data, issue_uuid)

            return {
                "success": True,
                "message": f"Created {len(tasks_data)} tasks for the feature",
                "data": {"tasks": tasks_data},
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
        decompose_phase = phases.TaskDecompositionPhase(workflow=self, bounty_type=self.bounty_type)
        decomposition_result = decompose_phase.execute()

        if not decomposition_result or not decomposition_result.get("success"):
            log_error(Exception(decomposition_result.get("error", "No result")), "Task decomposition failed")
            return None

        tasks_data = decomposition_result["data"].get("tasks", [])
        log_key_value("Created Tasks", tasks_data)
        if not tasks_data:
            log_error(Exception("No tasks generated"), "Task decomposition failed")
            return None

        log_key_value("Tasks Created Number", len(tasks_data))
        self.context["subtasks"] = tasks_data
        return tasks_data
    def _decode_decomposition_tasks_result(self, tasks_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Decode the decomposition result."""

        return tasks_data

    def _process_task_dependencies(self, tasks_data: List[Dict[str, Any]]) -> None:
        """Process dependencies between tasks."""
        for task in tasks_data:
            self.context["target_task"] = task
            dependency_result = self._get_task_dependencies(task)
            
            if dependency_result:
                task["dependency_tasks"] = self._validate_dependencies(
                    task["uuid"], 
                    dependency_result["data"].get(task["uuid"], []),
                    tasks_data
                )
            else:
                task["dependency_tasks"] = []

        self._remove_mutual_dependencies(tasks_data)

    def _get_task_dependencies(self, task: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Get dependencies for a specific task."""
        dependency_phase = phases.TaskDependencyPhase(workflow=self, bounty_type=self.bounty_type)
        return dependency_phase.execute()

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

    def _save_tasks_to_mongodb(self, tasks_data: List[Dict[str, Any]], issue_uuid: str) -> None:
        """Save tasks to MongoDB."""
        for task in tasks_data:
            try:
                task["phases_data"] = self._get_phase_data(task["info"], task["tools"], task["acceptance_criteria"])

                log_key_value("Phases Data", task["phases_data"])
                task_model = NewTaskModel(

                    acceptanceCriteria=task["acceptance_criteria"],
                    repoOwner=self.context["repo_owner"],
                    repoName=self.context["repo_name"],
                    phasesData=task["phases_data"],
                    dependencyTasks=task["dependency_tasks"],
                    uuid=task["uuid"],
                    issueUuid=issue_uuid,
                    bountyId=self.context["bounty_id"],
                    bountyType=self.bounty_type,
                )
                insert_task_to_mongodb(task_model)
            except Exception as e:
                log_error(
                    e,
                    f"Failed to save task {task.get('info', 'unknown')} "
                    f"with UUID {task.get('uuid', 'unknown')}"
                )

    def generate_system_prompts(self, issues: List[Dict[str, Any]], tasks: List[List[Dict[str, Any]]]) -> Optional[Dict[str, Any]]:
        """Generate system prompts for the workflow."""
        try:
            self._setup_system_prompt_context(issues, tasks)
            system_prompt_result = self._execute_system_prompt_generation()
            
            if system_prompt_result and system_prompt_result.get("success"):
                self._save_system_prompt(system_prompt_result["data"]["prompt"])
            
            return system_prompt_result
        except Exception as e:
            log_error(e, "System prompt generation workflow failed")
            return {
                "success": False,
                "message": f"System prompt generation workflow failed: {str(e)}",
                "data": {"prompt": None},
            }

    def _setup_system_prompt_context(self, issues: List[Dict[str, Any]], tasks: List[List[Dict[str, Any]]]) -> None:
        """Set up context for system prompt generation."""
        self.context["tasks"] = tasks
        self.context["issues"] = issues
        self.context["issue_spec"] = self.issue_spec

    def _execute_system_prompt_generation(self) -> Optional[Dict[str, Any]]:
        """Execute the system prompt generation phase."""
        system_prompt_phase = phases.SystemPromptGenerationPhase(workflow=self, bounty_type=self.bounty_type)
        result = system_prompt_phase.execute()
        
        if not result or not result.get("success"):
            log_error(Exception(result.get("error", "No result")), "System prompt generation failed")
            return None
            
        return result

    def _save_system_prompt(self, prompt: str) -> None:
        """Save system prompt to MongoDB."""
        try:
            system_prompt_model = SystemPromptModel(
                prompt=prompt,
                bountyId=self.context["bounty_id"],
                bountyType=self.bounty_type,
            )
            insert_system_prompt_to_mongodb(system_prompt_model)
        except Exception as e:
            log_error(e, "Failed to save system prompt to MongoDB")

    def check_circular_dependency(
        self, task_uuid: str, dependency_tasks: List[str], all_tasks: List[Dict[str, Any]]
    ) -> bool:
        """Check if adding dependencies would create a circular dependency."""
        visited = set()
        path = set()

        def has_cycle(current_uuid: str) -> bool:
            if current_uuid in path:
                return True
            if current_uuid in visited:
                return False

            visited.add(current_uuid)
            path.add(current_uuid)

            current_task = next((t for t in all_tasks if t["uuid"] == current_uuid), None)
            if current_task:
                for dep_uuid in current_task.get("dependency_tasks", []):
                    if has_cycle(dep_uuid):
                        return True

            path.remove(current_uuid)
            return False

        current_task = next((t for t in all_tasks if t["uuid"] == task_uuid), None)
        if current_task:
            original_deps = current_task.get("dependency_tasks", [])
            current_task["dependency_tasks"] = dependency_tasks
            has_circular = has_cycle(task_uuid)
            current_task["dependency_tasks"] = original_deps
            return has_circular
        return False
    def _get_phase_data(self, info:str, tools:List[str], acceptance_criteria:List[str]) -> List[PhaseData]:
        """Get the phase data for the task."""

        phase_data = []
        if self.bounty_type == SwarmBountyType.BUILD_FEATURE:
            for key in RECOMMENDED_TOOLS_FOR_FEATURE_BUILDER:
                log_key_value("Key Value", key)
                prompt = str(FEATURE_BUILDER_PROMPTS[key])  # Ensure prompt is a string
                tools = RECOMMENDED_TOOLS_FOR_FEATURE_BUILDER[key]
                # Format the prompt with the task info and acceptance criteria
                prompt = prompt.format(info=info, acceptance_criteria=acceptance_criteria)
                phase_data.append(PhaseData(
                    prompt=prompt,
                    tools=tools,
                ))
            return phase_data
        if self.bounty_type == SwarmBountyType.DOCUMENT_SUMMARIZER:
            for key in RECOMMENDED_TOOLS_FOR_DOCUMENT_SUMMARIZER:
                prompt = str(DOCUMENT_SUMMARIZER_PROMPTS[key])  # Ensure prompt is a string
                tools = RECOMMENDED_TOOLS_FOR_DOCUMENT_SUMMARIZER[key]
                prompt = prompt.format(info=info, acceptance_criteria=acceptance_criteria)
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
        