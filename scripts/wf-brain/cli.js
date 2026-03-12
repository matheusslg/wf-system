'use strict';

const db = require('./db');
const search = require('./search');

async function getEmbed() {
  if (process.env.WF_BRAIN_SKIP_EMBED === '1') return null;
  try {
    const embed = require('./embed');
    return embed;
  } catch {
    return null;
  }
}

function parseArgs(argv) {
  const command = argv[2];
  const args = { _positional: [] };
  for (let i = 3; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      if (key === 'force' || key === 'pretty' || key === 'recent' || key === 'approve-all') {
        args[key] = true;
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        args[key] = argv[i + 1];
        i++;
      } else {
        args[key] = true;
      }
    } else {
      args._positional.push(argv[i]);
    }
  }
  return { command, args };
}

function output(data, pretty) {
  if (pretty) {
    prettyPrint(data);
  } else {
    console.log(JSON.stringify(data));
  }
}

function prettyPrint(data) {
  if (Array.isArray(data)) {
    if (data.length === 0) {
      console.log('No results.');
      return;
    }
    data.forEach((entry, i) => {
      const match = entry.matchPercent != null ? ` (${entry.matchPercent}% match)` : '';
      console.log(`\n[${i + 1}]${match} ${entry.category} — ${entry.created_at || ''}`);
      console.log(`    ${entry.content}`);
      if (entry.tags) console.log(`    Tags: ${entry.tags}`);
    });
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

async function run(argv) {
  const { command, args } = parseArgs(argv);
  const pretty = args.pretty;

  if (!command || command === 'help') {
    output({ commands: ['init', 'search', 'store', 'propose', 'review', 'list', 'edit', 'delete', 'stats'] });
    return;
  }

  if (command === 'init') {
    const projectDir = args['project-dir'] || process.cwd();
    const dbPath = require('path').join(projectDir, '.claude', 'brain.db');
    const conn = db.initDb(dbPath);

    // Seed from existing project files (only on fresh brain)
    const seed = require('./seed');
    let seeded = 0;
    const existingStats = db.getStats(conn);

    if (existingStats.totalEntries === 0) {
      const standardsPath = require('path').join(projectDir, 'standards.md');
      if (require('fs').existsSync(standardsPath)) {
        const content = require('fs').readFileSync(standardsPath, 'utf8');
        const entries = seed.parseStandards(content);
        for (const entry of entries) {
          try {
            db.insertEntry(conn, { ...entry, embedding: null });
            seeded++;
          } catch {}
        }
      }

      const progressPath = require('path').join(projectDir, 'progress.md');
      if (require('fs').existsSync(progressPath)) {
        const content = require('fs').readFileSync(progressPath, 'utf8');
        const entries = seed.parseProgress(content);
        for (const entry of entries) {
          try {
            db.insertEntry(conn, { ...entry, embedding: null });
            seeded++;
          } catch {}
        }
      }
    }

    const stats = db.getStats(conn);
    conn.close();
    output({ success: true, dbPath, seeded, ...stats }, pretty);
    return;
  }

  const dbPath = db.findBrainDb(process.cwd());
  if (!dbPath) {
    output({ error: 'No brain.db found. Run: wf-brain init' });
    process.exitCode = 1;
    return;
  }

  const conn = db.initDb(dbPath);
  const embed = await getEmbed();

  try {
    switch (command) {
      case 'store': {
        const content = args._positional.join(' ');
        if (!content) { output({ error: 'Content required' }); return; }
        if (!args.category) { output({ error: '--category required' }); return; }

        const embedding = embed ? await embed.generateEmbedding(content) : null;

        if (!args.force) {
          const dup = search.checkDuplicate(conn, content, embedding);
          if (dup) {
            output({ error: `Similar entry already exists (id: ${dup.id})`, duplicate: dup.id });
            return;
          }
        }

        const id = db.insertEntry(conn, {
          content,
          category: args.category,
          tags: args.tags || '',
          source: args.source || 'manual',
          embedding
        });
        output({ id, stored: true }, pretty);
        break;
      }

      case 'propose': {
        const content = args._positional.join(' ');
        if (!content) { output({ error: 'Content required' }); return; }
        if (!args.category) { output({ error: '--category required' }); return; }

        const embedding = embed ? await embed.generateEmbedding(content) : null;

        if (!args.force) {
          const dup = search.checkDuplicate(conn, content, embedding);
          if (dup) {
            output({ error: `Similar entry already exists (id: ${dup.id})`, duplicate: dup.id });
            return;
          }
        }

        const id = db.insertPending(conn, {
          content,
          category: args.category,
          tags: args.tags || '',
          source: args.source || '',
          proposedBy: args.source || '',
          embedding
        });
        output({ id, proposed: true }, pretty);
        break;
      }

      case 'search': {
        const query = args._positional.join(' ');
        const embedding = embed ? await embed.generateEmbedding(query) : null;
        const results = search.hybridSearch(conn, query, embedding, {
          limit: parseInt(args.limit) || 5,
          category: args.category
        });
        output(results, pretty);
        break;
      }

      case 'review': {
        if (args.approve) {
          const id = parseInt(args.approve);
          const entryId = db.approvePending(conn, id);
          output({ approved: id, entryId }, pretty);
        } else if (args.reject) {
          const id = parseInt(args.reject);
          db.rejectPending(conn, id);
          output({ rejected: id, status: 'rejected' }, pretty);
        } else if (args['approve-all']) {
          const ids = db.approveAllPending(conn);
          output({ approved: ids.length, entryIds: ids }, pretty);
        } else {
          const pending = db.listPending(conn);
          output(pending, pretty);
        }
        break;
      }

      case 'list': {
        const results = db.listEntries(conn, {
          category: args.category,
          limit: parseInt(args.limit) || 20,
          recent: args.recent
        });
        output(results, pretty);
        break;
      }

      case 'edit': {
        const id = parseInt(args._positional[0]);
        if (!id) { output({ error: 'Entry ID required' }); return; }
        const fields = {};
        if (args.content) fields.content = args.content;
        if (args.category) fields.category = args.category;
        if (args.tags) fields.tags = args.tags;
        if (Object.keys(fields).length === 0) { output({ error: 'No fields to update' }); return; }
        if (fields.content && embed) {
          const newEmbed = await embed.generateEmbedding(fields.content);
          if (newEmbed) fields.embedding = newEmbed;
        }
        db.updateEntry(conn, id, fields);
        output({ success: true, id }, pretty);
        break;
      }

      case 'delete': {
        const id = parseInt(args._positional[0]);
        if (!id) { output({ error: 'Entry ID required' }); return; }
        db.deleteEntry(conn, id);
        output({ success: true, id }, pretty);
        break;
      }

      case 'stats': {
        const stats = db.getStats(conn);
        output(stats, pretty);
        break;
      }

      default:
        output({ error: `Unknown command: ${command}` });
    }
  } finally {
    conn.close();
  }
}

module.exports = { run, parseArgs };
