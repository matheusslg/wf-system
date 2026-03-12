'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const db = require('../wf-brain/db.js');
const { computeKeywordBonus, keywordSearch, checkDuplicate } = require('../wf-brain/search.js');

let conn;
let tmpDir;

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-brain-search-test-'));
  const dbPath = path.join(tmpDir, 'brain.db');
  conn = db.initDb(dbPath);

  // Seed 3 entries (no embeddings — keyword-only mode)
  db.insertEntry(conn, {
    content: 'JWT tokens expire in 15 minutes. Access tokens are short-lived for security.',
    category: 'architecture',
    tags: 'auth,jwt,tokens',
  });
  db.insertEntry(conn, {
    content: 'The auth middleware silently passes through OPTIONS requests for CORS preflight.',
    category: 'gotcha',
    tags: 'auth,cors,middleware',
  });
  db.insertEntry(conn, {
    content: 'We chose PostgreSQL over MongoDB because we need ACID transactions for billing.',
    category: 'decision',
    tags: 'database,postgres',
  });
});

after(() => {
  if (conn) conn.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('keywordSearch', () => {
  it('finds entries matching "auth middleware" (CORS entry should rank high)', () => {
    const results = keywordSearch(conn, 'auth middleware');
    assert.ok(results.length > 0, 'should return at least one result');
    // CORS entry contains both "auth" and "middleware"
    const corsEntry = results.find((r) => r.content.includes('CORS'));
    assert.ok(corsEntry, 'CORS/middleware entry should be in results');
    // It should be the top result since it matches both words
    assert.equal(results[0].id, corsEntry.id, 'CORS entry should rank highest');
  });

  it('filters by category', () => {
    // "tokens" appears in the architecture entry content
    const results = keywordSearch(conn, 'tokens', { category: 'architecture' });
    assert.ok(results.length > 0, 'should return results for architecture category');
    results.forEach((r) => {
      assert.equal(r.category, 'architecture', 'all results should be architecture');
    });
  });

  it('returns empty for no matches', () => {
    const results = keywordSearch(conn, 'xyzzy nonexistent foobar');
    assert.equal(results.length, 0, 'should return empty array for no matches');
  });

  it('returns recent entries for empty query', () => {
    const results = keywordSearch(conn, '');
    assert.equal(results.length, 3, 'should return all 3 entries');
    results.forEach((r) => {
      assert.equal(r.matchPercent, 100, 'matchPercent should be 100 for empty query');
    });
  });
});

describe('computeKeywordBonus', () => {
  it('returns higher bonus for more word matches', () => {
    const content = 'The auth middleware silently passes through OPTIONS requests for CORS preflight.';
    const bonusTwo = computeKeywordBonus('auth middleware', content);
    const bonusOne = computeKeywordBonus('auth xyzzy', content);
    assert.ok(bonusTwo > bonusOne, 'two matches should yield higher bonus than one');
  });

  it('returns 0 for no matches', () => {
    const bonus = computeKeywordBonus('xyzzy foobar', 'completely unrelated content here');
    assert.equal(bonus, 0, 'should return 0 when no query words found in content');
  });

  it('is capped at 0.2', () => {
    // All words match → fraction = 1 → bonus = 0.2
    const bonus = computeKeywordBonus('auth middleware cors', 'auth middleware cors preflight');
    assert.ok(bonus <= 0.2, 'bonus should never exceed 0.2');
    assert.equal(bonus, 0.2, 'full match should return exactly 0.2');
  });
});

describe('checkDuplicate', () => {
  it('returns null for unique content (keyword mode)', () => {
    const result = checkDuplicate(conn, 'This content does not exist in the database at all.', null);
    assert.equal(result, null, 'should return null for unique content');
  });

  it('returns existing entry for exact content match', () => {
    const content = 'JWT tokens expire in 15 minutes. Access tokens are short-lived for security.';
    const result = checkDuplicate(conn, content, null);
    assert.ok(result, 'should find the existing entry');
    assert.equal(result.content, content, 'returned entry should have matching content');
  });
});
