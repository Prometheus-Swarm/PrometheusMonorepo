"""Remote logging setup for planner-agent."""

import os
import requests
from typing import Any
from prometheus_swarm.utils.logging import set_conversation_hook, swarm_bounty_id_var


def setup_remote_logging():
    """Set up remote logging hooks."""
    print("Setting up remote logging")
    remote_url = os.getenv("MIDDLE_SERVER_URL")

    if not remote_url:
        return

    def conversation_hook(conversation_id: str, role: str, content: Any, model: str):
        """Send conversation messages to remote server."""
        # Only log assistant messages
        if role != "assistant":
            return

        try:
            # Extract tool names if there are tool calls
            tools = []
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
                data = {}
                if message:
                    data["content"] = message
                if tools:
                    data["tool"] = tools

                # Add bounty ID if available
                bounty_id = swarm_bounty_id_var.get()
                if bounty_id:
                    data["bounty_id"] = bounty_id

                response = requests.post(
                    f"{remote_url}/api/builder/record-message",
                    json=data,
                    timeout=5,  # 5 second timeout
                )
                response.raise_for_status()

        except Exception as e:
            # Print but don't raise - we don't want to interrupt the main process
            print(f"Failed to send conversation to remote server: {e}")

    # Register the hook
    set_conversation_hook(conversation_hook)
