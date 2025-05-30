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
        "IMPORTANT: ALWAYS use relative paths (e.g., 'src/file.py' not '/src/file.py')\n\n"
        "IMPORTANT: Before you begin your task, make sure a test runner is installed and configured correctly.\n"
        "IMPORTANT: If this is a Typescript project and a test framework is not already configured, use Vitest.\n"
        "Use the available tools to:\n"
        "Create necessary files using relative paths\n"
        "Run tests to verify your implementation\n"
        "Fix any issues until all tests pass\n\n"
        "IMPORTANT: Create a .gitignore file and include any files and folders you don't want to commit for example: 'node_modules', 'dist', '.env', '__pycache__'\n\n\n"
        "IMPORTANT: Ignore tests that require an end to end test runner like playwright or cypress\n"
        "Please implement the task following these guidelines:\n"
        "1. Write clear, well-documented code\n"
        "2. Include comprehensive tests\n"
        "3. Follow best practices for the language/framework\n"
        "4. Handle edge cases and errors appropriately\n"
        "5. Ensure all tests pass\n"
        "STOP after implementing the task, do not create a pull request."
    ),
    "fix_implementation": (
        "The previous implementation attempt had the following issues:\n"
        "{{previous_issues}}\n\n"
        "Continuing in the same conversation, you are working on fixing the implementation for:\n"
        "{info}\n\n"
        "IMPORTANT: Always use relative paths (e.g., 'src/file.py' not '/src/file.py')\n\n"
        "IMPORTANT: Ignore tests that require an end to end test runner like playwright or cypress\n"
        "Use the available tools to:\n"
        "1. Review and understand the reported problems\n"
        "2. Make necessary changes to fix each issue\n"
        "3. Ensure changes don't introduce new problems\n"
        "4. Run tests to verify your fixes\n"
        "5. Confirm all acceptance criteria are met\n\n"
        "STOP after fixing the implementation, do not create a pull request."
    ),
    "validate_criteria": (
        "You are validating the implementation of the following task:\n"
        "{info}\n\n"
        "Acceptance Criteria:\n"
        "{acceptance_criteria}\n\n"
        "IMPORTANT: Always use relative paths (e.g., 'src/file.py' not '/src/file.py')\n\n"
        "Steps to validate:\n"
        "1. First examine the available files to understand the implementation\n"
        "2. Run the tests and verify they all pass\n"
        "3. Check each acceptance criterion carefully\n"
        "4. Verify code quality and best practices\n"
        "5. Check error handling and edge cases\n"
        "6. Verify correct directory structure:\n"
        "   - Implementation code MUST be in 'src' directory\n"
        "   - Test files MUST be in 'tests' directory\n\n"
        "IMPORTANT: Ignore tests that require an end to end test runner like playwright or cypress\n"
        "Provide a detailed validation report with:\n"
        "1. Test Results:\n"
        "   - List of passing tests\n"
        "   - List of failing tests\n"
        "2. Acceptance Criteria Status:\n"
        "   - List of criteria that are met\n"
        "   - List of criteria that are not met\n"
        "3. Directory Structure Check:\n"
        "   - Whether structure is valid\n"
        "   - Any structural issues found\n"
        "4. List of all issues found\n"
        "5. List of required fixes\n\n"
        "Use the validate_implementation tool to submit your findings.\n"
        "The tool requires:\n"
        "- success: boolean indicating if ALL criteria are met\n"
        "- test_results: object with passed and failed test lists\n"
        "- criteria_status: object with met and not_met criteria lists\n"
        "- directory_check: object with valid boolean and issues list\n"
        "- issues: list of all issues found\n"
        "- required_fixes: list of fixes needed\n\n"
        "DO NOT reject a task because acceptance criteria cannot be verified. "
        "Only reject if the implementation is known to be incorrect."
        "STOP after submitting the validation report."
    ),
    "create_pr": (
        "You are creating a pull request for the following task:\n"
        "Task Description:\n"
        "{info}\n\n"
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
    "create_draft_pr": (
        "You are creating an initial draft pull request for the following task:\n"
        "Task Description:\n"
        "{info}\n\n"
        "IMPORTANT: Always use relative paths (e.g., 'src/file.py' not '/src/file.py')\n\n"
        "Steps to create the draft pull request:\n"
        "1. Create a clear and descriptive PR title.\n"
        "2. Write an initial PR description that includes a brief overview of the planned changes\n"
        "3. The PR will be created as a draft automatically"
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
        "setup_dependencies",
        "create_directory"
    ],
    "fix_implementation": [
        "read_file",
        "list_files",
        "edit_file",
        "delete_file",
        "run_tests",
        "install_dependency",
    ],
    "validate_criteria": [
        "read_file",
        "list_files",
        "run_tests",
        "validate_implementation",
    ],
    "create_pr": [
        "read_file",
        "list_files",
        "create_worker_pull_request"
    ],
    "create_draft_pr": [
        "read_file",
        "list_files",
        "create_worker_pull_request"
    ]
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