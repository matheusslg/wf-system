#!/usr/bin/env node
'use strict';

const { execFileSync, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Auto-install deps on first run
const nmPath = path.join(__dirname, 'node_modules');
if (!fs.existsSync(nmPath)) {
  execSync('npm install --production', { cwd: __dirname, stdio: 'pipe' });
}

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');

// Resolve CLI path from ~/.claude/scripts/ (installed location)
const CLI_PATH = path.join(process.env.HOME || require('os').homedir(), '.claude', 'scripts', 'wf-brain.js');

function runCli(args, cwd) {
  try {
    const result = execFileSync('node', [CLI_PATH, ...args], {
      cwd: cwd || process.cwd(),
      encoding: 'utf8',
      timeout: 30000,
      env: { ...process.env }
    });
    return JSON.parse(result.trim());
  } catch (err) {
    const stderr = err.stderr || '';
    const stdout = err.stdout || '';
    try {
      return JSON.parse(stdout.trim());
    } catch {
      return { error: stderr || err.message };
    }
  }
}

const server = new McpServer({
  name: 'wf-brain',
  version: '1.0.0'
});

server.tool(
  'brain_search',
  'Search the project knowledge brain for relevant information',
  {
    query: z.string().describe('Search query'),
    limit: z.number().optional().default(5).describe('Max results'),
    category: z.string().optional().describe('Filter by category')
  },
  async ({ query, limit, category }) => {
    const args = ['search', query, '--limit', String(limit)];
    if (category) args.push('--category', category);
    const result = runCli(args);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'brain_store',
  'Store approved knowledge in the project brain (main agent only)',
  {
    content: z.string().describe('Knowledge content (2-4 sentences)'),
    category: z.enum(['architecture', 'domain', 'convention', 'gotcha', 'decision', 'history']),
    tags: z.string().optional().describe('Comma-separated tags'),
    source: z.string().optional().default('manual')
  },
  async ({ content, category, tags, source }) => {
    const args = ['store', '--category', category, '--source', source, content];
    if (tags) args.splice(3, 0, '--tags', tags);
    const result = runCli(args);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'brain_propose',
  'Store knowledge in the brain (alias for brain_store, kept for backward compatibility)',
  {
    content: z.string().describe('Knowledge content (2-4 sentences)'),
    category: z.enum(['architecture', 'domain', 'convention', 'gotcha', 'decision', 'history']),
    tags: z.string().optional().describe('Comma-separated tags'),
    source: z.string().optional().default('agent:unknown')
  },
  async ({ content, category, tags, source }) => {
    const args = ['store', '--category', category, '--source', source, content];
    if (tags) args.splice(3, 0, '--tags', tags);
    const result = runCli(args);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'brain_stats',
  'Get brain statistics: entry count by category, pending count',
  {},
  async () => {
    const result = runCli(['stats']);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(err => {
  console.error('wf-brain MCP server error:', err);
  process.exit(1);
});
