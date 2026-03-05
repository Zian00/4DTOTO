# Section 8 — Privacy & Security

← [Prediction Models Guide](07-predictions-guide.md) | [Back to Manual](../../USER_MANUAL.md)

---

## What Data Does 4DTOTO Collect?

4DTOTO stores only the data necessary to provide its core feature — tracking your lottery tickets and checking their results.

| Data | Where stored | Why |
|------|-------------|-----|
| Ticket images | `backend/uploads/` (local filesystem) | Displayed in History and Ticket Detail screens |
| OCR extracted text | PostgreSQL (`raw_ocr_text` column) | Reference for reviewing extraction accuracy |
| Ticket fields | PostgreSQL | Numbers, draw date, bet type, game type, purchase time |
| Draw results | PostgreSQL | Cached from Singapore Pools to enable result checking |
| Win/loss notifications | PostgreSQL | In-app alerts for ticket outcomes |
| Nickname | Device local storage only | Personalises the greeting on the Upload screen — never sent to the server |

**No personal identity data is collected.** There are no user accounts, passwords, or email addresses.

---

## Third-Party Services

### Google Gemini API (OCR)

When you upload a ticket, the image is sent to **Google's Gemini Vision API** for text extraction. This means:

- Your ticket image leaves your device and local network
- Google processes the image according to the [Google AI Terms of Service](https://ai.google.dev/terms)
- The extracted text is returned and stored locally on your server

> **What to consider:** Lottery tickets may show your purchase location, transaction timestamp, and the numbers you chose. Do not upload documents containing unrelated personal or confidential information.

### Singapore Pools website (scraping)

Draw results are fetched from Singapore Pools' publicly accessible HTML data files. No login or personal data is involved in this process. Results are cached locally after the first fetch.

---

## Security Controls in the Application

| Control | Details |
|---------|---------|
| **File size limit** | Uploads capped at 10 MB |
| **File type validation** | Magic-byte validation — declared MIME type must match actual file content |
| **Safe file naming** | Extension derived from validated MIME type, not from client-supplied filename |
| **CORS restriction** | Allowed origins are environment-configurable; wildcard `*` is for local dev only |
| **Security headers** | `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy` on all responses |
| **OCR text logging** | Disabled by default (`LOG_OCR_RAW_TEXT=false`) to avoid logging sensitive ticket content |
| **Image cleanup** | Ticket image deleted from disk when the last ticket referencing it is deleted |

---

## Current Limitations (for self-hosted deployments)

The following are known limitations that matter if you deploy this beyond a personal local machine:

| Limitation | Risk | Recommendation |
|-----------|------|----------------|
| No authentication | Anyone who can reach the API can read, modify, or delete all tickets | Add authentication middleware before exposing to the internet |
| No per-user data isolation | All tickets visible to all clients | Implement user accounts with row-level access control |
| HTTP only (development) | Traffic is unencrypted | Use a reverse proxy (nginx, Caddy) with a TLS certificate in production |
| No rate limiting | API is open to abuse/scraping | Add request rate limiting at the proxy or application layer |
| No encryption at rest | DB and upload files are stored unencrypted | Encrypt volumes at the infrastructure level |

**For personal local use on your own network, the application is appropriate as-is.** The limitations above become relevant only when hosting for multiple users or exposing to the internet.

---

## Your Control Over Your Data

- **Delete a ticket:** Tap the delete button on the Ticket Detail screen. The image file is removed from the server immediately.
- **Delete all data:** Stop the backend and drop the database (`dropdb fourdtoto`). Delete the `backend/uploads/` folder.
- **Disable OCR logging:** Ensure `LOG_OCR_RAW_TEXT=false` in `backend/.env` (this is the default).

---

## User-Facing Disclosure

> *"Uploaded ticket images are processed by an external OCR provider (Google Gemini) to extract ticket fields. Images are stored locally on your server and are not shared further. Predictions are for educational purposes only and are not gambling advice. Do not upload documents containing personal or confidential information unrelated to your lottery ticket."*

---

For the full technical security audit, see [`docs/PRIVACY_SECURITY.md`](../PRIVACY_SECURITY.md).

---

← [Prediction Models Guide](07-predictions-guide.md) | [Back to User Manual](../../USER_MANUAL.md)
