'use strict';

const path = require('node:path');
const fs = require('node:fs');

// Resolve deps from the shared wf-brain node_modules
const MODULE_PATH = path.join(__dirname, '..', '..', '.claude', 'mcp-servers', 'wf-brain', 'node_modules');
if (fs.existsSync(MODULE_PATH)) {
  module.paths.unshift(MODULE_PATH);
}

const Database = require('better-sqlite3');

const CURRENT_SCHEMA_VERSION = '1';

const ALLOWED_UPDATE_FIELDS = ['content', 'category', 'tags', 'source', 'embedding'];

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const DDL = `
CREATE TABLE IF NOT EXISTS entries (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  content     TEXT    NOT NULL,
  category    TEXT    NOT NULL DEFAULT '',
  tags        TEXT    NOT NULL DEFAULT '',
  source      TEXT    NOT NULL DEFAULT '',
  embedding   BLOB,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pending (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  content     TEXT    NOT NULL,
  category    TEXT    NOT NULL DEFAULT '',
  tags        TEXT    NOT NULL DEFAULT '',
  source      TEXT    NOT NULL DEFAULT '',
  proposed_by TEXT    NOT NULL DEFAULT '',
  embedding   BLOB,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  status      TEXT    NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS schema_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if the sqlite-vec virtual table is accessible.
 * @param {import('better-sqlite3').Database} conn
 */
function hasVec(conn) {
  try {
    conn.prepare('SELECT 1 FROM entries_vec LIMIT 1').get();
    return true;
  } catch {
    return false;
  }
}

/**
 * Attempt to load sqlite-vec extension and create vector tables.
 * Gracefully skips if the extension is unavailable.
 * @param {import('better-sqlite3').Database} conn
 */
function _initVec(conn) {
  try {
    // eslint-disable-next-line
    const sqliteVec = require('sqlite-vec');
    sqliteVec.load(conn);

    conn.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS entries_vec USING vec0(
        rowid INTEGER PRIMARY KEY,
        embedding FLOAT[384]
      );
      CREATE VIRTUAL TABLE IF NOT EXISTS pending_vec USING vec0(
        rowid INTEGER PRIMARY KEY,
        embedding FLOAT[384]
      );
    `);
  } catch {
    // sqlite-vec unavailable or unsupported — vector search will be skipped
  }
}

// ---------------------------------------------------------------------------
// Migration framework
// ---------------------------------------------------------------------------

/**
 * Placeholder migration runner. Extend this when schema version increments.
 * @param {import('better-sqlite3').Database} conn
 * @param {string} fromVersion
 */
function _migrate(conn, fromVersion) {
  // Example: if (fromVersion === '1') { /* run v1 -> v2 migration */ }
  // No migrations needed yet.
  void fromVersion;
  void conn;
}

// ---------------------------------------------------------------------------
// initDb
// ---------------------------------------------------------------------------

/**
 * Open (or create) the SQLite database, apply schema, run migrations.
 * @param {string} dbPath  Absolute path to the .db file
 * @returns {import('better-sqlite3').Database}
 */
function initDb(dbPath) {
  const conn = new Database(dbPath);

  conn.pragma('journal_mode = WAL');
  conn.pragma('busy_timeout = 5000');

  // Create core tables
  conn.exec(DDL);

  // Vector tables — graceful fallback
  _initVec(conn);

  // Schema version bookkeeping
  const existing = conn
    .prepare("SELECT value FROM schema_meta WHERE key = 'schema_version'")
    .get();

  if (!existing) {
    conn
      .prepare("INSERT INTO schema_meta (key, value) VALUES ('schema_version', ?)")
      .run(CURRENT_SCHEMA_VERSION);
  } else if (existing.value !== CURRENT_SCHEMA_VERSION) {
    _migrate(conn, existing.value);
    conn
      .prepare("UPDATE schema_meta SET value = ? WHERE key = 'schema_version'")
      .run(CURRENT_SCHEMA_VERSION);
  }

  return conn;
}

// ---------------------------------------------------------------------------
// entries CRUD
// ---------------------------------------------------------------------------

/**
 * @param {import('better-sqlite3').Database} conn
 * @param {{ content: string, category?: string, tags?: string, source?: string, embedding?: Buffer|null }} fields
 * @returns {number} inserted row id
 */
function insertEntry(conn, { content, category = '', tags = '', source = '', embedding = null }) {
  const result = conn
    .prepare(`
      INSERT INTO entries (content, category, tags, source, embedding)
      VALUES (?, ?, ?, ?, ?)
    `)
    .run(content, category, tags, source, embedding);

  const id = result.lastInsertRowid;

  if (embedding && hasVec(conn)) {
    try {
      conn
        .prepare('INSERT INTO entries_vec (rowid, embedding) VALUES (?, ?)')
        .run(id, embedding);
    } catch {
      // vec insert failed — non-fatal
    }
  }

  return Number(id);
}

/**
 * @param {import('better-sqlite3').Database} conn
 * @param {number} id
 */
function getEntry(conn, id) {
  return conn.prepare('SELECT * FROM entries WHERE id = ?').get(id);
}

/**
 * @param {import('better-sqlite3').Database} conn
 * @param {number} id
 * @param {Partial<{content: string, category: string, tags: string, source: string, embedding: Buffer}>} fields
 * @returns {boolean}
 */
function updateEntry(conn, id, fields) {
  const safeFields = Object.fromEntries(
    Object.entries(fields).filter(([k]) => ALLOWED_UPDATE_FIELDS.includes(k))
  );

  if (Object.keys(safeFields).length === 0) return false;

  const setClauses = Object.keys(safeFields)
    .map((k) => `${k} = ?`)
    .join(', ');
  const values = Object.values(safeFields);

  const result = conn
    .prepare(`UPDATE entries SET ${setClauses}, updated_at = datetime('now') WHERE id = ?`)
    .run(...values, id);

  return result.changes > 0;
}

/**
 * @param {import('better-sqlite3').Database} conn
 * @param {number} id
 */
function deleteEntry(conn, id) {
  conn.prepare('DELETE FROM entries WHERE id = ?').run(id);

  if (hasVec(conn)) {
    try {
      conn.prepare('DELETE FROM entries_vec WHERE rowid = ?').run(id);
    } catch {
      // non-fatal
    }
  }
}

/**
 * @param {import('better-sqlite3').Database} conn
 * @param {{ category?: string, limit?: number, recent?: boolean }} opts
 */
function listEntries(conn, { category, limit = 100, recent = false } = {}) {
  let sql = 'SELECT * FROM entries';
  const params = [];

  if (category) {
    sql += ' WHERE category = ?';
    params.push(category);
  }

  sql += recent ? ' ORDER BY created_at DESC' : ' ORDER BY id ASC';
  sql += ' LIMIT ?';
  params.push(limit);

  return conn.prepare(sql).all(...params);
}

// ---------------------------------------------------------------------------
// pending CRUD
// ---------------------------------------------------------------------------

/**
 * @param {import('better-sqlite3').Database} conn
 * @param {{ content: string, category?: string, tags?: string, source?: string, proposedBy?: string, embedding?: Buffer|null }} fields
 * @returns {number}
 */
function insertPending(conn, { content, category = '', tags = '', source = '', proposedBy = '', embedding = null }) {
  const result = conn
    .prepare(`
      INSERT INTO pending (content, category, tags, source, proposed_by, embedding)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .run(content, category, tags, source, proposedBy, embedding);

  return Number(result.lastInsertRowid);
}

/**
 * @param {import('better-sqlite3').Database} conn
 * @param {number} id
 */
function getPending(conn, id) {
  return conn.prepare('SELECT * FROM pending WHERE id = ?').get(id);
}

/**
 * @param {import('better-sqlite3').Database} conn
 */
function listPending(conn) {
  return conn.prepare("SELECT * FROM pending WHERE status = 'pending' ORDER BY id ASC").all();
}

/**
 * Move a pending entry into entries; mark pending row as 'approved'.
 * @param {import('better-sqlite3').Database} conn
 * @param {number} id pending row id
 * @returns {number} new entries row id
 */
function approvePending(conn, id) {
  const row = getPending(conn, id);
  if (!row) throw new Error(`Pending entry ${id} not found`);

  const transfer = conn.transaction(() => {
    const entryId = insertEntry(conn, {
      content: row.content,
      category: row.category,
      tags: row.tags,
      source: row.source,
      embedding: row.embedding,
    });

    conn
      .prepare("UPDATE pending SET status = 'approved' WHERE id = ?")
      .run(id);

    return entryId;
  });

  return transfer();
}

/**
 * @param {import('better-sqlite3').Database} conn
 * @param {number} id
 */
function rejectPending(conn, id) {
  conn.prepare("UPDATE pending SET status = 'rejected' WHERE id = ?").run(id);
}

/**
 * Approve all rows in pending with status = 'pending'.
 * @param {import('better-sqlite3').Database} conn
 * @returns {number[]} list of new entry ids
 */
function approveAllPending(conn) {
  const rows = listPending(conn);
  return rows.map((r) => approvePending(conn, r.id));
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

/**
 * @param {import('better-sqlite3').Database} conn
 * @returns {{ totalEntries: number, totalPending: number, byCategory: Array<{category: string, count: number}> }}
 */
function getStats(conn) {
  const totalEntries = conn.prepare('SELECT COUNT(*) as n FROM entries').get().n;
  const totalPending = conn
    .prepare("SELECT COUNT(*) as n FROM pending WHERE status = 'pending'")
    .get().n;
  const byCategory = conn
    .prepare('SELECT category, COUNT(*) as count FROM entries GROUP BY category ORDER BY count DESC')
    .all();

  return { totalEntries, totalPending, byCategory };
}

// ---------------------------------------------------------------------------
// findBrainDb
// ---------------------------------------------------------------------------

/**
 * Walk up from startDir looking for .claude/brain.db.
 * @param {string} startDir
 * @returns {string|null}
 */
function findBrainDb(startDir) {
  let dir = startDir || process.cwd();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const candidate = path.join(dir, '.claude', 'brain.db');
    if (fs.existsSync(candidate)) return candidate;

    const parent = path.dirname(dir);
    if (parent === dir) return null; // reached filesystem root
    dir = parent;
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  CURRENT_SCHEMA_VERSION,
  ALLOWED_UPDATE_FIELDS,
  initDb,
  hasVec,
  // entries
  insertEntry,
  getEntry,
  updateEntry,
  deleteEntry,
  listEntries,
  // pending
  insertPending,
  getPending,
  listPending,
  approvePending,
  rejectPending,
  approveAllPending,
  // stats
  getStats,
  // utilities
  findBrainDb,
};
