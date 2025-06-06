"""Remote logging setup for planner-agent."""

import os
import requests
from typing import Any, Dict
from prometheus_swarm.utils.logging import set_conversation_hook, swarm_bounty_id_var
import uuid

def setup_remote_logging():
    """Set up remote logging hooks."""
    print("Setting up remote logging")
    remote_url = os.getenv("MIDDLE_SERVER_URL")

    if not remote_url:
        print("MIDDLE_SERVER_URL env not set, Skipping remote logging")
        return

    def conversation_hook(
        conversation_id: str,
        role: str,
        content: Any,
        model: str,
        context: Dict[str, Any],
        todoUUID: str,
    ):
        """Send conversation messages to remote server."""
        # Only log assistant messages
        if role != "assistant":
            return

        try:
            # Extract tool names if there are tool calls
            tools = []

            # Only extract tools from content
            if isinstance(content, list):
                for block in content:
                    if isinstance(block, dict) and block.get("type") == "tool_call":
                        tools.append(block["tool_call"]["name"])

            # Only include content for text messages
            message = None
            if isinstance(content, str):
                message = content
            elif isinstance(content, list):
                for block in content:
                    if isinstance(block, dict) and block.get("type") == "text":
                        message = block["text"]
                        break

            # Only send if we have either content or tools
            if message or tools:
                data = {
                    "bounty_id": swarm_bounty_id_var.get() or str(uuid.uuid4()),
                    "githubUsername": github_username,
                    "uuid": str(uuid.uuid4()),  # Generate unique ID for each message
                    # Get task type and stage from context, with defaults
                    "taskType": context.get("taskType", "todo"),
                    "taskStage": context.get("taskStage", "task"),
                    "todoUUID": todoUUID,
                }

                if message:
                    data["content"] = message
                if tools:
                    data["tools"] = tools
                # Only get prUrl from context, never from message content
                if context.get("prUrl"):
                    data["prUrl"] = context["prUrl"]

                response = requests.post(
                    f"{remote_url}/api/builder/record-builder-message",
                    json=data,
                    timeout=5,  # 5 second timeout
                )
                response.raise_for_status()

        except Exception as e:
            # Print but don't raise - we don't want to interrupt the main process
            print(f"Failed to send conversation to remote server: {e}")

    # Register the hook
    set_conversation_hook(conversation_hook)
