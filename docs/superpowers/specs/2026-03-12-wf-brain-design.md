# wf-brain Design Spec

**Date**: 2026-03-12
**Status**: Draft
**Author**: Brainstorming session

## Overview

`wf-brain` is a persistent, searchable knowledge layer for the wf-system workflow. It gives AI agents a long-lived "brain" — a semantic knowledge base that accumulates project understanding over time. Agents can search it, store to it, and propose entries for review. The orchestrator auto-injects relevant knowledge on session start and sub-agent delegation.

## Goals

- Persistent project knowledge that survives across sessions and agent lifetimes
- Semantic search (not just keyword matching) over project knowledge
- Sub-agents can propose entries; main agent/user approves (quality gate)
- Auto-extraction of knowledge at session end and issue completion
- Works out of the box for community users (auto-provisioning, no manual setup)
- Project-scoped (each project gets its own brain)
- Fully local — no external API keys, works offline

## Architecture

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| CLI tool | `scripts/wf-brain.js` | Core engine — search, store, propose, review, init (~300 lines) |
| MCP server | `.claude/mcp-servers/wf-brain/index.js` | Thin wrapper exposing CLI as MCP tools (~50 lines) |
| MCP package.json | `.claude/mcp-servers/wf-brain/package.json` | Self-contained dependencies |
| Review command | `commands/wf-brain-review.md` | Interactive pending entry review |
| Brain database | `.claude/brain.db` (in target project) | SQLite + sqlite-vec, project-scoped, gitignored |

### Dependencies

All dependencies live in a single `package.json` at `.claude/mcp-servers/wf-brain/package.json`. Both the CLI and MCP server use this shared `node_modules`:

- `better-sqlite3` — SQLite driver
- `sqlite-vec` — Vector extension for SQLite
- `@xenova/transformers` — Local embedding model (MiniLM-L6-v2)
- `@modelcontextprotocol/sdk` — MCP server SDK

The CLI (`scripts/wf-brain.js`) resolves dependencies from the MCP server's `node_modules` via an explicit require path:

```js
const MODULE_PATH = path.join(__dirname, '..', '.claude', 'mcp-servers', 'wf-brain', 'node_modules');
module.paths.unshift(MODULE_PATH);
```

This keeps a single install location. Auto-install on first run of either CLI or MCP server. No global installs required.

### Storage Schema

SQLite database at `.claude/brain.db` in the target project:

```sql
CREATE TABLE entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  category TEXT NOT NULL,
  tags TEXT,              -- comma-separated
  source TEXT,            -- "manual", "session", "issue:42", "agent:reviewer"
  embedding BLOB,         -- float32 vector from MiniLM
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE pending (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  category TEXT NOT NULL,
  tags TEXT,
  source TEXT,
  proposed_by TEXT,       -- "agent:developer", "agent:reviewer", "session-end", "issue:42"
  embedding BLOB,
  created_at TEXT DEFAULT (datetime('now')),
  status TEXT DEFAULT 'pending'  -- "pending", "approved", "rejected"
);
```

### Vector Search Table

```sql
CREATE VIRTUAL TABLE entries_vec USING vec0(
  id INTEGER PRIMARY KEY,
  embedding float[384]
);

-- Populated on insert: INSERT INTO entries_vec(id, embedding) VALUES (?, ?);
-- Searched via: SELECT id, distance FROM entries_vec WHERE embedding MATCH ? ORDER BY distance LIMIT ?;
```

The `entries_vec` virtual table mirrors `entries.id` and stores the 384-dim float32 embedding. Same pattern for `pending_vec`. Cosine distance is used for similarity ranking.

### Schema Versioning

```sql
CREATE TABLE schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
-- INSERT INTO schema_meta VALUES ('version', '1');
```

On `wf-brain init`, check `schema_meta.version`:
- If table doesn't exist → fresh install, create all tables
- If version < current → run migration functions sequentially (v1→v2, v2→v3, etc.)
- If version == current → no-op

Each version bump has an explicit migration function in the CLI code.

### Categories

Predefined, extensible:

| Category | Purpose |
|----------|---------|
| `architecture` | Design decisions, system structure |
| `domain` | Business rules, product context |
| `convention` | Patterns, coding standards beyond standards.md |
| `gotcha` | Pitfalls, quirks, easy-to-get-wrong things |
| `decision` | Why X was chosen over Y, with reasoning |
| `history` | What was tried, what failed, past context |

### Embedding Model

`all-MiniLM-L6-v2` via `@xenova/transformers`:
- ~80MB model download on first use (cached locally)
- 384-dimension embeddings
- Runs locally, no API keys, works offline
- Sufficient quality for project-scale knowledge (hundreds to low thousands of entries)

## CLI Interface

```bash
# Search (semantic + keyword hybrid)
wf-brain search "how does the auth middleware work?" [--limit 5] [--category architecture]

# Store (direct — for main agent / human)
wf-brain store --category <cat> [--tags "tag1,tag2"] [--source "manual"] "content..."

# Propose (for sub-agents — goes to pending queue)
wf-brain propose --category <cat> [--tags "tag1,tag2"] [--source "agent:reviewer"] "content..."

# Review pending entries
wf-brain review                    # list all pending as JSON
wf-brain review --approve <id>     # approve → moves to entries
wf-brain review --reject <id>      # reject → marks as rejected
wf-brain review --approve-all      # approve everything pending

# List / browse
wf-brain list [--category <cat>] [--limit 20] [--recent]

# Stats
wf-brain stats                     # entry count by category, pending count

# Init (creates the database, seeds from existing context)
wf-brain init [--project-dir <path>]
```

### Output Format

JSON by default (for programmatic use by agents). `--pretty` flag for human-readable:

```
$ wf-brain search "authentication" --limit 2 --pretty

[1] (92% match) architecture — 2026-03-10
    We use JWT with refresh tokens. Access tokens expire in 15min.
    The auth middleware is in src/middleware/auth.ts.
    Decision: chose JWT over session cookies for stateless API scaling.
    Tags: auth, jwt, middleware

[2] (84% match) gotcha — 2026-03-08
    The auth middleware silently passes through OPTIONS requests.
    This is intentional for CORS preflight but confuses new devs.
    Tags: auth, cors, middleware
```

### Search Algorithm

Hybrid search combining semantic and keyword:

1. Generate embedding for the query using MiniLM
2. If `--category` specified, filter candidates via SQL `WHERE category = ?` join before vector search
3. Vector similarity search via `sqlite-vec` (cosine distance) → top N*2 candidates
4. For each candidate, compute keyword bonus: count of query words found in `content` (case-insensitive), normalized to 0-0.2 range
5. Final score = `(1 - cosine_distance) * 0.8 + keyword_bonus * 0.2`
6. Match percentage = `final_score * 100`, clamped to 0-100
7. Return top N results sorted by match percentage descending

**Edge cases:**
- Single-word queries: work fine — embedding captures semantics, keyword match is exact
- Empty query: return most recent N entries (no vector search)
- No results above 20% match: return empty array (avoid noise)

### Deduplication

On `store` and `propose`, before inserting:
1. Generate embedding for the new content
2. Search `entries` + `pending` for cosine similarity > 0.92
3. If a near-duplicate exists, reject with message: `"Similar entry already exists (id: N, match: X%)"`
4. User can override with `--force` flag

## MCP Server Interface

Thin wrapper at `.claude/mcp-servers/wf-brain/index.js`. Each MCP tool shells out to the CLI and returns JSON:

| MCP Tool | CLI Command | Purpose |
|----------|-------------|---------|
| `brain_search` | `wf-brain search` | Semantic search for relevant knowledge |
| `brain_store` | `wf-brain store` | Store approved knowledge (main agent) |
| `brain_propose` | `wf-brain propose` | Sub-agents propose entries for review |
| `brain_review` | `wf-brain review` | List/approve/reject pending entries |
| `brain_stats` | `wf-brain stats` | Overview of brain state |

### MCP Registration

Added to the project's `.mcp.json` by `/wf-init` or `/wf-update`:

```json
{
  "mcpServers": {
    "wf-brain": {
      "command": "node",
      "args": [".claude/mcp-servers/wf-brain/index.js"],
      "cwd": "${workspaceFolder}"
    }
  }
}
```

### Auto-Install on First Run

The MCP server auto-installs dependencies:

```js
const nmPath = path.join(__dirname, 'node_modules');
if (!existsSync(nmPath)) {
  execSync('npm install --production', { cwd: __dirname });
}
```

First run is ~30s slower. Subsequent runs are instant.

## Orchestrator Integration

### Session Start Injection ("Subconscious")

When the orchestrator (`hooks/wf-orchestrator.py`) detects a new session:

1. Read `progress.md` WIP section to understand current work context
2. Extract keywords from WIP
3. Run `wf-brain search "<keywords>" --limit 5`
4. Inject results into `additionalContext`:

```
Brain Context (auto-retrieved):
- [architecture] We use JWT with refresh tokens...
- [gotcha] The auth middleware silently passes through OPTIONS...
```

This happens transparently — agents get relevant knowledge without asking.

### Sub-Agent Delegation Injection

When `/wf-delegate` or `/wf-team-delegate` spawns an agent:

1. Extract keywords from the issue title + description
2. Run `wf-brain search "<keywords>" --limit 3`
3. Append results to the agent's prompt context, after the issue body and before agent instructions

Both delegation commands get the same treatment. `/wf-team-delegate` teammates benefit especially since they retain this context across the full dev → review → QA pipeline.

### Pending Review Nudge

When `wf-brain stats` shows pending > 0, the orchestrator includes in session start:

```
Brain: 4 pending entries awaiting review. Run /wf-brain-review to process them.
```

## Auto-Extraction

### Session End Extraction

When `/wf-end-session` runs:

1. The main agent reviews the session (commits, files changed, decisions made)
2. Generates 1-3 knowledge entries, focusing on:
   - Decisions made and why
   - Gotchas discovered
   - Architectural patterns established
3. Stores via `wf-brain propose` (pending queue)
4. Reports: `Brain: proposed N entries from this session.`

The extraction is done by the main agent using its full session context — no separate LLM call.

### Issue Completion Extraction

**`/wf-delegate`** — When pipeline completes (APPROVED + PASSED):
- The delegator reviews the sub-agent's final summary
- Proposes entries if non-obvious knowledge surfaced

**`/wf-team-delegate`** — When team pipeline completes:
- Richer extraction — teammates have full context from dev → review → QA
- Reviewer feedback is a strong signal source (e.g., "had to refactor X because Y")
- QA findings that required fixes are gotcha candidates
- The team lead proposes entries from the consolidated pipeline outcome

In both cases, the delegating agent is the one that proposes, not the sub-agents directly. This keeps the quality gate consistent.

### What Does NOT Get Auto-Extracted

- Routine commits (too granular, noise)
- PR review comments (phase 2)
- Test results (ephemeral)
- Build output (ephemeral)

Quality over quantity. 50 high-signal entries beats 500 noisy ones.

## User-Facing Review Command

`commands/wf-brain-review.md` — Interactive review of pending entries:

```
/wf-brain-review
```

The command instructs the agent to:

1. Run `wf-brain review` to get all pending entries
2. Present them one at a time:
   ```
   Brain Review — 4 pending entries

   [1/4] gotcha — proposed by agent:reviewer (2026-03-12)
     "The Prisma migration fails silently if the DB connection string
      has a trailing slash. Must strip it in env validation."
     Tags: prisma, database, migration

     (a)pprove  (r)eject  (e)dit  (s)kip  (q)uit
   ```
3. For each entry: approve, reject, edit (modify before approving), skip, or quit
4. Execute the corresponding `wf-brain review --approve/--reject <id>` commands
5. Report summary when done

## Provisioning & Community Setup

### Auto-Init Flow

When a user runs `/wf-init` or `/wf-start-session`:

1. Check if `.claude/brain.db` exists for this project
2. If not, run `wf-brain init`:
   - Creates `.claude/brain.db` with schema
   - Seeds with starter entries from `standards.md` (if exists) — extracts key conventions
   - Seeds from `progress.md` (if exists) — extracts any documented decisions
   - Reports: `Brain initialized with N entries from project context.`
3. Register `wf-brain` MCP server in project `.mcp.json` (if not already registered)

### Dependency Installation

`.claude/mcp-servers/wf-brain/package.json` ships with wf-system. Dependencies auto-install on first MCP server launch. No user action needed.

### Database Location

`.claude/brain.db` lives in the target project's `.claude/` directory:
- Project-scoped — each project gets its own brain
- Already gitignored (`.claude/` is in standard gitignore patterns)
- Portable — if someone copies the `.claude/` dir, the brain comes with it

### Updates via `/wf-update`

When community users run `/wf-update` to get latest wf-system:
- New MCP server code is pulled automatically
- Schema migrations handled by `wf-brain init` (idempotent — adds missing tables/columns)
- Existing brain data is preserved

## Error Handling

| Error | Action |
|-------|--------|
| Brain DB doesn't exist | Auto-init on first access |
| sqlite-vec not available | Fall back to keyword-only search (no vectors) |
| MiniLM model not downloaded | Download on first search (~80MB, one-time) |
| MCP server deps not installed | Auto-install on first launch |
| Empty brain (no entries) | Return empty results, suggest seeding via `wf-brain init` |
| Embedding generation fails | Store entry without embedding, keyword search still works |
| Database locked (concurrent access) | SQLite WAL mode handles this; retry once on SQLITE_BUSY |

## Relationship to Existing Systems

| System | Role | Relationship to Brain |
|--------|------|----------------------|
| `progress.md` | Session tracking | Brain extracts from it at init; session-end proposes entries |
| `standards.md` | Code conventions | Brain seeds from it; conventions that need explanation go in brain |
| `workflow.json` | Project config | Brain config (enabled/disabled) could be added here |
| Claude memory (`~/.claude/.../memory/`) | User-level memory | Brain is project-level; they complement each other |
| Context7 MCP | Framework docs | External docs; brain is internal project knowledge |
| GitHub MCP | Issue/PR data | Brain captures knowledge derived from issues, not the issues themselves |
