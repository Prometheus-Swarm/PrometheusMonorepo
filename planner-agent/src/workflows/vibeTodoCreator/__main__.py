"""Entry point for the todo creator workflow."""

import sys
import argparse
import uuid
from dotenv import load_dotenv
from .workflow import TodoCreatorWorkflow
from .prompts import PROMPTS
from prometheus_swarm.clients import setup_client

from .utils import SwarmBountyType

# Load environment variables
load_dotenv()


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
        "--fork",
        type=str,
        required=True,
        help="Fork repository URL (e.g., https://github.com/fork-owner/repo)",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="todos.json",
        help="Output JSON file path (default: todos.json)",
    )
    parser.add_argument(
        "--model",
        type=str,
        default="anthropic",
        choices=["anthropic", "openai", "xai"],
        help="Model provider to use (default: anthropic)",
    )
    parser.add_argument(
        "--issue-spec",
        type=str,
        required=True,
        help="Description of the issue to implement",
    )
    args = parser.parse_args()

    # Initialize client
    client = setup_client(args.model)

    # Run the todo creator workflow
    workflow = TodoCreatorWorkflow(
        client=client,
        prompts=PROMPTS,
        source_url=args.repo,
        fork_url=args.fork,
        issue_spec=args.issue_spec,
        bounty_id=str(uuid.uuid4()),
        bounty_type=SwarmBountyType.BUILD_FEATURE,
    )

    result = workflow.run()
    if not result or not result.get("success"):
        print("Todo creator workflow failed")
        sys.exit(1)

def main_for_docs():

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
    # parser.add_argument(
    #     "--fork",
    #     type=str,
    #     required=True,
    #     help="Fork repository URL (e.g., https://github.com/fork-owner/repo)",
    # )
    parser.add_argument(
        "--output",
        type=str,
        default="todos.json",
        help="Output JSON file path (default: todos.json)",
    )
    parser.add_argument(
        "--model",
        type=str,
        default="anthropic",
        choices=["anthropic", "openai", "xai"],
        help="Model provider to use (default: anthropic)",
    )
    # parser.add_argument(
    #     "--issue-spec",
    #     type=str,
    #     required=True,
    #     help="Description of the issue to implement",
    # )
    args = parser.parse_args()

    # Initialize client
    client = setup_client(args.model)

    # Run the todo creator workflow
    workflow = TodoCreatorWorkflow(
        client=client,
        prompts=PROMPTS,
        source_url=args.repo,
        fork_url=args.repo,
        issue_spec=None,
        bounty_id=str(uuid.uuid4()),
        bounty_type=SwarmBountyType.DOCUMENT_SUMMARIZER,
    )

    result = workflow.run()
    if not result or not result.get("success"):
        print("Todo creator workflow failed")
        sys.exit(1)


if __name__ == "__main__":
    main()
