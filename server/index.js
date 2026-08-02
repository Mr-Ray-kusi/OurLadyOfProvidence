require("dotenv").config();

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const { initDb, readDb, writeDb, verifyPassword, hashPassword, getDbBackend } = require("./db");

function uuidv4() {
  return crypto.randomUUID();
}

const PORT = process.env.PORT || 3080;
const JWT_SECRET = process.env.JWT_SECRET || "olpsec-change-this-secret-in-production-2026";
const ROOT = path.join(__dirname, "..");
const ADMIN_DIR = path.join(ROOT, "admin");
const UPLOADS = path.join(__dirname, "uploads");
const BECE_DIR = path.join(UPLOADS, "bece");
const PREFECT_DIR = path.join(UPLOADS, "prefects");

[BECE_DIR, PREFECT_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

/* ---------- Host helpers (subdomain routing) ---------- */
function hostnameOf(req) {
  return (req.hostname || "").toLowerCase();
}

function isAdminHost(req) {
  const host = hostnameOf(req);
  // Production: admin.olpsec.edu.gh
  // Local testing: admin.localhost (Chrome/Edge/Firefox support *.localhost)
  return (
    host === "admin.olpsec.edu.gh" ||
    host.startsWith("admin.") ||
    host === "admin.localhost"
  );
}

/* Block crawling of admin */
app.use((req, res, next) => {
  if (isAdminHost(req)) {
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
  }
  next();
});

/* Uploaded files */
app.use("/uploads", express.static(UPLOADS));

/* ---------- Auth middleware ---------- */
function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Login required" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Session expired. Please log in again." });
  }
}

function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access only" });
  }
  next();
}

function staffOnly(req, res, next) {
  if (!req.user || (req.user.role !== "admin" && req.user.role !== "secretary")) {
    return res.status(403).json({ error: "Staff access only" });
  }
  next();
}

/* ---------- Multer ---------- */
const beceUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, BECE_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".pdf";
      cb(null, `${Date.now()}-${uuidv4()}${ext}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      /pdf|jpeg|jpg|png/i.test(file.mimetype) ||
      /\.(pdf|jpe?g|png)$/i.test(file.originalname);
    cb(ok ? null : new Error("Only PDF, JPG, or PNG allowed"), ok);
  }
});

const prefectUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, PREFECT_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
      cb(null, `${Date.now()}-${uuidv4()}${ext}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /jpeg|jpg|png|webp/i.test(file.mimetype) || /\.(jpe?g|png|webp)$/i.test(file.originalname);
    cb(ok ? null : new Error("Only image files allowed"), ok);
  }
});

/* ============================================================
   PUBLIC API
   ============================================================ */

app.get("/api/health", async (_req, res) => {
  res.json({ ok: true, service: "OLPSEC" });
});

app.get("/api/content", async (_req, res) => {
  const db = await readDb();
  res.json({
    bulletin: db.content.bulletin,
    prefects: db.content.prefects,
    outgoingPrefects: db.content.outgoingPrefects || [],
    cleanliness: db.content.cleanliness,
    ticker: db.content.ticker
  });
});

app.get("/api/prayers", async (_req, res) => {
  const db = await readDb();
  const list = (db.forms.prayer || [])
    .filter((p) => p.published !== false)
    .slice(-30)
    .reverse();
  res.json(list);
});

app.post("/api/forms/contact", async (req, res) => {
  const { name, role, email, message } = req.body || {};
  if (!name || !role || !email || !message || !String(email).includes("@")) {
    return res.status(400).json({ error: "Invalid contact form data" });
  }
  const db = await readDb();
  const entry = {
    id: uuidv4(),
    type: "contact",
    name: String(name).trim(),
    role: String(role).trim(),
    email: String(email).trim(),
    message: String(message).trim(),
    status: "new",
    createdAt: new Date().toISOString()
  };
  db.forms.contact.unshift(entry);
  await writeDb(db);
  res.json({ ok: true, id: entry.id });
});

app.post("/api/forms/alumni", async (req, res) => {
  const { name, year, occupation, location } = req.body || {};
  const yearNum = Number(year);
  if (!name || !occupation || !location || !yearNum || yearNum < 1989) {
    return res.status(400).json({ error: "Invalid alumni form data" });
  }
  const db = await readDb();
  const entry = {
    id: uuidv4(),
    type: "alumni",
    name: String(name).trim(),
    year: yearNum,
    occupation: String(occupation).trim(),
    location: String(location).trim(),
    status: "new",
    createdAt: new Date().toISOString()
  };
  db.forms.alumni.unshift(entry);
  await writeDb(db);
  res.json({ ok: true, id: entry.id });
});

app.post("/api/forms/urgent-meeting", async (req, res) => {
  const { parentName, childName, className, time, reason } = req.body || {};
  if (!parentName || !childName || !className || !time || !reason) {
    return res.status(400).json({ error: "Invalid urgent meeting data" });
  }
  const db = await readDb();
  const entry = {
    id: uuidv4(),
    type: "urgentMeeting",
    parentName: String(parentName).trim(),
    childName: String(childName).trim(),
    className: String(className).trim(),
    time: String(time).trim(),
    reason: String(reason).trim(),
    status: "new",
    createdAt: new Date().toISOString()
  };
  db.forms.urgentMeeting.unshift(entry);
  await writeDb(db);
  res.json({ ok: true, id: entry.id });
});

app.post("/api/forms/prayer", async (req, res) => {
  const { name, prayerType, message } = req.body || {};
  if (!message || !String(message).trim()) {
    return res.status(400).json({ error: "Message is required" });
  }
  const db = await readDb();
  const entry = {
    id: uuidv4(),
    type: "prayer",
    name: name && String(name).trim() ? String(name).trim() : "Anonymous",
    prayerType: prayerType === "Thanksgiving" ? "Thanksgiving" : "Prayer Request",
    message: String(message).trim(),
    published: true,
    status: "new",
    createdAt: new Date().toISOString()
  };
  db.forms.prayer.unshift(entry);
  await writeDb(db);
  res.json({ ok: true, id: entry.id, entry });
});

app.post("/api/forms/placement", beceUpload.single("beceResult"), async (req, res) => {
  try {
    const b = req.body || {};
    const required = [
      "fullName",
      "indexNumber",
      "gender",
      "beceYear",
      "jhs",
      "programme",
      "phone",
      "email",
      "guardian"
    ];
    for (const key of required) {
      if (!b[key] || !String(b[key]).trim()) {
        return res.status(400).json({ error: `Missing field: ${key}` });
      }
    }
    if (!String(b.email).includes("@")) {
      return res.status(400).json({ error: "Invalid email" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "BECE result file is required" });
    }

    const db = await readDb();
    const entry = {
      id: uuidv4(),
      type: "placement",
      fullName: String(b.fullName).trim(),
      indexNumber: String(b.indexNumber).trim(),
      gender: String(b.gender).trim(),
      beceYear: Number(b.beceYear),
      jhs: String(b.jhs).trim(),
      programme: String(b.programme).trim(),
      phone: String(b.phone).trim(),
      email: String(b.email).trim(),
      guardian: String(b.guardian).trim(),
      beceFile: {
        originalName: req.file.originalname,
        filename: req.file.filename,
        url: `/uploads/bece/${req.file.filename}`,
        size: req.file.size,
        mimeType: req.file.mimetype
      },
      status: "new",
      createdAt: new Date().toISOString()
    };
    db.forms.placement.unshift(entry);
    await writeDb(db);
    res.json({ ok: true, id: entry.id });
  } catch (err) {
    res.status(400).json({ error: err.message || "Upload failed" });
  }
});

/* ============================================================
   ADMIN AUTH + DASHBOARD API
   ============================================================ */

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }
  const db = await readDb();
  const user = db.users.find((u) => u.username === String(username).trim().toLowerCase());
  if (!user || !verifyPassword(password, user.salt, user.passwordHash)) {
    return res.status(401).json({ error: "Invalid username or password" });
  }
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, displayName: user.displayName },
    JWT_SECRET,
    { expiresIn: "8h" }
  );
  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      displayName: user.displayName
    }
  });
});

app.get("/api/auth/me", authRequired, staffOnly, async (req, res) => {
  res.json({ user: req.user });
});

app.put("/api/auth/credentials", authRequired, staffOnly, async (req, res) => {
  const currentPassword = String((req.body && req.body.currentPassword) || "");
  const newUsernameRaw = String((req.body && req.body.newUsername) || "").trim().toLowerCase();
  const newPassword = String((req.body && req.body.newPassword) || "");
  const confirmPassword = String((req.body && req.body.confirmPassword) || "");

  if (!currentPassword) {
    return res.status(400).json({ error: "Current password is required" });
  }
  if (!newUsernameRaw && !newPassword) {
    return res.status(400).json({ error: "Enter a new username and/or new password" });
  }
  if (newPassword && newPassword.length < 8) {
    return res.status(400).json({ error: "New password must be at least 8 characters" });
  }
  if (newPassword && newPassword !== confirmPassword) {
    return res.status(400).json({ error: "New password and confirmation do not match" });
  }
  if (newUsernameRaw && !/^[a-z0-9._-]{3,32}$/.test(newUsernameRaw)) {
    return res.status(400).json({
      error: "Username must be 3–32 characters (letters, numbers, . _ -)"
    });
  }

  const db = await readDb();
  const user = db.users.find((u) => u.id === req.user.id);
  if (!user || !verifyPassword(currentPassword, user.salt, user.passwordHash)) {
    return res.status(401).json({ error: "Current password is incorrect" });
  }

  if (newUsernameRaw && newUsernameRaw !== user.username) {
    const taken = db.users.some(
      (u) => u.id !== user.id && u.username === newUsernameRaw
    );
    if (taken) {
      return res.status(400).json({ error: "That username is already taken" });
    }
    user.username = newUsernameRaw;
  }

  if (newPassword) {
    const hashed = hashPassword(newPassword);
    user.salt = hashed.salt;
    user.passwordHash = hashed.hash;
  }

  await writeDb(db);

  const token = jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      displayName: user.displayName
    },
    JWT_SECRET,
    { expiresIn: "8h" }
  );

  res.json({
    ok: true,
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      displayName: user.displayName
    }
  });
});

app.get("/api/admin/summary", authRequired, staffOnly, async (_req, res) => {
  const db = await readDb();
  const countNew = (arr) => (arr || []).filter((x) => x.status === "new").length;
  res.json({
    totals: {
      contact: db.forms.contact.length,
      alumni: db.forms.alumni.length,
      urgentMeeting: db.forms.urgentMeeting.length,
      prayer: db.forms.prayer.length,
      placement: db.forms.placement.length
    },
    newCounts: {
      contact: countNew(db.forms.contact),
      alumni: countNew(db.forms.alumni),
      urgentMeeting: countNew(db.forms.urgentMeeting),
      prayer: countNew(db.forms.prayer),
      placement: countNew(db.forms.placement)
    }
  });
});

app.get("/api/admin/forms/:type", authRequired, staffOnly, async (req, res) => {
  const map = {
    contact: "contact",
    alumni: "alumni",
    "urgent-meeting": "urgentMeeting",
    prayer: "prayer",
    placement: "placement"
  };
  const key = map[req.params.type];
  if (!key) return res.status(404).json({ error: "Unknown form type" });
  const db = await readDb();
  res.json(db.forms[key] || []);
});

app.patch("/api/admin/forms/:type/:id", authRequired, staffOnly, async (req, res) => {
  const map = {
    contact: "contact",
    alumni: "alumni",
    "urgent-meeting": "urgentMeeting",
    prayer: "prayer",
    placement: "placement"
  };
  const key = map[req.params.type];
  if (!key) return res.status(404).json({ error: "Unknown form type" });
  const db = await readDb();
  const list = db.forms[key] || [];
  const idx = list.findIndex((x) => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Not found" });
  if (req.body.status) list[idx].status = req.body.status;
  if (typeof req.body.published === "boolean") list[idx].published = req.body.published;
  list[idx].updatedAt = new Date().toISOString();
  await writeDb(db);
  res.json(list[idx]);
});

/* Live content — Admin only */
app.put("/api/admin/content/bulletin", authRequired, adminOnly, async (req, res) => {
  const days = req.body && req.body.days;
  if (!Array.isArray(days) || days.length !== 7) {
    return res.status(400).json({ error: "Provide days array with 7 entries (0–6)" });
  }
  const db = await readDb();
  db.content.bulletin = { days };
  await writeDb(db);
  res.json({ ok: true, bulletin: db.content.bulletin });
});

app.put("/api/admin/content/prefects", authRequired, adminOnly, async (req, res) => {
  const prefects = req.body && req.body.prefects;
  if (!Array.isArray(prefects)) {
    return res.status(400).json({ error: "prefects array required" });
  }
  const db = await readDb();
  db.content.prefects = prefects.map((p) => ({
    id: p.id || uuidv4(),
    name: String(p.name || "").trim(),
    title: String(p.title || "").trim(),
    meta: String(p.meta || "").trim(),
    photoUrl: String(p.photoUrl || "").trim()
  }));
  await writeDb(db);
  res.json({ ok: true, prefects: db.content.prefects });
});

app.post("/api/admin/content/prefects/push-outgoing", authRequired, adminOnly, async (req, res) => {
  const { ids, termLabel } = req.body || {};
  const db = await readDb();
  const label =
    String(termLabel || "").trim() ||
    `Outgoing SRC · ${new Date().getFullYear()}`;
  const selected = Array.isArray(ids) && ids.length
    ? db.content.prefects.filter((p) => ids.includes(p.id))
    : db.content.prefects.slice();

  if (!selected.length) {
    return res.status(400).json({ error: "No current prefects to move" });
  }

  const movingIds = new Set(selected.map((p) => p.id));
  const archived = selected.map((p) => ({
    ...p,
    id: p.id || uuidv4(),
    termLabel: label,
    archivedAt: new Date().toISOString()
  }));

  db.content.outgoingPrefects = [...archived, ...(db.content.outgoingPrefects || [])];
  db.content.prefects = db.content.prefects.filter((p) => !movingIds.has(p.id));
  await writeDb(db);
  res.json({
    ok: true,
    prefects: db.content.prefects,
    outgoingPrefects: db.content.outgoingPrefects
  });
});

app.delete("/api/admin/content/outgoing-prefects/:id", authRequired, adminOnly, async (req, res) => {
  const db = await readDb();
  db.content.outgoingPrefects = (db.content.outgoingPrefects || []).filter(
    (p) => p.id !== req.params.id
  );
  await writeDb(db);
  res.json({ ok: true, outgoingPrefects: db.content.outgoingPrefects });
});

app.post(
  "/api/admin/content/prefects/:id/photo",
  authRequired,
  adminOnly,
  prefectUpload.single("photo"),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Photo required" });
    const db = await readDb();
    let prefect = db.content.prefects.find((p) => p.id === req.params.id);
    if (!prefect) {
      prefect = (db.content.outgoingPrefects || []).find((p) => p.id === req.params.id);
    }
    if (!prefect) return res.status(404).json({ error: "Prefect not found" });
    prefect.photoUrl = `/uploads/prefects/${req.file.filename}`;
    await writeDb(db);
    res.json({ ok: true, photoUrl: prefect.photoUrl, prefect });
  }
);

app.put("/api/admin/content/outgoing-prefects", authRequired, adminOnly, async (req, res) => {
  const list = req.body && req.body.outgoingPrefects;
  if (!Array.isArray(list)) {
    return res.status(400).json({ error: "outgoingPrefects array required" });
  }
  const db = await readDb();
  db.content.outgoingPrefects = list.map((p) => ({
    id: p.id || uuidv4(),
    name: String(p.name || "").trim(),
    title: String(p.title || "").trim(),
    meta: String(p.meta || "").trim(),
    photoUrl: String(p.photoUrl || "").trim(),
    termLabel: String(p.termLabel || "").trim(),
    archivedAt: p.archivedAt || new Date().toISOString()
  }));
  await writeDb(db);
  res.json({ ok: true, outgoingPrefects: db.content.outgoingPrefects });
});

app.put("/api/admin/content/cleanliness", authRequired, adminOnly, async (req, res) => {
  const { weekLabel, entries } = req.body || {};
  if (!Array.isArray(entries)) {
    return res.status(400).json({ error: "entries array required" });
  }
  const db = await readDb();
  db.content.cleanliness = {
    weekLabel: String(weekLabel || "").trim() || db.content.cleanliness.weekLabel,
    entries: entries
      .map((e) => ({
        id: e.id || uuidv4(),
        name: String(e.name || "").trim(),
        icon: e.icon === "chalkboard" ? "chalkboard" : "bed",
        score: Math.max(0, Math.min(100, Number(e.score) || 0))
      }))
      .sort((a, b) => b.score - a.score)
  };
  await writeDb(db);
  res.json({ ok: true, cleanliness: db.content.cleanliness });
});

app.put("/api/admin/content/ticker", authRequired, adminOnly, async (req, res) => {
  const items = req.body && req.body.items;
  if (!Array.isArray(items)) return res.status(400).json({ error: "items array required" });
  const db = await readDb();
  db.content.ticker = items.map((t) => String(t).trim()).filter(Boolean);
  await writeDb(db);
  res.json({ ok: true, ticker: db.content.ticker });
});

/* ============================================================
   STATIC HOSTING — subdomain aware
   ============================================================ */

/* Never expose admin folder on the public hostname as a linked path —
   but still block directory listing. Admin is ONLY on admin.* host. */
app.use((req, res, next) => {
  if (isAdminHost(req)) return next();
  if (req.path === "/admin" || req.path.startsWith("/admin/")) {
    return res.status(404).send("Not found");
  }
  next();
});

app.use((req, res, next) => {
  if (!isAdminHost(req)) return next();
  express.static(ADMIN_DIR, { index: "index.html" })(req, res, next);
});

app.use((req, res, next) => {
  if (isAdminHost(req)) return next();
  express.static(ROOT, {
    index: "index.html",
    setHeaders: (res, filePath) => {
      if (filePath.includes(`${path.sep}admin${path.sep}`)) {
        res.statusCode = 404;
      }
    }
  })(req, res, next);
});

/* Admin SPA fallback */
app.use((req, res, next) => {
  if (!isAdminHost(req)) return next();
  if (req.method !== "GET" || req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
    return next();
  }
  res.sendFile(path.join(ADMIN_DIR, "index.html"));
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(400).json({ error: err.message || "Request failed" });
});

initDb()
  .then((database) => {
    app.listen(PORT, () => {
      console.log("");
      console.log("OLPSEC server running");
      console.log(`  Public site : http://localhost:${PORT}`);
      console.log(`  Admin panel : http://admin.localhost:${PORT}`);
      console.log("  (Production admin subdomain: https://admin.olpsec.edu.gh)");
      console.log(`  Database    : ${database}`);
      console.log("");
      console.log("Default logins (CHANGE THESE):");
      console.log("  admin / ChangeMeAdmin2026!");
      console.log("  secretary / ChangeMeSecretary2026!");
      console.log("");
    });
  })
  .catch((err) => {
    console.error("Failed to start database:", err);
    process.exit(1);
  });
