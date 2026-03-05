# 4DTOTO

Singapore 4D / TOTO lottery ticket tracker — scan tickets with your camera, check results automatically, and explore statistical number predictions.

> **Ethics notice:** This application is for personal record-keeping and educational exploration only. Predictions are statistical models, not gambling advice. See the [Ethics Statement](#ethics-statement) below.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Manual Setup](#manual-setup)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [API Reference](#api-reference)
- [Data Sources](#data-sources)
- [Environment Variables](#environment-variables)
- [Ethics Statement](#ethics-statement)

---

## Quick Start

Requires Docker and Docker Compose.

```bash
# 1. Clone
git clone <repo-url>
cd 4DTOTO

# 2. Configure backend environment
cp backend/.env.example backend/.env
# Open backend/.env and set:
#   GEMINI_API_KEY=<your key from https://aistudio.google.com/apikey>

# 3. Start backend + database
docker-compose up --build

# 4. Open the web app
cd frontend
npm install
cp .env.example .env
npm run web          # opens http://localhost:8081
```

The backend auto-runs database migrations and begins seeding historical draw data on first start.
API interactive docs: **http://localhost:8000/docs**

---

## Manual Setup

### Backend

Requires **Python 3.11+** and a running **PostgreSQL** instance.

```bash
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Set DATABASE_URL and GEMINI_API_KEY in .env

# Apply database migrations
alembic upgrade head

# Start development server (auto-reload)
# Runs: python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
npm run dev
```

### Frontend — Mobile / Web dev server

Requires **Node 18+** and the [Expo CLI](https://docs.expo.dev/get-started/installation/).

```bash
cd frontend

npm install
cp .env.example .env          # already points to http://localhost:8000

npx expo start                # Expo dev server — scan QR with Expo Go (mobile)
                              # or press W to open in browser
npx expo start --web          # Web only
```

### Frontend — Web Production Build

```bash
cd frontend
npm run build:web             # expo export --platform web
# Static output → frontend/dist/  (serve with any static file server)
```

---

## Architecture

```
┌─────────────────────────────────────────┐
│   Frontend  (Expo / React Native)       │
│   iOS  ·  Android  ·  Web (SPA)         │
└────────────────────┬────────────────────┘
                     │ REST / JSON (HTTP)
                     ▼
┌─────────────────────────────────────────┐
│   Backend  (FastAPI · Python 3.11)      │
│                                         │
│  /api/tickets      upload, confirm,     │
│                    list, detail         │
│  /api/results      cached draw results  │
│  /api/predictions  3 statistical models │
│  /api/notifications win/loss alerts     │
│                                         │
│  APScheduler ──► polls every 30 min     │
│                  for pending results    │
└──────┬──────────────┬───────────────────┘
       │              │
       ▼              ▼
┌────────────┐  ┌──────────────────────────┐
│ PostgreSQL │  │     External Services    │
│            │  ├──────────────────────────┤
│  tickets   │  │  Gemini Vision API       │
│  results   │  │  (OCR — ticket images)   │
│  notifs    │  ├──────────────────────────┤
└────────────┘  │  Singapore Pools website │
                │  (httpx + BeautifulSoup) │
                └──────────────────────────┘
```

**Data flow — ticket upload:**
1. User photographs a ticket → Expo sends image to `/api/tickets/upload`
2. Backend calls Gemini Vision API → extracts game type, numbers, draw date
3. User reviews OCR output, edits if needed → confirms via `/api/tickets/confirm`
4. Ticket saved to PostgreSQL; APScheduler polls Singapore Pools for results
5. Win/loss notification created; History screen shows updated status

---

## Tech Stack

### Backend
| Component | Version |
|-----------|---------|
| Python | 3.11+ |
| FastAPI | 0.115 |
| SQLAlchemy (async) | 2.0 |
| PostgreSQL | 15+ |
| Alembic | 1.14 |
| APScheduler | 3.10 |
| httpx | 0.28 |
| BeautifulSoup4 | 4.12 |
| Gemini Vision API | gemini-2.5-flash (with fallback to gemini-2.5-flash-lite, gemini-3-flash-preview) |

### Frontend
| Component | Version |
|-----------|---------|
| React Native | 0.81 |
| Expo SDK | 54 |
| Expo Router | 6 |
| TypeScript | 5.3 |
| React | 19.1 |

### Infrastructure
| Component | Notes |
|-----------|-------|
| Docker / Docker Compose | Backend + PostgreSQL containerised |
| Static hosting | `frontend/dist/` from `expo export --platform web` |

---

## API Reference

Base URL: `http://localhost:8000`
Interactive docs (Swagger UI): `http://localhost:8000/docs`

### Tickets

#### `POST /api/tickets/upload`
Upload a ticket image for OCR preview. Returns extracted fields for user review before saving.

| | |
|---|---|
| **Body** | `multipart/form-data` — `file` (image/jpeg, png, webp, heic) |
| **Response 200** | `TicketPreviewResponse` |

```json
{
  "game_type": "TOTO",
  "draw_date": "27/02/2015",
  "draw_date_options": ["27/02/2015"],
  "draw_number": "3014",
  "draw_number_options": ["3014"],
  "purchase_datetime": "16/02/2015 08:40 AM",
  "bet_type": "ORDINARY",
  "numbers": [["02","03","07","14","20","21"]],
  "big_amount": null,
  "small_amount": null,
  "total_price": "2.00",
  "raw_ocr_text": "TOTO ORDINARY ..."
}
```

---

#### `POST /api/tickets/confirm`
Save a reviewed ticket to the database. Also stores the image and kicks off result checking.

| | |
|---|---|
| **Body** | `multipart/form-data` |
| **Fields** | `file` (image), `game_type`, `draw_dates_json` (JSON array), `numbers_json` (JSON array of arrays), `bet_type`, `draw_numbers_json`?, `purchase_datetime`?, `big_amount`?, `small_amount`?, `raw_ocr_text`? |
| **Response 200** | `TicketConfirmBatchResponse` |

```json
{
  "purchase_group_id": "uuid",
  "created_count": 1,
  "ticket_ids": ["uuid"],
  "pending_count": 1,
  "won_count": 0,
  "lost_count": 0,
  "message": "1 ticket(s) saved."
}
```

---

#### `GET /api/tickets`
List all saved tickets.

| | |
|---|---|
| **Query** | `sort` — `newest` (default) or `winning` |
| **Query** | `filter` — `4D`, `TOTO`, `system`, or `winning` |
| **Response 200** | `TicketListItem[]` |

---

#### `GET /api/tickets/{id}`
Get full ticket detail including expanded TOTO combinations and notifications.

| | |
|---|---|
| **Response 200** | `TicketDetail` |
| **Response 404** | Ticket not found |

---

#### `DELETE /api/tickets/{id}`
Delete a ticket and its image (if no other tickets share the image).

| | |
|---|---|
| **Response 204** | No content |

---

### Results

#### `GET /api/results`
List cached draw results, paginated.

| | |
|---|---|
| **Query** | `game_type` — `4D` or `TOTO` (omit for both) |
| **Query** | `page` — page number (default: 1) |
| **Query** | `limit` — results per page (default: 20) |
| **Response 200** | `PaginatedResults` (`items`, `total`, `page`, `limit`) |

---

#### `GET /api/results/{game_type}/{draw_date}`
Get (or scrape) a specific draw result.

| | |
|---|---|
| **Path** | `game_type` — `4D` or `TOTO` |
| **Path** | `draw_date` — `YYYY-MM-DD` |
| **Response 200** | `DrawResultResponse` |
| **Response 404** | Draw not found |

---

#### `POST /api/results/seed`
Trigger a background import of all historical draw results from Singapore Pools. Already-cached draws are skipped. Returns immediately.

| | |
|---|---|
| **Response 200** | `{ "message": "Historical seed started in background" }` |

---

### Predictions

#### `GET /api/predictions`
Returns number predictions from all three statistical models.

| | |
|---|---|
| **Response 200** | `PredictionResponse[]` (3 items) |

```json
[
  {
    "model": "Frequency Analysis",
    "description": "...",
    "four_d_prediction": "3847",
    "toto_prediction": {
      "primary": [3, 7, 14, 21, 34, 45],
      "supplementary": [2, 9, 18, 27, 38, 49],
      "format": "System 12"
    },
    "data_points": 1820,
    "disclaimer": "Statistical model only. Not gambling advice."
  }
]
```

Models returned (in order):
1. **Frequency Analysis** — picks the most historically drawn numbers
2. **Hot/Cold Analysis** — balances recently active (hot) and long-absent (cold) numbers
3. **Recency-Weighted Frequency** — weights recent draws more heavily than older draws

See [`docs/PREDICTION_MODELS.md`](docs/PREDICTION_MODELS.md) for full methodology.

---

### Notifications

#### `GET /api/notifications`
List the 50 most recent win/loss notifications across all tickets.

| | |
|---|---|
| **Response 200** | `NotificationListItem[]` |

---

#### `PATCH /api/notifications/{id}/read`
Mark a notification as read.

| | |
|---|---|
| **Response 200** | `NotificationListItem` |
| **Response 404** | Notification not found |

---

### Health

#### `GET /health`
```json
{ "status": "ok" }
```

---

## Data Sources

Draw results are scraped from Singapore Pools' publicly accessible HTML data files using `httpx` + `BeautifulSoup4`. No unofficial API or browser automation is used.

| Resource | URL |
|----------|-----|
| 4D — latest draws | `https://www.singaporepools.com.sg/DataFileArchive/Lottery/Output/fourd_result_top_draws_en.html` |
| 4D — draw list | `https://www.singaporepools.com.sg/DataFileArchive/Lottery/Output/fourd_result_draw_list_en.html` |
| TOTO — latest draws | `https://www.singaporepools.com.sg/DataFileArchive/Lottery/Output/toto_result_top_draws_en.html` |
| TOTO — draw list | `https://www.singaporepools.com.sg/DataFileArchive/Lottery/Output/toto_result_draw_list_en.html` |
| Historical draw (any) | Above draw-list URLs — each `<option>` element carries a `querystring` attribute used to fetch that draw's result fragment |

All data © Singapore Pools (Private) Limited. Scraped solely for personal result-checking purposes.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string, e.g. `postgresql+asyncpg://user:pass@localhost:5432/fourdtoto` |
| `GEMINI_API_KEY` | Yes | — | Gemini API key for OCR. [Get one free](https://aistudio.google.com/apikey) |
| `UPLOAD_DIR` | No | `./uploads` | Directory for saved ticket images |
| `CORS_ALLOW_ORIGINS` | No | localhost origins | Comma-separated allowed frontend origins |
| `SCHEDULER_POLL_INTERVAL` | No | `1800` | Seconds between result polls for pending tickets |
| `SCRAPE_DELAY_SECONDS` | No | `2` | Delay between requests during historical bulk import |
| `LOG_OCR_RAW_TEXT` | No | `false` | Log raw ticket text to console (may contain personal data) |
| `ALLOWED_IMAGE_MIME_TYPES` | No | jpeg,png,webp,heic,heif | Accepted image formats |

### Frontend (`frontend/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `EXPO_PUBLIC_API_URL` | No | `http://localhost:8000` | Backend API base URL |

---

## Ethics Statement

**This application is for personal use and educational purposes only.**

- **No gambling advice:** The prediction models (Frequency Analysis, Hot/Cold Analysis, Recency-Weighted Frequency) are statistical summaries of historical data. They have no predictive power over random draws and must not be interpreted as gambling advice.
- **No affiliation:** This project is not affiliated with, endorsed by, or connected to Singapore Pools (Private) Limited in any way.
- **Data use:** Singapore Pools draw results are scraped solely to enable users to check their own purchased tickets. Results are cached locally and not redistributed.
- **No encouragement of gambling:** The application does not encourage participation in gambling. Users are responsible for complying with all applicable laws regarding lottery participation in their jurisdiction.

See also [`docs/PRIVACY_SECURITY.md`](docs/PRIVACY_SECURITY.md) for data privacy and security details.
