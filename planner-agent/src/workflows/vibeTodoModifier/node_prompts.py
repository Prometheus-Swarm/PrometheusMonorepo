"""Prompts for the task workflow."""

FEATURE_BUILDER_PROMPTS = {
    "create_branch": (
        "Create a descriptive branch name for the following task: {info}. The branch name should:\n"
        "1. Be kebab-case (lowercase with hyphens)\n"
        "2. Be descriptive of the task\n"
        "3. Be concise (max 50 chars)\n"
        "4. Not include special characters\n"
        "STOP after creating the branch name, do not begin implementing the task."
    ),
    "implement_todo": (
        "You are working on implementing the following task:\n"
        "{info}\n\n"
        # "All available files: {current_files}\n\n"
        "IMPORTANT: ALWAYS use relative paths (e.g., 'src/file.py' not '/src/file.py')\n\n"
        "IMPORTANT: Before you begin your task, make sure a test runner is installed and configured correctly.\n"
        "IMPORTANT: If this is a Typescript project and a test framework is not already configured, use Vitest.\n"
        "Use the available tools to:\n"
        "Create necessary files using relative paths\n"
        "Run tests to verify your implementation\n"
        "Fix any issues until all tests pass\n\n"
        "IMPORTANT: Ignore tests that require an end to end test runner like playwright or cypress\n"
        "Please implement the task following these guidelines:\n"
        "1. Write clear, well-documented code\n"
        "2. Include comprehensive tests\n"
        "3. Follow best practices for the language/framework\n"
        "4. Handle edge cases and errors appropriately\n"
        "5. Ensure all tests pass\n"
        "STOP after implementing the task, do not create a pull request."
    ),
    "create_pr": (
        "You are creating a pull request for the following task:\n"
        "Task Description:\n"
        "{info}\n\n"
        # "Available files: {current_files}\n\n"
        "IMPORTANT: Always use relative paths (e.g., 'src/file.py' not '/src/file.py')\n\n"
        "IMPORTANT: Ignore tests that require an end to end test runner like playwright or cypress\n"
        "Steps to create the pull request:\n"
        "1. First examine the available files to understand the implementation\n"
        "2. Create a clear and descriptive PR title\n"
        "3. Write a comprehensive PR description that includes:\n"
        "   - Description of all changes made\n"
        "   - Implementation details for each component\n"
        "   - Testing approach and results\n"
        "   - How each acceptance criterion is met\n"
        "   - Any important notes or considerations"
    ),
}

RECOMMENDED_TOOLS_FOR_FEATURE_BUILDER = {
    "create_branch": ["create_branch"],
    "implement_todo": [
        "read_file",
        "list_files",
        "write_file",
        "delete_file",
        "run_tests",
        "install_dependency",
        "create_directory"
    ],
   
    "create_pr": [
        "read_file",
        "list_files",
        "create_worker_pull_request"
    ],
}

DOCUMENT_SUMMARIZER_PROMPTS = {
    "create_branch": (
        "You need to create a feature branch for the README generation.\n"
        "Create a new branch with a descriptive name related to creating a README file.\n"
    ),
    "consolidated_phase": (
        "Task Information: {info}\n\n"
        "Acceptance Criteria:\n{acceptance_criteria}\n\n"
        "Please proceed with implementing this documentation task."
    ),
    "create_pr": (
        "You are creating a pull request."
        "The repository has been cloned to the current directory.\n"
        "Use the `create_pull_request_legacy` tool to create the pull request.\n"
        "IMPORTANT: Always use relative paths (e.g., 'src/file.py' not '/src/file.py')\n\n"
        "Steps to create the pull request:\n"
        "1. First examine the available files to understand the implementation\n"
        "2. Create a clear and descriptive PR title\n"
        "3. Write a comprehensive PR description that includes:\n"
        "   - Description of all changes made\n"
        "   - The main features and value of the documentation\n"
    ),
}

RECOMMENDED_TOOLS_FOR_DOCUMENT_SUMMARIZER = {
    "create_branch": ["create_branch"],
    "consolidated_phase": ['write_file', 'read_file', 'list_directory_contents', 'create_pull_request_legacy'],
    "create_pr": ["read_file", "search_code", "list_directory_contents", "create_pull_request_legacy"]
}