"""Prompts for the task decomposition workflow."""

PROMPTS = {
    "system_prompt": (
        "You are an expert software architect and technical lead specializing in breaking down complex "
        "features into small, manageable tasks. You excel at creating detailed, actionable subtasks "
        "with clear acceptance criteria. The purpose of the tasks is to allow an AI agent to implement the feature and create a PR for it."
    ),
    "decompose_feature": (
        "You are creating user stories and subtasks as part of a plan to implement the following feature: "
        "{task_spec}\n"
        "A repository has already been checked out for you. Examine the existing code and then think through, "
        "step by step, which tasks are needed to implement the user story.\n"
        "For each task, you must provide:\n"
        "1. A clear, specific title\n"
        "2. A detailed description of the work required\n"
        "3. Quantifiable acceptance criteria that can be verified through automated tests\n\n"
        "Guidelines for task breakdown:\n"
        "- Each task should follow the Single Responsibility Principle - do one thing and do it well\n"
        "- Tasks should represent a single logical change (e.g., one schema change, one API endpoint)\n"
        "- Tasks should be independently testable with specific test cases\n"
        "- Each acceptance criterion must be measurable through unit tests, integration tests, or E2E tests\n"
        "- Tasks should be small enough that their implementation approach is clear\n"
        "- Consider separation of concerns (e.g., separate backend/frontend/database tasks)\n"
        "- Include necessary setup/infrastructure tasks\n"
        "- Tasks should be specific and focused\n"
        "- Tasks should include detailed steps\n"
        "- Every task must be a clear, actionable software development task that results in a code change\n"
        "- Consider using try logic to handle potential exceptions appropriately\n\n"
        "IMPORTANT: It is VITAL that you avoid over-engineering. The feature should be fully implemented but "
        "you must avoid unnecessary complexity. Do not include tasks that are not directly related to the feature. "
        "Do not include functionality beyond the user story.\n"
        "IMPORTANT: Make sure each task is discrete and doesn't overlap with other tasks.\n"
    ),
 
    "dependency_tasks": (
        "Review the following target task and determine if it depends on any other tasks.\n"
        "Target task: {target_task}\n"
        "Other tasks:\n{subtasks}\n\n"
        "Dependencies should always be one way, marking which tasks a task depends on.\n"
        "If any dependencies are found, link the uuid of the target task "
        "with a list of uuids for any tasks it depends on.\n"
        "IMPORTANT: do not create circular dependencies.\n"
    ),


    ###################################DOCS PROMPTS##########################################
    "docs_system_prompt": (
        "You are an expert technical writer specializing in creating clear, comprehensive documentation that helps users effectively use the software."
    ),
    "docs_generate_issues": (
        "Create documentation tasks for the repository following these rules:\n"
        "1. Create an overall repository documentation task\n"
        "2. Create tasks for significant folders and complex files (>200 lines)\n"
        "3. For each task, provide:\n"
        "   - Title in JSON format: {{Type: 'Folder'/'File', Path: ['path'], Readme File Name: ['name']}}\n"
        "   - Description with additional context\n"
        "Focus on end-user needs and use cases.\n"
        "IMPORTANT: Title must use the exact JSON format shown above."
    ),
    "docs_validate_issues": (
        "Review these documentation tasks:\n{issues}\n\n"
        "Validate against these criteria:\n"
        "1. Overall repository documentation exists\n"
        "2. Significant folders and complex files are covered\n"
        "3. Each task has:\n"
        "   - Valid JSON format title\n"
        "   - Clear description\n"
        "Provide specific feedback for any issues found."
    ),
    "docs_decompose_feature": (
        "Create documentation sections for: {current_issue}\n\n"
        "For each section provide:\n"
        "1. Please provide a title, in JSON string format: {{Type: 'Folder'/'File', Path: ['path'], Readme File Name: ['name'], Section Name: ['name']}}\n"
        "2. Description\n"
        "3. Tools: It must include all the tools AI agent need to use to complete the task and the tools to make a PULL REQUEST!\n\n"
        "TOOLS: {toolsNames}\n\n"
        "Guidelines:\n"
        "- Organize logically with clear dependencies\n"
        "- Make sections self-contained but linked\n\n"
        "IMPORTANT: Use exact JSON format for titles."
    ),
    "docs_validate_subtasks": (
        "Validate these documentation sections:\n{subtasks}\n\n"
        "Check for:\n"
        "1. Correct JSON title format\n"
        "2. Clear purpose and scope\n"
        "3. Key concepts and features\n"
        "4. Required examples and diagrams\n"
        "5. Logical organization\n"
        "6. No significant overlap\n"
        "7. Proper dependencies\n\n"
        "Approve if criteria are generally met. Reject only for significant issues."
    ),
    "docs_regenerate_subtasks": (
        "Regenerate documentation sections based on feedback:\n"
        "Task: {current_issue}\n"
        "Original: {subtasks}\n"
        "Failed: {auditedSubtasks}\n"
        "Feedback: {feedbacks}\n\n"
        "For each section provide:\n"
        "1. Section title\n"
        "2. Description in format: [Type: Path/File];[Path];[Readme Name]\n"
        "3. Documentation requirements\n\n"
        "Ensure sections are distinct and properly organized."
    ),
    "docs_dependency_tasks": (
        "Review dependencies for section: {target_task}\n"
        "Other sections: {subtasks}\n\n"
        "Identify one-way dependencies between sections.\n"
        "Link target section UUID with dependent section UUIDs.\n"
        "Avoid circular dependencies."
    ),
    "docs_generate_system_prompts": (
        "Create a system prompt for documentation generation:\n\n"
        "Sections: {issues}\n"
        "Tasks: {tasks}\n\n"
        "Include:\n"
        "1. AI role and expertise\n"
        "2. Documentation context\n"
        "3. Style and tone guidelines\n"
        "4. Documentation standards\n"
        "5. Example and visual aid requirements\n"
        "6. Section relationships\n"
        "7. Consistency guidelines\n\n"
        "Format as:\n"
        "---\n"
        "Documentation Overview\n"
        "AI Role and Expertise\n"
        "Documentation Context\n"
        "Documentation Guidelines\n"
        "Writing Standards\n"
        "Section Dependencies\n"
        "Quality Requirements\n"
        "---"
    ),
    
}
