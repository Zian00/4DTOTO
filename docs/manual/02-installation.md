# Section 2 — Installation & Configuration

← [Prerequisites](01-prerequisites.md) | [Back to Manual](../../USER_MANUAL.md) | [Next: Running →](03-running.md)

---

## 1. Clone the Repository

```bash
git clone <repository-url>
cd 4DTOTO
```

The project is structured as two independent sub-projects:

```
4DTOTO/
├── backend/        ← FastAPI Python server
├── frontend/       ← Expo React Native app (web + mobile)
├── docker-compose.yml
└── USER_MANUAL.md
```

---

## 2. Backend Setup

### 2a. Create a virtual environment (recommended)

```bash
cd backend
python -m venv .venv

# Activate — macOS / Linux
source .venv/bin/activate

# Activate — Windows
.venv\Scripts\activate
```

### 2b. Install Python dependencies

```bash
pip install -r requirements.txt
```

This installs FastAPI, SQLAlchemy, Alembic, httpx, BeautifulSoup4, APScheduler, and all other backend packages.

### 2c. Configure environment variables

```bash
cp .env.example .env
```

Open `backend/.env` in a text editor and fill in the required values:

```dotenv
# REQUIRED — PostgreSQL connection string
# Format: postgresql+asyncpg://USER:PASSWORD@HOST:PORT/DBNAME
DATABASE_URL=postgresql+asyncpg://postgres:your_password@localhost:5432/fourdtoto

# REQUIRED — Gemini API key for OCR
GEMINI_API_KEY=your_gemini_api_key_here

# Optional — all have sensible defaults
UPLOAD_DIR=./uploads
CORS_ALLOW_ORIGINS=http://localhost:3000,http://localhost:8081,http://localhost:19006
SCHEDULER_POLL_INTERVAL=1800
LOG_OCR_RAW_TEXT=false
```

**Full variable reference:**

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | **Yes** | — | PostgreSQL async connection string |
| `GEMINI_API_KEY` | **Yes** | — | Google Gemini API key for ticket OCR |
| `UPLOAD_DIR` | No | `./uploads` | Folder where ticket images are saved |
| `CORS_ALLOW_ORIGINS` | No | localhost origins | Allowed frontend origins (comma-separated) |
| `SCHEDULER_POLL_INTERVAL` | No | `1800` | How often (seconds) to poll for pending results |
| `SCRAPE_DELAY_SECONDS` | No | `2` | Delay between requests during bulk historical import |
| `LOG_OCR_RAW_TEXT` | No | `false` | Set `true` to log raw ticket text (debug only) |
| `ALLOWED_IMAGE_MIME_TYPES` | No | jpeg,png,webp,heic,heif | Accepted upload formats |

### 2d. Create the database and run migrations

Ensure PostgreSQL is running and the `fourdtoto` database exists:

```bash
# Create the database (run once)
psql -U postgres -c "CREATE DATABASE fourdtoto;"

# Apply all migrations
alembic upgrade head
```

Expected output:
```
INFO  [alembic.runtime.migration] Running upgrade -> 4224110d1703, initial schema
INFO  [alembic.runtime.migration] Running upgrade 4224110d1703 -> 7ab9d4db0f3a, ...
...
```

---

## 3. Frontend Setup

```bash
cd ../frontend    # from project root: cd frontend
npm install
```

### 3a. Configure environment variables

```bash
cp .env.example .env
```

The default `.env` is ready for local development:

```dotenv
# URL of the backend API
EXPO_PUBLIC_API_URL=http://localhost:8000
```

> **Mobile users:** If testing on a physical device with Expo Go, replace `localhost` with your computer's local network IP (e.g., `http://192.168.1.10:8000`). The app auto-detects this for the Expo dev server, but it's good practice to set it explicitly.

---

## 4. Docker Setup (alternative to steps 2–3 backend)

If you installed Docker, you can skip manual Python/PostgreSQL setup for the backend:

```bash
# From project root
cp backend/.env.example backend/.env
# Set GEMINI_API_KEY in backend/.env

docker-compose up --build
```

Docker will:
1. Pull PostgreSQL 16
2. Build the Python backend image
3. Run `alembic upgrade head` automatically
4. Start the API on port 8000

The frontend still runs separately (see Section 3):
```bash
cd frontend && npm install && npx expo start
```

---

[Next: Running the Application →](03-running.md)
