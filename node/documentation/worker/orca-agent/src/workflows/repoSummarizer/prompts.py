"""Prompts for the repository summarization workflow."""

PROMPTS = {
    "system_prompt": (
        "You are an expert software architect and technical lead specializing in summarizing "
        "repositories into comprehensive documentation. You excel at analyzing codebases "
        "and creating clear, structured documentation. Do NOT OVERLY READ THE REPO."
    ),
    "create_branch": (
        "You need to create a feature branch for the README generation.\n"
        "Create a new branch with a descriptive name related to creating a README file.\n"
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
    "previous_review_comments": ("Here are the comments from the previous review:\n"),
}
