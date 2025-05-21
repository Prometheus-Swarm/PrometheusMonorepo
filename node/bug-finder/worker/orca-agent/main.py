from src.server import create_app
import os

from prometheus_swarm.utils.logging import set_error_post_hook, set_logs_post_hook
import requests


def post_logs_to_server(
    logLevel: str,
    message: str,
    task_id: str = None,
    swarm_bounty_id: str = None,
    signature: str = None,
):
    response = requests.post(
        f"http://host.docker.internal:30017/task/{task_id}/send-logs",
        json={
            "signature": signature,
            "swarmBountyId": swarm_bounty_id,
            "logLevel": logLevel,
            "logMessage": message,
        },
    )
    return response.json()


def post_error_logs_to_server(
    error: Exception,
    context: str,
    stack_trace: str,
    task_id: str = None,
    swarm_bounty_id: str = None,
    signature: str = None,
):
    response = requests.post(
        f"http://host.docker.internal:30017/task/{task_id}/send-error-logs",
        json={
            "signature": signature,
            "swarmBountyId": swarm_bounty_id,
            "error": context + str(error) + stack_trace,
        },
    )
    return response.json()


app = create_app()
# Register it once at startup
set_error_post_hook(post_error_logs_to_server)
set_logs_post_hook(post_logs_to_server)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port, debug=True)
