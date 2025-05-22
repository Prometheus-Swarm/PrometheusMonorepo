from github import Github
from prometheus_swarm.utils.logging import logger
import time
import os
import 

def create_aggregator_repo(issue_uuid, repo_owner, repo_name):
    """Create a new aggregator repo for the given issue."""
    github = Github(os.environ["GITHUB_TOKEN"])
    username = os.environ["GITHUB_USERNAME"]
    try:
        source_repo = github.get_repo(f"{repo_owner}/{repo_name}")
        logger.info(f"Found source repo: {source_repo.html_url}")
    except Exception as e:
        logger.error(
            f"Error finding source repo {repo_owner}/{repo_name}: {str(e)}"
        )
        return {
            "success": False,
            "error": f"Failed to find source repo {repo_owner}/{repo_name}: {str(e)}",
            "data": None,
            "status": 500,
        }

    # Check if fork already exists
    try:
        fork = github.get_repo(f"{username}/{repo_name}")
        logger.info(f"Using existing fork: {fork.html_url}")
    except Exception:
        # Create new fork if it doesn't exist
        fork = github.get_user().create_fork(source_repo)
        logger.info(f"Created new fork: {fork.html_url}")

    branch_name = issue_uuid
    logger.info(f"Using branch_name: {branch_name}")

    try:
        # Check if branch already exists
        try:
            fork.get_branch(branch_name)
            logger.info(f"Using existing branch: {branch_name}")
        except Exception:
            # Create a branch with the issue UUID name
            # Branch doesn't exist, create it
            default_branch = fork.default_branch
            default_branch_sha = fork.get_branch(default_branch).commit.sha
            fork.create_git_ref(f"refs/heads/{branch_name}", default_branch_sha)
            logger.info(f"Created new branch: {branch_name}")

            # Add retry mechanism to ensure branch is available
            max_retries = 5
            retry_delay = 2  # seconds
            for attempt in range(max_retries):
                try:
                    fork.get_branch(branch_name)
                    logger.info(f"Branch {branch_name} is now available")
                    break
                except Exception as e:
                    if attempt == max_retries - 1:
                        raise Exception(
                            f"Branch {branch_name} not available after "
                            f"{max_retries} attempts: {str(e)}"
                        )
                    logger.info(
                        f"Branch {branch_name} not yet available, retrying in {retry_delay} seconds..."
                    )
                    time.sleep(retry_delay)

        # The create-aggregator-repo endpoint should only create the fork and branch
        # It should not call the middle server directly

        return {
            "status": 200,
            "success": True,
            "message": "Successfully created aggregator repository",
            "data": {
                "fork_url": fork.html_url,
                "branch_name": branch_name,
                "issue_uuid": issue_uuid,
            },
        }
    except Exception as e:
        logger.error(f"Error creating aggregator repo: {str(e)}")
        return {
            "status": 500,
            "success": False,
            "message": f"Failed to create aggregator repository: {str(e)}",
            "data": None,
        }

def consolidate_prs(issue_uuid, repo_owner, repo_name):
    client = setup_client("anthropic")

    workflow = MergeConflictWorkflow(
        client=client,
        prompts=CONFLICT_PROMPTS,
        source_fork_url=source_fork.html_url,
        source_branch=source_branch,
        staking_key=staking_key,
        pub_key=pub_key,
        staking_signature=staking_signature,
        public_signature=public_signature,
        bounty_id=bounty_id,
        pr_list=pr_list,
        expected_branch=source_branch,
        fork_owner=fork_owner,
        pr_signature=pr_signature,
        issue_uuid=issue_uuid,  # Pass issue_uuid to the workflow
    )

    # Run workflow
    pr_url = workflow.run()
    if not pr_url:
        log_error(
            Exception("No PR URL returned from workflow"),
            context="Merge workflow failed to create PR",
        )
        submission.status = "failed"
        db.commit()
        return {
            "success": False,
            "status": 500,
            "error": "Merge workflow failed to create PR",
        }

    # Store PR URL and update status
    submission.pr_url = pr_url
    submission.status = "completed"
    db.commit()
    logger.info(f"Stored PR URL {pr_url} and updated status to completed")

    return {
        "success": True,
        "data": {
            "pr_url": pr_url,
            "message": "PRs consolidated successfully",
            "bounty_id": bounty_id,
            "uuid": issue_uuid,
        },
    }

except Exception as e:
    log_error(e, context="PR consolidation failed")
    if "db" in locals():
        # Update submission status
        submission = (
            db.query(Submission)
            .filter(
                Submission.bounty_id == bounty_id,
                Submission.round_number == round_number,
            )
            .first()
        )
        if submission:
            submission.status = "failed"
            db.commit()
            logger.info(
                f"Updated status to failed for bounty {bounty_id}, round {round_number}"
            )
    return {"success": False, "status": 500, "error": str(e)}