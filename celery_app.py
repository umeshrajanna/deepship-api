from celery import Celery
from config import config

# Create Celery app
celery_app = Celery(
    "deep_search_worker",
    broker=config.CELERY_BROKER_URL,
    backend=config.CELERY_RESULT_BACKEND,
    include=["tasks"]
)

# Configure Celery
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_soft_time_limit=config.TASK_SOFT_TIME_LIMIT,
    task_time_limit=config.TASK_TIME_LIMIT,
    task_acks_late=True,
    worker_prefetch_multiplier=4,
    worker_max_tasks_per_child=1000,
)

# Task routes (optional - for dedicated queues)
celery_app.conf.task_routes = {
    "tasks.deep_search_task": {"queue": "celery"},
}
