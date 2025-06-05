"""Task decomposition workflow implementation."""

import os
from dataclasses import dataclass
from typing import List, Dict, Optional, Any
from github import Github
from prometheus_swarm.workflows.base import Workflow
from prometheus_swarm.utils.logging import log_key_value, log_error
from src.workflows.vibeTodoCreator import phases
from prometheus_swarm.workflows.utils import (
    check_required_env_vars,
    cleanup_repository,
    validate_github_auth,
    setup_repository,
    get_current_files,
)
from src.workflows.vibeTodoCreator.utils import (
    IssueModel,
    NewTaskModel,
    insert_issue_to_mongodb,
    insert_task_to_mongodb,
    SystemPromptModel,
    insert_system_prompt_to_mongodb,
    SwarmBountyType,
)
from src.workflows.vibeTodoCreator.node_prompts import FEATURE_BUILDER_PROMPTS, DOCUMENT_SUMMARIZER_PROMPTS, RECOMMENDED_TOOLS_FOR_FEATURE_BUILDER, RECOMMENDED_TOOLS_FOR_DOCUMENT_SUMMARIZER

from src.workflows.vibeTodoCreator.utils import (
    PhaseData,
    # RECOMMENDED_TOOLS_FOR_FEATURE_BUILDER,
    # RECOMMENDED_TOOLS_FOR_DOCUMENT_SUMMARIZER,
    # FEATURE_BUILDER_PROMPTS,
    # DOCUMENT_SUMMARIZER_PROMPTS,
)

class Task:
    """Represents a single task with info, tools and acceptance criteria."""
    
    def __init__(self, info: str, tools: List[str], acceptance_criteria: List[str], uuid: str = None, dependency_tasks: List[str] = None):
        self.info = info
        self.tools = tools
        self.acceptance_criteria = acceptance_criteria
        self.uuid = uuid
        self.dependency_tasks = dependency_tasks or []

    def to_dict(self) -> Dict[str, Any]:
        """Convert task to dictionary format."""
        return {
            "info": self.info,
            "tools": self.tools,
            "acceptance_criteria": self.acceptance_criteria,
            "uuid": self.uuid,
            "dependency_tasks": self.dependency_tasks,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Task":
        """Create task from dictionary."""
        return cls(
            info=data["info"],
            tools=data["tools"],
            acceptance_criteria=data["acceptance_criteria"],
            uuid=data.get("uuid"),
            dependency_tasks=data.get("dependency_tasks", []),
        )


# @dataclass
# class Task:
#     """Represents a task with its metadata."""
#     title: str
#     description: str
#     acceptance_criteria: List[str]
#     uuid: str
#     dependency_tasks: List[str] = None

#     def to_dict(self) -> Dict[str, Any]:
#         """Convert task to dictionary format."""
#         return {
#             "title": self.title,
#             "description": self.description,
#             "acceptance_criteria": self.acceptance_criteria,
#             "uuid": self.uuid,
#             "dependency_tasks": self.dependency_tasks or [],
#         }

#     @classmethod
#     def from_dict(cls, data: Dict[str, Any]) -> "Task":
#         """Create task from dictionary."""
#         return cls(
#             phasesData = data["phasesData"],
#             description=data["description"],
#             acceptance_criteria=data["acceptance_criteria"],
#             uuid=data["uuid"],
#             dependency_tasks=data.get("dependency_tasks", []),

class TodoCreatorWorkflow(Workflow):
    """Main workflow for creating and managing tasks."""

    def __init__(
        self,
        client,
        prompts,
        source_url: str,
        fork_url: str,
        issue_spec: str,
        bounty_id: str,
        bounty_type: str,
    ):
        # Extract owner and repo name from URL
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

        self.bounty_type = bounty_type
        self.issue_spec = issue_spec
        self.repo_url = source_url
        self.repo_owner = repo_owner
        self.repo_name = repo_name
        self.repo_path = None
        self.original_dir = None
        self.base_branch = "main"

    def setup(self) -> None:
        """Set up repository and workspace."""
        check_required_env_vars(["GITHUB_TOKEN", "GITHUB_USERNAME"])
        validate_github_auth(os.getenv("GITHUB_TOKEN"), os.getenv("GITHUB_USERNAME"))

        self._get_default_branch()
        self._setup_repository()
        self._get_current_files()
        self.context["issue_spec"] = self.issue_spec

    def cleanup(self) -> None:
        """Cleanup workspace."""
        if self.original_dir and self.repo_path:
            cleanup_repository(self.original_dir, self.repo_path)

    def _get_default_branch(self) -> None:
        """Get the default branch from GitHub."""
        try:
            gh = Github(os.getenv("GITHUB_TOKEN"))
            repo = gh.get_repo(f"{self.repo_owner}/{self.repo_name}")
            self.base_branch = repo.default_branch
            log_key_value("Default branch", self.base_branch)
        except Exception as e:
            log_error(e, "Failed to get default branch, using 'main'")

    def _setup_repository(self) -> None:
        """Set up repository directory."""
        setup_result = setup_repository(
            self.repo_url,
            github_token=os.getenv("GITHUB_TOKEN"),
            github_username=os.getenv("GITHUB_USERNAME"),
        )
        if not setup_result["success"]:
            raise Exception(f"Failed to set up repository: {setup_result['message']}")

        self.repo_path = setup_result["data"]["clone_path"]
        self.original_dir = setup_result["data"]["original_dir"]
        os.chdir(self.repo_path)

    def _get_current_files(self) -> None:
        """Get current files for context."""
        return get_current_files()

    def save_task_to_mongodb(self, task:Task, issue_uuid: str) -> None:
        """Save task to MongoDB."""
        try:
            task_model = NewTaskModel(
                acceptanceCriteria=task["acceptance_criteria"],
                repoOwner=self.context["repo_owner"],
                repoName=self.context["repo_name"],
                phasesData=task["phases_data"],
                dependencyTasks=task["dependency_tasks"],
                uuid=task["uuid"],
                bountyId=self.context["bounty_id"],
                bountyType=self.bounty_type,
            )
            insert_task_to_mongodb(task_model)
        except Exception as e:
            log_error(
                e,
                f"Failed to process task {task.title} with UUID {task.uuid}",
            )

    def check_circular_dependency(
        self, task_uuid: str, dependency_tasks: List[str], all_tasks: List[Task]
    ) -> bool:
        """Check if adding a dependency would create a circular dependency."""
        visited = set()
        path = set()

        def has_cycle(current_uuid: str) -> bool:
            if current_uuid in path:
                return True
            if current_uuid in visited:
                return False

            visited.add(current_uuid)
            path.add(current_uuid)

            current_task = next(
                (t for t in all_tasks if t.uuid == current_uuid), None
            )
            if current_task:
                for dep_uuid in current_task.dependency_tasks or []:
                    if has_cycle(dep_uuid):
                        return True

            path.remove(current_uuid)
            return False

        current_task = next((t for t in all_tasks if t.uuid == task_uuid), None)
        if current_task:
            original_deps = current_task.dependency_tasks or []
            current_task.dependency_tasks = dependency_tasks
            has_circular = has_cycle(task_uuid)
            current_task.dependency_tasks = original_deps
            return has_circular
        return False

    def run(self) -> Dict[str, Any]:
        """Execute the main workflow."""
        generate_issues_result = self.generate_issues()
        if not generate_issues_result or not generate_issues_result.get("success"):
            retry = 0
            while retry < 3:
                generate_issues_result = self.generate_issues()
                if generate_issues_result and generate_issues_result.get("success"):
                    break
                retry += 1
            if retry >= 3:
                return {
                    "success": False,
                    "message": "Failed to generate issues",
                    "data": None,
                }

        self.context["issues"] = generate_issues_result["data"]["issues"]

        tasks = []
        for issue in generate_issues_result["data"]["issues"]:
            self.context["current_issue"] = issue
            task_result = self.generate_tasks(issue["uuid"])
            if task_result:
                tasks.append(task_result["data"]["tasks"])

        system_prompt_result = self.generate_system_prompts(
            generate_issues_result["data"]["issues"], tasks
        )

        return {
            "success": True,
            "message": "Issue generation workflow completed",
            "data": {
                "issues": generate_issues_result["data"]["issues"],
                "tasks": tasks,
                "system_prompt": (
                    system_prompt_result["data"]["prompt"]
                    if system_prompt_result
                    else None
                ),
                "issue_spec": self.issue_spec,
                "repo_owner": self.context["repo_owner"],
                "repo_name": self.context["repo_name"],
            },
        }

    def generate_issues(self) -> Optional[Dict[str, Any]]:
        """Execute the issue generation workflow."""
        try:
            self.setup()
            generate_issues_phase = phases.IssueGenerationPhase(
                workflow=self, bounty_type=self.bounty_type
            )
            generate_issues_result = generate_issues_phase.execute()

            if not generate_issues_result or not generate_issues_result.get("success"):
                log_error(
                    Exception(generate_issues_result.get("error", "No result")),
                    "Issue generation failed",
                )
                return None
            for issue in generate_issues_result["data"]["issues"]:
                issue_model = IssueModel(
                    title=issue["title"],
                    description=issue["description"],
                    repoOwner=self.context["repo_owner"],
                    repoName=self.context["repo_name"],
                    uuid=issue["uuid"],
                    bountyId=self.context["bounty_id"],
                    forkOwner=self.context["fork_owner"],
                    forkUrl=self.context["fork_url"],
                    bountyType=SwarmBountyType.BUILD_FEATURE,
                )
                insert_issue_to_mongodb(issue_model)
            return generate_issues_result
        except Exception as e:
            log_error(e, "Issue generation workflow failed")
            return {
                "success": False,
                "message": f"Issue generation workflow failed: {str(e)}",
                "data": {"issues": []},
            }

    def generate_tasks(self, issue_uuid: str) -> Optional[Dict[str, Any]]:
        """Execute the task decomposition workflow."""
        try:
            self.setup()
            decompose_phase = phases.TaskDecompositionPhase(
                workflow=self, bounty_type=self.bounty_type
            )
            decomposition_result = decompose_phase.execute()

            if not decomposition_result or not decomposition_result.get("success"):
                log_error(
                    Exception(decomposition_result.get("error", "No result")),
                    "Task decomposition failed",
                )
                return None

            tasks_data = decomposition_result["data"].get("tasks", [])
            task_count = decomposition_result["data"].get("task_count", 0)

            if not tasks_data:
                log_error(
                    Exception("No tasks generated"),
                    "Task decomposition failed",
                )
                return None

            log_key_value("Tasks created Number", task_count)
            self.context["subtasks"] = tasks_data
            log_key_value("Subtasks Number", len(self.context["subtasks"]))

            self._process_dependencies(tasks_data)
            self._save_tasks_to_mongodb(tasks_data, issue_uuid)

            return {
                "success": True,
                "message": f"Created {task_count} tasks for the feature",
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

    def _process_dependencies(self, tasks_data: List[Dict[str, Any]]) -> None:
        """Process dependencies for all tasks."""
        for task in tasks_data:
            self.context["target_task"] = task
            dependency_phase = phases.TaskDependencyPhase(
                workflow=self, bounty_type=self.bounty_type
            )
            dependency_result = dependency_phase.execute()

            if not dependency_result or not dependency_result.get("success"):
                log_error(
                    Exception(
                        dependency_result.get("error", "No result")
                        if dependency_result
                        else "No results returned from phase"
                    ),
                    "Task dependency failed, continuing with empty dependencies",
                )
                task["dependency_tasks"] = []
                continue

            proposed_dependencies = dependency_result["data"].get(task["uuid"], [])
            valid_dependencies = self._validate_dependencies(
                task["uuid"], proposed_dependencies, tasks_data
            )
            task["dependency_tasks"] = valid_dependencies

        self._remove_mutual_dependencies(tasks_data)

    def _validate_dependencies(
        self, task_uuid: str, proposed_dependencies: List[str], tasks_data: List[Dict[str, Any]]
    ) -> List[str]:
        """Validate dependencies and remove circular ones."""
        valid_dependencies = []
        for dep in proposed_dependencies:
            temp_deps = valid_dependencies + [dep]
            if not self.check_circular_dependency(
                task_uuid, temp_deps, [Task.from_dict(t) for t in tasks_data]
            ):
                valid_dependencies.append(dep)
            else:
                log_error(
                    Exception("Circular dependency detected"),
                    f"Dependency {dep} would create a circular dependency, skipping it",
                )
        return valid_dependencies

    def _remove_mutual_dependencies(self, tasks_data: List[Dict[str, Any]]) -> None:
        """Remove mutual dependencies between tasks."""
        for task in tasks_data:
            if task.get("dependency_tasks"):
                for dep in task["dependency_tasks"]:
                    dep_task = next(
                        (t for t in tasks_data if t.get("uuid") == dep), None
                    )
                    if dep_task and task.get("uuid") in dep_task.get(
                        "dependency_tasks", []
                    ):
                        task["dependency_tasks"].remove(dep)

    def _save_tasks_to_mongodb(self, tasks_data: List[Dict[str, Any]], issue_uuid: str) -> None:
        """Save tasks to MongoDB."""
        for task in tasks_data:
            try:
                task["phases_data"] = self._get_phase_data(task["info"], task["tools"], task["acceptance_criteria"])

                log_key_value("Saving Task to MongoDB", {
                    "task_info": task["info"],
                    "task_uuid": task.get("uuid"),
                })
                if self.bounty_type == SwarmBountyType.BUILD_FEATURE:
                    try:
                        # Extract task info from the structured format
                        task_info = task["info"]
                        if isinstance(task_info, dict):
                            task_title = task_info.get("Todo", "").strip()
                            task_description = task_info.get("Description", "").strip()
                            task["info"] = f"{task_title}\n{task_description}"
                    except Exception as e:
                        log_error(e, f"Failed to process task info format for task {task.get('uuid', 'unknown')}")
                        # Fallback to using info as is if processing fails
                        pass
                    task_model = NewTaskModel(
                        title=task_title or "No Title Task",
                        description=task_description or "No Description Task", 
                        acceptanceCriteria=task["acceptance_criteria"],
                        repoOwner=self.context["repo_owner"],
                        repoName=self.context["repo_name"],
                        phasesData=task["phases_data"],
                        dependencyTasks=task.get("dependency_tasks", []),
                        uuid=task.get("uuid"),
                        bountyId=self.context["bounty_id"],
                        bountyType=self.bounty_type,
                        issueUuid=issue_uuid,
                    )
                result = insert_task_to_mongodb(task_model)
                
                if result:
                    log_key_value("Successfully saved task to MongoDB", {
                        "task_uuid": task.get("uuid"),
                    })
                else:
                    log_error(
                        Exception("Failed to save task to MongoDB"),
                        f"Task {task.get('info', 'unknown')} with UUID {task.get('uuid', 'unknown')} was not saved"
                    )
            except Exception as e:
                log_error(
                    e,
                    f"Failed to save task {task.get('info', 'unknown')} "
                    f"with UUID {task.get('uuid', 'unknown')}"
                )

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
    def generate_system_prompts(self, issues: List[Dict[str, Any]], tasks: List[List[Dict[str, Any]]]) -> Optional[Dict[str, Any]]:
        """Execute the system prompt generation workflow."""
        try:
            self.context["tasks"] = tasks
            self.context["issues"] = issues
            self.context["issue_spec"] = self.issue_spec

            system_prompt_phase = phases.SystemPromptGenerationPhase(
                workflow=self, bounty_type=self.bounty_type
            )
            system_prompt_result = system_prompt_phase.execute()

            if not system_prompt_result or not system_prompt_result.get("success"):
                log_error(
                    Exception(system_prompt_result.get("error", "No result")),
                    "System prompt generation failed",
                )
                return None

            self._save_system_prompt_to_mongodb(system_prompt_result["data"]["prompt"])
            return system_prompt_result

        except Exception as e:
            log_error(e, "System prompt generation workflow failed")
            return {
                "success": False,
                "message": f"System prompt generation workflow failed: {str(e)}",
                "data": {"prompt": None},
            }

    def _save_system_prompt_to_mongodb(self, prompt: str) -> None:
        """Save system prompt to MongoDB."""
        try:
            system_prompt_model = SystemPromptModel(
                prompt=prompt,
                bountyId=self.context["bounty_id"],
                bountyType=self.bounty_type,
            )
            insert_system_prompt_to_mongodb(system_prompt_model)
        except Exception as e:
            log_error(e, "Failed to insert system prompt into MongoDB")