const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");
const { DatabaseSync } = require("node:sqlite");

const DATA_DIR = path.join(__dirname, "data");
const SQLITE_PATH = path.join(DATA_DIR, "olpsec.db");
const LEGACY_JSON_PATH = path.join(DATA_DIR, "db.json");

let sqlite = null;
let pgPool = null;
let backend = "sqlite";
let ready = false;

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  try {
    const check = crypto.scryptSync(password, salt, 64).toString("hex");
    const a = Buffer.from(hash, "hex");
    const b = Buffer.from(check, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function defaultDb() {
  const adminPw = hashPassword("ChangeMeAdmin2026!");
  const secPw = hashPassword("ChangeMeSecretary2026!");

  return {
    users: [
      {
        id: "u-admin",
        username: "admin",
        displayName: "School Admin",
        role: "admin",
        salt: adminPw.salt,
        passwordHash: adminPw.hash
      },
      {
        id: "u-secretary",
        username: "secretary",
        displayName: "School Secretary",
        role: "secretary",
        salt: secPw.salt,
        passwordHash: secPw.hash
      }
    ],
    content: {
      bulletin: {
        days: [
          {
            day: 0,
            title: "Sunday — Faith & Rest",
            items: [
              { time: "6:30 AM", text: "Rising bell for boarders" },
              { time: "8:30 AM", text: "Holy Mass — School Chapel (compulsory for boarders)" },
              { time: "10:30 AM", text: "Quiet study / personal reading in dormitories" },
              { time: "12:30 PM", text: "Lunch" },
              { time: "3:00 PM", text: "Choir practice (optional)" },
              { time: "5:30 PM", text: "Rosary & evening prayers" },
              { time: "7:00 PM", text: "Lights preparation — early rest for Monday classes" }
            ]
          },
          {
            day: 1,
            title: "Monday — Full Academic Day",
            items: [
              { time: "6:45 AM", text: "Morning assembly & uniform inspection" },
              { time: "7:15 AM – 12:30 PM", text: "Core subject lessons (all forms)" },
              { time: "12:30 PM", text: "Lunch break" },
              { time: "1:30 PM – 3:30 PM", text: "Elective classes (Science / Arts / Business / Home Economics)" },
              { time: "3:45 PM", text: "Library study period for Forms 2 & 3" },
              { time: "5:00 PM", text: "Prep / supervised homework" },
              { time: "7:00 PM", text: "Evening study — examination classes priority" }
            ]
          },
          {
            day: 2,
            title: "Tuesday — Labs & Practicals",
            items: [
              { time: "6:45 AM", text: "Morning assembly & announcements" },
              { time: "7:15 AM – 12:30 PM", text: "Regular lessons" },
              { time: "1:30 PM", text: "Science practicals — Lab A (Form 3 Science)" },
              { time: "1:30 PM", text: "Home Economics practicals — Foods Lab (Forms 2 & 3)" },
              { time: "4:00 PM", text: "Cadet Band rehearsal — Parade Ground" },
              { time: "5:00 PM", text: "Prep / supervised homework" },
              { time: "7:00 PM", text: "Evening study" }
            ]
          },
          {
            day: 3,
            title: "Wednesday — Midweek Focus",
            items: [
              { time: "6:45 AM", text: "Morning assembly & house announcements" },
              { time: "7:15 AM – 12:30 PM", text: "Core & elective lessons" },
              { time: "1:30 PM – 3:00 PM", text: "Continuous Assessment tests (rotating subjects)" },
              { time: "3:15 PM", text: "Debate Club meeting — Assembly Hall" },
              { time: "4:30 PM", text: "Guidance & counselling sessions (by appointment)" },
              { time: "5:00 PM", text: "Prep / supervised homework" },
              { time: "7:00 PM", text: "Evening study" }
            ]
          },
          {
            day: 4,
            title: "Thursday — Skills & Leadership",
            items: [
              { time: "6:45 AM", text: "Morning assembly" },
              { time: "7:15 AM – 12:30 PM", text: "Regular lessons" },
              { time: "1:30 PM", text: "ICT / Computer Lab sessions (Forms 1 & 2)" },
              { time: "1:30 PM", text: "Business Accounting tutorials (Form 3 Business)" },
              { time: "4:00 PM", text: "Cadet Band rehearsal — Parade Ground" },
              { time: "5:00 PM", text: "SRC & Prefects briefing — Administration Block" },
              { time: "7:00 PM", text: "Evening study" }
            ]
          },
          {
            day: 5,
            title: "Friday — Review & Worship",
            items: [
              { time: "6:45 AM", text: "Morning assembly & week review" },
              { time: "7:15 AM – 12:00 PM", text: "Lessons & subject revision" },
              { time: "12:00 PM", text: "Early lunch" },
              { time: "1:00 PM – 2:30 PM", text: "Class tests / make-up assessments" },
              { time: "3:00 PM", text: "General cleaning — classrooms & compound" },
              { time: "4:30 PM", text: "Friday devotion / Stations of the Cross (seasonal)" },
              { time: "6:30 PM", text: "Weekend prep briefing for day students & boarders" }
            ]
          },
          {
            day: 6,
            title: "Saturday — Co-curricular & Catch-up",
            items: [
              { time: "7:00 AM", text: "Rising bell & dormitory inspection" },
              { time: "8:00 AM – 10:00 AM", text: "Extra classes for examination candidates" },
              { time: "10:30 AM", text: "Inter-house sports / athletics on the main field" },
              { time: "12:30 PM", text: "Lunch" },
              { time: "2:00 PM", text: "Club meetings (Drama, Science, Business, Home Economics)" },
              { time: "4:00 PM", text: "Free / laundry / personal time for boarders" },
              { time: "6:00 PM", text: "Evening prayers & weekend study (optional)" }
            ]
          }
        ]
      },
      prefects: [
        {
          id: "p1",
          name: "Ama Mensah",
          title: "School Prefect",
          meta: "Form 3 · St. Mary House",
          photoUrl: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=500&h=600&fit=crop&crop=faces"
        },
        {
          id: "p2",
          name: "Efua Boateng",
          title: "Dining Hall Prefect",
          meta: "Form 3 · St. Joseph House",
          photoUrl: "https://images.unsplash.com/photo-1589156280159-27698a70f29e?w=500&h=600&fit=crop&crop=faces"
        },
        {
          id: "p3",
          name: "Akosua Darko",
          title: "Compound Prefect",
          meta: "Form 2 · St. Theresa House",
          photoUrl: "https://images.unsplash.com/photo-1607746882042-944635dfe10e?w=500&h=600&fit=crop&crop=faces"
        },
        {
          id: "p4",
          name: "Adwoa Owusu",
          title: "Entertainment Prefect",
          meta: "Form 3 · St. Anne House",
          photoUrl: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=500&h=600&fit=crop&crop=faces"
        }
      ],
      outgoingPrefects: [],
      cleanliness: {
        weekLabel: "Week of 24 Feb – 1 Mar 2026",
        entries: [
          { id: "c1", name: "St. Mary Dormitory", icon: "bed", score: 98 },
          { id: "c2", name: "St. Theresa Dormitory", icon: "bed", score: 94 },
          { id: "c3", name: "Form 3 Science A", icon: "chalkboard", score: 91 },
          { id: "c4", name: "St. Joseph Dormitory", icon: "bed", score: 88 },
          { id: "c5", name: "Form 2 Arts B", icon: "chalkboard", score: 85 }
        ]
      },
      ticker: [
        "Mid-term break: Monday 10th – Friday 14th March 2026",
        "Cadet Band rehearsals every Tuesday & Thursday at 4:00 PM",
        "Congratulations to our WASSCE Top Performers — Category A excellence continues!",
        "Sunday Mass at the school chapel — All boarders to assemble by 8:30 AM",
        "Library open evenings extended until 8:00 PM during exam period",
        "Emergency parent meetings available — see Urgent Visit below"
      ]
    },
    forms: {
      contact: [],
      alumni: [],
      urgentMeeting: [],
      prayer: [],
      placement: []
    }
  };
}

function migrateDb(db) {
  if (!db.content) db.content = {};
  if (!Array.isArray(db.content.prefects)) db.content.prefects = [];
  if (!Array.isArray(db.content.outgoingPrefects)) db.content.outgoingPrefects = [];
  if (!db.content.cleanliness) {
    db.content.cleanliness = { weekLabel: "This week", entries: [] };
  }
  if (!Array.isArray(db.content.cleanliness.entries)) db.content.cleanliness.entries = [];
  if (!Array.isArray(db.content.ticker)) db.content.ticker = [];
  if (!db.content.bulletin) db.content.bulletin = { days: [] };
  if (!db.forms) db.forms = {};
  ["contact", "alumni", "urgentMeeting", "prayer", "placement"].forEach((k) => {
    if (!Array.isArray(db.forms[k])) db.forms[k] = [];
  });
  if (!Array.isArray(db.users)) db.users = [];
  return db;
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function resolveDatabaseUrl() {
  const raw = String(process.env.DATABASE_URL || "").trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (!u.hostname) return null;
    return raw;
  } catch {
    return null;
  }
}

function openSqlite() {
  if (sqlite) return sqlite;
  ensureDataDir();
  sqlite = new DatabaseSync(SQLITE_PATH);
  sqlite.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL,
      salt TEXT NOT NULL,
      password_hash TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS content (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS form_submissions (
      id TEXT PRIMARY KEY,
      form_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_forms_type_created
      ON form_submissions (form_type, created_at DESC);
  `);
  return sqlite;
}

function sqliteTableHasRows(db, table) {
  const row = db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get();
  return Number(row && row.c) > 0;
}

function loadLegacyJson() {
  if (!fs.existsSync(LEGACY_JSON_PATH)) return null;
  try {
    return migrateDb(JSON.parse(fs.readFileSync(LEGACY_JSON_PATH, "utf8")));
  } catch {
    return null;
  }
}

function persistSqlite(dbConn, state) {
  const data = migrateDb(state);
  dbConn.exec("BEGIN IMMEDIATE");
  try {
    dbConn.prepare("DELETE FROM users").run();
    const insertUser = dbConn.prepare(`
      INSERT INTO users (id, username, display_name, role, salt, password_hash)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const user of data.users) {
      insertUser.run(
        user.id,
        user.username,
        user.displayName,
        user.role,
        user.salt,
        user.passwordHash
      );
    }

    const upsertContent = dbConn.prepare(`
      INSERT INTO content (key, value_json) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json
    `);
    upsertContent.run("bulletin", JSON.stringify(data.content.bulletin));
    upsertContent.run("prefects", JSON.stringify(data.content.prefects));
    upsertContent.run("outgoingPrefects", JSON.stringify(data.content.outgoingPrefects));
    upsertContent.run("cleanliness", JSON.stringify(data.content.cleanliness));
    upsertContent.run("ticker", JSON.stringify(data.content.ticker));

    dbConn.prepare("DELETE FROM form_submissions").run();
    const insertForm = dbConn.prepare(`
      INSERT INTO form_submissions (id, form_type, status, payload_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const formTypes = ["contact", "alumni", "urgentMeeting", "prayer", "placement"];
    for (const type of formTypes) {
      for (const item of data.forms[type]) {
        insertForm.run(
          item.id,
          type,
          item.status || "new",
          JSON.stringify(item),
          item.createdAt || new Date().toISOString(),
          item.updatedAt || null
        );
      }
    }

    dbConn
      .prepare(
        `INSERT INTO meta (key, value) VALUES ('schema_version', '1')
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      )
      .run();
    dbConn
      .prepare(
        `INSERT INTO meta (key, value) VALUES ('updated_at', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      )
      .run(new Date().toISOString());

    dbConn.exec("COMMIT");
  } catch (err) {
    try {
      dbConn.exec("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw err;
  }
}

function loadSqlite(dbConn) {
  const users = dbConn
    .prepare(
      `SELECT id, username, display_name, role, salt, password_hash
       FROM users ORDER BY username`
    )
    .all()
    .map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.display_name,
      role: u.role,
      salt: u.salt,
      passwordHash: u.password_hash
    }));

  const contentRows = dbConn.prepare("SELECT key, value_json FROM content").all();
  const content = {};
  for (const row of contentRows) {
    try {
      content[row.key] =
        typeof row.value_json === "string" ? JSON.parse(row.value_json) : row.value_json;
    } catch {
      content[row.key] = null;
    }
  }

  const formRows = dbConn
    .prepare(
      `SELECT form_type, payload_json
       FROM form_submissions
       ORDER BY created_at DESC`
    )
    .all();

  const forms = {
    contact: [],
    alumni: [],
    urgentMeeting: [],
    prayer: [],
    placement: []
  };

  for (const row of formRows) {
    if (!forms[row.form_type]) forms[row.form_type] = [];
    try {
      const payload =
        typeof row.payload_json === "string"
          ? JSON.parse(row.payload_json)
          : row.payload_json;
      forms[row.form_type].push(payload);
    } catch {
      /* skip */
    }
  }

  return migrateDb({
    users,
    content: {
      bulletin: content.bulletin,
      prefects: content.prefects,
      outgoingPrefects: content.outgoingPrefects,
      cleanliness: content.cleanliness,
      ticker: content.ticker
    },
    forms
  });
}

function bootstrapSqlite(dbConn) {
  if (sqliteTableHasRows(dbConn, "users")) return;
  const legacy = loadLegacyJson();
  const seedData = migrateDb(legacy || defaultDb());
  persistSqlite(dbConn, seedData);
  if (legacy && fs.existsSync(LEGACY_JSON_PATH)) {
    const backup = path.join(
      DATA_DIR,
      `db.json.migrated-${new Date().toISOString().replace(/[:.]/g, "-")}.bak`
    );
    try {
      fs.copyFileSync(LEGACY_JSON_PATH, backup);
    } catch {
      /* ignore */
    }
  }
}

async function ensurePostgresSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL,
      salt TEXT NOT NULL,
      password_hash TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS content (
      key TEXT PRIMARY KEY,
      value_json JSONB NOT NULL
    );

    CREATE TABLE IF NOT EXISTS form_submissions (
      id TEXT PRIMARY KEY,
      form_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      payload_json JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS idx_forms_type_created
      ON form_submissions (form_type, created_at DESC);
  `);
}

async function persistPostgres(pool, state) {
  const data = migrateDb(state);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM users");
    for (const user of data.users) {
      await client.query(
        `INSERT INTO users (id, username, display_name, role, salt, password_hash)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          user.id,
          user.username,
          user.displayName,
          user.role,
          user.salt,
          user.passwordHash
        ]
      );
    }

    const contentPairs = [
      ["bulletin", data.content.bulletin],
      ["prefects", data.content.prefects],
      ["outgoingPrefects", data.content.outgoingPrefects],
      ["cleanliness", data.content.cleanliness],
      ["ticker", data.content.ticker]
    ];
    for (const [key, value] of contentPairs) {
      await client.query(
        `INSERT INTO content (key, value_json) VALUES ($1, $2::jsonb)
         ON CONFLICT (key) DO UPDATE SET value_json = EXCLUDED.value_json`,
        [key, JSON.stringify(value)]
      );
    }

    await client.query("DELETE FROM form_submissions");
    const formTypes = ["contact", "alumni", "urgentMeeting", "prayer", "placement"];
    for (const type of formTypes) {
      for (const item of data.forms[type]) {
        await client.query(
          `INSERT INTO form_submissions
             (id, form_type, status, payload_json, created_at, updated_at)
           VALUES ($1, $2, $3, $4::jsonb, $5, $6)`,
          [
            item.id,
            type,
            item.status || "new",
            JSON.stringify(item),
            item.createdAt || new Date().toISOString(),
            item.updatedAt || null
          ]
        );
      }
    }

    await client.query(
      `INSERT INTO meta (key, value) VALUES ('schema_version', '1')
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`
    );
    await client.query(
      `INSERT INTO meta (key, value) VALUES ('updated_at', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [new Date().toISOString()]
    );
    await client.query("COMMIT");
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    client.release();
  }
}

async function loadPostgres(pool) {
  const usersRes = await pool.query(
    `SELECT id, username, display_name, role, salt, password_hash
     FROM users ORDER BY username`
  );
  const users = usersRes.rows.map((u) => ({
    id: u.id,
    username: u.username,
    displayName: u.display_name,
    role: u.role,
    salt: u.salt,
    passwordHash: u.password_hash
  }));

  const contentRes = await pool.query("SELECT key, value_json FROM content");
  const content = {};
  for (const row of contentRes.rows) {
    content[row.key] = row.value_json;
  }

  const formRes = await pool.query(
    `SELECT form_type, payload_json
     FROM form_submissions
     ORDER BY created_at DESC`
  );
  const forms = {
    contact: [],
    alumni: [],
    urgentMeeting: [],
    prayer: [],
    placement: []
  };
  for (const row of formRes.rows) {
    if (!forms[row.form_type]) forms[row.form_type] = [];
    forms[row.form_type].push(row.payload_json);
  }

  return migrateDb({
    users,
    content: {
      bulletin: content.bulletin,
      prefects: content.prefects,
      outgoingPrefects: content.outgoingPrefects,
      cleanliness: content.cleanliness,
      ticker: content.ticker
    },
    forms
  });
}

async function bootstrapPostgres(pool) {
  const countRes = await pool.query("SELECT COUNT(*)::int AS c FROM users");
  if (countRes.rows[0].c > 0) return;

  let seedData = null;
  try {
    if (fs.existsSync(SQLITE_PATH)) {
      const local = openSqlite();
      bootstrapSqlite(local);
      seedData = loadSqlite(local);
    }
  } catch {
    seedData = null;
  }
  if (!seedData) {
    seedData = migrateDb(loadLegacyJson() || defaultDb());
  }
  await persistPostgres(pool, seedData);
}

async function initDb() {
  if (ready) return backend;

  const databaseUrl = resolveDatabaseUrl();
  if (databaseUrl) {
    try {
      pgPool = new Pool({
        connectionString: databaseUrl,
        ssl: databaseUrl.includes("localhost")
          ? false
          : { rejectUnauthorized: false },
        max: 5,
        connectionTimeoutMillis: 15000
      });
      await pgPool.query("SELECT 1");
      await ensurePostgresSchema(pgPool);
      await bootstrapPostgres(pgPool);
      backend = "postgres";
      ready = true;
      console.log("Database: Railway Postgres connected");
      return backend;
    } catch (err) {
      console.warn(
        "DATABASE_URL set but Postgres connection failed; falling back to SQLite."
      );
      console.warn("  Reason:", err.message);
      if (pgPool) {
        try {
          await pgPool.end();
        } catch {
          /* ignore */
        }
        pgPool = null;
      }
    }
  } else if (String(process.env.DATABASE_URL || "").trim()) {
    console.warn(
      "DATABASE_URL is set but invalid (missing host). Use Railway DATABASE_PUBLIC_URL for local development."
    );
  }

  const dbConn = openSqlite();
  bootstrapSqlite(dbConn);
  backend = "sqlite";
  ready = true;
  console.log("Database: local SQLite (" + SQLITE_PATH + ")");
  return backend;
}

async function readDb() {
  await initDb();
  if (backend === "postgres") return loadPostgres(pgPool);
  return loadSqlite(openSqlite());
}

async function writeDb(db) {
  await initDb();
  if (backend === "postgres") {
    await persistPostgres(pgPool, db);
    return;
  }
  persistSqlite(openSqlite(), db);
}

function getDbBackend() {
  return backend;
}

module.exports = {
  initDb,
  readDb,
  writeDb,
  hashPassword,
  verifyPassword,
  getDbBackend,
  SQLITE_PATH,
  DB_PATH: SQLITE_PATH
};
