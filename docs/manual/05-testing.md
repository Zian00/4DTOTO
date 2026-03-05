# Section 5 — Manual Testing Guide

← [Usage Walkthrough](04-usage-walkthrough.md) | [Back to Manual](../../USER_MANUAL.md) | [Next: Troubleshooting →](06-troubleshooting.md)

---

Use this guide to verify that all features are working correctly after installation. Each test includes the expected outcome so you can confirm success.

---

## Test 1 — Backend Health

**Steps:**
1. Start the backend (`uvicorn main:app --reload --port 8000` or `docker-compose up`)
2. Open `http://localhost:8000/health` in a browser

**Expected:**
```json
{"status": "ok"}
```

---

## Test 2 — Interactive API Docs

**Steps:**
1. Open `http://localhost:8000/docs` in a browser

**Expected:** Swagger UI loads showing all available API endpoints.

---

## Test 3 — Database Connection

**Steps:**
1. Check backend startup logs for any database errors

**Expected:** No `asyncpg` connection errors. The line `Application startup complete.` appears.

---

## Test 4 — Historical Data Seed

**Steps:**
1. Open `http://localhost:8000/docs`
2. Expand `POST /api/results/seed`
3. Click **Try it out** → **Execute**
4. Wait ~2–3 minutes, then open `GET /api/results` → Execute

**Expected:** Results list returns 4D and TOTO draw results (50+ entries after seeding completes).

---

## Test 5 — Ticket Upload (OCR)

**Steps:**
1. Open the web app at `http://localhost:8081`
2. Go to the **Upload** tab
3. Click **Pick from Gallery** and select any clear photo of a Singapore Pools 4D or TOTO ticket
4. Click **Read Ticket**
5. Observe the review form

**Expected:**
- After 5–20 seconds, the review form appears with fields pre-filled
- Game type (`4D` or `TOTO`) is correctly detected
- At least the draw date and numbers are populated
- Any field that could not be read is blank (not an error)

> **If OCR fails entirely:** A fallback form appears with blank fields. This is expected behaviour when `GEMINI_API_KEY` is missing or the image is unreadable. Fill in fields manually and confirm.

---

## Test 6 — Ticket Confirm and Save

**Steps:**
1. After Test 5, review the pre-filled fields
2. Correct any mistakes
3. Click **Confirm Ticket**

**Expected:**
- Success screen: "Ticket Saved! N ticket entries created."
- Navigate to **History** tab — the new ticket appears with status `PENDING`

---

## Test 7 — History List and Filtering

**Steps:**
1. Save at least two tickets (repeat Test 5–6 with different images or manually enter details)
2. Open the **History** tab
3. Try each filter: All, 4D, TOTO, Winners
4. Try each sort: Newest, Winning first

**Expected:**
- Cards update correctly based on filter/sort selection
- Thumbnails are visible on each card (tap to see the full ticket image)

---

## Test 8 — Ticket Detail Screen

**Steps:**
1. Tap any ticket card in History

**Expected:**
- Full ticket image shown at top
- All ticket fields visible (game type, draw date, bet type, numbers, purchase date)
- Status badge shown (`PENDING`, `WON`, `LOST`, or `NO RESULT`)
- For TOTO System bets: expanded combinations section is visible

---

## Test 9 — Draw Results Page

**Steps:**
1. Open the **Results** tab

**Expected:**
- List of draw results appears (4D and TOTO, sorted newest first)
- Each card shows draw date, draw number, and winning numbers
- **4D** / **TOTO** toggle filters correctly
- **Load More** fetches older results

---

## Test 10 — Specific Draw Result Lookup

**Steps:**
1. Open `http://localhost:8000/docs`
2. Expand `GET /api/results/{game_type}/{draw_date}`
3. Enter `game_type=4D`, `draw_date=2024-01-01` (or any known 4D draw date)
4. Execute

**Expected:** Draw result returned with `winning_numbers` object showing prize tiers.

---

## Test 11 — Predictions Page

**Steps:**
1. Open the **Predict** tab

**Expected:**
- Three model cards are shown (Frequency Analysis, Hot/Cold Analysis, Recency-Weighted Frequency)
- Each card shows a 4D prediction (4 digits) and TOTO prediction (12 numbers in System 12)
- `data_points` field shows a non-zero number (confirms historical data is loaded)
- Disclaimer is prominently shown on each card

> **If `data_points` is 0:** Historical data has not loaded yet. Run Test 4 (seed) and wait for it to complete.

---

## Test 12 — Win/Loss Notification (result checking)

This test requires a ticket whose draw date has already passed.

**Steps:**
1. Upload a ticket with a past draw date (any old ticket image, or manually enter a past date in the review form)
2. Confirm the ticket
3. Wait up to 30 seconds (or open the History tab — the scheduler checks on app focus)

**Expected:**
- Ticket status changes from `PENDING` to `WON` or `LOST`
- A toast notification appears the next time History tab loads
- If the ticket won, prize tier is shown

---

## Test 13 — Image Persistence

**Steps:**
1. Upload and confirm a ticket
2. Open History → tap the ticket card
3. Check that the ticket thumbnail and full image are visible

**Expected:** Image loads from `http://localhost:8000/uploads/…`

---

## Test 14 — Delete Ticket

**Steps:**
1. Open a ticket detail screen
2. Tap the delete button (trash icon)
3. Confirm the deletion
4. Return to History

**Expected:**
- Ticket is removed from the History list
- The ticket image file is deleted from the server (if no other ticket shares it)

---

## Test 15 — Mobile (Expo Go)

**Steps:**
1. Run `npm start` in `frontend/`
2. Scan the QR code with Expo Go on your device
3. Repeat Tests 5–9 on the device

**Expected:** All features work the same as the web version. Camera access works natively.

---

[Next: Troubleshooting →](06-troubleshooting.md)
