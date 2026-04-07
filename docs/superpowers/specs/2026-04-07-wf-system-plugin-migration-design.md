# wf-system Plugin Migration — Design (v2.0)

**Date:** 2026-04-07
**Status:** DRAFT — sections 1-3.5 complete; sections 4-7 TBD (continue in next session)
**Project:** matheusslg/wf-system
**Target version:** 2.0.0
**Author:** Brainstorming session between Matheus Cavallini and Claude (Opus 4.6)

---

## How to use this document

This is the design spec for migrating wf-system from a `install.sh`-based distribution to the Claude Code Plugins Marketplace format. It is the output of a brainstorming session that ran out of context budget after Section 3.5.

**If you are a Claude Code session continuing this work:**

1. Read this entire document before doing anything else.
2. Sections 1-3.5 are **decided and approved** by the user. Do NOT re-litigate them — they were the product of 5 explicit Q&A rounds. The "Decision log" below has the load-bearing decisions.
3. Sections 4-7 are **outlines only**. Your job is to flesh them out, present each as a section in the brainstorming flow, get user approval per section, then update this spec with the approved content.
4. After Sections 4-7 are approved, run the spec self-review pass (placeholder scan, internal consistency, scope check, ambiguity check) and ask the user to review the updated spec.
5. After spec approval, invoke the `writing-plans` skill to create the implementation plan.
6. Ticket creation (one ticket per deferred item, against matheusslg/wf-system) happens AFTER spec is fully approved. Use `gh issue create` directly — the github MCP server is disconnected in the user's environment.

**The original audit that motivated this work** is at `docs/2026-04-07-system-audit.md`. Read that first if you need context on *why* these decisions were made.

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

A new `.claude-plugin/marketplace.json` lives at the root of `matheusslg/wf-system`. Users install via:

```bash
/plugin install wf-core@matheusslg/wf-system
```

The marketplace name is `matheusslg/wf-system` (the repo path).

### Repository layout (after migration)

```
matheusslg/wf-system/
├── .claude-plugin/
│   └── marketplace.json          # registry: lists wf-core (v2.0) + future plugin slots
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

### Open questions for Section 1

1. **Inter-plugin dependencies:** when wf-brain ships in v2.1, does it `require` wf-core in the manifest, or is it standalone? The orchestrator hook's `_brain_search()` already gracefully no-ops if missing (line 322 of wf-orchestrator.py). My lean: optional dependency. **Verify the manifest format supports `requires` during implementation.**
2. **`claude -p -r <session_id> "/context"` child process:** the orchestrator hook (lines 211-225) shells out to the `claude` binary. Should still work after plugin install (PATH unchanged) but flagged as a fragile interface that could break with Claude Code version updates.

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

The skill becomes a single point of failure: if you break it, all three commands break simultaneously. Currently a bug in `wf-improve.md` only breaks improve. **Mitigation:** testing strategy in Section 7 (TBD) must validate the shared skill before shipping. The win is still net-positive; the failure mode just changes from "three independent ways to drift" to "one coordinated way to break".

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

Plugin docs say plugin hooks merge with user hooks. If a user already has the wf-orchestrator Stop hook in `~/.claude/settings.json` (installed by the old install.sh), both will run after plugin install. **The migration helper script (Section 5 — TBD) must remove the old hook entries from `settings.json` before plugin install.**

### Open question for Section 3

- **Plugin hooks event support:** the plugin format docs list `PreToolUse`, `PostToolUse`, `Stop`, `SessionStart`, `SessionEnd`, `UserPromptSubmit`, `PreCompact`, `Notification`, `SubagentStop` as supported events. wf-orchestrator only uses `PostToolUse` and `Stop` — both confirmed supported. **Smoke-test this end-to-end before declaring v2.0 done.**

---

## Section 3.5 — wf-team-* Commands and Cockpit Reservation (APPROVED)

### 3.5.1 — wf-team-* commands ship in wf-core almost unchanged

Both `wf-team-delegate.md` (1,437 lines) and `wf-team-review.md` (556 lines) go into `plugins/wf-core/commands/`. **No collapse or refactor in v2.0** — the only modification is the additive event-log instrumentation in §3.5.3 (≈10 lines, off by default in `wf-team-delegate.md`). `wf-team-review.md` is byte-identical to today.

Reasoning:

1. Most-used commands per the user → migration risk must be near-zero
2. Use Agent Teams primitives that have only one obvious right implementation — no F1-style duplication problem
3. Drift bugs found in F1 trio are NOT present in the team commands as far as we can see — they have internal consistency

### 3.5.2 — Reserve marketplace slots for `wf-brain` and `wf-cockpit`

Marketplace.json registers future plugins explicitly even though neither ships in v2.0:

```json
{
  "plugins": [
    {
      "name": "wf-core",
      "source": "./plugins/wf-core",
      "status": "stable"
    },
    {
      "name": "wf-brain",
      "source": "./plugins/wf-brain",
      "status": "planned",
      "targetVersion": "2.1"
    },
    {
      "name": "wf-cockpit",
      "source": "./plugins/wf-cockpit",
      "status": "planned",
      "targetVersion": "2.3+"
    }
  ]
}
```

**NOTE:** the `status: "planned"` field is unverified — may need to be expressed differently (e.g., as README documentation + only adding the entry once the plugin is real). Firm this up when writing the actual marketplace.json in Section 4.

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

## Section 4 — Plugin & Marketplace Manifests (TBD — outline only)

**Status:** not yet designed. Continue here in next session.

This section needs to specify:

1. The full content of `plugins/wf-core/.claude-plugin/plugin.json`:
   - `name`: `wf-core`
   - `version`: `2.0.0`
   - `description`: brief
   - `author`: name + email + url (Matheus Cavallini, matheus@gnarlysoft.io, github.com/matheusslg)
   - `repository`: `https://github.com/matheusslg/wf-system`
   - `homepage`: TBD
   - `license`: MIT
   - `keywords`: TBD (sample: workflow, automation, agents, claude-code)
   - `commands`: `./commands` (and possibly `./skills`, `./agents`, `./hooks/hooks.json`, `./.mcp.json` paths if not auto-discovered)
   - **Open question:** does plugin format support a `requires` field for inter-plugin dependencies? Verify via context7 or by looking at the official plugin-dev plugin's manifest.

2. The full content of `.claude-plugin/marketplace.json`:
   - The "planned" status convention from §3.5.2 needs verification
   - May need to be a different shape — query context7 for the official marketplace.json schema
   - Should include marketplace metadata: name, owner, description

3. README rewrite:
   - Replace install.sh instructions with `/plugin install wf-core@matheusslg/wf-system`
   - Document the migration path for old install.sh users (point at the migration helper script)

**Decisions needed in Section 4:**
- Final keyword list for discoverability
- Whether `wf-brain` and `wf-cockpit` slots appear in marketplace.json from day one as "planned" or only when they ship
- Whether plugin.json's `commands` field needs to explicitly list paths or auto-discovers

---

## Section 5 — Migration Helper Script (TBD — outline only)

**Status:** not yet designed. Continue here in next session.

A `scripts/migrate-to-plugin.sh` script that runs once for existing install.sh users.

What it must do:

1. Detect existing install.sh installation (look for `~/.claude/hooks/.wf-version` or `~/.claude/commands/wf-*.md`)
2. Remove old wf-system files:
   - `rm -rf ~/.claude/hooks/wf-orchestrator.py`
   - `rm -f ~/.claude/hooks/.wf-version ~/.claude/hooks/.wf-source ~/.claude/hooks/.wf-install-mode ~/.claude/hooks/.wf-last-check ~/.claude/hooks/.wf-update-available`
   - `rm -f ~/.claude/commands/wf-*.md` (only files that match the wf-system pattern; check carefully so we don't delete user customizations)
   - `rm -rf ~/.claude/scripts/wf-brain ~/.claude/scripts/wf-brain.js ~/.claude/mcp-servers/wf-brain` (the old brain installation)
3. **Surgically remove the wf-orchestrator hook entries from `~/.claude/settings.json`** (NOT delete the whole file — only the wf-system entries). This is the trickiest part. Use `jq` to filter out the wf-orchestrator Stop and PostToolUse hooks, write back.
4. Print clear next steps: "Now run `/plugin install wf-core@matheusslg/wf-system` from Claude Code"
5. Optionally back up the old config to `~/.claude/wf-system-backup-{timestamp}/` before deleting (safety net)
6. Idempotent — running it twice should not cause errors

**Decisions needed in Section 5:**
- Should the script back up before deleting, or just delete?
- How aggressive to be about detecting "this is an old wf-system install" vs "this is something else with a wf- prefix"?
- Should the script be POSIX sh or bash-only?
- Should it have a `--dry-run` mode?

---

## Section 6 — Release Process (TBD — outline only)

**Status:** not yet designed. Continue here in next session.

What this section needs to cover:

1. **Branch strategy:**
   - This spec is on `docs/plugin-migration-spec` branch
   - Implementation work on `feature/plugin-migration-v2`?
   - Final cutover via PR to `main`
2. **Versioning:**
   - Bump VERSION file to `2.0.0`
   - Tag as `v2.0.0`
   - Last install.sh release should be tagged `v1.10.x` (whatever the current tip is) with a note "final install.sh release"
3. **CHANGELOG.md entry:**
   - Major heading for v2.0.0
   - "BREAKING CHANGES" section listing the install.sh removal
   - "Added", "Changed", "Removed", "Fixed" sections
   - Migration instructions (or link to them)
4. **Release announcement:**
   - GitHub release notes
   - README update
   - Anywhere else wf-system is referenced
5. **Smoke test before tagging:**
   - The testing strategy from Section 7 must pass
   - Manual end-to-end test: install plugin in a fresh Claude Code, run the daily loop
6. **Rollback plan:**
   - If v2.0 has critical issues post-release, what's the rollback story?
   - Old install.sh tag remains accessible — users can git checkout v1.10.x and run install.sh

**Decisions needed in Section 6:**
- Pre-release / RC versions before v2.0.0?
- Should the migration helper be tested against multiple historical install.sh versions?

---

## Section 7 — Testing & Validation (TBD — outline only)

**Status:** not yet designed. **This is the most decision-heavy of the remaining sections** — handle with care in the next session.

What this section needs to cover:

1. **Plugin format validation:**
   - Does `${CLAUDE_PLUGIN_ROOT}` resolve correctly inside Python script invocations?
   - Does `hooks/hooks.json` actually fire the hook on PostToolUse and Stop events?
   - Does the `.mcp.json` MCP server path work the same as a standalone install? (Not v2.0 since wf-brain is deferred, but for v2.1 readiness)
2. **F1 dedup validation:**
   - The shared skill is a single point of failure (Section 2's flagged risk). How do we test it without breaking things?
   - Test all three modes (`feature`, `bug`, `improve`) end-to-end against a real test project
   - Verify Branch Safety check fires for ALL three modes (was missing in fix-bug/improve)
   - Verify GitHub issue updates fire for ALL three modes (was missing in improve)
3. **Migration helper validation:**
   - Test against a fresh install.sh installation
   - Test against a partially-broken install.sh installation
   - Test the `~/.claude/settings.json` jq surgery doesn't break user-customized hooks
4. **Hook behavior parity:**
   - Compare plugin-installed hook behavior against current install.sh hook behavior
   - Context monitoring still triggers
   - WIP detection still works
   - Stop sound (gated to macOS) still plays
5. **Smoke test in fresh Claude Code:**
   - Empty project
   - `/plugin install wf-core@matheusslg/wf-system`
   - `/wf-init`
   - `/wf-start-session`
   - `/wf-implement "Add hello world endpoint"`
   - `/wf-commit`
   - `/wf-end-session`
   - All should work end-to-end without errors

**Decisions needed in Section 7:**
- What's the minimum bar for "v2.0 is shippable"? Pass all 5 above? Subset?
- Manual smoke test, or scripted? wf-system has no automated test suite (per the audit's standards.md note "Test commands manually by running them in a test project") — should v2.0 introduce one?
- Where do test projects live? Disposable? Tracked in repo?
- Beta testers, or just user self-testing?

---

## Risks & open questions

| Risk | Mitigation |
|---|---|
| Plugin hooks event support is limited and Stop/PostToolUse don't actually work | Verified in docs; smoke test before declaring v2.0 done |
| `${CLAUDE_PLUGIN_ROOT}` doesn't propagate to Python script invocations | Smoke test by adding `print(os.environ.get("CLAUDE_PLUGIN_ROOT"))` in the hook on first invocation |
| Migration script breaks user-customized `~/.claude/settings.json` | jq surgery + dry-run mode + backup before deletion |
| The shared skill becomes a single point of failure for /wf-implement /wf-fix-bug /wf-improve | Section 7 testing strategy must validate all three modes |
| Marketplace.json schema differs from what Section 3.5.2 assumes | Verify schema in Section 4 implementation; adjust if needed |
| v2.0 ships without ever validating end-to-end on a clean install | Section 7 smoke test is mandatory |
| Brain integration in orchestrator hook breaks in M1 (because brain isn't installed) | Already gracefully no-ops at line 322; no action needed for v2.0 |
| "Drop progress.md" is acted on prematurely without resolving the concerns above | Recorded in deferred list with explicit "concerns to address first" note |

---

## What was NOT decided in this brainstorming session

Listed for the next session's awareness:

1. The actual JSON content of `plugin.json` and `marketplace.json` (Section 4)
2. The migration helper script content (Section 5)
3. Branch / version / CHANGELOG strategy (Section 6)
4. Testing strategy and shippability bar (Section 7)
5. Whether to introduce automated tests as part of v2.0 or defer
6. The wf-brain plugin's exact boundary (deferred to v2.1 brainstorming)
7. The wf-design plugin's exact boundary (deferred to v2.2 brainstorming)
8. The wf-cockpit's data-source feasibility (deferred to Project A brainstorming)
9. Whether the `commands` field in plugin.json auto-discovers or needs explicit paths
10. Whether `requires` field exists for inter-plugin dependencies

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

## For the next Claude Code session continuing this work

**Your immediate next steps:**

1. Read this entire spec start to finish before doing anything.
2. Read the audit at `docs/2026-04-07-system-audit.md` for context.
3. Resume the brainstorming flow at Section 4 (Plugin & Marketplace Manifests).
4. Use the `superpowers:brainstorming` skill if not already loaded.
5. Present each remaining section (4, 5, 6, 7) one at a time, asking for user approval after each — same pattern as Sections 1-3.5 in this conversation.
6. When approval lands for all sections, run the spec self-review pass (placeholder scan, internal consistency, scope check, ambiguity check). Update this spec inline.
7. Ask the user to review the updated spec.
8. After spec approval, invoke the `writing-plans` skill to create the implementation plan.
9. Ticket creation (one ticket per item in the deferred list) happens AFTER the implementation plan exists. Use `gh issue create` against `matheusslg/wf-system` directly (the github MCP server is disconnected in this user's environment per a system reminder). Each ticket should reference back to the spec section it came from.

**What you should NOT do:**

1. Re-litigate decisions from Sections 1-3.5. They're settled. If you genuinely think one is wrong, raise it as a flag — don't silently change it.
2. Spawn multiple parallel agents to "speed up" the remaining sections. Each section needs human approval; parallel work creates merge conflicts.
3. Start implementation. The brainstorming flow ends with `writing-plans`, not with code changes.
4. Create GitHub tickets before spec approval.
5. Push to remote or merge to main. The user must explicitly authorize these.

**Branch context:** this spec was written on the `docs/plugin-migration-spec` branch. Continue work on the same branch unless the user says otherwise.
