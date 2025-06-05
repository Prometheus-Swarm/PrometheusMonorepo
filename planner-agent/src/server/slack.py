import os
import json
import requests
from typing import Optional

def send_message_to_slack(message: str) -> None:
    """
    Send a message to Slack using a webhook URL.
    
    Args:
        message (str): The message to send to Slack
        
    Raises:
        ValueError: If SLACK_WEBHOOK_URL environment variable is not set
        requests.RequestException: If the request to Slack fails
    """
    try:
        slack_webhook_url = os.getenv("SLACK_WEBHOOK_URL")
        if not slack_webhook_url:
            raise ValueError("SLACK_WEBHOOK_URL is not set")

        payload = {
            "text": message
        }

        response = requests.post(
            slack_webhook_url,
            headers={"Content-Type": "application/json"},
            data=json.dumps(payload)
        )
        
        response.raise_for_status()  # Raises an HTTPError for bad responses (4xx, 5xx)
        
    except requests.RequestException as error:
        print(f"Error sending message to Slack: {error}")
        raise
