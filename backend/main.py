from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from database import engine
from models.bookmark import Bookmark
from database import Base
from sqlalchemy.orm import Session
from database import SessionLocal
from fastapi import Depends
app = FastAPI()
Base.metadata.create_all(bind=engine)
def get_db():
    db=SessionLocal()
    try:
        yield db
    finally:
        db.close()
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
    

@app.post("/bookmarks")
def create_bookmark(
    bookmark: BookmarkSchema,
    db: Session=Depends(get_db)
):
    new_bookmark=Bookmark(
        title=bookmark.title,
        url=bookmark.url
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
    