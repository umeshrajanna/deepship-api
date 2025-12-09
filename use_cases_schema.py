# Add these to your database.py file

from sqlalchemy import Column, String, Text, Integer, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime, timezone
import uuid
from sqlalchemy import create_engine, Column, String, Text, Boolean, DateTime, Integer, ForeignKey, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid
from datetime import datetime, timezone
Base = declarative_base()
# ============================================
# PUBLIC USE CASES TABLES
# ============================================

class PublicUseCase(Base):
    """
    Public showcase of example conversations/use cases.
    Completely separate from user conversations for privacy.
    """
    __tablename__ = "public_use_cases"
    
    # Core Identity
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Showcase Information
    title = Column(String(255), nullable=False)  # Display title for the use case
    description = Column(Text, nullable=False)  # What this use case demonstrates
    category = Column(String(100), nullable=False)  # e.g., "writing", "coding", "research"
    
    # Metadata
    tags = Column(JSON, default=list)  # ["pdf_analysis", "charts", "deep_search"]
    difficulty_level = Column(String(50), default="beginner")  # beginner/intermediate/advanced
    
    # Display Options
    thumbnail_url = Column(Text, nullable=True)  # Optional preview image
    featured = Column(Boolean, default=False)  # Admin-curated featured examples
    
    # Engagement Metrics
    view_count = Column(Integer, default=0)
    message_count = Column(Integer, default=0)  # Number of messages in this use case
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationships
    messages = relationship("PublicMessage", back_populates="use_case", cascade="all, delete-orphan", order_by="PublicMessage.order")
    
    def to_dict(self):
        """Convert to dictionary for API response"""
        return {
            "id": str(self.id),
            "title": self.title,
            "description": self.description,
            "category": self.category,
            "tags": self.tags,
            "difficulty_level": self.difficulty_level,
            "thumbnail_url": self.thumbnail_url,
            "featured": self.featured,
            "view_count": self.view_count,
            "message_count": self.message_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class PublicMessage(Base):
    """
    Messages belonging to public use cases.
    Sanitized and curated content for public viewing.
    """
    __tablename__ = "public_messages"
    
    # Core Identity
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    use_case_id = Column(UUID(as_uuid=True), ForeignKey("public_use_cases.id", ondelete="CASCADE"), nullable=False)
    
    # Message Content
    role = Column(String(50), nullable=False)  # "user" or "assistant"
    content = Column(Text, nullable=False)  # Main message content (sanitized)
    order = Column(Integer, nullable=False)  # Message sequence (0, 1, 2, ...)
    
    # Rich Content (same as regular messages)
    sources = Column(Text, nullable=True)  # JSON string of sources
    reasoning_steps = Column(Text, nullable=True)  # JSON string of reasoning steps
    assets = Column(Text, nullable=True)  # JSON string of assets (charts, etc.)
    app = Column(Text, nullable=True)  # HTML content for interactive apps
    
    # File Attachments Info (metadata only, not actual files)
    has_file = Column(Boolean, default=False)
    file_type = Column(String(50), nullable=True)  # e.g., "pdf", "csv"
    file_description = Column(Text, nullable=True)  # e.g., "Q4 Financial Report.pdf"
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    # Relationships
    use_case = relationship("PublicUseCase", back_populates="messages")
    
    def to_dict(self):
        """Convert to dictionary for API response"""
        return {
            "id": str(self.id),
            "use_case_id": str(self.use_case_id),
            "role": self.role,
            "content": self.content,
            "order": self.order,
            "sources": self.sources,
            "reasoning_steps": self.reasoning_steps,
            "assets": self.assets,
            "app": self.app,
            "has_file": self.has_file,
            "file_type": self.file_type,
            "file_description": self.file_description,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


# ============================================
# CATEGORY ENUM (Optional - for reference)
# ============================================

USE_CASE_CATEGORIES = {
    'writing': {'icon': '✍️', 'name': 'Writing & Content'},
    'coding': {'icon': '💻', 'name': 'Coding & Development'},
    'research': {'icon': '🔬', 'name': 'Research & Analysis'},
    'data': {'icon': '📊', 'name': 'Data & Charts'},
    'creative': {'icon': '🎨', 'name': 'Creative Projects'},
    'business': {'icon': '💼', 'name': 'Business & Finance'},
    'learning': {'icon': '📚', 'name': 'Learning & Education'},
    'apps': {'icon': '🚀', 'name': 'Interactive Apps'}
}

# ============================================
# MIGRATION SCRIPT
# ============================================


# Database connection
DATABASE_URL = "postgresql://postgres:ciZHXAGUToWMnHlQEEogymCAZViEZnYE@hopper.proxy.rlwy.net:45046/railway"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

if __name__ == "__main__":
    print("🗑️  Dropping all tables...")
    Base.metadata.drop_all(bind=engine)
    print("✅ Tables dropped")
    
    print("📝 Creating all tables...")
    Base.metadata.create_all(bind=engine)
    print("✅ Tables created")
    
    print("\n✅ Migration complete!")
 