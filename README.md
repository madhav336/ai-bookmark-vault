# AI Bookmark Vault

AI Bookmark Vault is a full-stack AI-powered bookmark management platform that helps users save, organize, and retrieve useful online resources intelligently.

Instead of storing plain browser bookmarks, the platform enhances saved resources using AI-generated summaries and structured organization to create a personal knowledge vault.

Live Demo: [https://ai-bookmark-vault.vercel.app](https://ai-bookmark-vault.vercel.app)

---

## Features

- Full CRUD bookmark management
- AI-generated bookmark summaries
- Persistent PostgreSQL database storage
- FastAPI backend APIs
- Responsive Next.js frontend
- Cloud database integration with Neon
- Real-time frontend to backend synchronization
- Deployable full-stack architecture

---

## Tech Stack

### Frontend
- Next.js (React framework)
- React
- TypeScript

### Backend
- FastAPI (Python)
- SQLAlchemy ORM
- Pydantic

### Database
- PostgreSQL (Neon)

### AI/ML
- OpenAI API

### Deployment
- Vercel (Frontend)
- Railway or Render (Backend)

### Language Composition
- TypeScript: 78.3%
- Python: 16.2%
- Java: 2.4%
- CSS: 2.1%
- JavaScript: 1%

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

AI Bookmark Vault solves this by combining bookmark management with AI-assisted summaries and intelligent organization.

---

## How It Works

### Bookmark Flow

1. User saves a resource URL
2. Frontend sends request to FastAPI backend
3. Backend stores bookmark in PostgreSQL
4. AI generates contextual summary via OpenAI API
5. Frontend displays organized bookmark cards
6. Real-time synchronization between frontend and backend

---

## Architecture

```
Next.js Frontend (TypeScript, React)
        |
        | HTTP/REST API
        |
FastAPI Backend (Python)
        |
        | SQLAlchemy ORM
        |
PostgreSQL Database (Neon)
        |
        | External APIs
        |
OpenAI API (Summarization)
```

---

## Local Setup

### Prerequisites
- Node.js and npm
- Python 3.8+
- PostgreSQL (or use Neon for cloud database)
- OpenAI API key

---

### 1. Clone Repository

```bash
git clone https://github.com/madhav336/ai-bookmark-vault.git
cd ai-bookmark-vault
```

---

### 2. Backend Setup

```bash
cd backend

python -m venv venv

# On Windows
venv\Scripts\activate

# On macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
```

Create `.env` file in backend directory:

```env
DATABASE_URL=your_postgresql_connection_string
OPENAI_API_KEY=your_openai_api_key
BACKEND_PORT=8000
```

Run backend:

```bash
uvicorn main:app --reload
```

Backend will run on http://localhost:8000

---

### 3. Frontend Setup

```bash
cd frontend

npm install

npm run dev
```

Frontend will run on http://localhost:3000

---

### 4. Database Setup

Create a PostgreSQL database (local or via Neon) and update the DATABASE_URL in your .env file.

Migrations will run automatically on backend startup.

---

## API Endpoints

### Bookmarks
- `GET /api/bookmarks` - Get all bookmarks
- `POST /api/bookmarks` - Create new bookmark
- `GET /api/bookmarks/{id}` - Get specific bookmark
- `PUT /api/bookmarks/{id}` - Update bookmark
- `DELETE /api/bookmarks/{id}` - Delete bookmark

### AI Summarization
- `POST /api/bookmarks/{id}/summarize` - Generate AI summary for bookmark

---

## Future Improvements

- Browser extension for quick bookmark saving
- Mobile app integration (React Native)
- Semantic AI search across bookmarks
- Auto-generated tags and categories
- User authentication and authorization
- Share-to-app workflow
- Export bookmarks to different formats
- Advanced filtering and search capabilities
- Bookmark collections and folders

---

## Deployment

### Frontend (Vercel)
1. Connect repository to Vercel
2. Set environment variables
3. Deploy automatically on push to main

### Backend (Railway/Render)
1. Connect repository to hosting platform
2. Configure environment variables
3. Set Python runtime and startup command
4. Deploy automatically on push

---

## Learning Outcomes

This project provided experience with:
- Full-stack application architecture
- REST API design and implementation
- Frontend/backend communication patterns
- PostgreSQL database design and optimization
- SQLAlchemy ORM and database migrations
- OpenAI API integration
- TypeScript for type-safe development
- Deployment workflows and CI/CD concepts
- Real-time data synchronization

---

## Repository Structure

```
ai-bookmark-vault/
├── frontend/              # Next.js React application
│   ├── app/              # Next.js app directory
│   ├── components/       # React components
│   ├── public/           # Static assets
│   └── package.json
├── backend/              # FastAPI application
│   ├── main.py           # Entry point
│   ├── models/           # Database models
│   ├── schemas/          # Pydantic schemas
│   ├── database.py       # Database configuration
│   └── requirements.txt
└── README.md
```

---

## Contributing

Contributions are welcome. Please feel free to submit pull requests or open issues for bugs and feature requests.

---

## License

This project is open source and available under the MIT License.

---

## Author

Madhav Dalvi

GitHub: [madhav336](https://github.com/madhav336)

Project Repository: [ai-bookmark-vault](https://github.com/madhav336/ai-bookmark-vault)
