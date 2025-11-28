from celery_app import celery_app
from redis_client import publish_progress
from database import SessionLocal
from config import config
from models import SearchJob, JobStatus
import time
import json
from datetime import datetime
from typing import List, Dict, Any
import asyncio

# Import scraper functions
from scraper_core import scrape_and_extract


@celery_app.task(bind=True, max_retries=config.TASK_MAX_RETRIES)
def deep_search_task(self, job_id: str, query: str):
    """
    Main deep search task - orchestrates LLM and scraping
    Uses async scraping tasks via queue
    """
    db = SessionLocal()
    
    try:
        # Update job status
        job = db.query(SearchJob).filter(SearchJob.id == job_id).first()
        if job:
            job.status = JobStatus.PROCESSING
            job.celery_task_id = self.request.id
            db.commit()
        
        # Step 1: Analyze query with LLM
        publish_progress(job_id, "reasoning", "Analyzing your search query...")
        query_analysis = analyze_query_with_llm(query)
        
        publish_progress(
            job_id, 
            "reasoning", 
            f"Identified {len(query_analysis['search_angles'])} search angles"
        )
        
        # Step 2: Dispatch scraper tasks to queue
        publish_progress(
            job_id,
            "reasoning",
            f"Dispatching {len(query_analysis['search_angles'])} scraping tasks..."
        )
        
        scraper_tasks = []
        for i, angle in enumerate(query_analysis['search_angles'], 1):
            task = scrape_content_task.apply_async(
                args=[job_id, angle, i, len(query_analysis['search_angles']), query],
                queue='scraper_queue'
            )
            scraper_tasks.append(task)
        
        # Wait for scraper tasks
        publish_progress(job_id, "reasoning", "Waiting for scraping to complete...")
        
        all_scraped_content = []
        for i, task_result in enumerate(scraper_tasks, 1):
            try:
                result = task_result.get(timeout=120)  # 2 min per scrape
                if result:
                    all_scraped_content.append(result)
                    publish_progress(
                        job_id,
                        "content",
                        f"✓ Completed {i}/{len(scraper_tasks)} scraping tasks"
                    )
            except Exception as e:
                publish_progress(job_id, "error", f"Scraping task {i} failed: {str(e)}")
                continue
        
        if not all_scraped_content:
            raise Exception("No content could be scraped")
        
        # Step 3: Synthesize with LLM
        publish_progress(job_id, "reasoning", "Synthesizing information...")
        synthesis = synthesize_with_llm(query, all_scraped_content)
        
        publish_progress(
            job_id,
            "content",
            f"Generated answer with {synthesis.get('source_count', 0)} sources"
        )
        
        # Step 4: Format answer
        publish_progress(job_id, "reasoning", "Formatting final answer...")
        final_answer = format_answer_with_llm(query, synthesis)
        
        # Step 5: Save and complete
        job = db.query(SearchJob).filter(SearchJob.id == job_id).first()
        if job:
            job.status = JobStatus.COMPLETED
            job.result = json.dumps(final_answer)
            job.completed_at = datetime.utcnow()
            db.commit()
        
        publish_progress(
            job_id,
            "complete",
            final_answer.get('answer', ''),
            full_result=final_answer
        )
        
        return final_answer
        
    except Exception as e:
        publish_progress(job_id, "error", f"Search failed: {str(e)}", fatal=True)
        
        job = db.query(SearchJob).filter(SearchJob.id == job_id).first()
        if job:
            job.status = JobStatus.FAILED
            job.error = str(e)
            db.commit()
        
        if self.request.retries < self.max_retries:
            raise self.retry(exc=e, countdown=10)
        raise
        
    finally:
        db.close()


@celery_app.task(bind=True, max_retries=2, queue='scraper_queue')
def scrape_content_task(self, job_id: str, angle: Dict, index: int, total: int, original_query: str):
    """
    Scraper task - runs Playwright directly (NO HTTP calls!)
    Runs on scraper workers only
    """
    try:
        publish_progress(
            job_id,
            "reasoning",
            f"Scraping: {angle['description']} ({index}/{total})"
        )
        
        # Generate URLs from search query (mock for now - replace with actual search)
        urls = generate_urls_from_query(angle['search_query'])
        
        # Run async scraper in sync context
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            scraped_data = loop.run_until_complete(
                scrape_and_extract(
                    urls=urls,
                    query=original_query,
                    concurrency=5
                )
            )
        finally:
            loop.close()
        
        if not scraped_data or not scraped_data.get('results'):
            raise Exception("No results from scraper")
        
        publish_progress(
            job_id,
            "content",
            f"✓ Found {len(scraped_data['results'])} sources for: {angle['description']}"
        )
        
        return {
            "angle": angle,
            "data": scraped_data
        }
        
    except Exception as e:
        publish_progress(job_id, "error", f"Failed to scrape '{angle['description']}': {str(e)}")
        
        if self.request.retries < self.max_retries:
            raise self.retry(exc=e, countdown=5)
        
        return None


def generate_urls_from_query(search_query: str) -> List[str]:
    """
    Generate URLs from search query
    TODO: Replace with actual search engine API (Google, Bing, etc.)
    """
    # Mock URLs - replace with actual search results
    return [
        f"https://example.com/search?q={search_query}",
        f"https://news.example.com/{search_query.replace(' ', '-')}",
        f"https://blog.example.com/article/{search_query.replace(' ', '-')}"
    ]


def analyze_query_with_llm(query: str) -> Dict[str, Any]:
    """Use LLM to analyze query - REPLACE WITH CLAUDE API"""
    time.sleep(1)
    return {
        "search_angles": [
            {
                "description": "Recent developments and news",
                "search_query": f"{query} recent news 2024"
            },
            {
                "description": "Technical details",
                "search_query": f"{query} technical documentation"
            },
            {
                "description": "Expert analysis",
                "search_query": f"{query} expert analysis"
            }
        ]
    }


def synthesize_with_llm(query: str, scraped_content: List[Dict]) -> Dict[str, Any]:
    """Synthesize with LLM - REPLACE WITH CLAUDE API"""
    time.sleep(2)
    
    total_sources = sum(
        len(item['data'].get('results', [])) 
        for item in scraped_content if item and item.get('data')
    )
    
    return {
        "key_findings": [
            "Finding from scraped content",
            "Another insight from sources"
        ],
        "source_count": total_sources
    }


def format_answer_with_llm(query: str, synthesis: Dict) -> Dict[str, Any]:
    """Format answer with LLM - REPLACE WITH CLAUDE API"""
    time.sleep(1)
    return {
        "answer": f"Based on {synthesis['source_count']} sources about '{query}'...",
        "sources": synthesis.get('key_findings', []),
        "confidence": "high"
    }