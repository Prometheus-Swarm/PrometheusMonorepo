"""Prompts for the task decomposition workflow."""

PROMPTS = {
    "system_prompt": (
        "You are an expert software architect and technical lead specializing in breaking down complex "
        "features into small, manageable tasks. You excel at creating detailed, actionable subtasks "
        "with clear acceptance criteria. The purpose of the tasks is to allow an AI agent to implement the feature and create a PR for it."
    ),
    'regenerate_task': (
        "You need to regenerate a task that failed to be implemented properly.\n\n"
        "Original Task Info: {info}\n"
        "Error Message: {error}\n\n"
        "Please regenerate this task with the following requirements:\n"
        "1. A clear, specific title\n"
        "2. A detailed description of the work required\n"
        "3. Quantifiable acceptance criteria that can be verified through automated tests\n\n"
        "Guidelines for task regeneration:\n"
        "- Address the specific error that caused the failure\n"
        "- Make the task more specific and actionable\n"
        "- Ensure acceptance criteria are measurable and testable\n"
        "- Break down complex steps into smaller, manageable parts\n"
        "- Include any necessary setup or prerequisites\n"
        "- Consider edge cases and error handling\n\n"
        "IMPORTANT: The regenerated task should be more detailed and clearer than the original to avoid similar implementation issues."
    )
}
