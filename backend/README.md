# Kin waitlist backend

A zero-dependency, self-hosted Node.js handler for the waitlist form. It
receives `POST /waitlist` submissions, validates them, and stores each signup
in a **SQLite** database (`data/waitlist.db`) via Node's built-in `node:sqlite`.

## Requirements

- **Node.js 22.5+** (uses the built-in `node:sqlite` module — no `npm install` needed)

> `node:sqlite` prints an "ExperimentalWarning" on startup. It's stable enough
> for this use; silence it with `node --no-warnings server.js` if desired.

## Run

```bash
cd backend
node server.js
```

Typical production invocation:

```bash
HOST=127.0.0.1 \
PORT=8080 \
DB_FILE=/var/lib/kin/waitlist.db \
ALLOW_ORIGIN=https://kin-app.io \
TRUST_PROXY=1 \
ADMIN_TOKEN="$(openssl rand -hex 32)" \
node server.js
```

| Env var          | Default                 | Purpose                                            |
| ---------------- | ----------------------- | -------------------------------------------------- |
| `PORT`           | `8080`                  | Port to listen on                                  |
| `HOST`           | `127.0.0.1`             | Bind address (keep local; expose via proxy)        |
| `DB_FILE`        | `./data/waitlist.db`    | SQLite database path                               |
| `ALLOW_ORIGIN`   | `*`                     | CORS origin — set to your exact site origin        |
| `TRUST_PROXY`    | off                     | `1` to read client IP from `X-Forwarded-For`       |
| `RATE_MAX`       | `5`                     | Max requests per window per IP                     |
| `RATE_WINDOW_MS` | `600000` (10 min)       | Rate-limit window                                  |
| `ADMIN_TOKEN`    | disabled                | Bearer token to enable `GET /admin/signups`        |

## Endpoints

- `POST /waitlist` — `{ name, contact_method, email, phone, website }` → `201 { ok: true }`
- `GET /health` — → `200 { ok: true }`
- `GET /admin/signups` — count + latest 100 signups. Requires `Authorization: Bearer <ADMIN_TOKEN>`; returns `401` otherwise. Disabled unless `ADMIN_TOKEN` is set.

Read signups from the admin endpoint, or directly from the DB:

```bash
sqlite3 data/waitlist.db "SELECT created_at, name, email, phone FROM signups ORDER BY id DESC;"
```

## Security measures

Because this is exposed publicly, the handler includes:

- **No SQL injection** — every query uses prepared statements with bound parameters (`db.js`); user input is never concatenated into SQL. Verified: a `'); DROP TABLE …` payload is stored as a literal string.
- **Per-IP rate limiting** — sliding window (`RATE_MAX`/`RATE_WINDOW_MS`), returns `429` when exceeded. Guards against spam and brute-force.
- **Honeypot field** — a hidden `website` input; if a bot fills it, the request is silently accepted but discarded.
- **Strict validation + length caps** — name ≤ 100, email format ≤ 254, phone 7–15 digits.
- **Body size cap** — 8 KB, oversized requests get `413`.
- **CORS lock** — set `ALLOW_ORIGIN` to your site so other origins can't POST from a browser.
- **Security headers** — `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store`.
- **Anti IP-spoofing** — `X-Forwarded-For` is trusted only when `TRUST_PROXY=1` (i.e. only behind your own proxy), so clients can't forge their IP to dodge rate limits.
- **No enumeration leak** — duplicate email/phone returns success, so the endpoint can't be used to check who's already registered. A case-insensitive unique index dedupes silently.
- **Constant-time token compare** — admin token checked with `crypto.timingSafeEqual`.
- **Generic errors** — internal failures return a generic message; details only go to server logs.

### Deployment checklist

- [ ] Terminate **TLS** at a reverse proxy (nginx / Caddy); keep the Node process bound to `127.0.0.1`.
- [ ] Set `ALLOW_ORIGIN` to your exact HTTPS origin and `TRUST_PROXY=1` behind the proxy.
- [ ] Set a strong random `ADMIN_TOKEN` (`openssl rand -hex 32`).
- [ ] Run under a process manager (systemd / pm2) for restart-on-crash.
- [ ] Back up `waitlist.db` (plus `-wal`/`-shm` sidecar files) regularly.
- [ ] Ensure the `data/` directory is writable only by the service user.

## Connecting the form

The static site posts to `<API_BASE>/waitlist`. `API_BASE` defaults to
`https://api.kin-app.io` in `index.html`; override without editing code by
setting `window.KIN_API_BASE` before the page script runs. For local browser
testing:

```html
<script>window.KIN_API_BASE = 'http://localhost:8080';</script>
```

```bash
ALLOW_ORIGIN=http://localhost:8000 node server.js
```
