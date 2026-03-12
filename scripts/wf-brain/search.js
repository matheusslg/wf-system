'use strict';

const { listEntries, getEntry, getPending, hasVec } = require('./db');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a Float32Array from a buffer blob stored in SQLite.
 * @param {Buffer} buf
 * @returns {Float32Array}
 */
function _bufToFloat32(buf) {
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
}

/**
 * Compute cosine distance between two Float32Arrays.
 * Returns value in [0, 2]; lower = more similar.
 * @param {Float32Array} a
 * @param {Float32Array} b
 * @returns {number}
 */
function _cosineDistance(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 1;
  return 1 - dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ---------------------------------------------------------------------------
// computeKeywordBonus
// ---------------------------------------------------------------------------

/**
 * Fraction of query words (>2 chars) found in content, normalized to 0-0.2.
 * @param {string} query
 * @param {string} content
 * @returns {number}
 */
function computeKeywordBonus(query, content) {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);

  if (words.length === 0) return 0;

  const lowerContent = content.toLowerCase();
  const matched = words.filter((w) => lowerContent.includes(w)).length;
  const fraction = matched / words.length;

  // Normalize: fraction 0-1 → bonus 0-0.2
  return Math.min(fraction * 0.2, 0.2);
}

// ---------------------------------------------------------------------------
// keywordSearch
// ---------------------------------------------------------------------------

/**
 * @param {import('better-sqlite3').Database} conn
 * @param {string} query
 * @param {{ limit?: number, category?: string }} opts
 * @returns {Array<Object>}
 */
function keywordSearch(conn, query, { limit = 20, category } = {}) {
  const trimmed = (query || '').trim();

  if (!trimmed) {
    // Empty query: return recent entries
    const recent = listEntries(conn, { category, limit, recent: true });
    return recent.map((e) => ({ ...e, matchPercent: 100 }));
  }

  const entries = listEntries(conn, { category, limit: 10000 });

  const scored = entries.map((entry) => {
    const bonus = computeKeywordBonus(trimmed, entry.content);
    const matchPercent = Math.round(bonus * 500);
    return { ...entry, matchPercent };
  });

  return scored
    .filter((e) => e.matchPercent > 0)
    .sort((a, b) => b.matchPercent - a.matchPercent)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// hybridSearch
// ---------------------------------------------------------------------------

/**
 * @param {import('better-sqlite3').Database} conn
 * @param {string} query
 * @param {Buffer|Float32Array|null} embedding
 * @param {{ limit?: number, category?: string }} opts
 * @returns {Array<Object>}
 */
function hybridSearch(conn, query, embedding, { limit = 20, category } = {}) {
  const trimmed = (query || '').trim();

  if (!trimmed) {
    const recent = listEntries(conn, { category, limit, recent: true });
    return recent.map((e) => ({ ...e, matchPercent: 100 }));
  }

  if (!embedding || !hasVec(conn)) {
    return keywordSearch(conn, trimmed, { limit, category });
  }

  // Vector search: fetch 2x limit candidates from entries_vec via SQL JOIN
  let sql = `
    SELECT e.*
    FROM entries e
    JOIN entries_vec v ON v.rowid = e.id
    WHERE v.embedding MATCH ?
      AND k = ?
  `;
  const params = [embedding, limit * 2];

  if (category) {
    sql += ' AND e.category = ?';
    params.push(category);
  }

  let candidates;
  try {
    candidates = conn.prepare(sql).all(...params);
  } catch {
    // vec query failed — fall back to keyword
    return keywordSearch(conn, trimmed, { limit, category });
  }

  const queryVec =
    embedding instanceof Float32Array ? embedding : _bufToFloat32(embedding);

  const scored = candidates.map((entry) => {
    const keywordBonus = computeKeywordBonus(trimmed, entry.content);

    let vectorScore = 0;
    if (entry.embedding) {
      const entryVec = _bufToFloat32(
        Buffer.isBuffer(entry.embedding)
          ? entry.embedding
          : Buffer.from(entry.embedding)
      );
      const dist = _cosineDistance(queryVec, entryVec);
      vectorScore = (1 - dist) * 0.8;
    }

    const finalScore = vectorScore + keywordBonus;
    const matchPercent = Math.round(Math.min(Math.max(finalScore * 100, 0), 100));
    return { ...entry, matchPercent };
  });

  return scored
    .filter((e) => e.matchPercent > 20)
    .sort((a, b) => b.matchPercent - a.matchPercent)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// checkDuplicate
// ---------------------------------------------------------------------------

/**
 * Check if content/embedding already exists in entries or pending.
 * @param {import('better-sqlite3').Database} conn
 * @param {string} content
 * @param {Buffer|Float32Array|null} embedding
 * @returns {Object|null}
 */
function checkDuplicate(conn, content, embedding) {
  if (embedding && hasVec(conn)) {
    // Vector search entries_vec
    try {
      const entriesVecRows = conn
        .prepare(
          `SELECT e.* FROM entries e
           JOIN entries_vec v ON v.rowid = e.id
           WHERE v.embedding MATCH ? AND k = 5`
        )
        .all(embedding);

      const queryVec =
        embedding instanceof Float32Array ? embedding : _bufToFloat32(embedding);

      for (const row of entriesVecRows) {
        if (row.embedding) {
          const rowVec = _bufToFloat32(
            Buffer.isBuffer(row.embedding) ? row.embedding : Buffer.from(row.embedding)
          );
          const dist = _cosineDistance(queryVec, rowVec);
          if (1 - dist > 0.92) return row;
        }
      }
    } catch {
      // fall through to exact match
    }

    // Vector search pending_vec
    try {
      const pendingVecRows = conn
        .prepare(
          `SELECT p.* FROM pending p
           JOIN pending_vec v ON v.rowid = p.id
           WHERE v.embedding MATCH ? AND k = 5`
        )
        .all(embedding);

      const queryVec =
        embedding instanceof Float32Array ? embedding : _bufToFloat32(embedding);

      for (const row of pendingVecRows) {
        if (row.embedding) {
          const rowVec = _bufToFloat32(
            Buffer.isBuffer(row.embedding) ? row.embedding : Buffer.from(row.embedding)
          );
          const dist = _cosineDistance(queryVec, rowVec);
          if (1 - dist > 0.92) return row;
        }
      }
    } catch {
      // fall through to exact match
    }
  }

  // Exact content match fallback
  const entryMatch = conn
    .prepare('SELECT * FROM entries WHERE content = ? LIMIT 1')
    .get(content);
  if (entryMatch) return entryMatch;

  const pendingMatch = conn
    .prepare('SELECT * FROM pending WHERE content = ? LIMIT 1')
    .get(content);
  if (pendingMatch) return pendingMatch;

  return null;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  computeKeywordBonus,
  keywordSearch,
  hybridSearch,
  checkDuplicate,
};
