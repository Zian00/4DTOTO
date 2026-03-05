# Section 6 — Troubleshooting & Known Limitations

← [Testing Guide](05-testing.md) | [Back to Manual](../../USER_MANUAL.md) | [Next: Predictions Guide →](07-predictions-guide.md)

---

## Common Problems

---

### "Cannot reach API" error on mobile

**Symptom:** The app shows "Cannot reach API (http://…). Network request failed" when uploading a ticket or loading history.

**Causes and fixes:**

| Cause | Fix |
|-------|-----|
| Backend is not running | Start the backend: `uvicorn main:app --port 8000` |
| Phone and computer not on same Wi-Fi | Connect both devices to the same network |
| `EXPO_PUBLIC_API_URL` uses `localhost` | Change to your computer's local IP (e.g., `http://192.168.1.10:8000`) |
| Firewall blocking port 8000 | Allow inbound connections on port 8000 |
| Slow OCR response (Gemini timeout) | This is intermittent; tap **Try Again** — the request has a 60-second timeout |

---

### Backend fails to start — database connection error

**Symptom:** `asyncpg.exceptions.InvalidCatalogNameError: database "fourdtoto" does not exist` or similar.

**Fix:**
```bash
psql -U postgres -c "CREATE DATABASE fourdtoto;"
alembic upgrade head
```

---

### Alembic migration fails

**Symptom:** Error like `can't locate revision` or `Target database is not up to date`.

**Fix:**
```bash
# Check current migration state
alembic current

# Apply all pending migrations
alembic upgrade head

# If still failing — reset (development only, destroys data)
alembic downgrade base
alembic upgrade head
```

---

### OCR returns empty or wrong fields

**Symptom:** After "Read Ticket", the review form is blank or has incorrect values.

**Causes and fixes:**

| Cause | Fix |
|-------|-----|
| `GEMINI_API_KEY` not set | Add the key to `backend/.env` and restart the backend |
| Blurry or poorly lit image | Retake the photo with better lighting and focus |
| Ticket partially cropped | Ensure the entire ticket is visible in frame |
| OCR model quota exceeded | The backend auto-falls back to alternative Gemini models; if all fail, fill in fields manually |
| Old ticket format | Fill in manually — very old tickets may not match current OCR prompts |

---

### "All Gemini models failed" in backend logs

**Symptom:** Backend console shows `[ocr] all models failed`; review form appears blank.

**Fix:**
1. Verify your `GEMINI_API_KEY` is correct (test at https://aistudio.google.com)
2. Check your Gemini API quota at https://aistudio.google.com/apikey
3. The app still works without OCR — fill in the review form fields manually and confirm

---

### Ticket status stuck on PENDING

**Symptom:** A ticket for a past draw date remains `PENDING` and never changes to `WON` or `LOST`.

**Causes and fixes:**

| Cause | Fix |
|-------|-----|
| Backend not running when results were published | Restart the backend — the scheduler will check pending tickets shortly |
| Draw date is in the future | Results are not yet available; the scheduler will check every 30 minutes |
| Singapore Pools website temporarily unavailable | Scraping will retry on the next scheduler cycle |
| Draw number not matching | Open the ticket detail and verify the draw number matches the Singapore Pools website |

To force an immediate check, restart the backend — the scheduler runs shortly after startup.

---

### Predictions show "0 data points"

**Symptom:** The Predict tab shows `data_points: 0` on all model cards, and predictions are placeholder values.

**Fix:** Historical draw data has not been seeded yet. Either wait for the background seeding that runs on first startup, or trigger it manually:

```bash
curl -X POST http://localhost:8000/api/results/seed
```

After ~2–5 minutes, reload the Predict tab.

---

### Docker: `docker-compose up` fails with port conflict

**Symptom:** `Error starting userland proxy: listen tcp 0.0.0.0:5432: bind: address already in use`

**Fix:** PostgreSQL is already running locally on port 5432. Either stop it or change the Docker port:

```bash
# Stop local PostgreSQL (macOS/Homebrew)
brew services stop postgresql

# Or change the host port in docker-compose.yml
ports:
  - "5433:5432"   # use 5433 on host instead
```

---

### Frontend build error — `expo export` fails

**Symptom:** `npm run build:web` throws a Metro bundler error.

**Fix:**
```bash
# Clear the Metro cache and retry
npx expo export --platform web --clear
```

---

### Image not showing in history / ticket detail

**Symptom:** Ticket cards show a grey placeholder instead of the ticket thumbnail.

**Causes:**
- The backend's `UPLOAD_DIR` path changed between runs
- The `uploads/` folder was deleted

**Fix:** Re-upload the ticket. The image file is stored permanently at `backend/uploads/` — do not delete this folder.

---

## Known Issues and Limitations

| # | Issue | Details |
|---|-------|---------|
| 1 | **No user accounts** | All tickets are stored in a single shared database. Multiple users on the same instance see each other's tickets. |
| 2 | **No authentication** | Any client that can reach the API can read or delete any ticket. Not suitable for public internet deployment without adding auth. |
| 3 | **OCR accuracy varies** | Gemini Vision generally reads modern tickets well, but older ticket formats and low-quality photos may require manual correction. |
| 4 | **Singapore Pools HTML structure dependency** | The scraper uses CSS selectors against Singapore Pools' HTML. If they change their website structure, scraping may break until the selectors are updated in `backend/services/scraper.py`. |
| 5 | **Scheduler does not persist across restarts** | APScheduler jobs are in-memory. If the backend restarts, in-flight polls are reset. Pending tickets will be re-queued on next startup. |
| 6 | **No HTTPS in development** | The dev server runs on HTTP. For production, a reverse proxy (nginx, Caddy) with TLS is required. |
| 7 | **Predictions require data** | Prediction models fall back to placeholder output until historical draw data is seeded. Allow 2–5 minutes after first start. |
| 8 | **Expo Go camera on iOS** | On some iOS versions, the camera picker returns a HEIC image. The backend accepts HEIC but Gemini OCR accuracy may be slightly lower than JPEG. |

---

[Next: Prediction Models Guide →](07-predictions-guide.md)
