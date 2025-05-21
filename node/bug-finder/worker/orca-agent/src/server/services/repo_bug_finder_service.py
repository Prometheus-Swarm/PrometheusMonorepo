"""Task service module."""

from prometheus_swarm.database import get_db
from prometheus_swarm.clients import setup_client
from src.workflows.repoBugFinder.workflow import RepoBugFinderWorkflow
from prometheus_swarm.utils.logging import logger
from dotenv import load_dotenv
from src.workflows.repoBugFinder.prompts import PROMPTS
from src.database.models import Submission

load_dotenv()


def handle_task_creation(task_id, swarmBountyId, repo_url, signature, db=None):
    """Handle task creation request."""
    try:
        if db is None:
            db = get_db()  # Fallback for direct calls
        client = setup_client("anthropic")

        workflow = RepoBugFinderWorkflow(
            client=client,
            prompts=PROMPTS,
            repo_url=repo_url,
            signature=signature,
            task_id=task_id,
            swarmBountyId=swarmBountyId,
        )

        result = workflow.run()
        if result.get("success"):
            # Convert swarmBountyId to integer
            submission = Submission(
                task_id=task_id,
                swarmBountyId=swarmBountyId,
                status="summarized",
                repo_url=repo_url,
                pr_url=result["data"]["pr_url"],
            )
            db.add(submission)
            db.commit()
            return {"success": True, "result": result}
        else:
            return {"success": False, "result": result.get("error", "No result")}
    except Exception as e:
        logger.error(f"Repo summarizer failed: {str(e)}")
        raise


if __name__ == "__main__":
    from flask import Flask

    app = Flask(__name__)
    with app.app_context():
        result = handle_task_creation(
            task_id="1",
            swarmBountyId=1,
            repo_url="https://github.com/koii-network/builder-test",
        )
        print(result)
