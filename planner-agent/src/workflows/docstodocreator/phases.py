"""Task decomposition workflow phases implementation."""

from prometheus_swarm.workflows.base import WorkflowPhase, Workflow



class RepoSectionGenerationPhase(WorkflowPhase):
    def __init__(self, workflow: Workflow, conversation_id: str = None):
        super().__init__(
            workflow=workflow,
            prompt_name="generate_sections",
            available_tools=["read_file", "search_code", "list_directory_contents", "generate_sections"],
            conversation_id=conversation_id,
            name="Repository Section Generation",
        )

class RepoSectionValidationPhase(WorkflowPhase):
    def __init__(self, workflow: Workflow, conversation_id: str = None):
        super().__init__(
            workflow=workflow,
            prompt_name="validate_sections",
            available_tools=["validate_sections"],
        )

class SystemPromptGenerationPhase(WorkflowPhase):
    def __init__(self, workflow: Workflow, conversation_id: str = None):
        super().__init__(
            workflow=workflow,
            prompt_name="generate_system_prompt",
            available_tools=["generate_system_prompt"],
            conversation_id=conversation_id,
            name="System Prompt Generation",
        )
