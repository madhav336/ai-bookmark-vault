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
from auth import get_current_user

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
    category: str | None = None  # Optional override; None = let AI decide

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
    user_id: str = Depends(get_current_user)
):
    return (
        db.query(Bookmark)
        .filter(Bookmark.user_id == user_id)
        .order_by(Bookmark.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@app.get("/search")
def search_bookmarks(q: str, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    results = db.query(Bookmark).filter(
        Bookmark.user_id == user_id,
        or_(
            Bookmark.title.ilike(f"%{q}%"),
            Bookmark.url.ilike(f"%{q}%"),
            Bookmark.summary.ilike(f"%{q}%"),
            Bookmark.category.ilike(f"%{q}%"),
        )
    ).all()
    return results


@app.post("/bookmarks")
def create_bookmark(bookmark: BookmarkSchema, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    ai = generate_summary(bookmark.title, bookmark.url)
    # Respect user-supplied category if it's a recognised value; else fall back to AI suggestion
    user_category = bookmark.category if bookmark.category in VALID_CATEGORIES else None
    new_bookmark = Bookmark(
        title=bookmark.title,
        url=bookmark.url,
        summary=ai["summary"],
        category=user_category or ai["category"],
        user_id=user_id
    )
    db.add(new_bookmark)
    db.commit()
    db.refresh(new_bookmark)
    return {"message": "Bookmark added", "data": new_bookmark}


@app.delete("/bookmarks/{bookmark_id}")
def delete_bookmark(bookmark_id: int, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    bookmark = db.query(Bookmark).filter(Bookmark.id == bookmark_id, Bookmark.user_id == user_id).first()
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
    user_id: str = Depends(get_current_user)
):
    bookmark = db.query(Bookmark).filter(Bookmark.id == bookmark_id, Bookmark.user_id == user_id).first()
    if not bookmark:
        raise HTTPException(status_code=404, detail="Bookmark not found")

    # Validate user-supplied category override
    user_category = updated.category if updated.category in VALID_CATEGORIES else None

    # Only regenerate AI summary and category if the URL has actually changed
    # or if the current summary is missing/unavailable.
    url_changed = bookmark.url != updated.url or not bookmark.summary or bookmark.summary == "Summary unavailable."

    bookmark.title = updated.title
    bookmark.url = updated.url

    if url_changed:
        ai = generate_summary(updated.title, updated.url)
        bookmark.summary = ai["summary"]
        # User override takes priority over AI suggestion
        bookmark.category = user_category or ai["category"]
    else:
        # URL unchanged — check what the user wants for category
        if user_category:
            # User picked a specific category
            bookmark.category = user_category
        else:
            # User explicitly selected "Auto (AI picks)" — re-run AI for category only,
            # keeping the existing summary since the URL/content hasn't changed
            ai = generate_summary(updated.title, updated.url)
            bookmark.category = ai["category"]

    db.commit()
    db.refresh(bookmark)
    return {"message": "Bookmark updated", "data": bookmark}