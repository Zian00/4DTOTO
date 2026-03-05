# 4DTOTO

Singapore 4D / TOTO lottery ticket tracker — scan tickets, check results automatically, and view statistical predictions.

---

## Quick Start (Docker)

The fastest way to run the backend + database:

```bash
# 1. Copy and fill in your Gemini API key
cp backend/.env.example backend/.env
# Edit backend/.env and set GEMINI_API_KEY=<your key>

# 2. Start backend + PostgreSQL
docker-compose up --build

# 3. API is available at http://localhost:8000
```

The backend runs database migrations automatically on startup.

---

## Manual Setup

### Backend

Requires Python 3.11+ and a running PostgreSQL instance.

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env: set DATABASE_URL and GEMINI_API_KEY

# Run database migrations
alembic upgrade head

# Start the API server (development, with auto-reload)
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

API available at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

### Frontend (Mobile + Web dev server)

Requires Node 18+ and [Expo CLI](https://docs.expo.dev/get-started/installation/).

```bash
cd frontend

# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env
# .env already points to http://localhost:8000 by default

# Start Expo dev server (scan QR with Expo Go, or press W for web)
npm start

# Web only
npm run web
```

### Frontend — Web Production Build

```bash
cd frontend
npm run build:web   # runs: expo export --platform web
# Output: frontend/dist/  — serve with any static file server
```

---

## Environment Variables

| File | Variable | Description |
|------|----------|-------------|
| `backend/.env` | `DATABASE_URL` | PostgreSQL connection string |
| `backend/.env` | `GEMINI_API_KEY` | Gemini API key for OCR ([get one free](https://aistudio.google.com/apikey)) |
| `backend/.env` | `CORS_ALLOW_ORIGINS` | Comma-separated allowed frontend origins |
| `backend/.env` | `UPLOAD_DIR` | Directory for saved ticket images (default: `./uploads`) |
| `backend/.env` | `SCHEDULER_POLL_INTERVAL` | Seconds between result polls (default: `1800`) |
| `frontend/.env` | `EXPO_PUBLIC_API_URL` | Backend API base URL (default: `http://localhost:8000`) |

See `backend/.env.example` and `frontend/.env.example` for full reference.
