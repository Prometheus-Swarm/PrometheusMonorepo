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
        print("MIDDLE_SERVER_URL env not set, Skipping remote logging")
        return

    def conversation_hook(conversation_id: str, role: str, content: Any, model: str, context):
        """Send conversation messages to remote server."""
        print("DEBUG",role, content)
        # Only log assistant messages
        if role != "assistant":
            return

        print("Sending conversation message: Debug2")

        try:
            # Extract tool names if there are tool calls
            tools = []
            if isinstance(content, list):
                for block in content:
                    if isinstance(block, dict) and block.get("type") == "tool_call":
                        tools.append(block["tool_call"]["name"])
            print("Debug2")
            # Only include content for text messages
            message = None
            if isinstance(content, str):
                message = content
            elif isinstance(content, list):
                for block in content:
                    if isinstance(block, dict) and block.get("type") == "text":
                        message = block["text"]
                        break
            print("Debug3", message, tools)

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

                print("Sending conversation message to remote server")
                response = requests.post(
                    f"{remote_url}/api/builder/record-message",
                    json=data,
                    timeout=5,  # 5 second timeout
                )
                response.raise_for_status()
            else:
                print("Debug4: No content or tools found in conversation message")
        except Exception as e:
            # Print but don't raise - we don't want to interrupt the main process
            print(f"Failed to send conversation to remote server: {e}")

    # Register the hook
    print("Setting conversation hook")
    set_conversation_hook(conversation_hook)
