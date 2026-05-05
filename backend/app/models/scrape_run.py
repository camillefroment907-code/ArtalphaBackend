import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Text, DateTime, Numeric
from sqlalchemy.dialects.postgresql import UUID
from app.models.db_models import Base


class ScrapeRun(Base):
    __tablename__ = "scrape_runs"

    id = Column(Integer, primary_key=True)
    run_id = Column(UUID(as_uuid=True), nullable=False, default=uuid.uuid4)
    source = Column(String(50), nullable=False)
    started_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)
    status = Column(String(20), nullable=False, default="RUNNING")
    n_fetched = Column(Integer, default=0)
    n_inserted = Column(Integer, default=0)
    n_skipped = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    duration_seconds = Column(Numeric(10, 2), nullable=True)
