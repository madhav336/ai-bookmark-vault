from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
bookmarks=[]
class Bookmark(BaseModel):
    title: str
    url: str

@app.get("/")
def root():
    return {"message":"Backend works"}

@app.get("/bookmarks")
def get_bookmarks():
    return bookmarks

@app.post("/bookmarks")
def create_bookmark(bookmark: Bookmark):
    bookmarks.append(bookmark.dict())
    return {
        "message": "Bookmark added",
        "data": bookmark
    }