# Deploying the Kin waitlist backend

The static site (kinapp.social) is on GitHub Pages. The backend is a Node
process, so it needs its own small server. This guide runs it at
**api.kinapp.social** behind Caddy (auto-HTTPS).

## Architecture

```
Browser ──HTTPS──> GitHub Pages   (kinapp.social)      static site
   │
   └──HTTPS POST──> Caddy          (api.kinapp.social)  TLS + reverse proxy
                      └──HTTP────>  Node server          127.0.0.1:8080
                                     └──> SQLite          /var/lib/kin/waitlist.db
```

## 1. Get a server

Any small Linux VPS works (DigitalOcean, Hetzner, Linode, Fly.io, a Raspberry
Pi with a public IP…). The smallest tier is plenty — a waitlist is tiny.
You need root/sudo and a public IP.

## 2. Point DNS at it

At your DNS provider for `kinapp.social`, add a record:

```
Type: A      Name: api      Value: <your server's public IP>
```

(Add an `AAAA` record too if the server has IPv6.) This creates
`api.kinapp.social`. Wait for it to resolve (`dig api.kinapp.social`).

## 3. Install Node 22+ and Caddy on the server

```bash
# Node 22 (nodesource)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Caddy (Debian/Ubuntu)
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update && sudo apt-get install -y caddy
```

## 4. Copy the backend to the server

From your machine (only the `backend/` folder is needed):

```bash
rsync -av --exclude node_modules --exclude data \
  backend/ youruser@api.kinapp.social:/tmp/kin-backend/
```

On the server:

```bash
sudo mkdir -p /opt/kin-site
sudo mv /tmp/kin-backend /opt/kin-site/backend
sudo useradd -r -s /usr/sbin/nologin kin          # service user
sudo mkdir -p /var/lib/kin                         # database dir
sudo chown kin:kin /var/lib/kin
```

## 5. Configure and start the service

```bash
# Generate an admin token and note it down
openssl rand -hex 32

sudo cp /opt/kin-site/backend/deploy/kin-waitlist.service /etc/systemd/system/
sudo nano /etc/systemd/system/kin-waitlist.service   # set ADMIN_TOKEN=, confirm paths
sudo systemctl daemon-reload
sudo systemctl enable --now kin-waitlist
systemctl status kin-waitlist                        # should be "active (running)"
```

## 6. Put Caddy in front (HTTPS)

```bash
sudo cp /opt/kin-site/backend/deploy/Caddyfile /etc/caddy/Caddyfile
sudo mkdir -p /var/log/caddy
sudo systemctl reload caddy
```

Caddy will fetch a TLS certificate for api.kinapp.social automatically (ports
80 and 443 must be open in the firewall / security group).

## 7. Verify

```bash
curl https://api.kinapp.social/health
# -> {"ok":true}

curl -X POST https://api.kinapp.social/waitlist \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test","contact_method":"email","email":"test@example.com"}'
# -> {"ok":true}
```

Then open https://kinapp.social/waitlist/ and submit the form for real. The
frontend already points at `https://api.kinapp.social` (in `assets/js/waitlist.js`).

## 8. Read your signups

```bash
# via the admin API (use the token from step 5)
curl -H 'Authorization: Bearer <ADMIN_TOKEN>' https://api.kinapp.social/admin/signups

# or directly on the server
sudo -u kin sqlite3 /var/lib/kin/waitlist.db \
  "SELECT created_at, name, email, phone FROM signups ORDER BY id DESC;"
```

## Updating the backend later

```bash
rsync -av --exclude node_modules --exclude data \
  backend/ youruser@api.kinapp.social:/tmp/kin-backend/
# on server:
sudo cp -r /tmp/kin-backend/* /opt/kin-site/backend/
sudo systemctl restart kin-waitlist
```

## Back up the database

`/var/lib/kin/waitlist.db` (plus its `-wal`/`-shm` sidecars) is the source of
truth. Copy it somewhere off-server regularly, e.g. a nightly cron:

```bash
sqlite3 /var/lib/kin/waitlist.db ".backup '/var/backups/kin-$(date +%F).db'"
```

## Cheaper / simpler alternatives

- **Fly.io / Render** — run `node server.js` as a container; they give you
  HTTPS and a subdomain, so you can skip Caddy. Mount a persistent volume for
  the SQLite file. Still set `ALLOW_ORIGIN=https://kinapp.social`.
- **Serverless (Vercel/Netlify functions, Cloudflare Workers)** — possible but
  changes the storage model: their filesystems are ephemeral, so SQLite-on-disk
  won't persist. You'd swap storage for a hosted DB (e.g. Turso/libSQL, D1, or
  Postgres). More moving parts than a single VPS for a waitlist.

A single small VPS with the setup above is the most direct fit for this code.
