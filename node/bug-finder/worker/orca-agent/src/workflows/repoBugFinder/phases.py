"""Task decomposition workflow phases implementation."""

from prometheus_swarm.workflows.base import WorkflowPhase, Workflow


class BranchCreationPhase(WorkflowPhase):
    def __init__(self, workflow: Workflow, conversation_id: str = None):
        super().__init__(
            workflow=workflow,
            prompt_name="create_branch",
            available_tools=["create_branch"],
            conversation_id=conversation_id,
            name="Branch Creation",
        )

class IssuesReadmeFileCreationPhase(WorkflowPhase):
    def __init__(self, workflow: Workflow, conversation_id: str = None):
        super().__init__(
            workflow=workflow,
            prompt_name="generate_issues_readme",
            required_tool="create_readme_file_with_name",
            conversation_id=conversation_id,
            name="Readme File Creation",
        )


class IssuesReadmeReviewPhase(WorkflowPhase):
    def __init__(self, workflow: Workflow, conversation_id: str = None):
        super().__init__(
            workflow=workflow,
            prompt_name="review_readme_file",
            available_tools=["read_file", "list_files", "review_readme_file"],
            conversation_id=conversation_id,
            name="Readme Review",
        )


class CreatePullRequestPhase(WorkflowPhase):
    def __init__(self, workflow: Workflow, conversation_id: str = None):
        super().__init__(
            workflow=workflow,
            prompt_name="create_pr",
            available_tools=["read_file", "list_files", "create_pull_request_legacy"],
            conversation_id=conversation_id,
            name="Create Pull Request",
        )
