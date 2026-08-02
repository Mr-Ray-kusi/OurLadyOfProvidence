# OLPSEC Admin Subdomain Setup

The public website and staff dashboard share one Node.js server. Routing is based on the **hostname**:

| Hostname | What visitors see |
|----------|-------------------|
| `olpsec.edu.gh` / `www.olpsec.edu.gh` / `localhost` | Public school website only |
| `admin.olpsec.edu.gh` / `admin.localhost` | Staff login + dashboard (not linked from public site) |

There is **no Admin / Login link** on the public site. Staff open the admin URL from a bookmark.

---

## 1. Run locally

```bash
cd OLP
npm install
npm start
```

- Public site: http://localhost:3080  
- Admin dashboard: http://admin.localhost:3080  

(`*.localhost` works in Chrome, Edge, and Firefox.)

### Default accounts (change immediately)

| Username | Password | Role |
|----------|----------|------|
| `admin` | `ChangeMeAdmin2026!` | Full access: forms + live site editors |
| `secretary` | `ChangeMeSecretary2026!` | Forms inbox only |

Passwords are stored hashed in the database after first run.

- **Railway Postgres (recommended):** set `DATABASE_URL` in `.env` to Railway’s **`DATABASE_PUBLIC_URL`** (for local use) or the internal `DATABASE_URL` (when the app also runs on Railway). Tables are created automatically on startup.
- **Local SQLite fallback:** if `DATABASE_URL` is missing/invalid, the app uses `server/data/olpsec.db`. To reset local users, stop the server, delete that file (and any `-wal` / `-shm`), then restart.

---

## 2. Production on Vercel (+ Railway Postgres)

The app is ready for Vercel serverless. **Database stays on Railway.** Uploads use **Vercel Blob**.

### A. Railway (already done)
Keep Postgres online. Use **`DATABASE_PUBLIC_URL`** as `DATABASE_URL` in Vercel (public proxy host).

### B. Vercel project
1. Import GitHub repo `OurLadyOfProvidence` at [vercel.com/new](https://vercel.com/new).
2. Framework preset: **Other**.
3. Add a **Blob** store: Project → Storage → Create → Blob (this sets `BLOB_READ_WRITE_TOKEN`).
4. Environment variables (Production + Preview):

   | Name | Value |
   |------|--------|
   | `DATABASE_URL` | Railway `DATABASE_PUBLIC_URL` |
   | `JWT_SECRET` | Long random secret |
   | `BLOB_READ_WRITE_TOKEN` | From Vercel Blob (auto if store linked) |

5. Deploy. Check `https://YOUR-APP.vercel.app/api/health` — should show `"database":"postgres"` and `"uploads":"vercel-blob"`.

### C. Custom domains
1. Vercel → Domains → add `olpsec.edu.gh` and `admin.olpsec.edu.gh` (same project).
2. Point DNS as Vercel shows (usually CNAME to `cname.vercel-dns.com`).
3. Admin works only on the `admin.*` hostname (same as local `admin.localhost`).

### D. Local without Blob
Leave `BLOB_READ_WRITE_TOKEN` empty; files save under `server/uploads/`.

---

## 3. Production: other hosts (Railway / VPS)

1. Deploy this project on a VPS / Node host (Railway, Render, DigitalOcean, etc.).
2. In DNS for your domain, add:

   ```
   A / CNAME   olpsec.edu.gh        → your server
   A / CNAME   admin.olpsec.edu.gh  → same server
   ```

3. Put HTTPS in front (Caddy, Nginx, or host SSL).
4. Set environment variables on the server:

   ```bash
   PORT=3080
   JWT_SECRET=a-long-random-secret
   DATABASE_URL=postgresql://...   # Railway internal or public URL
   ```

5. Run `npm start` (or use PM2 / systemd).

Optional: set `BLOB_READ_WRITE_TOKEN` on Railway too if you want Blob uploads there; otherwise local disk / a volume under `server/uploads/`.

Both hostnames hit the **same** Node process. The server detects `admin.*` and serves the dashboard; everything else gets the public site. Requests to `/admin` on the **public** hostname return 404 on purpose.

---

## 4. What each role can do

**Secretary & Admin**

- View Self Placement applications (download BECE files)
- View Contact, Alumni, Urgent Meeting, and Prayer submissions
- Mark items reviewed / archived

**Admin only**

- Edit Daily Bulletin (per weekday)
- Edit SRC prefects (names, titles, photos)
- Edit Cleanliness Champions scores
- Edit news ticker text  

Edits save to the database and appear on the public site via `/api/content`.

---

## 5. Security checklist

- Change default passwords before going live  
- Set a strong `JWT_SECRET`  
- Use HTTPS on both `olpsec.edu.gh` and `admin.olpsec.edu.gh`  
- Do not publish the admin URL on social media or the school homepage  
- Optionally restrict `admin.olpsec.edu.gh` to the school office IP in the firewall / Nginx  
- Back up the database regularly: Railway Postgres snapshots (or dump) if using Railway; otherwise copy `server/data/olpsec.db` (+ `-wal`/`-shm`) when stopped. Always back up `server/uploads/` too.  

---

## 6. Project layout

```
OLP/
  api/index.js                        → Vercel serverless entry
  vercel.json                         → route all traffic to Express
  index.html, styles.css, script.js   → public site
  admin/                              → staff UI (admin subdomain only)
  server/index.js                     → Express API + host routing (exported for Vercel)
  server/db.js                        → Postgres (Railway) or SQLite fallback (local)
  server/storage.js                   → Vercel Blob or local disk uploads
  .env                                → secrets (not committed)
  .env.example                        → variable template
  server/uploads/                     → local BECE + prefect photos (when not using Blob)
```
