import re
from github import Github
import os
import logging

logger = logging.getLogger(__name__)


def verify_pr_ownership(
    pr_url,
    expected_username,
    expected_owner,
    expected_repo,
):
    try:
        gh = Github(os.environ.get("GITHUB_TOKEN"))

        match = re.match(r"https://github.com/([^/]+)/([^/]+)/pull/(\d+)", pr_url)
        if not match:
            logger.error(f"Invalid PR URL: {pr_url}")
            return False

        owner, repo_name, pr_number = match.groups()

        if owner != expected_owner or repo_name != expected_repo:
            logger.error(
                f"PR URL mismatch: {pr_url} != {expected_owner}/{expected_repo}"
            )
            return False

        repo = gh.get_repo(f"{owner}/{repo_name}")
        pr = repo.get_pull(int(pr_number))

        if pr.user.login != expected_username:
            logger.error(
                f"PR username mismatch: {pr.user.login} != {expected_username}"
            )
            return False
        return True

    except Exception as e:
        logger.error(f"Error verifying PR ownership: {str(e)}")
        return True
