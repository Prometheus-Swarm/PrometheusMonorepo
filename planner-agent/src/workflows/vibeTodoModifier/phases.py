"""Task decomposition workflow phases implementation."""

from prometheus_swarm.workflows.base import WorkflowPhase, Workflow
from .utils import SwarmBountyType









class TaskRegenerationPhase(WorkflowPhase):
    def __init__(self, workflow: Workflow, conversation_id: str = None, bounty_type: SwarmBountyType = None):
        prompt_name = "regenerate_task"
        super().__init__(
            workflow=workflow,
            prompt_name=prompt_name,
            available_tools=[
                "read_file",
                "generate_task",
            ],
            conversation_id=conversation_id,
            name="Task Regeneration",
        )