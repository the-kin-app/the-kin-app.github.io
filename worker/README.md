# Kin waitlist — Cloudflare Worker

Serverless replacement for the old self-hosted Node backend. Same request
contract, so `assets/js/waitlist.js` at the repo root needs no changes.

One Worker now backs two forms, on two tables in the same D1 database:

| Form | Page | Endpoint | Table | Migration |
| --- | --- | --- | --- | --- |
| Consumer waitlist | `/waitlist/` | `POST /waitlist` | `signups` | `0001_init.sql` |
| Business interest form | `/business/` | `POST /business` | `business_signups` | `0002_business_signups.sql`, `0003_business_type_other.sql` |

- **Compute:** Cloudflare Workers (`src/index.js`)
- **Storage:** Cloudflare D1 — serverless SQLite (`migrations/`)
- **Collects:** waitlist — name + (email or phone). Business form — business
  name + location (required), plus optional contact info and questionnaire
  answers (business type, current marketing, slow hours, concept reaction,
  pricing preference, pilot interest). No IP address, no user agent, either
  way.

```
Browser ──HTTPS──> GitHub Pages   (kinapp.social)      static site
   │
   └──HTTPS POST──> Worker         (api.kinapp.social)  validation, CORS, rate limit
                      └──> D1                            signups table
```

Free-tier limits (D1: ~5 GB storage, generous daily read/write allowance;
Workers: ~100k requests/day) are far beyond what a waitlist will ever use —
check the current numbers on the Cloudflare dashboard if you want exact
figures, but there's no realistic scenario where a waitlist form hits them.

## 1. Install the CLI and log in

```bash
cd worker
npm install
npx wrangler login
```

## 2. Create the D1 database

```bash
npx wrangler d1 create kin-waitlist
```

Copy the `database_id` from the output into `wrangler.toml`
(`REPLACE_WITH_D1_DATABASE_ID`).

## 3. Run the migrations

```bash
npm run migrate:remote
```

Applies every file in `migrations/` that hasn't run yet, on the live D1
database:

- `0001_init.sql` — the `signups` table and its unique indexes
- `0002_business_signups.sql` — the `business_signups` table and its indexes
- `0003_business_type_other.sql` — adds `business_type_other`, the free-text
  write-in behind the "Something else, what?" business-type option

(`npm run migrate:local` runs the same thing against the local dev database
instead, for use with `wrangler dev`.) Safe to re-run; already-applied
migrations are skipped, so a deployment sitting on any earlier migration
catches up with this one command.

## 4. Set the admin token

```bash
openssl rand -hex 32
npx wrangler secret put ADMIN_TOKEN
# paste the generated value when prompted
```

This is a **secret**, not a `[vars]` entry — it never gets written to
`wrangler.toml` or committed.

## 5. Deploy

```bash
npm run deploy
```

## 6. Exposing the Worker — pick one

**Option A — `workers.dev` subdomain (fastest, no DNS changes).** Comment out
the `routes` block in `wrangler.toml` and deploy; Cloudflare gives you a URL
like `https://kin-waitlist.<your-subdomain>.workers.dev`. Then either:

- Set `window.KIN_API_BASE = 'https://kin-waitlist.<subdomain>.workers.dev';`
  in a small inline `<script>` before `waitlist.js` loads on
  `waitlist/index.html`, **or**
- Just change the default in `assets/js/waitlist.js` (`API_BASE` constant)
  to that URL and commit it.

**Option B — `api.kinapp.social` custom domain (what `wrangler.toml` is set
up for, and what `waitlist.js` already defaults to).** Requires
`kinapp.social`'s DNS to be managed by Cloudflare — i.e. the domain's
nameservers point at Cloudflare, not (only) your registrar's defaults. If
that's not already the case:

1. Add `kinapp.social` as a zone in the Cloudflare dashboard.
2. Update the nameservers at your domain registrar to the ones Cloudflare
   gives you.
3. Re-create the apex/`www` DNS records so GitHub Pages keeps working (A
   records to GitHub Pages' IPs, or a CNAME per GitHub's custom-domain docs) —
   don't drop these when migrating the zone.
4. Once the zone is active, the `routes` entry in `wrangler.toml` (already
   present) provisions `api.kinapp.social` pointing at this Worker on deploy.

Option A gets the form working today with zero risk to the existing site's
DNS. Option B is the nicer permanent URL, but only worth doing once you're
ready to move `kinapp.social`'s DNS management to Cloudflare.

## 7. Verify

```bash
curl https://api.kinapp.social/health          # or the workers.dev URL
# -> {"ok":true}

curl -X POST https://api.kinapp.social/waitlist \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test","contact_method":"email","email":"test@example.com"}'
# -> {"ok":true}

curl -X POST https://api.kinapp.social/business \
  -H 'Content-Type: application/json' \
  -d '{"business_name":"Test Cafe","location":"Kallio, Helsinki"}'
# -> {"ok":true}
```

Then submit the real forms at `kinapp.social/waitlist/` and
`kinapp.social/business/`.

## 8. Read signups

```bash
curl -H 'Authorization: Bearer <ADMIN_TOKEN>' https://api.kinapp.social/admin/signups
curl -H 'Authorization: Bearer <ADMIN_TOKEN>' https://api.kinapp.social/admin/business-signups
```

Or query D1 directly:

```bash
npx wrangler d1 execute kin-waitlist --remote \
  --command "SELECT created_at, name, email, phone FROM signups ORDER BY id DESC;"

npx wrangler d1 execute kin-waitlist --remote \
  --command "SELECT created_at, business_name, location, concept_interest, pilot_interest FROM business_signups ORDER BY id DESC;"
```

## Local development

```bash
npm run dev
```

Runs the Worker against a local D1 instance (`npm run migrate:local` first).
Point the frontend at it for local testing:

```html
<script>window.KIN_API_BASE = 'http://localhost:8787';</script>
```

## Updating later

Edit `src/index.js`, then `npm run deploy`. Schema changes go in a new
`migrations/000N_*.sql` file, applied with `npm run migrate:remote`.

## Security measures

Ported from the previous backend, adjusted for the Workers runtime:

- **No SQL injection** — every D1 query uses `.bind()` with parameters.
- **Per-IP rate limiting** — Cloudflare's native Rate Limiting binding
  (`RATE_LIMITER` in `wrangler.toml`), 5 requests/60s per IP.
- **Honeypot field** — hidden `website` input; a filled one is accepted and
  silently discarded.
- **Strict validation + length caps** — name ≤ 100, email ≤ 254, phone 7–15
  digits.
- **Body size cap** — 8 KiB, oversized requests get `413`.
- **CORS lock** — `ALLOW_ORIGIN` restricts POSTs to `https://kinapp.social`.
- **Security headers** — `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Cache-Control: no-store`.
- **No enumeration leak** — a duplicate email/phone returns the same success
  response as a new signup.
- **Constant-time admin token compare** — manual constant-time comparison
  (the Workers runtime has no `crypto.timingSafeEqual`).
- **Generic error messages** — internals only reach the Cloudflare log tail
  (`npm run tail`), never the response body.
- **Minimal data collection** — no IP address or user agent is stored,
  unlike the previous backend. The business form only *requires* business
  name + location; every questionnaire field is optional and validated
  against a fixed set of allowed values where applicable (business type,
  marketing channels, concept/pricing/pilot answers).
