# AI Bookmark Vault 

AI Bookmark Vault is a full-stack AI-powered bookmark management platform that helps users save, organize, and retrieve useful online resources intelligently.

Instead of storing plain browser bookmarks, the platform enhances saved resources using AI-generated summaries and structured organization to create a personal knowledge vault.

---

##  Features

-  Full CRUD bookmark management
-  AI-generated bookmark summaries
-  Persistent PostgreSQL database storage
-  FastAPI backend APIs
-  Responsive Next.js frontend
-  Cloud database integration with Neon
-  Real-time frontend ↔ backend synchronization
-  Deployable full-stack architecture

---

##  Tech Stack

### Frontend
- Next.js
- React
- TypeScript

### Backend
- FastAPI
- SQLAlchemy
- Pydantic

### Database
- PostgreSQL (Neon)

### AI
- OpenAI API

### Deployment
- Vercel (Frontend)
- Railway / Render (Backend)

---

## Problem Statement

Modern browser bookmarks become cluttered very quickly.

Users often save:
- tutorials
- documentation
- articles
- GitHub repositories
- videos

but later struggle to:
- remember why they saved them
- retrieve them efficiently
- organize them meaningfully

AI Bookmark Vault solves this by combining bookmark management with AI-assisted summaries and organization.

---

##  How It Works

### Bookmark Flow

1. User saves a resource URL
2. Frontend sends request to FastAPI backend
3. Backend stores bookmark in PostgreSQL
4. AI generates contextual summary
5. Frontend displays organized bookmark cards

---

## Architecture

```txt
Next.js Frontend
        ↓
FastAPI Backend
        ↓
SQLAlchemy ORM
        ↓
PostgreSQL Database
        ↓
OpenAI API
```



##  Local Setup

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/ai-bookmark-vault.git
cd ai-bookmark-vault
```

---

### 2. Backend Setup

```bash
cd backend

python -m venv venv

venv\Scripts\activate

pip install -r requirements.txt
```

Create `.env`

```env
DATABASE_URL=your_postgresql_connection_string
OPENAI_API_KEY=your_openai_api_key
```

Run backend:

```bash
uvicorn main:app --reload
```

---

### 3. Frontend Setup

```bash
cd frontend

npm install

npm run dev
```

---

##  Future Improvements

- Browser extension support
- Mobile app integration
- Semantic AI search
- Auto-generated tags
- User authentication
- Share-to-app workflow

---

##  What I Learned

This project helped me learn:
- full-stack application architecture
- REST API design
- frontend/backend communication
- PostgreSQL integration
- SQLAlchemy ORM
- AI API integration
- deployment workflows

---

## Author

Madhav Dalvi
