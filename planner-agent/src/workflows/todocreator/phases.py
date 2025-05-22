"""Task decomposition workflow phases implementation."""

from prometheus_swarm.workflows.base import WorkflowPhase, Workflow
from src.workflows.todocreator.utils import SwarmBountyType


class IssueGenerationPhase(WorkflowPhase):
    def __init__(self, workflow: Workflow, conversation_id: str = None, bounty_type: SwarmBountyType = None):
        prompt_name = "docs_generate_issues" if bounty_type == SwarmBountyType.DOCUMENT_SUMMARIZER else "generate_issues"
        super().__init__(
            workflow=workflow,
            prompt_name=prompt_name,
            available_tools=["generate_issues", "list_directory_contents", "read_file"],
            conversation_id=conversation_id,
            name="Issue Generation",
        )


class IssueValidationPhase(WorkflowPhase):
    def __init__(self, workflow: Workflow, conversation_id: str = None, bounty_type: SwarmBountyType = None):
        prompt_name = "docs_validate_issues" if bounty_type == SwarmBountyType.DOCUMENT_SUMMARIZER else "validate_issues"
        super().__init__(
            workflow=workflow,
            prompt_name=prompt_name,
            available_tools=[
                "generate_issues",
                "approve_issues",
                "list_files",
                "read_file",
            ],
            conversation_id=conversation_id,
            name="Issue Validation",
        )


class TaskDecompositionPhase(WorkflowPhase):
    def __init__(self, workflow: Workflow, conversation_id: str = None, bounty_type: SwarmBountyType = None):
        prompt_name = "docs_decompose_feature" if bounty_type == SwarmBountyType.DOCUMENT_SUMMARIZER else "decompose_feature"
        super().__init__(
            workflow=workflow,
            prompt_name=prompt_name,
            available_tools=[
                "read_file",
                "list_files",
                "generate_tasks",
            ],
            conversation_id=conversation_id,
            name="Task Decomposition",
        )


class TaskValidationPhase(WorkflowPhase):
    def __init__(self, workflow: Workflow, conversation_id: str = None, bounty_type: SwarmBountyType = None):
        prompt_name = "docs_validate_subtasks" if bounty_type == SwarmBountyType.DOCUMENT_SUMMARIZER else "validate_subtasks"
        super().__init__(
            workflow=workflow,
            prompt_name=prompt_name,
            available_tools=[
                "read_file",
                "validate_tasks",
            ],
            conversation_id=conversation_id,
            name="Task Validation",
        )


class TaskRegenerationPhase(WorkflowPhase):
    def __init__(self, workflow: Workflow, conversation_id: str = None, bounty_type: SwarmBountyType = None):
        prompt_name = "docs_regenerate_subtasks" if bounty_type == SwarmBountyType.DOCUMENT_SUMMARIZER else "regenerate_subtasks"
        super().__init__(
            workflow=workflow,
            prompt_name=prompt_name,
            available_tools=[
                "read_file",
                "regenerate_tasks",
            ],
            conversation_id=conversation_id,
            name="Task Regeneration",
        )


# TODO: Implement Task Dependency Phase
class TaskDependencyPhase(WorkflowPhase):
    def __init__(self, workflow: Workflow, conversation_id: str = None, bounty_type: SwarmBountyType = None):
        prompt_name = "docs_dependency_tasks" if bounty_type == SwarmBountyType.DOCUMENT_SUMMARIZER else "dependency_tasks"
        super().__init__(
            workflow=workflow,
            prompt_name=prompt_name,
            available_tools=[
                "read_file",
                "create_task_dependency",
            ],
            conversation_id=conversation_id,
            name="Task Dependency",
        )


class SystemPromptGenerationPhase(WorkflowPhase):
    def __init__(self, workflow: Workflow, conversation_id: str = None, bounty_type: SwarmBountyType = None):
        prompt_name = "docs_generate_system_prompts" if bounty_type == SwarmBountyType.DOCUMENT_SUMMARIZER else "generate_system_prompts"
        super().__init__(
            workflow=workflow,
            prompt_name=prompt_name,
            available_tools=[
                "read_file",
                "list_files",
                "generate_system_prompt",
            ],
            conversation_id=conversation_id,
            name="System Prompt Generation",
        )
