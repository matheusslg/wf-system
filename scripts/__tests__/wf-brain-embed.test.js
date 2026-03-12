'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const EMBED_PATH = require.resolve('../wf-brain/embed.js');

// Build a deterministic fake embedding based on text length.
// Returns a Float32Array of 384 dimensions.
function _fakeEmbedding(text) {
  const dims = 384;
  const arr = new Float32Array(dims);
  const seed = text.length;
  for (let i = 0; i < dims; i++) {
    arr[i] = Math.sin(seed * (i + 1) * 0.1);
  }
  return arr;
}

// Inject mock for @xenova/transformers into require.cache before embed.js loads.
function _injectMock() {
  // Resolve a stable cache key for @xenova/transformers.
  // We use a synthetic path since the real module may not be locally resolved.
  const MOCK_KEY = path.join(
    __dirname,
    '..',
    '..',
    '.claude',
    'mcp-servers',
    'wf-brain',
    'node_modules',
    '@xenova',
    'transformers',
    'src',
    'transformers.js'
  );

  // We need to intercept the require('@xenova/transformers') call inside embed.js.
  // The simplest approach: override Module._resolveFilename for this specific require.
  const Module = require('module');
  const originalResolve = Module._resolveFilename.bind(Module);

  Module._resolveFilename = function (request, parent, isMain, options) {
    if (request === '@xenova/transformers') {
      return MOCK_KEY;
    }
    return originalResolve(request, parent, isMain, options);
  };

  // Register the mock in require.cache under the intercepted key.
  require.cache[MOCK_KEY] = {
    id: MOCK_KEY,
    filename: MOCK_KEY,
    loaded: true,
    exports: {
      pipeline: async (_task, _model) => {
        // Return a mock pipeline function
        return async (text) => {
          const arr = _fakeEmbedding(text);
          return { data: arr };
        };
      },
    },
    parent: null,
    children: [],
    paths: [],
  };

  return { MOCK_KEY, originalResolve, Module };
}

describe('wf-brain embed', () => {
  let embed;
  let MOCK_KEY;
  let originalResolve;
  let Module;

  before(() => {
    // Clear any prior load of embed.js and its cached pipeline
    delete require.cache[EMBED_PATH];

    const injected = _injectMock();
    MOCK_KEY = injected.MOCK_KEY;
    originalResolve = injected.originalResolve;
    Module = injected.Module;

    embed = require('../wf-brain/embed.js');
  });

  after(() => {
    // Restore original resolve and clean up caches
    Module._resolveFilename = originalResolve;
    delete require.cache[MOCK_KEY];
    delete require.cache[EMBED_PATH];
  });

  it('generateEmbedding returns a Buffer of 384 * 4 bytes', async () => {
    const result = await embed.generateEmbedding('hello world');
    assert.ok(result instanceof Buffer, 'result should be a Buffer');
    assert.equal(result.length, 384 * 4, `expected ${384 * 4} bytes, got ${result.length}`);
  });

  it('different text produces different buffers', async () => {
    const a = await embed.generateEmbedding('short');
    const b = await embed.generateEmbedding('a much longer sentence that differs significantly');
    assert.ok(a instanceof Buffer);
    assert.ok(b instanceof Buffer);
    assert.notDeepEqual(a, b, 'buffers for different texts should differ');
  });

  it('returns null when text is null or empty', async () => {
    const resultNull = await embed.generateEmbedding(null);
    assert.equal(resultNull, null, 'null input should return null');

    const resultEmpty = await embed.generateEmbedding('');
    assert.equal(resultEmpty, null, 'empty string should return null');
  });
});
