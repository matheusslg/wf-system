#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

// Auto-install deps on first MCP load. Pinned via package-lock.json so
// callers get reproducible builds without an npm install step in their
// own workflow.
const nmPath = path.join(__dirname, 'node_modules');
if (!fs.existsSync(nmPath)) {
  execSync('npm install --production', { cwd: __dirname, stdio: 'pipe' });
}

// Resolve transitive deps from plugin-local node_modules. The standard
// resolution algorithm already walks `__dirname/node_modules`, but
// Claude Code may inject additional search paths above ours; unshifting
// keeps lib imports deterministic across hosts.
if (fs.existsSync(nmPath)) {
  module.paths.unshift(nmPath);
}

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');

const db = require('./lib/db');
const search = require('./lib/search');

async function loadEmbed() {
  if (process.env.WF_BRAIN_SKIP_EMBED === '1') return null;
  try {
    return require('./lib/embed');
  } catch {
    return null;
  }
}

function notInitialized() {
  return {
    error: 'No brain.db found. Initialize one with `/wf-core:wf-init` inside the project (creates .claude/brain.db).',
  };
}

function jsonReply(payload) {
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
}

function withConnection(handler) {
  return async (input) => {
    const dbPath = db.findBrainDb(process.cwd());
    if (!dbPath) return jsonReply(notInitialized());

    const conn = db.initDb(dbPath);
    try {
      const result = await handler(input, conn);
      return jsonReply(result);
    } catch (err) {
      return jsonReply({ error: err.message || String(err) });
    } finally {
      conn.close();
    }
  };
}

const server = new McpServer({ name: 'wf-brain', version: '0.1.0' });

server.tool(
  'brain_search',
  'Search the project knowledge brain for relevant information',
  {
    query: z.string().describe('Search query'),
    limit: z.number().optional().default(5).describe('Max results'),
    category: z.string().optional().describe('Filter by category'),
  },
  withConnection(async ({ query, limit, category }, conn) => {
    const embed = await loadEmbed();
    const embedding = embed ? await embed.generateEmbedding(query) : null;
    return search.hybridSearch(conn, query, embedding, { limit, category });
  })
);

server.tool(
  'brain_store',
  'Store approved knowledge in the project brain (main agent only)',
  {
    content: z.string().describe('Knowledge content (2-4 sentences)'),
    category: z.enum(['architecture', 'domain', 'convention', 'gotcha', 'decision', 'history']),
    tags: z.string().optional().describe('Comma-separated tags'),
    source: z.string().optional().default('manual'),
  },
  withConnection(async ({ content, category, tags, source }, conn) => {
    const embed = await loadEmbed();
    const embedding = embed ? await embed.generateEmbedding(content) : null;

    const dup = search.checkDuplicate(conn, content, embedding);
    if (dup) {
      return { error: `Similar entry already exists (id: ${dup.id})`, duplicate: dup.id };
    }

    const id = db.insertEntry(conn, {
      content,
      category,
      tags: tags || '',
      source: source || 'manual',
      embedding,
    });
    return { id, stored: true };
  })
);

server.tool(
  'brain_propose',
  'Propose knowledge for human review before it lands in the brain (sub-agents)',
  {
    content: z.string().describe('Knowledge content (2-4 sentences)'),
    category: z.enum(['architecture', 'domain', 'convention', 'gotcha', 'decision', 'history']),
    tags: z.string().optional().describe('Comma-separated tags'),
    source: z.string().optional().default('agent:unknown'),
  },
  withConnection(async ({ content, category, tags, source }, conn) => {
    const embed = await loadEmbed();
    const embedding = embed ? await embed.generateEmbedding(content) : null;

    const dup = search.checkDuplicate(conn, content, embedding);
    if (dup) {
      return { error: `Similar entry already exists (id: ${dup.id})`, duplicate: dup.id };
    }

    const id = db.insertPending(conn, {
      content,
      category,
      tags: tags || '',
      source: source || '',
      proposedBy: source || '',
      embedding,
    });
    return { id, proposed: true };
  })
);

server.tool(
  'brain_stats',
  'Get brain statistics: entry count by category, pending count',
  {},
  withConnection(async (_input, conn) => db.getStats(conn))
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('wf-brain MCP server error:', err);
  process.exit(1);
});
