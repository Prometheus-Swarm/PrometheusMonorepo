"""Task decomposition workflow phases implementation."""

from prometheus_swarm.workflows.base import WorkflowPhase, Workflow


class BranchCreationPhase(WorkflowPhase):
    def __init__(self, workflow: Workflow, tools: list, conversation_id: str = None):
        super().__init__(
            workflow=workflow,
            prompt_name="create_branch",
            available_tools=tools,
            conversation_id=conversation_id,
            name="Branch Creation",
        )

class ConsolidatedPhase(WorkflowPhase):
    def __init__(self, workflow: Workflow, tools: list, conversation_id: str = None):
        super().__init__(
            workflow=workflow,
            prompt_name="consolidated_phase",
            available_tools=tools,
            conversation_id=conversation_id,
            name="Consolidated Phase",
        )




class CreatePullRequestPhase(WorkflowPhase):
    def __init__(self, workflow: Workflow, tools: list, conversation_id: str = None):
        super().__init__(
            workflow=workflow,
            prompt_name="create_pr",
            available_tools=tools,
            conversation_id=conversation_id,
            name="Create Pull Request",
        )
