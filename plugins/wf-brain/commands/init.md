---
description: Initialize a project-local wf-brain database (.claude/brain.db). Idempotent — safe to re-run.
allowed-tools: Bash
---

# Brain Init

Bootstrap the `.claude/brain.db` file that backs every other `brain_*` MCP tool. The MCP server's per-request `withConnection` helper opens the DB and applies the schema migrations on first contact, so this command only needs to make sure the file exists at the right path.

This command is **idempotent** — running it on a project that already has a brain reports the current stats and stops. No destructive operations.

---

## 1. Check whether brain.db already exists

```bash
test -f .claude/brain.db && echo "BRAIN_EXISTS" || echo "BRAIN_MISSING"
```

**If `BRAIN_EXISTS`:** call the `brain_stats` MCP tool and report:

> Brain already initialized at `.claude/brain.db`.
> Current stats: {brain_stats output, formatted as `totalEntries` / `totalPending` / `byCategory` summary}.

Then stop — do not recreate or seed anything.

**If `BRAIN_MISSING`:** continue to step 2.

---

## 2. Create the database file

```bash
mkdir -p .claude && touch .claude/brain.db
```

A zero-byte file is enough — the MCP server's `db.initDb(path)` call applies the full schema (entries, pending, schema_version pragma, optional sqlite-vec virtual table) the first time any brain tool opens the connection.

---

## 3. Verify with `brain_stats`

Call the `brain_stats` MCP tool. Expected response on a freshly-created brain:

```json
{
  "totalEntries": 0,
  "totalPending": 0,
  "byCategory": []
}
```

If `brain_stats` returns an error payload (e.g. `{ "error": "No brain.db found..." }`) something went wrong between steps 2 and 3 — surface the error and stop without claiming success.

---

## 4. Report

> Brain.db created at `.claude/brain.db`. Schema initialized (entries + pending tables, schema_version=1). Ready for `brain_store` / `brain_search`. Sub-agents can write to the review queue via `brain_propose`; run `/wf-brain:review` later to triage.

---

## Out of scope (separate PR)

This command does **not** seed entries from `standards.md` or `progress.md`. That auto-seed flow needs its own design (which sections to parse, how to handle re-runs after the source docs change). Seeding lands in a follow-up.
