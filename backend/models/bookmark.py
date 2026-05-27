from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func

from database import Base

class Bookmark(Base):

    __tablename__ = "bookmarks"

    id = Column(Integer, primary_key=True, index=True)

    title = Column(String)

    url = Column(String)

    summary = Column(String, nullable=True)

    category = Column(String, nullable=True)

    created_at = Column(DateTime, server_default=func.now())