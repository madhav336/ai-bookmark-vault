from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from database import engine
from models.bookmark import Bookmark
from database import Base
from sqlalchemy.orm import Session
from database import SessionLocal
from fastapi import Depends
import os
from google import genai
from sqlalchemy import or_
client=genai.Client(
    api_key=os.getenv("GEMINI_API_KEY")
)
app = FastAPI()
Base.metadata.create_all(bind=engine)
def get_db():
    db=SessionLocal()
    try:
        yield db
    finally:
        db.close()

def generate_summary(title, url):

    prompt = f"""
    You are generating metadata for a bookmark manager application.

    Analyze the bookmark below.

    TITLE:
    {title}

    URL:
    {url}

    IMPORTANT RULES:
    - Return ONLY plain text
    - Do NOT use markdown
    - Do NOT add explanations
    - Do NOT add extra headings
    - Follow the exact format below

    FORMAT:

    SUMMARY: <short 2-3 sentence summary>

    CATEGORY: <single broad category>

    VALID CATEGORIES:
    Backend
    Frontend
    AI/ML
    DevOps
    Database
    Mobile
    Security
    Cloud
    Productivity
    Programming
    Other
    """
    try:

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )

        return response.text

    except Exception as e:

        print("AI Summary error:", e)

        return """
        SUMMARY: Summary unavailable.

        CATEGORY: Uncategorized
        """
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class BookmarkSchema(BaseModel):
    title: str
    url: str

@app.get("/")
def root():
    return {"message":"Backend works"}

@app.get("/bookmarks")
def get_bookmarks(
    db: Session=Depends(get_db)
):
    bookmarks=db.query(Bookmark).all()
    return bookmarks
    
@app.get("/search")
def search_bookmarks(
    q: str,
    db: Session = Depends(get_db)
):

    results = db.query(Bookmark).filter(

        or_(

            Bookmark.title.ilike(f"%{q}%"),

            Bookmark.summary.ilike(f"%{q}%"),

            Bookmark.category.ilike(f"%{q}%")
        )

    ).all()

    return results 
@app.post("/bookmarks")
def create_bookmark(
    bookmark: BookmarkSchema,
    db: Session=Depends(get_db)
):
    ai_response=generate_summary(
        bookmark.title,
        bookmark.url
    )
    parts = ai_response.split("CATEGORY:")

    summary = parts[0].replace(
        "SUMMARY:",
        ""
    ).strip()

    if len(parts) > 1:

        category = parts[1].strip()

    else:

        category = "Uncategorized"
    new_bookmark=Bookmark(
        title=bookmark.title,
        url=bookmark.url,
        summary=summary,
        category=category
    )
    db.add(new_bookmark)
    db.commit()
    db.refresh(new_bookmark)
    return {
        "message": "Bookmark added",
        "data": new_bookmark
    }

@app.delete("/bookmarks/{bookmark_id}")
def delete_bookmark(
    bookmark_id: int,
    db: Session=Depends(get_db)
):
    bookmark=db.query(Bookmark).filter(
        Bookmark.id==bookmark_id
    ).first()
    if not bookmark:
        return{"message":"Bookmark not found"}
    db.delete(bookmark)
    db.commit()

    return {"message": "Bookmark deleted"}

@app.put("/bookmarks/{bookmark_id}")
def update_bookmark(
    bookmark_id: int,
    updated_bookmark: BookmarkSchema,
    db: Session=Depends(get_db)
):
    bookmark=db.query(Bookmark).filter(
        Bookmark.id==bookmark_id
    ).first()
    if not bookmark:
        return {"message":"Bookmark not found"}
    bookmark.title=updated_bookmark.title
    bookmark.url=updated_bookmark.url
    db.commit()
    db.refresh(bookmark)
    return{
        "message": "Bookmark updated",
        "data": bookmark
    }
    