const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');

const CLI_PATH = path.join(__dirname, '..', 'wf-brain.js');

describe('wf-brain CLI', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-brain-cli-'));
    fs.mkdirSync(path.join(tmpDir, '.claude'), { recursive: true });
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function run(args, opts = {}) {
    const result = execFileSync('node', [CLI_PATH, ...args], {
      cwd: tmpDir,
      encoding: 'utf8',
      timeout: 30000,
      env: { ...process.env, WF_BRAIN_SKIP_EMBED: '1' },
      ...opts
    });
    return result.trim();
  }

  function runJson(args) {
    return JSON.parse(run(args));
  }

  describe('init', () => {
    it('creates brain.db and reports success', () => {
      const result = runJson(['init']);
      assert.strictEqual(result.success, true);
      assert.ok(fs.existsSync(path.join(tmpDir, '.claude', 'brain.db')));
    });

    it('is idempotent', () => {
      const result = runJson(['init']);
      assert.strictEqual(result.success, true);
    });
  });

  describe('store', () => {
    it('stores an entry and returns id', () => {
      const result = runJson(['store', '--category', 'architecture', '--tags', 'test', 'Test knowledge entry']);
      assert.ok(result.id > 0);
    });

    it('rejects duplicate content', () => {
      run(['store', '--category', 'gotcha', 'Unique gotcha entry']);
      const result = runJson(['store', '--category', 'gotcha', 'Unique gotcha entry']);
      assert.ok(result.error);
      assert.ok(result.error.includes('Similar entry'));
    });

    it('allows duplicate with --force', () => {
      const result = runJson(['store', '--category', 'gotcha', '--force', 'Unique gotcha entry']);
      assert.ok(result.id > 0);
    });
  });

  describe('propose', () => {
    it('creates a pending entry', () => {
      const result = runJson(['propose', '--category', 'decision', '--source', 'agent:reviewer', 'Proposed knowledge']);
      assert.ok(result.id > 0);
    });
  });

  describe('list', () => {
    it('returns entries as JSON array', () => {
      const result = runJson(['list']);
      assert.ok(Array.isArray(result));
      assert.ok(result.length > 0);
    });

    it('filters by category', () => {
      const result = runJson(['list', '--category', 'architecture']);
      assert.ok(result.every(e => e.category === 'architecture'));
    });

    it('respects --limit', () => {
      const result = runJson(['list', '--limit', '1']);
      assert.strictEqual(result.length, 1);
    });

    it('supports --recent ordering', () => {
      const result = runJson(['list', '--recent']);
      assert.ok(Array.isArray(result));
      assert.ok(result.length > 0);
    });
  });

  describe('search', () => {
    it('finds entries matching query', () => {
      const result = runJson(['search', 'architecture test']);
      assert.ok(Array.isArray(result));
    });

    it('returns empty array for no matches', () => {
      const result = runJson(['search', 'xyznonexistent123']);
      assert.ok(Array.isArray(result));
      assert.strictEqual(result.length, 0);
    });
  });

  describe('review', () => {
    it('lists pending entries', () => {
      const result = runJson(['review']);
      assert.ok(Array.isArray(result));
    });

    it('approves a pending entry', () => {
      const proposed = runJson(['propose', '--category', 'gotcha', 'Approve this one']);
      const result = runJson(['review', '--approve', String(proposed.id)]);
      assert.ok(result.entryId > 0);
    });

    it('rejects a pending entry', () => {
      const proposed = runJson(['propose', '--category', 'gotcha', 'Reject this one']);
      const result = runJson(['review', '--reject', String(proposed.id)]);
      assert.strictEqual(result.status, 'rejected');
    });

    it('approves all pending entries', () => {
      runJson(['propose', '--category', 'gotcha', '--force', 'Bulk approve A']);
      runJson(['propose', '--category', 'gotcha', '--force', 'Bulk approve B']);
      const result = runJson(['review', '--approve-all']);
      assert.ok(result.approved >= 2);
      assert.ok(Array.isArray(result.entryIds));
    });
  });

  describe('edit', () => {
    it('updates entry content', () => {
      const stored = runJson(['store', '--category', 'history', '--force', 'Old content']);
      const result = runJson(['edit', String(stored.id), '--content', 'New content']);
      assert.strictEqual(result.success, true);
    });
  });

  describe('delete', () => {
    it('removes an entry', () => {
      const stored = runJson(['store', '--category', 'history', '--force', 'Delete me']);
      const result = runJson(['delete', String(stored.id)]);
      assert.strictEqual(result.success, true);
    });
  });

  describe('stats', () => {
    it('returns stats object', () => {
      const result = runJson(['stats']);
      assert.ok(typeof result.totalEntries === 'number');
      assert.ok(typeof result.totalPending === 'number');
      assert.ok(typeof result.byCategory === 'object');
    });
  });
});
