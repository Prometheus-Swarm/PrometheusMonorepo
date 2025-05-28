"""Entry point for the todo creator workflow."""

import sys
import argparse
from dotenv import load_dotenv
from src.workflows.repoSummarizer.workflow import RepoSummarizerWorkflow
from src.workflows.repoSummarizer.prompts import PROMPTS
from prometheus_swarm.clients import setup_client

# Load environment variables
load_dotenv()

exampleTask = {'title': {'Type': 'File', 'PathToWrite': ['codex-cli', 'README.md'], 'SectionName': ['CLI Overview']}, 'description': 'Create a comprehensive overview section explaining the purpose and key features of the Codex CLI, providing users with a clear understanding of its functionality and value.', 'acceptance_criteria': ['Explain the main purpose of the CLI', 'Highlight key features and capabilities', 'Provide a high-level description of what problems the CLI solves', 'Write in a clear, engaging, and informative style'], 'tools': ['write_file', 'read_file', 'list_directory_contents', 'create_pull_request_legacy'], 'uuid': 'a978aad3-096e-48ec-b133-3eb85968e9c9'}
def main():
    """Run the todo creator workflow."""
    parser = argparse.ArgumentParser(
        description="Create tasks from a feature specification for a GitHub repository"
    )
    parser.add_argument(
        "--repo",
        type=str,
        required=True,
        help="GitHub repository URL (e.g., https://github.com/owner/repo)",
    )

    parser.add_argument(
        "--model",
        type=str,
        default="anthropic",
        choices=["anthropic", "openai", "xai"],
        help="Model provider to use (default: anthropic)",
    )
    args = parser.parse_args()

    # Initialize client
    client = setup_client(args.model)
    title_info = f"File: {'/'.join(exampleTask['title']['PathToWrite'])} - Section: {exampleTask['title']['SectionName'][0]}"
    PROMPTS["consolidated_phase"] = title_info + "\n\n" + exampleTask['description'] + "\n\nAcceptance Criteria:\n" + "\n".join(exampleTask['acceptance_criteria'])
 
    # Run the todo creator workflow
    workflow = RepoSummarizerWorkflow(
        client=client,
        prompts=PROMPTS,
        repo_url=args.repo,
        tools=exampleTask['tools']
    )

    result = workflow.run()
    if not result or not result.get("success"):
        print("Todo creator workflow failed")
        sys.exit(1)


if __name__ == "__main__":
    main()
