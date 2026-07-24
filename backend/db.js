'use strict';

/**
 * SQLite storage for waitlist signups, using Node's built-in node:sqlite
 * module (Node 22.5+). Zero external dependencies.
 *
 * All writes go through prepared statements with bound parameters, so user
 * input is never concatenated into SQL — SQL injection is not possible.
 */

const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'data', 'waitlist.db');

fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });

const db = new DatabaseSync(DB_FILE);

// WAL improves concurrency and durability; foreign_keys on for good hygiene.
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
  CREATE TABLE IF NOT EXISTS signups (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT NOT NULL,
    contact_method TEXT NOT NULL CHECK (contact_method IN ('email','phone')),
    email          TEXT,
    phone          TEXT,
    ip             TEXT,
    user_agent     TEXT,
    created_at     TEXT NOT NULL
  );
`);

// Case-insensitive uniqueness on email; plain uniqueness on phone.
// Partial indexes let the "other" column stay NULL without collisions.
db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_signups_email
    ON signups (email) WHERE email IS NOT NULL;
`);
db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_signups_phone
    ON signups (phone) WHERE phone IS NOT NULL;
`);

const insertStmt = db.prepare(`
  INSERT INTO signups (name, contact_method, email, phone, ip, user_agent, created_at)
  VALUES (:name, :contact_method, :email, :phone, :ip, :user_agent, :created_at)
`);

const countStmt = db.prepare('SELECT COUNT(*) AS n FROM signups');
const recentStmt = db.prepare(
  'SELECT id, name, contact_method, email, phone, created_at FROM signups ORDER BY id DESC LIMIT :limit'
);

/**
 * Insert a signup. Returns { status: 'created' } or { status: 'duplicate' }.
 * Emails are lower-cased for consistent de-duplication.
 */
function insertSignup(record) {
  const email = record.email ? record.email.toLowerCase() : null;
  try {
    insertStmt.run({
      name: record.name,
      contact_method: record.contact_method,
      email,
      phone: record.phone || null,
      ip: record.ip || null,
      user_agent: record.user_agent || null,
      created_at: record.created_at
    });
    return { status: 'created' };
  } catch (err) {
    // UNIQUE constraint → already on the list. Treat as success upstream so
    // we don't leak whether a given email/phone is already registered.
    if (String(err.message).includes('UNIQUE')) {
      return { status: 'duplicate' };
    }
    throw err;
  }
}

function count() {
  return countStmt.get().n;
}

function recent(limit = 50) {
  return recentStmt.all({ limit });
}

function close() {
  try { db.close(); } catch (_) { /* already closed */ }
}

module.exports = { insertSignup, count, recent, close, DB_FILE };
