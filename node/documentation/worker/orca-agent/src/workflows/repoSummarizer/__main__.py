"""Entry point for the todo creator workflow."""

import sys
import argparse
from dotenv import load_dotenv
from src.workflows.repoSummarizer.workflow import RepoSummarizerWorkflow
from src.workflows.repoSummarizer.prompts import PROMPTS
from prometheus_swarm.clients import setup_client
from typing import List, Dict, Any
import ast
import re


# Load environment variables
load_dotenv()

def clean_prompt_string(prompt: str) -> str:
    """Clean up double curly braces in prompt strings to single curly braces and handle dictionary formatting.
    
    Args:
        prompt (str): The prompt string that may contain double curly braces and dictionary strings
        
    Returns:
        str: Cleaned prompt string with proper formatting
    """
    # First handle the dictionary string formatting
    def replace_dict(match):
        try:
            # Parse the dictionary string into an actual dict
            dict_str = match.group(0)
            dict_obj = ast.literal_eval(dict_str)
            # Format it into a readable string
            return f"Description: {dict_obj['Description']}, Todo: {dict_obj['Todo']}"
        except:
            return match.group(0)
    
    # Find and replace dictionary strings
    prompt = re.sub(r"\{'Description':.*?'Todo':.*?\}", replace_dict, prompt)
    
    # Then handle double curly braces
    return prompt.replace("{{", "{").replace("}}", "}")

def main():
    """Run the todo creator workflow."""
    # Sample Repo Url
    repo_url = "https://github.com/openai/codex"
    ## NEVER CHANGE THIS PHASES DATA! 
    phasesData = [
        {
            "prompt": "Create a descriptive branch name for the following task: {'Description': 'Create unit tests for CoinGecko API integration', 'Todo': 'Write comprehensive unit tests to validate API client and service'}. The branch name should:\n1. Be kebab-case (lowercase with hyphens)\n2. Be descriptive of the task\n3. Be concise (max 50 chars)\n4. Not include special characters\nSTOP after creating the branch name, do not begin implementing the task.",
            "tools": ["create_branch"]
        },
        {
            "prompt": "You are working on implementing the following task:\n{'Description': 'Create unit tests for CoinGecko API integration', 'Todo': 'Write comprehensive unit tests to validate API client and service'}\n\nIMPORTANT: ALWAYS use relative paths (e.g., 'src/file.py' not '/src/file.py')\n\nIMPORTANT: Before you begin your task, make sure a test runner is installed and configured correctly.\nIMPORTANT: If this is a Typescript project and a test framework is not already configured, use Vitest.\nUse the available tools to:\nCreate necessary files using relative paths\nRun tests to verify your implementation\nFix any issues until all tests pass\n\nIMPORTANT: Ignore tests that require an end to end test runner like playwright or cypress\nPlease implement the task following these guidelines:\n1. Write clear, well-documented code\n2. Include comprehensive tests\n3. Follow best practices for the language/framework\n4. Handle edge cases and errors appropriately\n5. Ensure all tests pass\nSTOP after implementing the task, do not create a pull request.",
            "tools": ["read_file", "list_files", "write_file", "delete_file", "run_tests", "install_dependency"]
        },
        {
            "prompt": "You are creating a pull request for the following task:\nTask Description:\n{'Description': 'Create unit tests for CoinGecko API integration', 'Todo': 'Write comprehensive unit tests to validate API client and service'}\n\nIMPORTANT: Always use relative paths (e.g., 'src/file.py' not '/src/file.py')\n\nIMPORTANT: Ignore tests that require an end to end test runner like playwright or cypress\nSteps to create the pull request:\n1. First examine the available files to understand the implementation\n2. Create a clear and descriptive PR title\n3. Write a comprehensive PR description that includes:\n   - Description of all changes made\n   - Implementation details for each component\n   - Testing approach and results\n   - How each acceptance criterion is met\n   - Any important notes or considerations",
            "tools": ["read_file", "list_files", "create_worker_pull_request"]
        }
    ]
    model = "anthropic"
    # Initialize client
    client = setup_client(model)
    # Run the todo creator workflow

    PROMPTS["create_branch"] = clean_prompt_string(phasesData[0]["prompt"])
    PROMPTS["create_pr"] = clean_prompt_string(phasesData[2]["prompt"])
    PROMPTS["consolidated_phase"] = clean_prompt_string(phasesData[1]["prompt"])
    workflow = RepoSummarizerWorkflow(
        client=client,
        repo_url=repo_url,
        phasesData=phasesData,
        PROMPTS=PROMPTS
    )

    result = workflow.run()
    if not result or not result.get("success"):
        print("Repo summarizer workflow failed")
        sys.exit(1)


if __name__ == "__main__":
    main()
