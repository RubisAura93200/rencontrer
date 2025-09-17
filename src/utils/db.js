// src/utils/db.js
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'database.sqlite');
const db = new Database(dbPath);

// Table profiles (avec likes + nouvelles colonnes)
db.prepare(`
CREATE TABLE IF NOT EXISTS profiles (
  userId TEXT PRIMARY KEY,
  username TEXT,
  age INTEGER,
  height TEXT,             -- Taille (ex: 1m80)
  weight TEXT,             -- Poids (ex: 75kg)
  morphologie TEXT,        -- Morphologie
  ethnicite TEXT,          -- Ethnicité
  tribes TEXT,             -- Tribes (liste séparée par virgule)
  attentes TEXT,           -- Ce que l’utilisateur recherche
  meeting TEXT,            -- Lieu de rencontre
  nsfw TEXT,               -- Acceptation images NSFW en privé
  gender TEXT,             -- Identité de genre
  pronouns TEXT,           -- Pronoms
  
  genre TEXT,              -- (héritage ancien si tu veux garder)
  orientation TEXT,
  relation TEXT,
  position TEXT,
  fumeur TEXT,
  alcool TEXT,
  recherche TEXT,          -- (legacy si déjà utilisée)
  localisation TEXT,
  interets TEXT,
  bio TEXT,
  photo TEXT,
  
  likes INTEGER DEFAULT 0,
  created_at INTEGER
)
`).run();

// Table settings (clé/valeur globale pour stocker infos techniques)
db.prepare(`
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
)
`).run();

// Table actions (anti-spam sur likes, passes, reports, matchs)
db.prepare(`
CREATE TABLE IF NOT EXISTS actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId TEXT,
  targetId TEXT,
  action TEXT, -- like | pass | report | match
  created_at INTEGER
)
`).run();

// Table matches
db.prepare(`
CREATE TABLE IF NOT EXISTS matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user1 TEXT,
  user2 TEXT,
  created_at INTEGER
)
`).run();

// Table match_requests
db.prepare(`
CREATE TABLE IF NOT EXISTS match_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fromUser TEXT,
  toUser TEXT,
  created_at INTEGER
)
`).run();

// -----------------------------
// TABLE: members (ultra-complète)
// -----------------------------
db.prepare(`
CREATE TABLE IF NOT EXISTS members (
  userId TEXT PRIMARY KEY,
  username TEXT,
  global_name TEXT,
  discriminator TEXT,
  avatar TEXT,
  banner TEXT,
  accent_color TEXT,
  public_flags INTEGER,
  created_at_account INTEGER,

  locale TEXT,
  email TEXT,
  connections TEXT,

  nick TEXT,
  roles TEXT,
  joined_at INTEGER,
  left_at INTEGER,
  premium_since INTEGER,
  permissions TEXT,

  pending INTEGER,
  communication_disabled_until INTEGER,
  deaf INTEGER,
  mute INTEGER,

  voice_channel TEXT,
  voice_self_mute INTEGER,
  voice_self_deaf INTEGER,
  voice_stream INTEGER,
  voice_camera INTEGER,

  updated_at INTEGER
)
`).run();

// -----------------------------
// TABLE: members_raw
// -----------------------------
db.prepare(`
CREATE TABLE IF NOT EXISTS members_raw (
  userId TEXT PRIMARY KEY,
  raw_user TEXT,
  raw_member TEXT,
  last_fetched INTEGER
)
`).run();

// -----------------------------
// TABLE: audit_logs
// -----------------------------
db.prepare(`
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guildId TEXT,
  action_type TEXT,
  target_id TEXT,
  user_id TEXT,
  reason TEXT,
  created_at INTEGER,
  raw_entry TEXT
)
`).run();

// -----------------------------
// TABLE: oauth_tokens
// -----------------------------
db.prepare(`
CREATE TABLE IF NOT EXISTS oauth_tokens (
  userId TEXT PRIMARY KEY,
  access_token TEXT,
  refresh_token TEXT,
  scope TEXT,
  expires_at INTEGER,
  created_at INTEGER
)
`).run();

// Helpers
function getSetting(k) {
  const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(k);
  return r ? r.value : null;
}
function setSetting(k, v) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(k, String(v));
}

function pickNextProfile(excludeUserId) {
  if (excludeUserId) {
    return db
      .prepare('SELECT * FROM profiles WHERE userId != ? ORDER BY RANDOM() LIMIT 1')
      .get(excludeUserId) || null;
  }
  return db.prepare('SELECT * FROM profiles ORDER BY RANDOM() LIMIT 1').get() || null;
}

module.exports = { db, getSetting, setSetting, pickNextProfile };
