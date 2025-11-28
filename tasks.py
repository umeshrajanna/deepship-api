# tasks_api.py - Lightweight task stubs for API
# Contains only task signatures for dispatching, no heavy imports

from celery import Celery
import os

# Minimal Celery app configuration
celery_app = Celery(
    'deepship',
    broker=os.getenv('CELERY_BROKER_URL', 'redis://localhost:6379'),
    backend=os.getenv('CELERY_RESULT_BACKEND', 'redis://localhost:6379')
)

celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
)

# Task signature - just for dispatching, no implementation
@celery_app.task(bind=True, name='tasks.deep_search_task')
def deep_search_task(self, job_id: str, query: str):
    """
    Task stub for API to dispatch.
    Actual implementation is in workers' tasks.py
    This is never executed by API - only used for task.apply_async()
    """
    raise NotImplementedError("This task should only be dispatched, not executed by API")

@celery_app.task(bind=True, name='tasks.scrape_content_task')
def scrape_content_task(self, job_id: str, search_query: str, original_query: str):
    """
    Task stub for dispatching scraper tasks.
    Actual implementation is in workers' tasks.py
    """
    raise NotImplementedError("This task should only be dispatched, not executed by API")

# That's it! No scraper_core, no playwright, no torch imports!
# API can now dispatch tasks without loading heavy dependencies