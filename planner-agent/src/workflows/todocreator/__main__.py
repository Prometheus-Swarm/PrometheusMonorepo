"""Entry point for the todo creator workflow."""

import sys
import argparse
import uuid
from dotenv import load_dotenv
from src.workflows.todocreator.workflow import TodoCreatorWorkflow
from src.workflows.todocreator.prompts import PROMPTS
from prometheus_swarm.clients import setup_client
from prometheus_swarm.utils.logging import configure_logging, swarm_bounty_id_var
from src.server.logging_setup import setup_remote_logging
from src.workflows.todocreator.utils import SwarmBountyType

from src.workflows.todocreator.utils import SwarmBountyType

# Load environment variables
load_dotenv()


def run_workflow(args, mode="builder"):
    """Run the todo creator workflow with the specified mode."""
    # Configure logging
    configure_logging()
    setup_remote_logging()

    # Generate a test bounty ID
    test_bounty_id = str(uuid.uuid4())
    swarm_bounty_id_var.set(test_bounty_id)

    # Initialize client
    client = setup_client(args.model)

    if mode == "builder":
        # Run the todo creator workflow in builder mode
        workflow = TodoCreatorWorkflow(
            client=client,
            prompts=PROMPTS,
            source_url=args.repo,
            fork_url=args.fork,
            issue_spec=args.issue_spec,
            bounty_id=test_bounty_id,  # Use the same test bounty ID
            bounty_type=SwarmBountyType.BUILD_FEATURE,
        )
    else:
        # Run the todo creator workflow in docs mode
        workflow = TodoCreatorWorkflow(
            client=client,
            prompts=PROMPTS,
            source_url=args.repo,
            fork_url=args.repo,
            issue_spec=None,
            bounty_id=test_bounty_id,  # Use the same test bounty ID
            bounty_type=SwarmBountyType.DOCUMENT_SUMMARIZER,
        )

    result = workflow.run()
    if not result or not result.get("success"):
        print("Todo creator workflow failed")
        sys.exit(1)


def main():
    """Main entry point that handles both builder and docs modes."""
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
        "--mode",
        type=str,
        default="builder",
        choices=["builder", "docs"],
        help="Mode to run in (default: builder)",
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

    # Add conditional arguments based on mode
    args, remaining = parser.parse_known_args()

    if args.mode == "builder":
        parser.add_argument(
            "--fork",
            type=str,
            required=False,
            help="Fork repository URL (e.g., https://github.com/fork-owner/repo). "
            "Defaults to --repo value if not specified",
        )
        parser.add_argument(
            "--issue-spec",
            type=str,
            required=True,
            help="Description of the issue to implement",
        )

    args = parser.parse_args()

    # Set fork to repo value if not specified in builder mode
    if args.mode == "builder" and (not hasattr(args, "fork") or args.fork is None):
        args.fork = args.repo

    run_workflow(args, mode=args.mode)

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
    main_for_docs()
