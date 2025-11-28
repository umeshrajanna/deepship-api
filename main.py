from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import Dict, Set
import json
import asyncio
from datetime import datetime

from models import SearchJob, JobStatus
from database import get_db, init_db
from redis_client import redis_client, get_pubsub
from config import config
from tasks import deep_search_task

# Initialize FastAPI app
app = FastAPI(title="Deep Search API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        # Map job_id -> set of WebSocket connections
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # Map job_id -> pubsub listener task
        self.pubsub_tasks: Dict[str, asyncio.Task] = {}
    
    async def connect(self, websocket: WebSocket, job_id: str):
        """Add a WebSocket connection for a job"""
        await websocket.accept()
        
        if job_id not in self.active_connections:
            self.active_connections[job_id] = set()
        
        self.active_connections[job_id].add(websocket)
        
        # Start listening to Redis pub/sub if not already listening
        if job_id not in self.pubsub_tasks:
            task = asyncio.create_task(self._listen_to_redis(job_id))
            self.pubsub_tasks[job_id] = task
    
    def disconnect(self, websocket: WebSocket, job_id: str):
        """Remove a WebSocket connection"""
        if job_id in self.active_connections:
            self.active_connections[job_id].discard(websocket)
            
            # If no more connections for this job, stop listening
            if not self.active_connections[job_id]:
                del self.active_connections[job_id]
                
                if job_id in self.pubsub_tasks:
                    self.pubsub_tasks[job_id].cancel()
                    del self.pubsub_tasks[job_id]
    
    async def _listen_to_redis(self, job_id: str):
        """Listen to Redis pub/sub for a specific job and forward to WebSockets"""
        pubsub = get_pubsub()
        channel = f"job:{job_id}"
        
        try:
            pubsub.subscribe(channel)
            
            # Listen for messages
            for message in pubsub.listen():
                if message["type"] == "message":
                    data = message["data"]
                    
                    # Send to all connected WebSockets for this job
                    if job_id in self.active_connections:
                        disconnected = set()
                        
                        for websocket in self.active_connections[job_id]:
                            try:
                                await websocket.send_text(data)
                            except Exception:
                                disconnected.add(websocket)
                        
                        # Clean up disconnected WebSockets
                        for ws in disconnected:
                            self.disconnect(ws, job_id)
                        
                        # Check if job is complete
                        try:
                            msg = json.loads(data)
                            if msg.get("type") in ["complete", "error"]:
                                # Job finished, can stop listening after a delay
                                await asyncio.sleep(5)
                                break
                        except json.JSONDecodeError:
                            pass
                
        except asyncio.CancelledError:
            pass
        finally:
            pubsub.unsubscribe(channel)
            pubsub.close()

manager = ConnectionManager()

@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    init_db()

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

@app.post("/search")
async def create_search(
    query: str,
    db: Session = Depends(get_db)
):
    """
    Create a new search job
    
    Args:
        query: Search query string
        
    Returns:
        Job ID and status
    """
    if not query or len(query.strip()) == 0:
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    
    # Create job record
    job = SearchJob(query=query, status=JobStatus.PENDING)
    db.add(job)
    db.commit()
    db.refresh(job)
    
    print(f"📝 Created job: {job.id} for query: '{query}'")
    
    # Dispatch Celery task
    task = deep_search_task.apply_async(
        args=[job.id, query],
        task_id=f"search-{job.id}"
    )
    
    print(f"🚀 Dispatched task to Celery: task_id={task.id}, job_id={job.id}")
    print(f"   Task state: {task.state}")
    print(f"   Queue: celery (default)")
    
    # Update job with task ID
    job.celery_task_id = task.id
    db.commit()
    
    print(f"✅ Job {job.id} saved with celery_task_id: {task.id}")
    
    return {
        "job_id": job.id,
        "status": job.status.value,
        "message": "Search job created successfully"
    }

@app.get("/search/{job_id}")
async def get_search_status(
    job_id: str,
    db: Session = Depends(get_db)
):
    """
    Get the current status of a search job
    
    Args:
        job_id: The job ID
        
    Returns:
        Job details including status and results
    """
    job = db.query(SearchJob).filter(SearchJob.id == job_id).first()
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    response = job.to_dict()
    
    # Parse result JSON if available
    if job.result:
        try:
            response["result"] = json.loads(job.result)
        except json.JSONDecodeError:
            pass
    
    return response

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time updates
    
    Client should send: {"action": "subscribe", "job_id": "xxx"}
    """
    await websocket.accept()
    current_job_id = None
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            
            try:
                message = json.loads(data)
                action = message.get("action")
                
                if action == "subscribe":
                    job_id = message.get("job_id")
                    
                    if not job_id:
                        await websocket.send_json({
                            "type": "error",
                            "content": "job_id is required"
                        })
                        continue
                    
                    # Unsubscribe from previous job if any
                    if current_job_id:
                        manager.disconnect(websocket, current_job_id)
                    
                    # Subscribe to new job
                    current_job_id = job_id
                    await manager.connect(websocket, job_id)
                    
                    await websocket.send_json({
                        "type": "subscribed",
                        "content": f"Subscribed to job {job_id}"
                    })
                
                elif action == "unsubscribe":
                    if current_job_id:
                        manager.disconnect(websocket, current_job_id)
                        current_job_id = None
                    
                    await websocket.send_json({
                        "type": "unsubscribed",
                        "content": "Unsubscribed successfully"
                    })
                
                elif action == "ping":
                    await websocket.send_json({
                        "type": "pong",
                        "content": "Connection alive"
                    })
                
                else:
                    await websocket.send_json({
                        "type": "error",
                        "content": f"Unknown action: {action}"
                    })
                    
            except json.JSONDecodeError:
                await websocket.send_json({
                    "type": "error",
                    "content": "Invalid JSON"
                })
    
    except WebSocketDisconnect:
        if current_job_id:
            manager.disconnect(websocket, current_job_id)

@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "service": "Deep Search API",
        "version": "1.0.0",
        "endpoints": {
            "create_search": "POST /search",
            "get_status": "GET /search/{job_id}",
            "websocket": "WS /ws",
            "health": "GET /health"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=config.API_HOST,
        port=config.API_PORT,
        reload=True
    )