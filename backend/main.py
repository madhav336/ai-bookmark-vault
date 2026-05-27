import json
import os

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_
from google import genai
from google.genai import types

from database import engine, Base, SessionLocal
from models.bookmark import Bookmark

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

app = FastAPI()
Base.metadata.create_all(bind=engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── DB dependency ────────────────────────────────────────────────────────────

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Schemas ──────────────────────────────────────────────────────────────────

class BookmarkSchema(BaseModel):
    title: str
    url: str

# Pydantic model used as the structured output schema for Gemini
class BookmarkAI(BaseModel):
    summary: str
    category: str


# ── AI helper ────────────────────────────────────────────────────────────────

VALID_CATEGORIES = [
    "Backend", "Frontend", "AI/ML", "DevOps", "Database",
    "Mobile", "Security", "Cloud", "Productivity", "Programming", "Other",
]

def generate_summary(title: str, url: str) -> dict:
    prompt = f"""
    You are generating metadata for a bookmark manager application.
    Analyze the bookmark below and return a JSON object.

    Bookmark Title: {title}
    Bookmark URL: {url}

    Return:
    - summary: A concise 2-3 sentence description of what this resource is about.
    - category: Exactly one value from this list: {", ".join(VALID_CATEGORIES)}
    """
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=BookmarkAI,
            ),
        )
        data = json.loads(response.text)
        # Validate that the returned category is one we recognise
        if data.get("category") not in VALID_CATEGORIES:
            data["category"] = "Other"
        return data
    except Exception as e:
        print("AI Summary error:", e)
        return {"summary": "Summary unavailable.", "category": "Other"}


# ── Routes ───────────────────────────────────────────────────────────────────

@app.get("/bookmarks")
def get_bookmarks(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    return (
        db.query(Bookmark)
        .order_by(Bookmark.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@app.get("/search")
def search_bookmarks(q: str, db: Session = Depends(get_db)):
    results = db.query(Bookmark).filter(
        or_(
            Bookmark.title.ilike(f"%{q}%"),
            Bookmark.url.ilike(f"%{q}%"),
            Bookmark.summary.ilike(f"%{q}%"),
            Bookmark.category.ilike(f"%{q}%"),
        )
    ).all()
    return results


@app.post("/bookmarks")
def create_bookmark(bookmark: BookmarkSchema, db: Session = Depends(get_db)):
    ai = generate_summary(bookmark.title, bookmark.url)
    new_bookmark = Bookmark(
        title=bookmark.title,
        url=bookmark.url,
        summary=ai["summary"],
        category=ai["category"],
    )
    db.add(new_bookmark)
    db.commit()
    db.refresh(new_bookmark)
    return {"message": "Bookmark added", "data": new_bookmark}


@app.delete("/bookmarks/{bookmark_id}")
def delete_bookmark(bookmark_id: int, db: Session = Depends(get_db)):
    bookmark = db.query(Bookmark).filter(Bookmark.id == bookmark_id).first()
    if not bookmark:
        raise HTTPException(status_code=404, detail="Bookmark not found")
    db.delete(bookmark)
    db.commit()
    return {"message": "Bookmark deleted"}


@app.put("/bookmarks/{bookmark_id}")
def update_bookmark(
    bookmark_id: int,
    updated: BookmarkSchema,
    db: Session = Depends(get_db),
):
    bookmark = db.query(Bookmark).filter(Bookmark.id == bookmark_id).first()
    if not bookmark:
        raise HTTPException(status_code=404, detail="Bookmark not found")
    bookmark.title = updated.title
    bookmark.url = updated.url
    # Regenerate AI summary and category with the new title/URL
    ai = generate_summary(updated.title, updated.url)
    bookmark.summary = ai["summary"]
    bookmark.category = ai["category"]
    db.commit()
    db.refresh(bookmark)
    return {"message": "Bookmark updated", "data": bookmark}