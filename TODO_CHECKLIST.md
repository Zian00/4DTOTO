# 4DTOTO — Requirements Checklist by Phase

> Compared against `Final Interview Challenge.pdf`. Checked 2026-03-04.

---

## Phase 1 — Ticket Image Persistence ✅
> Images are currently discarded after OCR. This blocks the history page thumbnail requirement.

- [x] 1.1 Save uploaded image file to `uploads/` directory in the confirm endpoint
- [x] 1.2 Add `image_path` + `raw_ocr_text` columns to `Ticket` model (`backend/models.py`)
- [x] 1.3 Create Alembic migration (`b5e7f2a9c3d1_add_image_path_and_raw_ocr_to_tickets.py`)
- [x] 1.4 Return `image_url` + `raw_ocr_text` in `TicketListItem` and `TicketDetail` schemas
- [x] 1.5 Show ticket thumbnail in History list cards (`frontend/app/(tabs)/history.tsx`)
- [x] 1.6 Show full ticket image in Ticket Detail screen (`frontend/app/ticket/[id].tsx`)
- [x] 1.7 Show raw OCR text in Ticket Detail screen

---

## Phase 2 — Two Additional Prediction Models ✅
> PDF requires **3 distinct models**. Only Frequency Analysis (model 1) exists.

- [x] 2.1 Implement **Model 2: Hot/Cold Number Analysis** in `backend/services/predictions.py`
  - Hot = numbers drawn most recently; Cold = numbers not drawn for longest time
  - Produce one 4D prediction + one TOTO System 12 set
- [x] 2.2 Implement **Model 3: Recency-Weighted Frequency** in `backend/services/predictions.py`
  - Weight recent draws higher than old draws (e.g., exponential decay)
  - Produce one 4D prediction + one TOTO System 12 set
- [x] 2.3 Update `GET /api/predictions/` response to return all 3 models in an array
- [x] 2.4 Update `PredictionResponse` schema to support array of model results
- [x] 2.5 Update Predict screen to display all 3 models' results (`frontend/app/(tabs)/predict.tsx`)
- [x] 2.6 Write prediction model documentation (`docs/PREDICTION_MODELS.md`):
  - [x] 2.6a Why each model was chosen
  - [x] 2.6b Core assumptions per model
  - [x] 2.6c Methodology (how each model works)
  - [x] 2.6d Evaluation / validation approach
  - [x] 2.6e Confidence indicators or uncertainty levels
  - [x] 2.6f Disclaimer: educational purposes only, not intended for gambling

---

## Phase 3 — Historical Results Import ✅
> Currently only ~3 latest draws are seeded. PDF says "all past winning numbers".

- [x] 3.1 Add `scrape_all_historical()` + helpers to `backend/services/scraper.py` — iterates draw list, skips already-cached draws, fetches all new ones with rate-limit delay
- [x] 3.2 `POST /api/results/seed` endpoint for manual trigger + startup `asyncio.create_task` in `main.py` lifespan (auto-seeds if DB has < 50 4D / < 30 TOTO draws)
- [x] 3.3 Prediction models use all rows from DB — sufficient data once seed completes

---

## Phase 4 — Minor Frontend & API Fixes
> Small gaps that are individually quick to fix.

- [ ] 4.1 Send `X-Device-ID` header in all API calls (`frontend/services/api.ts` — call `getDeviceId()` and attach header)
- [ ] 4.2 Read `X-Device-ID` header in backend to associate tickets with device (optional but consistent)

---

## Phase 5 — Automated Tests
> `backend/tests/` is completely empty. Code quality is an evaluation criterion.

- [ ] 5.1 Set up pytest + `httpx` async test client in `backend/tests/`
- [ ] 5.2 Test ticket upload endpoint (mock OCR, check response shape)
- [ ] 5.3 Test ticket confirm endpoint (4D and TOTO paths)
- [ ] 5.4 Test 4D win/loss checker logic (`services/checker.py`)
- [ ] 5.5 Test TOTO win/loss checker logic including system bet expansion
- [ ] 5.6 Test results retrieval endpoint (cached and uncached)
- [ ] 5.7 Test all 3 prediction endpoints

---

## Phase 6 — Deployment Config
> No Dockerfile or docker-compose exists. A deployable build is a required deliverable.

- [ ] 6.1 Write `backend/Dockerfile`
- [ ] 6.2 Write `docker-compose.yml` at root (backend + PostgreSQL + optional frontend)
- [ ] 6.3 Add `.env.example` file with all required environment variables documented
- [ ] 6.4 Verify `expo export --platform web` produces a working static web build
- [ ] 6.5 Add build/run commands to README

---

## Phase 7 — README
> Current README.md is just `# 4DTOTO`. This is a required deliverable.

- [ ] 7.1 Quick-start guide (clone → install → run in <5 minutes)
- [ ] 7.2 Architecture overview (diagram or description: Frontend ↔ API ↔ DB ↔ Scraper ↔ Gemini)
- [ ] 7.3 All API endpoints documented (method, path, params, response)
- [ ] 7.4 Data source citations (Singapore Pools URLs used for scraping)
- [ ] 7.5 Ethics statement (no gambling use, predictions are educational only)
- [ ] 7.6 Tech stack list with versions

---

## Phase 8 — User Manual
> PDF says *"We will assess the User Manual heavily"*. This is the highest-weight doc deliverable.

- [ ] 8.1 Create `USER_MANUAL.md` (or PDF)
- [ ] 8.2 Prerequisites — what to install (Node, Python, PostgreSQL, Expo CLI, etc.)
- [ ] 8.3 Full installation & setup instructions (backend + frontend, step by step)
- [ ] 8.4 Environment configuration (.env variables explained)
- [ ] 8.5 How to run the Web app
- [ ] 8.6 How to run the Mobile app (Expo Go or build)
- [ ] 8.7 Step-by-step usage walkthrough with screenshots:
  - [ ] 8.7a Upload a ticket
  - [ ] 8.7b Review and confirm OCR results
  - [ ] 8.7c Check ticket history
  - [ ] 8.7d View draw results
  - [ ] 8.7e Use prediction page
- [ ] 8.8 How to test each feature manually
- [ ] 8.9 Troubleshooting common issues
- [ ] 8.10 Known issues / limitations
- [ ] 8.11 Predictive analysis usage guide (what the 3 models mean, how to read output)
- [ ] 8.12 Data privacy & security considerations

---

## Already Done (reference)
- [x] Ticket upload (Web + Mobile)
- [x] OCR extraction — number combos, draw date, game type, format variations, system bet
- [x] Data storage — all ticket fields, expanded TOTO combinations
- [x] Results retrieval — context-aware (future: poll; past: immediate)
- [x] In-app notifications — win/loss, prize tier, draw info (Web + Mobile)
- [x] History page — game type, dates, status, prize tier, sort, filter, detail view
- [x] Past Results page — 4D + TOTO, paginated, cached
- [x] Prediction page — Frequency Analysis (1 of 3 models), System 12 format, disclaimer
- [x] TOTO System bets — detect, expand C(n,6), store, compare
- [x] ~~Mock data for offline demo~~ (removed — not needed)

---

## Optional Bonus (do last if time permits)
- [ ] Export / reporting for ticket history
- [ ] Accessibility improvements
- [ ] Multi-language support
- [ ] Demo video
