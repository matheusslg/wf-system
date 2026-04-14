# wf-system Plugin Migration — Design (v2.0)

**Date:** 2026-04-07
**Status:** COMPLETE — all sections (1-7) approved by user
**Project:** matheusslg/wf-system
**Target version:** 2.0.0
**Author:** Brainstorming session between Matheus Cavallini and Claude (Opus 4.6)

---

## How to use this document

This is the design spec for migrating wf-system from a `install.sh`-based distribution to the Claude Code Plugins Marketplace format. It is the complete output of a brainstorming session covering Sections 1 through 7.

**All sections are decided and approved.** The next step after this spec is the `writing-plans` skill to produce the implementation plan; ticket creation happens after the implementation plan exists. Use `gh issue create` directly against `matheusslg/wf-system` for tickets — the github MCP server is disconnected in the user's environment.

**The original audit that motivated this work** is at `docs/2026-04-07-system-audit.md`. Read that for context on *why* these decisions were made.

---

## Top-line summary

wf-system migrates from a 230-line `install.sh` to the Claude Code Plugins Marketplace format. The migration is a hard cutover (no parallel install paths) shipping as v2.0.0. v2.0 ships exactly **one plugin (`wf-core`)** containing the daily workflow loop. `wf-brain`, `wf-design`, and `wf-cockpit` are deferred to v2.1, v2.2, and v2.3+ respectively.

The migration also includes the F1 deduplication of `/wf-implement`, `/wf-fix-bug`, `/wf-improve` into a shared skill (`wf-dev-pipeline`) with three thin command shims. This dedup is required for v2.0 because it forces a clean plugin boundary AND fixes three drift bugs the audit + spike found.

The marketplace and plugin format eliminate ~100+ LOC of custom infrastructure from `wf-orchestrator.py` (version checks, install-mode tracking, path discovery) by using the platform's built-in `${CLAUDE_PLUGIN_ROOT}` variable and marketplace update mechanism.

---

## Decision log (Q1-Q5, brainstormed and approved)

| # | Question | Decision | Reasoning |
|---|---|---|---|
| Q1 | Primary target user | **(c) Both — personal use AND OSS adoption equal weight** | User chose; means every design decision must serve both audiences |
| Q2 | Single plugin or multi-plugin | **(b) Multi-plugin from day 1** | Opt-in is the biggest adoption lever for OSS users; splitting forces F1 dedup conversation; future cockpit gets a natural home |
| Q3 | F1 duplicate commands handling | **(d→a) Spike first, then collapse** | Spike confirmed ~85% verbatim duplication + 3 drift bugs (Branch Safety missing in fix-bug/improve, GitHub issue update missing in improve, error handling drift) |
| Q4 | How to collapse | **(a) Keep three command names as thin shims sharing internals** | Muscle memory survives; LOC reduction is still 1241 → 386; any reference to the old commands still works |
| Q5 | Migration path for existing install.sh users | **(a) Hard cutover** | Single source of truth from day one; no double maintenance burden; safety net is a one-shot migration helper script |

**Release scope (M1):** v2.0 ships `wf-core` only. `wf-brain` follows in v2.1 once the in-flight RAG implementation stabilizes (~5 of 10 tasks done per progress.md). `wf-design` follows in v2.2. `wf-cockpit` follows in v2.3+ gated on a data-source feasibility spike.

---

## Section 1 — Plugin Architecture & Boundaries (APPROVED)

### What goes in `wf-core` (v2.0)

Everything currently in wf-system that doesn't depend on the brain MCP or Figma tooling. **Decision principle:** anything currently used in the daily workflow must ship in v2.0; otherwise we'd be deferring functionality the user already uses, which M1 explicitly forbids.

| Category | Commands |
|---|---|
| **Project setup** | `wf-init`, `wf-generate`, `wf-create-agent`, `wf-update` |
| **Session loop** | `wf-start-session`, `wf-end-session`, `wf-overview` |
| **Planning** | `wf-create-prd`, `wf-parse-prd`, `wf-breakdown`, `wf-create-ticket`, `wf-ticket-status`, `wf-investigate` |
| **Daily work (F1 dedup victims)** | `wf-implement` (canonical), `wf-fix-bug` (alias), `wf-improve` (alias), `wf-pick-issue`, `wf-commit`, `wf-delegate`, `wf-team-delegate`, `wf-pr-comments`, `wf-debug`, `wf-refactor` |
| **Quality / Review** | `wf-review`, `wf-team-review`, `wf-pre-prod-review`, `wf-test`, `wf-e2e`, `wf-qa-plan`, `wf-ai-qa` |
| **Hook** | `wf-orchestrator.py` bundled via `hooks/hooks.json` |
| **Skills** | All current skills move into `skills/` of wf-core, plus the new `wf-dev-pipeline` skill (Section 2) |
| **Agent templates** | Move into `agents/` of wf-core |

**Total wf-core commands:** ~30, of which 3 are alias shims (wf-fix-bug, wf-improve sharing wf-implement's internals via the shared skill).

### What is deferred from v2.0

| Plugin | Ships in | Contents |
|---|---|---|
| `wf-brain` | v2.1 | `wf-brain-review` command + the MCP server + SQLite/embeddings code in `scripts/wf-brain/` |
| `wf-design` | v2.2 | `wf-match-figma`, `wf-design-setup`, the pixelmatch script, the figma skill |
| `wf-cockpit` | v2.3+ | Web UI reading the event log from §3.5.3; gated on data-source feasibility spike |

### Marketplace structure

A new `.claude-plugin/marketplace.json` lives at the root of `matheusslg/wf-system`. The marketplace `name` field is `wf-system` (kebab-case, no slashes — required by the marketplace schema). Users install via:

```bash
/plugin marketplace add matheusslg/wf-system
/plugin install wf-core@wf-system
```

The first command takes the github `owner/repo` shorthand to register the marketplace; the second uses the marketplace's internal `name` field to install plugins from it.

### Repository layout (after migration)

```
matheusslg/wf-system/
├── .claude-plugin/
│   └── marketplace.json          # registry: lists wf-core only in v2.0 (future plugins added when they ship)
├── plugins/
│   └── wf-core/                  # The v2.0 plugin
│       ├── .claude-plugin/
│       │   └── plugin.json
│       ├── commands/             # ~30 .md files (3 are thin shims)
│       ├── agents/               # agent templates
│       ├── skills/               # skills incl. wf-dev-pipeline (the shared internals)
│       │   └── wf-dev-pipeline/
│       │       └── SKILL.md
│       ├── hooks/
│       │   └── hooks.json
│       ├── scripts/
│       │   └── wf-orchestrator.py
│       └── README.md
├── docs/
│   └── superpowers/
│       └── specs/
│           └── 2026-04-07-wf-system-plugin-migration-design.md  # this file
├── scripts/
│   └── migrate-to-plugin.sh      # one-shot migration helper for old install.sh users
├── CHANGELOG.md                  # continues; v2.0.0 entry describes the cutover
├── README.md                     # rewritten to point at /plugin install
└── VERSION                       # bumps to 2.0.0
```

### What disappears from the repo

- `install.sh` (deleted)
- `templates/settings-hooks.json` (no longer needed)
- `hooks/wf-orchestrator.py` (moves into `plugins/wf-core/scripts/`)
- All version-tracking metadata files (`.wf-version`, `.wf-source`, `.wf-install-mode`, `.wf-last-check`)
- Brain code at `scripts/wf-brain/` and `scripts/wf-brain.js` stays in repo but moves into `plugins/wf-brain/` in v2.1; orphaned at repo root for v2.0

### Resolved questions (originally flagged in Section 1)

1. **Inter-plugin dependencies:** the plugin manifest schema has **no `requires` field** (resolved in §4.6). When wf-brain ships in v2.1, it will be standalone — the orchestrator hook's `_brain_search()` already gracefully no-ops when the brain isn't installed. Document the optional dependency in README only.
2. **`claude -p -r <session_id> "/context"` child process:** the orchestrator hook (lines 211-225) shells out to the `claude` binary. Should still work after plugin install (PATH unchanged) but remains a fragile interface that could break with Claude Code version updates. **§7 Category 4 covers this in the parity tests.**

---

## Section 2 — F1 Dedup Mechanism (APPROVED)

### Approach: shared skill, thin command shims

One file holds the logic: `skills/wf-dev-pipeline/SKILL.md`. It contains the entire shared pipeline currently copy-pasted across the three commands:

- ⛔ ORCHESTRATOR BOUNDARIES block
- ⛔ Branch Safety check **(applied to all three modes — fixes drift bug)**
- Load Configuration
- Understand the work (parse args, fetch issue + comments)
- Determine Responsible Agent (auto-detection table)
- Prepare Context block
- Spawn Developer Agent
- Pipeline: Code Review (with loop-back-on-CHANGES_REQUESTED)
- Pipeline: QA Validation (with loop-back-on-FAILED)
- Update GitHub Issue **(applied to all three modes — fixes drift bug in wf-improve)**
- Update Progress (450-line archive check + log entry)
- Report Results
- Error Handling **(merged from all three files — fixes error handling drift)**

**Mode-specific bits** live in a single table in the skill:

| Mode | Verb | Mission Steps | Commit Prefix | Progress Header | Issue Comment Title |
|---|---|---|---|---|---|
| `feature` | Implement | Design / Create / Integrate / Test / Document | feat: | ### Implementation: | Feature Implemented |
| `bug` | Fix | Locate / Understand / Fix / Test / Verify | fix: | ### Bug Fix: | Bug Fixed |
| `improve` | Improve | Analyze / Plan / Implement / Test / Verify | improve: | ### Improvement: | Improvement Complete |

The skill renders verb-flavored sections from this table based on the `mode` parameter passed by the calling shim.

### Three command shims (~12 lines each)

```markdown
---
description: Build a new feature from description
allowed-tools: Read, Bash, Grep, Glob, Task
argument-hint: <feature description or issue number>
---

# Implement

This command shares its orchestration logic with `/wf-fix-bug` and `/wf-improve`.
The pipeline lives in the `wf-dev-pipeline` skill.

**Read** `${CLAUDE_PLUGIN_ROOT}/skills/wf-dev-pipeline/SKILL.md` and **follow its
instructions exactly**, applying the rules for `mode=feature`.

**User arguments:** $ARGUMENTS
```

Identical for `wf-fix-bug.md` (with `mode=bug`) and `wf-improve.md` (with `mode=improve`).

### Why not the Skill tool

The `Skill` tool in Claude Code is designed for Claude to autonomously discover relevant skills based on the task. Hard-coded invocation from a command file is unusual usage AND the Skill tool doesn't have a clean way to pass a parameter like `mode=bug`. The "Read this file and follow it with mode=X" pattern is more explicit and doesn't depend on how the Skill tool handles parameters.

### LOC accounting

| File | Current LOC | After dedup |
|---|---|---|
| `commands/wf-implement.md` | 449 | ~12 |
| `commands/wf-fix-bug.md` | 435 | ~12 |
| `commands/wf-improve.md` | 357 | ~12 |
| `skills/wf-dev-pipeline/SKILL.md` | (didn't exist) | ~350 |
| **Total** | **1,241** | **~386** |

Net reduction: ~855 LOC. More importantly, **one source of truth** — the drift bugs disappear because there's only one place they could live.

### Drift bugs the spike found (FIXED by this dedup)

1. **`wf-implement` has a Branch Safety block (lines 31-43); `wf-fix-bug` and `wf-improve` do NOT.** Real defect: running `/wf-fix-bug` while on `main` does not enforce branch safety. Fixed because the consolidated skill applies it to all modes.
2. **`wf-fix-bug` has extra error handling** (`Cannot Determine Agent`, `Agent Failed`) that the others lack. Fixed because the consolidated skill merges all error handlers.
3. **`wf-improve` has no "Update GitHub Issue" section.** If you run improve on an issue, the issue never gets updated. Fixed because the consolidated skill applies the update for all modes.

### Failure mode flagged

The skill becomes a single point of failure: if you break it, all three commands break simultaneously. Currently a bug in `wf-improve.md` only breaks improve. **Mitigation:** §7 Category 2 (F1 dedup correctness) explicitly validates all three modes against a real test project before any RC ships. The win is still net-positive; the failure mode just changes from "three independent ways to drift" to "one coordinated way to break".

---

## Section 3 — Orchestrator Hook Bundling (APPROVED)

### The plugin's `hooks/hooks.json`

```json
{
  "description": "wf-system orchestrator: context monitoring, brain injection (when wf-brain is installed), session lifecycle",
  "hooks": {
    "Stop": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "python3 ${CLAUDE_PLUGIN_ROOT}/scripts/wf-orchestrator.py --mode=stop",
            "timeout": 60000
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "python3 ${CLAUDE_PLUGIN_ROOT}/scripts/wf-orchestrator.py",
            "timeout": 5000
          }
        ]
      }
    ]
  }
}
```

The only change from `templates/settings-hooks.json` is the path: `~/.claude/hooks/wf-orchestrator.py` → `${CLAUDE_PLUGIN_ROOT}/scripts/wf-orchestrator.py`. Events, matcher, timeouts, mode flag are identical.

### Changes inside `wf-orchestrator.py`

| What | Current | After plugin migration | Reason |
|---|---|---|---|
| Self-locate the script | Walks parent dirs or hardcoded `~/.claude/hooks/` | `os.environ["CLAUDE_PLUGIN_ROOT"]` | Plugin format provides this directly |
| Find user's `workflow.json` | Walks up 3 parent dirs from CWD (lines 165-178) | **No change** | Finding user's project workflow.json, not the plugin's own files |
| Version check | `VERSION_URL = "...matheusslg/wf-system..."` (line 40) + GitHub API call + `.wf-update-available` | **DELETED entirely (~50 LOC)** | `/plugin update` from marketplace replaces this |
| State files | `~/.claude/hooks/.wf-state/` | `~/.wf-state/` | State should survive plugin reinstalls |
| `_brain_search()` (lines 322-352) | Tries brain CLI; silently no-ops on failure | **No change for v2.0** | Already gracefully no-ops; works for the brainless v2.0 case |
| `afplay` macOS sound (line 591) | Hardcoded | Gate behind `if sys.platform == "darwin"` | Currently silently fails on Linux/Windows; 2-line fix |
| `claude -p -r <session_id> "/context"` (lines 211-225) | Shells out to `claude` on PATH | **No change** | Should still work; PATH unchanged by plugin install |

### What gets deleted entirely (~100 LOC removed)

1. The version check subsystem (~50 LOC around line 40)
2. `INSTALL_TYPE` / install-mode awareness
3. Code reading `.wf-source` / `.wf-install-mode` / `.wf-last-check` metadata files

### Hook merge / migration concern

Plugin docs say plugin hooks merge with user hooks. If a user already has the wf-orchestrator Stop hook in `~/.claude/settings.json` (installed by the old install.sh), both will run after plugin install. **The migration helper script (§5) handles this via the jq surgery in §5.4 — old wf-orchestrator hook entries are removed before plugin install.**

### Forwarded to §7 (smoke testing)

- **Plugin hooks event support:** the plugin format docs list `PreToolUse`, `PostToolUse`, `Stop`, `SessionStart`, `SessionEnd`, `UserPromptSubmit`, `PreCompact`, `Notification`, `SubagentStop` as supported events. wf-orchestrator only uses `PostToolUse` and `Stop` — both confirmed supported in docs. §7 Category 1 smoke-tests both end-to-end on the actual plugin install before v2.0 ships.

---

## Section 3.5 — wf-team-* Commands and Cockpit Reservation (APPROVED)

### 3.5.1 — wf-team-* commands ship in wf-core almost unchanged

Both `wf-team-delegate.md` (1,437 lines) and `wf-team-review.md` (556 lines) go into `plugins/wf-core/commands/`. **No collapse or refactor in v2.0** — the only modification is the additive event-log instrumentation in §3.5.3 (≈10 lines, off by default in `wf-team-delegate.md`). `wf-team-review.md` is byte-identical to today.

Reasoning:

1. Most-used commands per the user → migration risk must be near-zero
2. Use Agent Teams primitives that have only one obvious right implementation — no F1-style duplication problem
3. Drift bugs found in F1 trio are NOT present in the team commands as far as we can see — they have internal consistency

### 3.5.2 — Future plugin announcement (README-only)

The original idea was to register `wf-brain` and `wf-cockpit` as `status: "planned"` slots in `marketplace.json`. **Section 4 research killed this idea** — the marketplace schema has no `status: "planned"` field, and every plugin entry needs a real `source` path. You can't reserve slots for plugins that don't exist yet.

**Replacement:** announce future plugins via README only. The README's "Coming soon" section (drafted in §4.5) lists `wf-brain` (v2.1), `wf-design` (v2.2), and `wf-cockpit` (v2.3+). They get added to `marketplace.json` AT THE TIME each one ships, not before.

This is the YAGNI answer and matches the marketplace's actual schema.

### 3.5.3 — wf-team-delegate gets a cockpit-ready event log (additive, off by default)

In `wf-team-delegate.md` Section 7 ("Blocking Monitoring Loop"), inject ~10 lines that — IF `cockpit.eventLog` is set in `workflow.json` — append a JSON-line event to a log file each time the loop sees a state change:

```json
{"ts": "2026-04-07T14:23:01Z", "team": "review-pr-42", "event": "task_status_change", "task_id": "5", "from": "in_progress", "to": "completed", "owner": "security-reviewer"}
```

**Why this matters:**
- v2.0 ships with the seam in place but the feature off
- Future `wf-cockpit` plugin reads this log file — no new instrumentation needed in wf-team-delegate
- Cockpit data-source spike becomes "does this event log capture enough?" — much more answerable than "how do we observe sub-agent token usage in real time?"
- Honest limitation: gives "what happened" not "how many tokens" — cockpit becomes "team activity timeline" not "cost dashboard"

**This 10-line change does NOT:**
- Add server, UI, or runtime infrastructure
- Change wf-team-delegate's existing behavior (off by default)
- Couple wf-core to the cockpit plugin
- Spike the cockpit's data-source question (still needs to happen before Project A starts)

### 3.5.4 — wf-delegate vs wf-team-delegate duplication: deferred ticket

`wf-delegate.md` is **1,758 lines** (larger than `wf-team-delegate.md` at 1,437 lines). The size mismatch + the description ("`/wf-delegate` is the stateless fallback for `/wf-team-delegate`") strongly suggests another F1-style duplication. **NOT investigating this in v2.0** — sprawl risk. Goes in deferred tickets list for v2.x.

### 3.5.5 — Cockpit data-source: hiding in plain sight

The natural extension seam for the future cockpit is `wf-team-delegate.md` Section 7 — the team lead's blocking monitoring loop polls `TaskList()` to watch teammate progress. A cockpit subscribes to this loop's output (via the event log from §3.5.3) instead of needing new instrumentation.

**The unanswered cockpit question** (NOT for v2.0): can hooks observe per-teammate token usage in real time? Probably no. The realistic cockpit shows team activity timeline, not cost dashboard.

---

## Deferred items list (post-v2.0)

| Item | Target | Notes |
|---|---|---|
| `wf-brain` plugin | v2.1 | Brain MCP server + brain-review command + sqlite/embeddings code |
| `wf-design` plugin | v2.2 | Figma + match-figma + design-setup |
| `wf-cockpit` plugin | v2.3+ | Web UI reading event log from §3.5.3; gated on data-source spike |
| Project A brainstorm (cockpit) | After v2.0 ships | Separate brainstorming session; first step is the data-source spike |
| `wf-delegate` vs `wf-team-delegate` audit | v2.x | Confirm/reject F1-style duplication; collapse if confirmed |
| **wf-brain mandatory + progress.md retirement** | **v3.x (strategic)** | User intent: brain becomes canonical knowledge layer, progress.md is dropped. Resolve concerns first (see "Concerns about progress.md retirement" below) — possibly hybrid (brain + progress.md) is the right answer instead of full replacement |

### Concerns about progress.md retirement (must address before v3.x)

User stated intent: "wf-brain should be mandatory and we can drop progress.md so the agents can always refer to the knowledge base using RAG".

What progress.md provides that the brain doesn't:
- Human-readable at a glance (eyeball-able; embeddings aren't)
- Git-diffable in PRs and commits
- Brittleness floor — works even when brain is broken/missing/incompatible
- Zero infrastructure dependency
- Orchestrator hook depends on it (WIP detection, 450-line archive trigger, session log format)
- Predictable token efficiency at session start

What brain provides that progress.md doesn't:
- Semantic recall across projects
- Finding related work without exact keywords
- Cross-session linking

**Honest take:** the future state is probably brain + progress.md as **complementary** (journal + search index), not brain replacing progress.md. Killing the journal loses something important even if the search is better. Resolve this tension before executing "drop progress.md".

---

## Section 4 — Plugin & Marketplace Manifests (APPROVED)

### 4.1 — `plugins/wf-core/.claude-plugin/plugin.json`

```json
{
  "name": "wf-core",
  "version": "2.0.0",
  "description": "Workflow management for Claude Code: session orchestration, agent teams, GitHub/Jira integration, and a developer pipeline (implement / fix-bug / improve)",
  "author": {
    "name": "Matheus Cavallini",
    "email": "matheus@gnarlysoft.io",
    "url": "https://github.com/matheusslg"
  },
  "homepage": "https://github.com/matheusslg/wf-system",
  "repository": "https://github.com/matheusslg/wf-system",
  "license": "MIT",
  "keywords": [
    "workflow",
    "automation",
    "agents",
    "agent-teams",
    "orchestration",
    "session-management",
    "github",
    "jira"
  ]
}
```

**That's it.** No `commands`, `agents`, `skills`, `hooks`, or `mcpServers` fields — all auto-discovered from the standard layout (`commands/`, `agents/`, `skills/`, `hooks/hooks.json`, `.mcp.json`). Adding explicit paths would be noise.

**Why no `.mcp.json` in v2.0:** wf-core has zero MCP dependencies. The brain MCP moves to `wf-brain` in v2.1. The github MCP server isn't used (the user's environment has it disconnected and the wf-dev-pipeline skill switches to `gh` CLI anyway).

### 4.2 — `.claude-plugin/marketplace.json`

```json
{
  "name": "wf-system",
  "owner": {
    "name": "Matheus Cavallini",
    "email": "matheus@gnarlysoft.io"
  },
  "metadata": {
    "description": "wf-system: workflow management plugins for Claude Code",
    "version": "2.0.0"
  },
  "plugins": [
    {
      "name": "wf-core",
      "source": "./plugins/wf-core",
      "description": "Core workflow loop: session management, dev pipeline, agent teams, planning",
      "category": "productivity",
      "tags": ["workflow", "agents", "orchestration"]
    }
  ]
}
```

**One plugin entry only.** Future plugins (`wf-brain` v2.1, `wf-design` v2.2, `wf-cockpit` v2.3+) get added when they ship. No phantom slots, no `status: "planned"` field (that field doesn't exist — see §3.5.2).

### 4.3 — Install command for users

```bash
# In Claude Code:
/plugin marketplace add matheusslg/wf-system
/plugin install wf-core@wf-system
```

The `/plugin marketplace add` step takes a github `owner/repo` shorthand. After that, the marketplace is referenced by its kebab-case `name` (`wf-system`) in install commands.

### 4.4 — Add a LICENSE file (defect fix)

The README claims MIT via badge but **no `LICENSE` file exists** in the repo. Fix as part of v2.0:

```
LICENSE                    # Add MIT license text at repo root
```

Otherwise the plugin marketplace listing is technically misleading and OSS users can't legally redistribute.

### 4.5 — README rewrite

Replace install.sh sections with:

```markdown
## Install (v2.0+)

Inside Claude Code:

    /plugin marketplace add matheusslg/wf-system
    /plugin install wf-core@wf-system

That's it. The plugin auto-loads commands, agents, skills, hooks, and the orchestrator script.

## Migrating from v1.x (install.sh users)

If you previously installed wf-system via `install.sh`, run the one-shot migration helper before installing the plugin:

    curl -fsSL https://raw.githubusercontent.com/matheusslg/wf-system/main/scripts/migrate-to-plugin.sh | bash

This removes the old `~/.claude/hooks/wf-orchestrator.py`, surgically prunes wf-system entries from `~/.claude/settings.json`, and clears `.wf-version` / `.wf-source` metadata. Then install the plugin as above.

(Migration helper specified in §5.)

## Coming soon

- `wf-brain` (v2.1) — RAG knowledge layer with hybrid search
- `wf-design` (v2.2) — Figma + pixelmatch verification
- `wf-cockpit` (v2.3+) — Web UI for agent team observability
```

Other README sections (Features, Commands, Architecture) stay structurally the same — only install/migration content changes.

### 4.6 — Resolved questions

| Question | Resolution |
|---|---|
| Plugin format supports `requires` for inter-plugin deps? | **No.** Not in schema. Brain hook already gracefully no-ops. Document optional dependency in README only. |
| `commands` field auto-discovers or needs explicit paths? | **Auto-discovers** when omitted. Only specify paths to override defaults. |
| Marketplace.json `status: "planned"` convention | **Doesn't exist.** Added plugins only when they ship. README "Coming soon" section instead. |
| Plugin manifest schema source of truth | `code.claude.com/docs/en/plugins-reference` and `code.claude.com/docs/en/plugin-marketplaces` |
| `wf-core` vs alternative plugin names | **Stick with `wf-core`** — short, clear, paired with `wf-system` marketplace name |
| `metadata.pluginRoot` shortcut in marketplace.json | **Don't use it for v2.0** — only one plugin, no benefit. Add when v2.1 makes it pay off. |
| `version` in plugin.json + VERSION file = two sources of truth | **`scripts/bump-version.sh` updates all three (VERSION, plugin.json, marketplace.json) atomically.** See §6.2. |

### 4.7 — Things flagged forward to §7

1. The `strict` field on plugin entries — docs show `"strict": false` but don't explain it. Leaving it out (default behavior). §7 testing: if anything we care about depends on it, address in v2.0.1.

---

## Section 5 — Migration Helper Script (APPROVED)

### 5.1 — Goals and non-goals

**Goals**
1. Reverse a previous `install.sh` run cleanly so the v2.0 plugin install starts from a known state.
2. Always make a backup before deleting anything (no `--force` style irreversibility).
3. Be safe to run on a machine that never had wf-system installed (no-op cleanly).
4. Be safe to run twice (idempotent).
5. Make rollback obvious if something goes wrong.

**Non-goals**
1. Auto-discovering every project that ever ran `install.sh --project`. Users handle one project at a time via `--project <path>`, or the script prints instructions.
2. Migrating user data inside `workflow.json` files inside user projects. Plugin format reads `workflow.json` exactly as before (orchestrator hook unchanged), so no data migration is needed.
3. Migrating the brain database. v2.0 doesn't ship the brain at all (deferred to v2.1); the brain SQLite DB stays untouched and waits for v2.1.

### 5.2 — Backup before any destructive action

Before doing anything else, the script creates:

```
~/.claude/wf-system-backup-<UTC-timestamp>/
├── settings.json              # full original copy
├── hooks/                     # entire ~/.claude/hooks/ directory
│   ├── wf-orchestrator.py
│   ├── .wf-version
│   ├── .wf-source
│   ├── .wf-install-mode
│   ├── .wf-last-check
│   ├── .wf-update-available
│   └── .wf-state/
├── scripts/
│   ├── wf-brain.js            # if exists
│   └── wf-brain/              # if exists
├── mcp-servers/
│   └── wf-brain/              # if exists
└── commands/
    └── wf-*.md                # only the wf-* files, not user customizations
```

The backup uses `cp -r` (resolves symlinks → real files). If user installed in symlink mode, the backup is fully self-contained — restoring later doesn't require the original git checkout to still exist.

The backup path is **printed as the very last line of stdout** so users can find it after the script finishes.

`--no-backup` flag skips this for users who really want to (CI scenarios). Default is backup on.

### 5.3 — What gets removed (global install case)

| Path | Reason |
|---|---|
| `~/.claude/commands/wf-*.md` | Plugin's `commands/` directory provides these now |
| `~/.claude/hooks/wf-orchestrator.py` | Moves into plugin under `${CLAUDE_PLUGIN_ROOT}/scripts/` |
| `~/.claude/hooks/.wf-version` | Marketplace handles versioning |
| `~/.claude/hooks/.wf-source` | No longer needed (plugin self-locates) |
| `~/.claude/hooks/.wf-install-mode` | install.sh distinction is gone |
| `~/.claude/hooks/.wf-last-check` | `/plugin update` replaces this |
| `~/.claude/hooks/.wf-update-available` | Same |
| `~/.claude/hooks/.wf-state/` | Will move to `~/.wf-state/` per §3 |
| `~/.claude/scripts/wf-brain.js` | Moves to `wf-brain` plugin in v2.1 |
| `~/.claude/scripts/wf-brain/` | Same |
| `~/.claude/mcp-servers/wf-brain/` | Same |

**Detection guard:** the script aborts with a clear error if **none** of the above paths exist AND `~/.claude/hooks/.wf-version` is not present. If wf-system was never installed, refuse to delete anything.

**Pattern safety on commands:** the script enumerates `wf-*.md` in `~/.claude/commands/` and removes only files matching the documented wf-system command list (hard-coded ~30-entry allowlist of v1.x command names). This protects users who happened to name a custom command `wf-anything.md`.

**Symlink-aware deletion:** `rm -f` works the same on symlinks and regular files (removes the symlink itself, not the target). No special handling needed.

### 5.4 — `~/.claude/settings.json` jq surgery

**Detection signature:** any hook entry whose `command` field contains the substring `wf-orchestrator`. No other hook in the wild uses that filename — safe enough.

**The jq filter:**

```jq
.hooks |= (
  if . == null then null
  else
    with_entries(
      .value |= (
        map(.hooks |= map(select(.command | test("wf-orchestrator") | not)))
        | map(select(.hooks | length > 0))
      )
    )
  end
)
```

This walks each hook event (Stop, PostToolUse, etc.), drops individual hook commands matching `wf-orchestrator`, and removes empty matcher groups so we don't leave dangling `[]`. If `.hooks` becomes empty after pruning, leave the empty object rather than deleting the key (less surprising).

**Atomicity:** write to `settings.json.tmp`, then `mv` over the original. Any failure leaves the original intact.

**jq dependency:** check `command -v jq` at script start. Hard-fail with install instructions if missing:

```
ERROR: jq is required for safe settings.json migration.
Install it first:
  macOS:  brew install jq
  Debian: apt install jq
  Fedora: dnf install jq
Then re-run this script.
```

**Why bash + jq instead of Python:** the whole script is ~120 LOC and bash matches install.sh convention. The jq dependency hits maybe 5% of users; one extra step for them is cheaper than maintaining a Python shim that has to handle the same JSON safety concerns from scratch.

### 5.5 — Project-local install case

install.sh's `--project` mode only installs `<project>/.claude/commands/wf-*.md`. No hook, no settings, no brain. The migration is trivial.

The script handles this with a `--project <path>` flag:

```bash
./migrate-to-plugin.sh                       # global install only (default)
./migrate-to-plugin.sh --project ~/my-app    # only the project install at this path
./migrate-to-plugin.sh --project ~/my-app --include-global   # both
```

Default (no `--project` flag) is "global only" because it's the most common case AND the most dangerous to get wrong. Users with project installs run the script once per project.

If the user has a project install they don't migrate, **the v2.0 plugin install still works** — the project's local `wf-*.md` files just become orphaned dead weight that get loaded redundantly.

### 5.6 — Flags and UX

```
Usage: migrate-to-plugin.sh [OPTIONS]

Options:
  --dry-run             Print what would be done without making any changes
  --no-backup           Skip backup (NOT recommended)
  --project PATH        Migrate a project-local install at PATH
  --include-global      Used with --project: also migrate global install
  -h, --help            Show this help

Examples:
  migrate-to-plugin.sh                      # migrate global install
  migrate-to-plugin.sh --dry-run            # preview changes
  migrate-to-plugin.sh --project ~/my-app   # migrate one project install
```

**Output format:** colorless (no ANSI), structured as numbered phases:

```
[1/5] Detecting wf-system installation...
      Found global install (v1.11.1, mode: symlink)
[2/5] Creating backup at ~/.claude/wf-system-backup-2026-04-07T15-23-01Z/...
      Backed up 14 files (38 KB)
[3/5] Removing wf-system files from ~/.claude/...
      Removed 30 commands, 1 hook, 5 metadata files, 3 brain components
[4/5] Pruning wf-system hooks from ~/.claude/settings.json...
      Removed 2 hook entries (Stop, PostToolUse)
[5/5] Migration complete.

Backup: ~/.claude/wf-system-backup-2026-04-07T15-23-01Z/

Next steps:
  1. Open Claude Code
  2. Run: /plugin marketplace add matheusslg/wf-system
  3. Run: /plugin install wf-core@wf-system
```

### 5.7 — Failure handling and rollback

If any step fails AFTER the backup is created, the script:
1. Prints `ERROR: <step> failed: <reason>`
2. Prints the backup path prominently
3. Prints the exact restore command:
   ```bash
   cp -a ~/.claude/wf-system-backup-<ts>/* ~/.claude/
   ```
4. Exits non-zero

**No automatic rollback.** Manual restore is intentional — if something failed mid-migration, we don't know what state things are in, and an automated rollback could make it worse.

### 5.8 — Resolved decisions

| Question | Resolution |
|---|---|
| Backup vs delete | **Backup by default, `--no-backup` flag for opt-out.** |
| Detection aggressiveness | **Conservative.** Refuse to delete anything unless `~/.claude/hooks/.wf-version` exists OR specific wf-system files are present. Hard-coded ~30-entry `wf-*.md` allowlist instead of glob deletion. |
| POSIX sh vs bash | **Bash 3.2+** (matches install.sh, available on macOS and Linux out of the box). |
| Dry-run mode | **Yes, `--dry-run` flag.** Worth ~20 LOC for trust-building. |

### 5.9 — Things flagged forward

1. **Distribution:** the script lives at `scripts/migrate-to-plugin.sh` in the repo. README points users to `curl -fsSL https://.../scripts/migrate-to-plugin.sh | bash`. §6 must decide whether to also include it as a github release asset.
2. **Testability:** §7 covers the `HOME=$tmpdir` test fixture approach for testing without mutating the real `~/.claude/`.
3. **Version compatibility:** if a user is on an old wf-system version (e.g., 1.0.0), the script must `[[ -e ]]` check before each removal so missing files (like brain components, which only existed from v1.9.0+) don't error. §7 validates this against multiple historical fixtures.

---

## Section 6 — Release Process (APPROVED)

### 6.1 — Branch strategy

| Branch | Purpose | Lifetime |
|---|---|---|
| `main` | Stable v1.x line until v2.0.0 lands; v2.x line after | Permanent |
| `docs/plugin-migration-spec` | Where this spec lives + future spec edits | Until merged into main during the cutover |
| `feature/plugin-migration-v2` | All implementation work for v2.0 | Until merged into main during the cutover |

**Long-lived `feature/plugin-migration-v2` branch over many small PRs.** Single-maintainer project with no other significant in-flight work on `main`. Coordinating the migration as one atomic event is simpler than rebasing many small PRs through a partial-state main. Rebase against main weekly.

**The cutover PR** merges both branches into main as a single merge commit (preserving the granular history of the feature branch). The PR includes:
- Spec link
- CHANGELOG entry
- The migrate-to-plugin.sh helper
- The full plugin restructure
- LICENSE file
- README rewrite

**One `main` push, no incremental v2 commits to main.** If v2 work landed on main before v2.0.0 ships, `git log` becomes confusing for users on v1.x doing `/wf-update`.

### 6.2 — Versioning and tags

**Version bumps:**

| File | v1.11.1 → ? |
|---|---|
| `VERSION` | `2.0.0` |
| `plugins/wf-core/.claude-plugin/plugin.json` `version` | `2.0.0` |
| `.claude-plugin/marketplace.json` `metadata.version` | `2.0.0` |

**Lockstep bump via `scripts/bump-version.sh <new-version>`** — ~15-line bash script that does a `sed` replace on all three files. Called manually from the release process. Single source of truth at the release-process level even though three files hold the version.

**Tags:**

| Tag | Points at | Purpose |
|---|---|---|
| `v1.11.1-final-installer` | The tip of `main` BEFORE the v2.0 merge | Rollback target. Users on v1.x who hit issues can `git checkout v1.11.1-final-installer && ./install.sh`. |
| `v2.0.0-rc.1` | First RC commit on `feature/plugin-migration-v2` | Dogfood install. |
| `v2.0.0-rc.N` | Later RCs as needed | Each fix iteration. |
| `v2.0.0` | The merge commit after RC dogfooding completes | Final release. |

The `v1.11.1-final-installer` tag is **created BEFORE** the cutover merge so it lives on a clean v1.x commit.

### 6.3 — Pre-release / RC strategy

**Mandatory: at least one RC before v2.0.0.** The hard cutover has too many moving pieces to ship straight to a stable tag with zero bake time.

**RC process:**

1. **Cut `v2.0.0-rc.1`** from `feature/plugin-migration-v2` once the implementation passes the §7 smoke test in a clean environment.
2. **Dogfood for at least 3 days.** matheusslg installs it locally via the marketplace flow and uses it for daily work on `wf-system` itself (eat your own dog food — bug-fixing wf-system v2.0 *with* wf-system v2.0 is the highest-fidelity test).
3. **Issues found → fix on the branch → cut `v2.0.0-rc.N+1`**.
4. **Cut `v2.0.0`** after at least 24 hours of clean dogfooding on the latest RC with no new issues found.

**Why not a longer beta period:** wf-system has effectively one user (matheusslg) plus an unknown small number of OSS users. A 2-week public beta would mostly be silence. 3-5 days of intense single-user dogfooding catches most real issues — anything that survives that is a long-tail bug a beta period wouldn't find either.

**RC marketplace registration:** RCs are NOT added to `marketplace.json` on `main`. They live only on the feature branch. To install an RC, the user adds the marketplace from the feature branch ref:

```bash
/plugin marketplace add matheusslg/wf-system@feature/plugin-migration-v2
/plugin install wf-core@wf-system
```

**§7 must verify** that `/plugin marketplace add` accepts a branch ref. If it doesn't, the dogfood path needs a different shape (local-path install, or tag-based marketplace add).

### 6.4 — CHANGELOG.md entry

```markdown
## [2.0.0] - <date>

### ⚠ BREAKING CHANGES

- **install.sh removed.** wf-system is now distributed as a Claude Code plugin via
  the official Plugins Marketplace. Users on v1.x must run the one-shot migration
  helper before installing v2.0:

      curl -fsSL https://raw.githubusercontent.com/matheusslg/wf-system/main/scripts/migrate-to-plugin.sh | bash

  Then in Claude Code:

      /plugin marketplace add matheusslg/wf-system
      /plugin install wf-core@wf-system

  Users who need to stay on v1.x can pin to the `v1.11.1-final-installer` tag.

### Added

- Claude Code plugin format support via `plugins/wf-core/.claude-plugin/plugin.json`
- Marketplace registration via `.claude-plugin/marketplace.json`
- Shared `wf-dev-pipeline` skill consolidating `/wf-implement`, `/wf-fix-bug`,
  `/wf-improve` (~855 LOC removed; one source of truth)
- `scripts/migrate-to-plugin.sh` one-shot migration helper for v1.x users
- LICENSE file (MIT) — previously the README claimed MIT but no LICENSE existed
- Cockpit-ready event log seam in `/wf-team-delegate` (off by default; reads
  `cockpit.eventLog` from `workflow.json`)

### Changed

- Orchestrator hook bundled with plugin via `${CLAUDE_PLUGIN_ROOT}` (no more
  `~/.claude/hooks/wf-orchestrator.py`)
- README rewritten to lead with plugin install instructions
- Hook state directory moved from `~/.claude/hooks/.wf-state/` to `~/.wf-state/`
  (survives plugin reinstalls)
- macOS sound playback in orchestrator gated behind `sys.platform == "darwin"`
  (was silently failing on Linux/Windows)

### Removed

- `install.sh` (replaced by plugin marketplace install)
- `templates/settings-hooks.json` (plugin format auto-loads `hooks/hooks.json`)
- Version check subsystem in orchestrator hook (~50 LOC) — `/plugin update`
  replaces this
- Install-mode tracking files (`.wf-version`, `.wf-source`, `.wf-install-mode`,
  `.wf-last-check`, `.wf-update-available`)

### Fixed

- **F1 drift bug**: Branch Safety check was missing in `/wf-fix-bug` and
  `/wf-improve`. Now applied to all three modes via the shared skill.
- **F1 drift bug**: GitHub issue update was missing in `/wf-improve`. Now applied
  to all three modes.
- **F1 drift bug**: error handlers (`Cannot Determine Agent`, `Agent Failed`) were
  only in `/wf-fix-bug`. Now consolidated and applied to all three.
- F9 audit finding: stale `/wf-init-project` references in install.sh removed
  (command was renamed in v1.1.0)
```

**Migration instructions stay inline in CHANGELOG, no separate `MIGRATION.md`.** KISS — add a separate file only if v3.x or another big cutover demands it.

### 6.5 — Release announcement plan

| Surface | Action |
|---|---|
| `matheusslg/wf-system` README | Already covered in §4.5 |
| `matheusslg/wf-system` GitHub release notes | Auto-derived from CHANGELOG entry + 2-paragraph intro |
| `matheusslg/wf-system` repo description | Update tagline to mention "Claude Code plugin" |
| Buy Me a Coffee profile | No change needed |
| Social/professional channels | At user's discretion — not our problem |

**The v2.0.0 GitHub release notes structure:**

```
# wf-system v2.0.0 — Plugin Migration

Two-paragraph intro: what changed, why, and the headline benefits
(opt-in plugin model, marketplace updates, shared dev pipeline).

## What's new
[Pull from CHANGELOG Added/Changed sections]

## Migration
[Link to migrate-to-plugin.sh + 1-paragraph summary]

## Breaking changes
[Pull from CHANGELOG BREAKING CHANGES section]

## Acknowledgements
N/A for v2.0 — single-maintainer release.
```

Manual `gh release create` from the cutover commit. No automated announcement.

### 6.6 — Smoke test gate (pointer to §7)

The release process gates v2.0.0 on §7's smoke test passing in a clean Claude Code environment. **No `v2.0.0` tag is cut until §7's smoke test passes on the most recent RC.**

### 6.7 — Rollback plan

**Two rollback layers:**

**Layer 1 — User rollback (post-v2.0 release).** If a user installs v2.0 and hits issues:

1. Restore from the migration helper's backup:
   ```bash
   cp -a ~/.claude/wf-system-backup-<ts>/* ~/.claude/
   ```
2. Uninstall the v2.0 plugin: `/plugin uninstall wf-core@wf-system`
3. They're back to their pre-migration v1.x state.

If the user did NOT use the migration helper backup (e.g., ran with `--no-backup`), they can clone the repo at the `v1.11.1-final-installer` tag and re-run `install.sh`.

**Layer 2 — Maintainer rollback (post-v2.0 release).** If v2.0 has a critical issue affecting many users:

1. Cut `v2.0.1` with a fix as quickly as possible (preferred).
2. If `v2.0.1` isn't possible quickly: cut `v1.11.2` from `v1.11.1-final-installer` with the critical fix and tell users to install from that tag via `install.sh`. The `install.sh` is gone from `main` but lives in git history at `v1.11.1-final-installer`.

**Documentation:** the rollback procedure for both layers is committed at `docs/v2.0-rollback.md` (~30 lines) and linked from the GitHub release notes.

### 6.8 — Resolved decisions

| Question | Resolution |
|---|---|
| Pre-release / RC versions before v2.0.0? | **Yes, at least one RC.** Mandatory ~3-day dogfood period before final tag. |
| Migration helper tested against multiple historical install.sh versions? | **Smoke-test latest (v1.11.1) in detail; spot-check v1.5.0 and v1.0.0 by simulating their installed state.** §7 details. |
| Long-lived branch vs many small PRs | **Long-lived `feature/plugin-migration-v2` branch.** |
| Inline migration in CHANGELOG vs separate MIGRATION.md | **Inline in CHANGELOG.** KISS. |

### 6.9 — Things flagged forward to §7

1. **`/plugin marketplace add` from a branch ref:** assumed to work for RC dogfood. §7 verifies. If it doesn't, RC distribution needs a different shape.

---

## Section 7 — Testing & Validation (APPROVED)

### 7.1 — Philosophy: manual smoke + targeted bash tests for the helper

wf-system has no test suite by design — `standards.md` documents "Test commands manually in a test project" as the convention. v2.0 should not change that convention. Building a full automated test harness for Claude Code commands is scope creep, and the runtime is Claude Code itself, which doesn't have a clean fixture model.

**The v2.0 testing strategy:**
- **Manual smoke tests** for everything that runs *inside* Claude Code (commands, agents, hooks firing, marketplace install).
- **Automated bash tests** ONLY for the migration helper, because it's pure bash mutating files — testable in isolation by overriding `$HOME`.
- **No tests for the commands themselves.** Matches existing convention; revisit in v2.x if scale demands it.

This is a deliberate undershoot of "industry best practice" in favor of matching the project's actual scale and maintainer bandwidth.

### 7.2 — Five test categories (all must pass for v2.0.0)

| # | Category | Type | Depth |
|---|---|---|---|
| 1 | Plugin format validation | Manual | High |
| 2 | F1 dedup correctness | Manual | High |
| 3 | Migration helper safety | Automated bash tests + manual dry-run review | Medium |
| 4 | Orchestrator hook behavior parity | Manual | Medium |
| 5 | End-to-end smoke test in fresh Claude Code | Manual | High |

**All five must pass against the latest RC** before cutting `v2.0.0`. No partial-pass shipping.

### 7.3 — Category 1: Plugin format validation

**Goal:** confirm the plugin format actually works the way the docs claim, *for our specific shape* of plugin (Python hook script + auto-discovered commands + auto-discovered skills).

| Test | How | Pass criterion |
|---|---|---|
| `${CLAUDE_PLUGIN_ROOT}` resolves to the correct path inside the Python hook | Add a one-line debug print at the top of `wf-orchestrator.py`: `print(f"ROOT={os.environ.get('CLAUDE_PLUGIN_ROOT', 'MISSING')}", file=sys.stderr)`. Install the plugin. Trigger any hook event. | The path printed matches the actual plugin directory (NOT `MISSING`). Remove the debug line before tagging. |
| `hooks/hooks.json` PostToolUse hook fires | Trigger any tool use in Claude Code with the plugin installed. Watch for the orchestrator's behavior (e.g., context monitoring counter increments). | Hook visibly runs. |
| `hooks/hooks.json` Stop hook fires | End a session in Claude Code. | Stop sound plays on macOS; orchestrator logs the session end. |
| `commands/` auto-discovers all 30 wf commands | After plugin install, type `/wf-` in Claude Code and check the autocomplete list. | All ~30 commands present. |
| `skills/wf-dev-pipeline/SKILL.md` is readable from a command | Run `/wf-implement "test feature"`. The shim should successfully Read the skill file via `${CLAUDE_PLUGIN_ROOT}/skills/wf-dev-pipeline/SKILL.md`. | Command runs without "file not found" error. |
| Marketplace registration from a branch (for RC dogfood) | `/plugin marketplace add matheusslg/wf-system@feature/plugin-migration-v2` | Marketplace resolves and lists `wf-core`. **If this fails, document the workaround in §6.3.** |

**The `${CLAUDE_PLUGIN_ROOT}` debug print is NON-OPTIONAL.** This is the riskiest unknown — if Claude Code doesn't propagate that env var to child processes spawned by hooks, the entire plugin breaks. Verify on day one of implementation before writing anything else.

### 7.4 — Category 2: F1 dedup correctness

**Goal:** confirm the shared skill behaves identically across all three modes (`feature`, `bug`, `improve`), with the drift bugs actually fixed.

| Test | How | Pass criterion |
|---|---|---|
| Branch Safety enforced for all three modes | Create a test project. Check out `main`. Run `/wf-implement "x"`, `/wf-fix-bug "y"`, `/wf-improve "z"` in turn. | All three abort with the branch safety error and offer to create a feature branch. |
| GitHub issue update fires for all three modes | Run each command against a real test issue (`gh issue create` first). | All three add a closing comment to the issue with the right title (`Feature Implemented` / `Bug Fixed` / `Improvement Complete`). |
| Mode-specific verbs and prefixes | Check the progress.md entries and the suggested commit messages from each command. | Verbs/prefixes match the table in §2 (feature/Implement/feat:, bug/Fix/fix:, improve/Improve/improve:). |
| Loop-back on CHANGES_REQUESTED | Force a reviewer agent to return CHANGES_REQUESTED. | Skill loops back to the developer agent for fixes, then re-runs review. |
| Loop-back on QA FAILED | Force a QA agent to return FAILED. | Same loop-back behavior. |

**This category is the highest-risk one** because the shared skill is the new single point of failure (flagged in §2). Test rigorously.

### 7.5 — Category 3: Migration helper safety (automated bash tests)

**Goal:** confirm the migration helper handles the realistic v1.x install states without surprises, and that idempotency + dry-run work.

**Automated test fixtures live at `tests/migration/`** in the repo:

```
tests/migration/
├── run-tests.sh                # entry point
├── fixtures/
│   ├── v1.0.0-fresh-install/   # snapshot of what install.sh produces on v1.0.0
│   ├── v1.5.0-fresh-install/
│   ├── v1.11.1-fresh-install/
│   └── never-installed/        # empty .claude/ dir
└── assertions.sh                # shared assertion helpers
```

Each fixture is a directory tree mirroring `~/.claude/` after a hypothetical `install.sh` run from that version. Hand-written placeholder files matching what install.sh would produce. These fixtures are checked into the repo since they're tiny (~5 KB each) and stable.

**Test cases:**

| Test | How |
|---|---|
| Migrate v1.11.1 fresh install | `tmpdir=$(mktemp -d); cp -r tests/migration/fixtures/v1.11.1-fresh-install/* $tmpdir/.claude/; HOME=$tmpdir bash scripts/migrate-to-plugin.sh --no-backup; assert all v1.x files removed; assert settings.json no longer contains wf-orchestrator references` |
| Migrate v1.5.0 fresh install | Same shape, different fixture. Specifically asserts no error on missing brain files (brain wasn't installed until v1.9.0). |
| Migrate v1.0.0 fresh install | Same shape. |
| Migrate never-installed system | Empty `.claude/`. Assert script exits cleanly with "no wf-system installation detected" message and zero filesystem changes. |
| Idempotency | Run migration twice on the same fixture. Assert second run is a no-op. |
| Dry-run does not mutate | `bash scripts/migrate-to-plugin.sh --dry-run`; assert ALL fixture files still present afterward. |
| Settings.json surgery preserves user hooks | Fixture with a `settings.json` containing both wf-orchestrator hooks AND a user-defined hook for some other tool. Assert the user hook survives migration. |

**`run-tests.sh` runs all of these, prints pass/fail per test, exits non-zero on any failure.** Called manually as part of the release process.

**Manual dry-run review (in addition to automated tests):**

Run `bash scripts/migrate-to-plugin.sh --dry-run` against the maintainer's actual `~/.claude/` and eyeball the output. Automated tests catch correctness; manual review catches "the output is confusing" or "the next-steps message is unclear" UX bugs.

### 7.6 — Category 4: Orchestrator hook behavior parity

**Goal:** confirm the orchestrator hook does the same things post-migration as it did pre-migration. We're not adding behaviors (those are §1-3 changes); we're verifying nothing regressed.

| Test | How | Pass criterion |
|---|---|---|
| Context monitoring still triggers at 75% / 90% | Run a long Claude Code session until context approaches 75%. | Soft warning fires; at 90% the critical warning fires. |
| WIP detection still works | Create a git WIP state in a project workflow. End a session. | Stop hook detects WIP and behaves the same as pre-migration. |
| Brain search no-op when brain not installed | Default v2.0 state (no brain). Trigger any command. | `_brain_search()` no-ops silently; no error. |
| Stop sound on macOS | End a session on macOS. | Sound plays. |
| Stop sound silenced on Linux | (If user has Linux, otherwise skip) End a session. | NO error; sound silently skipped. |
| Hook state directory at new location | Trigger any hook event. Check that `~/.wf-state/` is created (not `~/.claude/hooks/.wf-state/`). | New location used. |
| Workflow.json discovery still walks 3 parent dirs | Run a command from a deeply nested subdirectory of a wf project. | Hook finds workflow.json. |

**No comparison harness** — these are eyeball checks against expected behavior. wf-system never had hook regression tests pre-v2.0; we're not introducing them now.

### 7.7 — Category 5: End-to-end smoke test in fresh Claude Code

**Goal:** the user-facing acceptance test. From zero state to a complete daily workflow loop.

**Test script (manual, run once per RC):**

```
1. Open a fresh Claude Code (no wf-system installed)
2. /plugin marketplace add matheusslg/wf-system
   → Marketplace registers
3. /plugin install wf-core@wf-system
   → Installation completes; restart prompt appears
4. Restart Claude Code
5. cd ~/wf-system-test-project && claude
6. /wf-init
   → Creates .claude/workflow.json
7. /wf-start-session
   → Logs session start; orchestrator hook fires
8. /wf-implement "Add a hello-world endpoint"
   → Branch safety check (creates feature branch)
   → Spawns developer agent
   → Spawns reviewer agent
   → Spawns QA agent
   → Updates progress.md
9. /wf-commit
   → Creates a feat: commit
10. /wf-end-session
    → Closes session; Stop hook fires; sound plays (macOS)
11. /plugin uninstall wf-core@wf-system
    → Cleanly uninstalls
12. rm -rf ~/wf-system-test-project
```

**Pass criterion:** every step completes without errors. Expected output at each step is documented in a `tests/smoke/v2.0-smoke-test.md` file (a manual checklist).

**Test project location:** `~/wf-system-test-project/` (gitignored, throwaway, recreated on each smoke test). NOT checked into the repo.

**Hello-world endpoint complexity:** intentionally trivial. The point isn't to test the dev pipeline's robustness — it's to test that the install → run → commit → uninstall loop works end-to-end. A trivial feature catches "does the loop run at all?" without confusing test failures with implementation bugs.

### 7.8 — Test artifact location summary

| Artifact | Path | Tracked in git? |
|---|---|---|
| Migration helper bash test runner | `tests/migration/run-tests.sh` | Yes |
| Migration helper fixtures (v1.0.0, v1.5.0, v1.11.1, never-installed) | `tests/migration/fixtures/*/` | Yes |
| Migration helper assertion helpers | `tests/migration/assertions.sh` | Yes |
| Manual smoke test checklist | `tests/smoke/v2.0-smoke-test.md` | Yes |
| Smoke test project | `~/wf-system-test-project/` | No (throwaway) |

Total new files: ~10. Total LOC: ~300 (mostly fixture files, which are tiny).

### 7.9 — Shippability bar for v2.0.0

| Gate | Required to ship? |
|---|---|
| Category 1 (Plugin format) | **Yes** — any failure blocks |
| Category 2 (F1 dedup) | **Yes** — any failure blocks |
| Category 3 (Migration helper, automated tests) | **Yes** — `tests/migration/run-tests.sh` exits 0 |
| Category 4 (Hook parity) | **Yes** — any failure blocks |
| Category 5 (End-to-end smoke) | **Yes** — every step must pass |

**No partial pass.** All five categories. The cost of a buggy v2.0 (angry users, rollback churn, reputation hit) is high; the cost of one extra day of manual testing is low.

### 7.10 — Resolved decisions

| Question | Resolution |
|---|---|
| Minimum bar for shippability | **All 5 categories must pass.** No partial-ship. |
| Manual or scripted | **Both, scoped per category.** Automated for the migration helper (testable in isolation); manual for everything that runs inside Claude Code. |
| Where test projects live | **Migration fixtures: tracked at `tests/migration/fixtures/`. Smoke test project: throwaway at `~/wf-system-test-project/`.** |
| Beta testers vs self-test | **Self-test only.** RC dogfood by maintainer for 3-5 days catches the realistic failure modes. No formal beta program. |

### 7.11 — Out of scope for v2.0

1. **No CI integration.** wf-system has no CI today; v2.0 doesn't introduce one. Tests run manually as part of the release process.
2. **No regression test harness for the commands themselves.** The migration helper is the only thing getting automated tests because it's the only thing that's testable in isolation.
3. **No visual / UX testing of the cockpit event log seam.** It's off by default, ships unused. v2.3+ adds the cockpit and tests it then.
4. **No tests for the brain (`wf-brain`).** Deferred to v2.1.
5. **No load / performance tests.** wf-system has no performance budget today.

### 7.12 — Things flagged

1. **The fixture-creation step is actual work.** Hand-writing v1.0.0/v1.5.0/v1.11.1 fixture trees requires reading the install.sh history. Implementation will need to spend ~1 hour producing these. Flagged but not a design risk.
2. **`tests/migration/fixtures/v1.0.0-fresh-install/` accuracy depends on what install.sh actually produced in v1.0.0.** Trusting the v1.0.0 git history rather than testing against an actual v1.0.0 install. If a discrepancy is found later, fixture gets updated.

---

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Plugin hooks event support is limited and Stop/PostToolUse don't actually work | Verified in docs; §7 Category 1 smoke-tests both events on a real install before v2.0 ships |
| `${CLAUDE_PLUGIN_ROOT}` doesn't propagate to Python script invocations | §7 Category 1 mandates the debug-print verification on day one of implementation, BEFORE writing anything else |
| Migration script breaks user-customized `~/.claude/settings.json` | §5.4 jq surgery + §5.6 dry-run mode + §5.2 backup-by-default; §7 Category 3 has a dedicated test fixture for this case |
| The shared skill becomes a single point of failure for /wf-implement /wf-fix-bug /wf-improve | §7 Category 2 explicitly validates all three modes against a real test project |
| Marketplace.json schema turns out different from what §4.2 assumes | §4 was grounded in context7 fetch of the official schema; re-verify in §7 Category 1 marketplace registration test |
| v2.0 ships without ever validating end-to-end on a clean install | §7 Category 5 (end-to-end smoke test) is a mandatory shippability gate |
| Brain integration in orchestrator hook breaks in M1 (because brain isn't installed) | Already gracefully no-ops at line 322; §7 Category 4 verifies this with the "brain search no-op" test |
| `/plugin marketplace add @branch-ref` may not work for RC dogfood | §7 Category 1 verifies; if it fails, §6.3 needs an alternative RC distribution strategy |
| "Drop progress.md" is acted on prematurely without resolving the concerns above | Recorded in deferred list with explicit "concerns to address first" note |

---

## What was NOT decided in this brainstorming session

Items that intentionally remain out of scope for v2.0 (each has a specified deferral target):

1. The wf-brain plugin's exact boundary — deferred to v2.1 brainstorming
2. The wf-design plugin's exact boundary — deferred to v2.2 brainstorming
3. The wf-cockpit's data-source feasibility — deferred to Project A brainstorming (the cockpit-ready event log seam is in place from §3.5.3)
4. The wf-delegate vs wf-team-delegate duplication audit — deferred to v2.x post-v2.0
5. The wf-brain mandatory + progress.md retirement question — deferred to v3.x with explicit concerns documented in the deferred items list

---

## Methodology

This spec is the output of a structured brainstorming session using the `superpowers:brainstorming` skill. Key decisions were made via 5 multiple-choice questions (Q1-Q5 in the Decision log), each with explicit pro/con analysis and a recommendation. The user agreed to each decision before moving on.

The audit at `docs/2026-04-07-system-audit.md` motivated this work by identifying:
- F1 (highest-leverage finding): duplicate command fragmentation
- F9: stale `install.sh` references (e.g., `/wf-init-project` renamed in v1.1.0)
- General fragmentation of in-flight work

The plugin migration addresses F9 directly, F1 as a forcing function, and reduces fragmentation by establishing a clear plugin boundary model.

The user is matheusslg / Matheus Cavallini, working on multiple professional projects. wf-system is a personal/OSS project. The user explicitly chose "both audiences equal weight" (Q1) which shaped every subsequent decision.

---

## Next steps after this spec

1. **User reviews the spec** as a whole (asked for explicitly after this commit).
2. **Invoke the `writing-plans` skill** to produce a detailed implementation plan from this spec.
3. **Ticket creation** (one ticket per item in the deferred list, against `matheusslg/wf-system`) happens AFTER the implementation plan exists. Use `gh issue create` directly — the github MCP server is disconnected in the user's environment.
4. **Implementation work** happens on the `feature/plugin-migration-v2` branch (NOT this spec branch) per §6.1.
5. **Cutover PR** merges both `docs/plugin-migration-spec` and `feature/plugin-migration-v2` into `main` as a single merge commit.

**Branch context:** this spec lives on `docs/plugin-migration-spec`. The cutover PR will bring both this branch and the implementation branch into `main` together.
