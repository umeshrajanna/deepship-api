# tasks_api.py - Lightweight task stubs for API
# Contains only task signatures for dispatching, no heavy imports

from celery import Celery
import os
from celery_app import celery_app


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