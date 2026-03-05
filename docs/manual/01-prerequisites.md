# Section 1 — Prerequisites

← [Back to User Manual](../../USER_MANUAL.md) | [Next: Installation →](02-installation.md)

---

Before installing 4DTOTO, ensure the following tools are available on your machine.

---

## Required for Backend

### Python 3.11 or later

Download from [python.org](https://www.python.org/downloads/) or use a version manager.

Verify:
```bash
python --version   # or python3 --version
# Expected: Python 3.11.x or 3.12.x
```

### PostgreSQL 15 or later

Download from [postgresql.org](https://www.postgresql.org/download/) or use a package manager.

```bash
# macOS (Homebrew)
brew install postgresql@16 && brew services start postgresql@16

# Ubuntu / Debian
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

Verify:
```bash
psql --version
# Expected: psql (PostgreSQL) 15.x or later
```

You will need to create a database:
```sql
-- Run inside psql
CREATE DATABASE fourdtoto;
```

### Gemini API Key

The backend uses Google Gemini Vision to read ticket images via OCR.

1. Go to [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Sign in with a Google account
3. Click **Create API key**
4. Copy the key — you will add it to `backend/.env` during installation

The free tier is sufficient for normal use.

---

## Required for Frontend

### Node.js 18 or later

Download from [nodejs.org](https://nodejs.org/) or use a version manager (nvm, fnm).

Verify:
```bash
node --version    # Expected: v18.x or later
npm --version     # Expected: 9.x or later
```

### Expo Go (for mobile testing only)

Install the **Expo Go** app on your iOS or Android device:

- iOS: [App Store — Expo Go](https://apps.apple.com/app/expo-go/id982107779)
- Android: [Google Play — Expo Go](https://play.google.com/store/apps/details?id=host.exp.exponent)

> Expo Go is only needed if you want to test on a physical device. The web version runs entirely in your browser with no extra app required.

---

## Optional — Docker (simplifies backend + database setup)

If you prefer not to install Python or PostgreSQL locally, Docker handles both.

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose)

Verify:
```bash
docker --version
docker compose version
```

> With Docker, skip the Python and PostgreSQL installation steps in Section 2 — the Docker path handles them for you.

---

## Summary Checklist

| Requirement | Where to get it | Required for |
|-------------|----------------|--------------|
| Python 3.11+ | python.org | Backend (manual setup) |
| PostgreSQL 15+ | postgresql.org | Backend (manual setup) |
| Gemini API key | aistudio.google.com | OCR feature |
| Node.js 18+ | nodejs.org | Frontend (all) |
| Expo Go app | App Store / Google Play | Mobile testing only |
| Docker Desktop | docker.com | Docker setup (optional) |

---

[Next: Installation & Configuration →](02-installation.md)
