# 4DTOTO — User Manual

**Version 1.0 · Singapore 4D / TOTO Lottery Ticket Tracker**

---

This manual covers everything you need to install, run, and use the 4DTOTO application. It is intended for both end-users and technical evaluators.

> **Disclaimer:** 4DTOTO is a personal tracking tool. Predictions are statistical models for educational purposes only — they are **not** gambling advice. See [Privacy & Security](docs/manual/08-privacy-security.md) for full disclosures.

---

## Sections

| # | Section | Covers |
|---|---------|--------|
| 1 | [Prerequisites](docs/manual/01-prerequisites.md) | What to install before you start |
| 2 | [Installation & Configuration](docs/manual/02-installation.md) | Clone, install dependencies, set up `.env` files |
| 3 | [Running the Application](docs/manual/03-running.md) | Web app, mobile app (Expo Go), Docker |
| 4 | [Usage Walkthrough](docs/manual/04-usage-walkthrough.md) | Step-by-step guide to every feature |
| 5 | [Manual Testing Guide](docs/manual/05-testing.md) | How to verify each feature works |
| 6 | [Troubleshooting](docs/manual/06-troubleshooting.md) | Common problems and fixes; known limitations |
| 7 | [Prediction Models Guide](docs/manual/07-predictions-guide.md) | What each model does and how to read output |
| 8 | [Privacy & Security](docs/manual/08-privacy-security.md) | Data handling, security controls, risks |

---

## Quick Reference

**Start everything with Docker (fastest):**
```bash
cp backend/.env.example backend/.env   # add your GEMINI_API_KEY
docker-compose up --build
cd frontend && npm install && npx expo start
```

**Manual start:**
```bash
# Terminal 1 — backend
cd backend && pip install -r requirements.txt
alembic upgrade head
npm run dev

# Terminal 2 — frontend
cd frontend && npm install && npx expo start
```

**Mobile (Expo Go):**
```bash
cd frontend && npx expo start   # scan QR code with Expo Go
```

---

*Full step-by-step instructions start in [Section 1 — Prerequisites](docs/manual/01-prerequisites.md).*
