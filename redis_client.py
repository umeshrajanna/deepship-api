import redis
from config import config
import json
from typing import Dict, Any

# Redis client for general use (Celery broker, caching)
redis_client = redis.from_url(config.REDIS_URL, decode_responses=True)

# Separate Redis client for pub/sub (needs dedicated connection)
redis_pubsub_client = redis.from_url(config.REDIS_URL, decode_responses=True)

def publish_progress(job_id: str, message_type: str, content: Any, **kwargs):
    """
    Publish progress update for a job
    
    Args:
        job_id: The job ID
        message_type: Type of message (reasoning, content, complete, error)
        content: Message content
        **kwargs: Additional fields to include in message
    """
    message = {
        "type": message_type,
        "content": content,
        **kwargs
    }
    
    channel = f"job:{job_id}"
    redis_client.publish(channel, json.dumps(message))
    
def get_pubsub():
    """Get a new pubsub instance"""
    return redis_pubsub_client.pubsub()
