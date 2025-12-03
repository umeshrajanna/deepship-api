# tasks_api.py - Lightweight task stubs for API
# Contains only task signatures for dispatching, no heavy imports

from celery import Task
from celery_app import celery_app
from datetime import datetime, timezone
import logging
import json
import time

logger = logging.getLogger(__name__)
# Task signature - just for dispatching, no implementation
# @celery_app.task(bind=True, name='tasks.deep_search_task')
# def deep_search_task(self, job_id: str, query: str):
#     """
#     Task stub for API to dispatch.
#     Actual implementation is in workers' tasks.py
#     This is never executed by API - only used for task.apply_async()
#     """
#     raise NotImplementedError("This task should only be dispatched, not executed by API")

class CallbackTask(Task):
    """Custom task that publishes progress via Redis"""
    
    def publish_progress(self, job_id: str, data: dict):
        """Publish progress update to Redis channel"""
        from redis_client import redis_client
        channel = f"job:{job_id}"
        
        try:
            redis_client.publish(channel, json.dumps(data))
            logger.info(f"[REDIS] Published to {channel}: {data.get('type')}")
        except Exception as e:
            logger.error(f"[REDIS] Publish error: {e}")
            
@celery_app.task(
    bind=True, 
    base=CallbackTask, 
    name='tasks.deep_search_task',
    queue='llm_worker_queue'
)
def deep_search_task(
    self, 
    job_id: str,
    conversation_id: str,
    query: str, 
    conversation_history: list = None,
    file_contents: list = None,
    lab_mode: bool = False
):
    """
    Celery task for deep search with LLM processing
    Publishes reasoning steps and final result via Redis
    """
    
    logger.info(f"[WORKER] Starting task for job {job_id}")
    logger.info(f"[WORKER] Conversation ID: {conversation_id}")
    logger.info(f"[WORKER] Query: {query}")
    logger.info(f"[WORKER] Lab Mode: {lab_mode}")
    logger.info(f"[WORKER] Files: {len(file_contents) if file_contents else 0}")
    
    try:
        # ===== STEP 1: Initial reasoning =====
        self.publish_progress(job_id, {
            "type": "reasoning",
            "step": "Query Analysis",
            "content": "Analyzing your query and planning research strategy...",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        time.sleep(0.5)
        
        # ===== STEP 2: Web search =====
        from web_search import search_web
        
        self.publish_progress(job_id, {
            "type": "reasoning",
            "step": "Web Search",
            "content": f"Searching for: {query}",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        search_results = search_web(query, num_results=10)
        
        self.publish_progress(job_id, {
            "type": "reasoning",
            "step": "Sources Found",
            "content": f"Found {len(search_results)} relevant sources",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        time.sleep(0.5)
        
        # ===== STEP 3: Build context for LLM =====
        self.publish_progress(job_id, {
            "type": "reasoning",
            "step": "Context Building",
            "content": "Extracting and organizing information from sources...",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        # Build search context
        search_context = "\n\n=== WEB SEARCH RESULTS ===\n"
        sources = []
        
        for idx, result in enumerate(search_results[:10], 1):
            search_context += f"\n[Source {idx}]\n"
            search_context += f"Title: {result.get('title', 'N/A')}\n"
            search_context += f"URL: {result.get('url', 'N/A')}\n"
            search_context += f"Content: {result.get('content', 'N/A')[:500]}...\n"
            search_context += "="*50 + "\n"
            
            sources.append({
                "title": result.get('title', 'N/A'),
                "url": result.get('url', 'N/A'),
                "snippet": result.get('content', 'N/A')[:200]
            })
        
        # Add file contents if present
        if file_contents:
            search_context += "\n\n=== UPLOADED FILES ===\n"
            for file_info in file_contents:
                search_context += f"\n--- {file_info['filename']} ({file_info['type']}) ---\n"
                search_context += file_info['content'][:2000]
                search_context += "\n" + "="*50 + "\n"
        
        # ===== STEP 4: CALL LLM =====
        self.publish_progress(job_id, {
            "type": "reasoning",
            "step": "Deep Analysis",
            "content": "Claude is analyzing all sources and generating comprehensive response...",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        # Import Anthropic client
        import anthropic
        import os
        
        client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        
        # Build conversation history
        messages = []
        if conversation_history:
            messages = conversation_history.copy()
        
        # Add current query with context
        user_message = f"""{query}

{search_context}

Please provide a comprehensive, well-structured response based on the search results above."""
        
        messages.append({
            "role": "user",
            "content": user_message
        })
        
        # Call Claude API
        logger.info("[WORKER] Calling Claude API...")
        
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            messages=messages
        )
        
        # Extract response text
        response_text = response.content[0].text
        
        logger.info(f"[WORKER] Got response: {len(response_text)} chars")
        
        # ===== STEP 5: Finalize =====
        self.publish_progress(job_id, {
            "type": "reasoning",
            "step": "Finalizing",
            "content": "Research complete! Delivering results...",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        time.sleep(0.3)
        
        reasoning_steps = [
            {
                "step": "Query Analysis",
                "content": "Analyzed query and planned research strategy",
                "timestamp": datetime.now(timezone.utc).isoformat()
            },
            {
                "step": "Web Search",
                "content": f"Found {len(search_results)} relevant sources",
                "timestamp": datetime.now(timezone.utc).isoformat()
            },
            {
                "step": "Deep Analysis",
                "content": "Generated comprehensive response using Claude",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        ]
        
        final_result = {
            "type": "complete",
            "conversation_id": conversation_id,
            "content": response_text,
            "sources": sources,
            "reasoning_steps": reasoning_steps,
            "assets": [],
            "app": None,
            "lab_mode": lab_mode
        }
        
        self.publish_progress(job_id, final_result)
        
        logger.info(f"[WORKER] Task complete for job {job_id}")
        return final_result
        
    except Exception as e:
        logger.error(f"[WORKER] Task failed: {e}", exc_info=True)
        
        # Publish error
        self.publish_progress(job_id, {
            "type": "error",
            "message": "We encountered an issue processing your request. Please try again.",
            "fatal": True,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        raise
@celery_app.task(bind=True, name='tasks.scrape_content_task')
def scrape_content_task(self, job_id: str, search_query: str, original_query: str):
    """
    Task stub for dispatching scraper tasks.
    Actual implementation is in workers' tasks.py
    """
    raise NotImplementedError("This task should only be dispatched, not executed by API")

# That's it! No scraper_core, no playwright, no torch imports!
# API can now dispatch tasks without loading heavy dependencies