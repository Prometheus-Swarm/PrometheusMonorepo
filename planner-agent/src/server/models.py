from pydantic import BaseModel, Field
from typing import List, Optional, Dict
import uuid
from datetime import datetime
from pymongo.errors import ConnectionFailure, PyMongoError
from .mongo_connection import MongoConnection
from enum import Enum

mongo_conn = MongoConnection()
db = mongo_conn.get_database("builder247")
sp_collection = db["specs"]



class TodoStatus(str, Enum):
    INITIALIZED = "initialized"  # Means not assigned to any node or when a node is audited as false
    IN_PROGRESS = "in_progress"  # Means is assigned to a node, not completed
    AUDITED = "audited"  # Means a PR is audited and waiting for merge
    MERGED = "merged"  # Means a PR is merged


def delete_a_spec_from_mongodb(
    swarmBountyId: str
) -> bool:
    try:
        # Insert the task
        result = sp_collection.delete_one({"swarmBountyId": swarmBountyId})

        # Check if the insertion was successful
        return result.acknowledged

    except ConnectionFailure:
        print("MongoDB connection failed")
        return False
    except PyMongoError as e:
        print(f"MongoDB error: {e}")
        return False
    except Exception as e:
        print(f"An unknown error occurred: {e}")
        return False