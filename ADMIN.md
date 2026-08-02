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

## 2. Production: point subdomain at the same app

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
   ```

5. Run `npm start` (or use PM2 / systemd).

Both hostnames hit the **same** Node process. The server detects `admin.*` and serves the dashboard; everything else gets the public site. Requests to `/admin` on the **public** hostname return 404 on purpose.

---

## 3. What each role can do

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

## 4. Security checklist

- Change default passwords before going live  
- Set a strong `JWT_SECRET`  
- Use HTTPS on both `olpsec.edu.gh` and `admin.olpsec.edu.gh`  
- Do not publish the admin URL on social media or the school homepage  
- Optionally restrict `admin.olpsec.edu.gh` to the school office IP in the firewall / Nginx  
- Back up the database regularly: Railway Postgres snapshots (or dump) if using Railway; otherwise copy `server/data/olpsec.db` (+ `-wal`/`-shm`) when stopped. Always back up `server/uploads/` too.  

---

## 5. Project layout

```
OLP/
  index.html, styles.css, script.js   → public site
  admin/                              → staff UI (admin subdomain only)
  server/index.js                     → Express API + host routing
  server/db.js                        → Postgres (Railway) or SQLite fallback
  .env                                → DATABASE_URL, JWT_SECRET, PORT
  server/data/olpsec.db               → SQLite fallback (if no Railway URL)
  server/uploads/                     → BECE + prefect photos
```
