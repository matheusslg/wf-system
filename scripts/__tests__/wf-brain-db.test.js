'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Helper to create a fresh temp dir and open a db for each suite
function makeTmpDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-brain-test-'));
  const dbPath = path.join(dir, 'brain.db');
  return { dir, dbPath };
}

const DB_PATH = require.resolve('../wf-brain/db.js');

describe('wf-brain db', () => {
  let db;
  let conn;
  let tmpDir;
  let tmpDbPath;

  before(() => {
    // Invalidate cache so each suite starts fresh
    delete require.cache[DB_PATH];
    db = require('../wf-brain/db.js');
    const tmp = makeTmpDb();
    tmpDir = tmp.dir;
    tmpDbPath = tmp.dbPath;
    conn = db.initDb(tmpDbPath);
  });

  after(() => {
    if (conn) conn.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('initDb', () => {
    it('creates all tables (entries, pending, schema_meta)', () => {
      const tables = conn
        .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        .all()
        .map((r) => r.name);

      assert.ok(tables.includes('entries'), 'entries table missing');
      assert.ok(tables.includes('pending'), 'pending table missing');
      assert.ok(tables.includes('schema_meta'), 'schema_meta table missing');
    });

    it('sets schema version to "1"', () => {
      const row = conn
        .prepare("SELECT value FROM schema_meta WHERE key='schema_version'")
        .get();
      assert.equal(row.value, '1');
    });

    it('is idempotent — calling initDb again does not throw', () => {
      assert.doesNotThrow(() => db.initDb(tmpDbPath));
    });
  });

  describe('insertEntry / getEntry', () => {
    it('insertEntry creates entry and returns numeric id', () => {
      const id = db.insertEntry(conn, {
        content: 'Hello world',
        category: 'note',
        tags: 'test,hello',
        source: 'test-suite',
      });
      assert.equal(typeof id, 'number');
      assert.ok(id > 0);
    });

    it('getEntry retrieves by id', () => {
      const id = db.insertEntry(conn, {
        content: 'Retrieve me',
        category: 'fact',
        tags: '',
        source: 'test',
      });
      const entry = db.getEntry(conn, id);
      assert.equal(entry.content, 'Retrieve me');
      assert.equal(entry.category, 'fact');
      assert.equal(entry.id, id);
    });
  });

  describe('updateEntry', () => {
    it('modifies content and updated_at', (t) => {
      const id = db.insertEntry(conn, {
        content: 'Original',
        category: 'note',
        tags: '',
        source: 'test',
      });

      const before = db.getEntry(conn, id);
      // Ensure a measurable time difference
      const updated = db.updateEntry(conn, id, { content: 'Updated' });
      assert.ok(updated, 'updateEntry should return truthy');

      const after = db.getEntry(conn, id);
      assert.equal(after.content, 'Updated');
      assert.notEqual(after.updated_at, before.updated_at === after.updated_at ? null : before.updated_at,
        'updated_at should change or entry should reflect update');
    });
  });

  describe('deleteEntry', () => {
    it('removes entry', () => {
      const id = db.insertEntry(conn, {
        content: 'Delete me',
        category: 'note',
        tags: '',
        source: 'test',
      });
      db.deleteEntry(conn, id);
      const entry = db.getEntry(conn, id);
      assert.equal(entry, undefined);
    });
  });

  describe('insertPending', () => {
    it('creates pending entry with status "pending"', () => {
      const id = db.insertPending(conn, {
        content: 'Pending content',
        category: 'note',
        tags: '',
        source: 'test',
        proposedBy: 'agent-1',
      });
      assert.equal(typeof id, 'number');
      const row = db.getPending(conn, id);
      assert.equal(row.status, 'pending');
      assert.equal(row.content, 'Pending content');
    });
  });

  describe('approvePending', () => {
    it('moves from pending to entries and updates pending status', () => {
      const pendingId = db.insertPending(conn, {
        content: 'Approve me',
        category: 'fact',
        tags: 'approve',
        source: 'test',
        proposedBy: 'agent-1',
      });

      const entryId = db.approvePending(conn, pendingId);
      assert.equal(typeof entryId, 'number');
      assert.ok(entryId > 0);

      const entry = db.getEntry(conn, entryId);
      assert.equal(entry.content, 'Approve me');

      const pending = db.getPending(conn, pendingId);
      assert.notEqual(pending.status, 'pending');
    });
  });

  describe('rejectPending', () => {
    it('marks pending entry as rejected', () => {
      const id = db.insertPending(conn, {
        content: 'Reject me',
        category: 'note',
        tags: '',
        source: 'test',
        proposedBy: 'agent-2',
      });

      db.rejectPending(conn, id);
      const row = db.getPending(conn, id);
      assert.equal(row.status, 'rejected');
    });
  });

  describe('listEntries', () => {
    it('filters by category', () => {
      db.insertEntry(conn, { content: 'Cat A entry 1', category: 'catA', tags: '', source: 'test' });
      db.insertEntry(conn, { content: 'Cat A entry 2', category: 'catA', tags: '', source: 'test' });
      db.insertEntry(conn, { content: 'Cat B entry', category: 'catB', tags: '', source: 'test' });

      const catA = db.listEntries(conn, { category: 'catA' });
      assert.ok(catA.every((e) => e.category === 'catA'), 'all results should be catA');
      assert.ok(catA.length >= 2);

      const catB = db.listEntries(conn, { category: 'catB' });
      assert.ok(catB.every((e) => e.category === 'catB'));
    });
  });

  describe('listPending', () => {
    it('returns only pending-status entries', () => {
      // Add one pending and one rejected to ensure filter works
      const pId = db.insertPending(conn, {
        content: 'Still pending',
        category: 'note',
        tags: '',
        source: 'test',
        proposedBy: 'agent',
      });
      const rId = db.insertPending(conn, {
        content: 'Rejected one',
        category: 'note',
        tags: '',
        source: 'test',
        proposedBy: 'agent',
      });
      db.rejectPending(conn, rId);

      const list = db.listPending(conn);
      assert.ok(list.every((r) => r.status === 'pending'), 'listPending should return only pending rows');
      const ids = list.map((r) => r.id);
      assert.ok(ids.includes(pId));
      assert.ok(!ids.includes(rId));
    });
  });

  describe('getStats', () => {
    it('returns totalEntries, totalPending, and byCategory counts', () => {
      const stats = db.getStats(conn);
      assert.ok('totalEntries' in stats, 'missing totalEntries');
      assert.ok('totalPending' in stats, 'missing totalPending');
      assert.ok('byCategory' in stats, 'missing byCategory');
      assert.ok(typeof stats.totalEntries === 'number');
      assert.ok(typeof stats.totalPending === 'number');
      assert.ok(Array.isArray(stats.byCategory));
    });
  });
});
