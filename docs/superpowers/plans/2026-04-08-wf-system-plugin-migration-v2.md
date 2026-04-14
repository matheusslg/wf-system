# wf-system Plugin Migration v2.0 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate wf-system from a 238-line `install.sh` distribution to the Claude Code Plugins Marketplace format, ship as v2.0.0, and collapse the `/wf-implement`, `/wf-fix-bug`, `/wf-improve` F1 trio into a single shared `wf-dev-pipeline` skill with three thin command shims.

**Architecture:** One plugin (`wf-core`) under `plugins/wf-core/` with auto-discovered `commands/`, `agents/`, `skills/`, and `hooks/hooks.json`. A root `.claude-plugin/marketplace.json` registers the marketplace. The orchestrator Python hook self-locates via `${CLAUDE_PLUGIN_ROOT}`. A one-shot `scripts/migrate-to-plugin.sh` helper cleans up old `install.sh` state for v1.x users.

**Tech Stack:** Claude Code Plugin format, Python 3 (existing orchestrator hook), Bash 3.2+ / jq (migration helper), Markdown (commands + skills), JSON (manifests).

**Spec:** `docs/superpowers/specs/2026-04-07-wf-system-plugin-migration-design.md` (authoritative — when in doubt, re-read)

**Audit:** `docs/2026-04-07-system-audit.md` (motivation)

---

## Ground rules

1. **Never commit to `main`.** All work lands on `feature/plugin-migration-v2`. Cutover PR at the end.
2. **Every code/content task ends with a commit** using Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`).
3. **Never use `git add -A` / `git add .`** — stage files explicitly.
4. **Do not push to remote** unless the task explicitly says so.
5. **For migration helper work (Phase D), follow TDD strictly.** For everything else, use explicit manual verification steps — most of the work is config/content that cannot be unit-tested.
6. **KISS.** Resist scope creep. If a step isn't listed, don't do it. Changes outside the spec go in a `deferred.md` file at the branch root to be triaged later.

---

## File Structure (end state after plan completes)

```
wf-system/
├── .claude-plugin/
│   └── marketplace.json               # NEW — root marketplace registry
├── plugins/
│   └── wf-core/                        # NEW — the v2.0 plugin
│       ├── .claude-plugin/
│       │   └── plugin.json             # NEW
│       ├── commands/                   # MOVED from wf-system/commands/ + shims rewritten
│       │   ├── wf-implement.md         # REWRITTEN as ~12-line shim
│       │   ├── wf-fix-bug.md           # REWRITTEN as ~12-line shim
│       │   ├── wf-improve.md           # REWRITTEN as ~12-line shim
│       │   └── ... (30 total, others unchanged except wf-team-delegate.md)
│       ├── agents/                     # MOVED from wf-system/templates/agents/
│       ├── skills/                     # MOVED from wf-system/.claude/skills/ (minus match-figma)
│       │   └── wf-dev-pipeline/        # NEW — shared dev pipeline skill
│       │       └── SKILL.md
│       ├── hooks/
│       │   └── hooks.json              # NEW — plugin-format hook config
│       ├── scripts/
│       │   └── wf-orchestrator.py      # MOVED + MODIFIED from wf-system/hooks/
│       └── README.md                   # NEW — plugin-level readme (thin)
├── scripts/
│   ├── migrate-to-plugin.sh            # NEW — one-shot migration helper
│   └── bump-version.sh                 # NEW — lockstep version bumper
├── tests/
│   ├── migration/                      # NEW — migration helper test harness
│   │   ├── run-tests.sh
│   │   ├── assertions.sh
│   │   └── fixtures/
│   │       ├── v1.11.1-fresh-install/
│   │       ├── v1.5.0-fresh-install/
│   │       ├── v1.0.0-fresh-install/
│   │       └── never-installed/
│   └── smoke/
│       └── v2.0-smoke-test.md          # NEW — manual smoke checklist
├── docs/
│   └── v2.0-rollback.md                # NEW — user + maintainer rollback guide
├── CHANGELOG.md                        # MODIFIED — v2.0.0 entry added
├── README.md                           # REWRITTEN — plugin install flow
├── LICENSE                             # NEW — MIT text
└── VERSION                             # MODIFIED — 1.11.1 → 2.0.0

DELETED:
├── install.sh
├── uninstall.sh
├── templates/settings-hooks.json       # (templates/ dir may still hold workflow.json.example + progress.md.example — keep those)
└── hooks/                              # entire dir removed after content moves
```

---

## Phase A — Pre-flight verification & scaffolding

### Task 1: Verify `${CLAUDE_PLUGIN_ROOT}` propagates to Python hooks

**Why first:** §7 Category 1 calls this "the riskiest unknown" and mandates day-one verification. If the env var does NOT reach the Python child process, the entire plan is invalid and the plugin format isn't viable for wf-system without a workaround.

**Files:**
- Create (throwaway): `~/wf-plugin-probe/.claude-plugin/plugin.json`
- Create (throwaway): `~/wf-plugin-probe/scripts/probe.py`
- Create (throwaway): `~/wf-plugin-probe/hooks/hooks.json`
- Create (throwaway, sibling): `~/wf-plugin-probe-marketplace/.claude-plugin/marketplace.json`

- [ ] **Step 1: Create a minimal throwaway plugin tree**

```bash
mkdir -p ~/wf-plugin-probe/.claude-plugin
mkdir -p ~/wf-plugin-probe/scripts
mkdir -p ~/wf-plugin-probe/hooks
mkdir -p ~/wf-plugin-probe-marketplace/.claude-plugin
```

- [ ] **Step 2: Write the probe Python script**

File: `~/wf-plugin-probe/scripts/probe.py`

```python
#!/usr/bin/env python3
import os, sys
root = os.environ.get("CLAUDE_PLUGIN_ROOT", "MISSING")
print(f"[probe] CLAUDE_PLUGIN_ROOT={root}", file=sys.stderr)
sys.exit(0)
```

Then: `chmod +x ~/wf-plugin-probe/scripts/probe.py`

- [ ] **Step 3: Write `~/wf-plugin-probe/.claude-plugin/plugin.json`**

```json
{
  "name": "wf-plugin-probe",
  "version": "0.0.1",
  "description": "Throwaway plugin to verify CLAUDE_PLUGIN_ROOT propagation"
}
```

- [ ] **Step 4: Write `~/wf-plugin-probe/hooks/hooks.json`**

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "python3 ${CLAUDE_PLUGIN_ROOT}/scripts/probe.py",
            "timeout": 5000
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 5: Write `~/wf-plugin-probe-marketplace/.claude-plugin/marketplace.json`**

```json
{
  "name": "wf-plugin-probe",
  "owner": {
    "name": "Matheus Cavallini",
    "email": "matheus@gnarlysoft.io"
  },
  "metadata": {
    "description": "Probe marketplace",
    "version": "0.0.1"
  },
  "plugins": [
    {
      "name": "wf-plugin-probe",
      "source": "../wf-plugin-probe",
      "description": "Probe plugin"
    }
  ]
}
```

- [ ] **Step 6: Install the probe plugin via local filesystem marketplace**

Open a new Claude Code session. Run:

```
/plugin marketplace add ~/wf-plugin-probe-marketplace
/plugin install wf-plugin-probe@wf-plugin-probe
```

Restart if prompted.

- [ ] **Step 7: Trigger any tool use to fire PostToolUse and observe stderr**

In the restarted Claude Code session, run any tool that produces a PostToolUse event (e.g., a simple `ls` via Bash). Check the hook stderr output (via Claude Code's hook debug facility or by adding `>> /tmp/probe.log 2>&1` to the command in `hooks.json` and re-installing if necessary).

**Expected:** stderr contains `[probe] CLAUDE_PLUGIN_ROOT=<absolute path to ~/wf-plugin-probe>` (NOT `MISSING`).

- [ ] **Step 8: Record the result**

**If PASS** (`${CLAUDE_PLUGIN_ROOT}` resolves correctly): proceed to Task 2.

**If FAIL** (env var is `MISSING` or empty): STOP the plan. The orchestrator hook cannot self-locate. Open an issue on `matheusslg/wf-system` titled "Day-1 blocker: CLAUDE_PLUGIN_ROOT does not propagate to Python hooks" and report the finding to the user before continuing.

- [ ] **Step 9: Uninstall the probe and clean up**

```bash
# In Claude Code:
/plugin uninstall wf-plugin-probe@wf-plugin-probe
/plugin marketplace remove wf-plugin-probe
# Then in shell:
rm -rf ~/wf-plugin-probe ~/wf-plugin-probe-marketplace
```

No commit for this task — the probe is throwaway and outside the repo.

---

### Task 2: Create feature branch, tag the v1.x rollback point, and scaffold directories

**Files:**
- No file edits; pure git + `mkdir`
- Will later populate: `plugins/wf-core/.claude-plugin/`, `plugins/wf-core/commands/`, etc.

- [ ] **Step 1: Confirm current branch is clean**

```bash
cd ~/wf-system
git status
```

Expected: branch is `docs/plugin-migration-spec` (where the spec lives) with no unrelated uncommitted changes. If dirty, investigate before proceeding.

- [ ] **Step 2: Create the v1.11.1 rollback tag FROM the tip of `main`, not the spec branch**

```bash
git fetch origin main
git tag v1.11.1-final-installer origin/main
git push origin v1.11.1-final-installer
```

This tag must live on a clean v1.x commit so users on v1.x can `git checkout v1.11.1-final-installer && ./install.sh` to roll back.

- [ ] **Step 3: Create and switch to the feature branch**

```bash
git checkout -b feature/plugin-migration-v2
```

From now on, ALL implementation commits land on this branch. The spec branch `docs/plugin-migration-spec` is frozen.

- [ ] **Step 4: Scaffold the plugin directory tree**

```bash
mkdir -p plugins/wf-core/.claude-plugin
mkdir -p plugins/wf-core/commands
mkdir -p plugins/wf-core/agents
mkdir -p plugins/wf-core/skills/wf-dev-pipeline
mkdir -p plugins/wf-core/hooks
mkdir -p plugins/wf-core/scripts
mkdir -p .claude-plugin
mkdir -p tests/migration/fixtures
mkdir -p tests/smoke
```

- [ ] **Step 5: Create `.gitkeep` files to track empty dirs**

```bash
touch plugins/wf-core/commands/.gitkeep
touch plugins/wf-core/agents/.gitkeep
touch plugins/wf-core/skills/.gitkeep
touch plugins/wf-core/hooks/.gitkeep
touch plugins/wf-core/scripts/.gitkeep
touch tests/migration/fixtures/.gitkeep
```

- [ ] **Step 6: Commit scaffolding**

```bash
git add plugins/wf-core/ .claude-plugin/ tests/
git commit -m "chore(v2): scaffold plugin directory structure"
```

---

### Task 3: Create `plugin.json` and `marketplace.json` manifests

**Files:**
- Create: `plugins/wf-core/.claude-plugin/plugin.json`
- Create: `.claude-plugin/marketplace.json`

- [ ] **Step 1: Write `plugins/wf-core/.claude-plugin/plugin.json`**

Exact content (from spec §4.1):

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

No `commands`, `agents`, `skills`, `hooks`, or `mcpServers` fields — all auto-discovered from the standard paths.

- [ ] **Step 2: Validate the JSON**

```bash
python3 -m json.tool plugins/wf-core/.claude-plugin/plugin.json > /dev/null
```

Expected: exits 0 with no output. Any syntax error → fix before proceeding.

- [ ] **Step 3: Write `.claude-plugin/marketplace.json`**

Exact content (from spec §4.2):

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

Marketplace `name` MUST be kebab-case (`wf-system`), not `matheusslg/wf-system`. The github shorthand is only used in `/plugin marketplace add`.

- [ ] **Step 4: Validate the JSON**

```bash
python3 -m json.tool .claude-plugin/marketplace.json > /dev/null
```

- [ ] **Step 5: Commit**

```bash
git add plugins/wf-core/.claude-plugin/plugin.json .claude-plugin/marketplace.json
git commit -m "feat(v2): add plugin.json and marketplace.json manifests"
```

---

### Task 4: Add the MIT LICENSE file

**Why:** README already has an MIT badge but no actual LICENSE file exists. Spec §4.4 flags this as a defect to fix in v2.0.

**Files:**
- Create: `LICENSE`

- [ ] **Step 1: Write the LICENSE file**

File: `LICENSE`

```
MIT License

Copyright (c) 2025-2026 Matheus Cavallini

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 2: Commit**

```bash
git add LICENSE
git commit -m "fix(legal): add missing LICENSE file (MIT)"
```

---

## Phase B — Plugin content migration

### Task 5: Copy all 30 command files into the plugin

**Files:**
- Move: `commands/*.md` → `plugins/wf-core/commands/*.md` (all 30 files)

**Note:** `wf-design-setup.md` and `wf-match-figma.md` are technically for the deferred `wf-design` plugin. Per spec §1, however, **everything currently in use** ships in v2.0 except brain and figma-specific artifacts. Re-check the decision:
- `wf-match-figma.md` **does NOT ship in v2.0** (figma is deferred to v2.2)
- `wf-design-setup.md` **does NOT ship in v2.0** (same reason)
- `wf-brain-review.md` **does NOT ship in v2.0** (brain is deferred to v2.1)

That leaves **30 commands** to ship out of the 33 in `commands/` today.

- [ ] **Step 1: Copy the 30 commands that ship with wf-core**

```bash
cd ~/wf-system
# Explicit list of files that ship in v2.0 (per spec §1)
for f in \
  wf-ai-qa.md \
  wf-breakdown.md \
  wf-commit.md \
  wf-create-agent.md \
  wf-create-prd.md \
  wf-create-ticket.md \
  wf-debug.md \
  wf-delegate.md \
  wf-e2e.md \
  wf-end-session.md \
  wf-fix-bug.md \
  wf-generate.md \
  wf-implement.md \
  wf-improve.md \
  wf-init.md \
  wf-investigate.md \
  wf-overview.md \
  wf-parse-prd.md \
  wf-pick-issue.md \
  wf-pr-comments.md \
  wf-pre-prod-review.md \
  wf-qa-plan.md \
  wf-refactor.md \
  wf-review.md \
  wf-start-session.md \
  wf-team-delegate.md \
  wf-team-review.md \
  wf-test.md \
  wf-ticket-status.md \
  wf-update.md
do
  cp commands/$f plugins/wf-core/commands/$f
done
```

- [ ] **Step 2: Verify 30 files copied**

```bash
ls plugins/wf-core/commands/*.md | wc -l
```

Expected: `30` (plus `.gitkeep` remains — delete it now):

```bash
rm plugins/wf-core/commands/.gitkeep
```

- [ ] **Step 3: Diff a sample file against the original to verify byte-identical copy**

```bash
diff commands/wf-start-session.md plugins/wf-core/commands/wf-start-session.md && echo "IDENTICAL"
```

Expected: `IDENTICAL` (no diff output).

- [ ] **Step 4: Commit**

```bash
git add plugins/wf-core/commands/
git commit -m "feat(v2): copy 30 wf-core commands into plugin"
```

**Do NOT delete the originals in `commands/` yet.** They are deleted in Task 23 after the plugin structure is verified. Keeping both ensures we can diff and rollback quickly during early development.

---

### Task 6: Copy agent templates into the plugin

**Files:**
- Move: `templates/agents/*.md` → `plugins/wf-core/agents/*.md`

- [ ] **Step 1: Copy agent templates**

```bash
cp templates/agents/*.md plugins/wf-core/agents/
rm plugins/wf-core/agents/.gitkeep
ls plugins/wf-core/agents/
```

Expected: `backend-developer.md  fullstack-developer.md  generic-developer.md  reviewer.md  ui-developer.md`

- [ ] **Step 2: Commit**

```bash
git add plugins/wf-core/agents/
git commit -m "feat(v2): copy agent templates into plugin"
```

---

### Task 7: Copy project skills into the plugin (minus match-figma)

**Files:**
- Copy: `.claude/skills/<name>/SKILL.md` → `plugins/wf-core/skills/<name>/SKILL.md`
- **Exclude:** `match-figma/` (deferred to `wf-design` v2.2)

- [ ] **Step 1: Inventory skills**

```bash
ls .claude/skills/
```

Expected: `agent-browser  cmd-list  gh-issues  gh-pr  match-figma  py-check  sync-commands  visual-verify`

- [ ] **Step 2: Copy the 7 wf-core skills (not match-figma)**

```bash
for skill in agent-browser cmd-list gh-issues gh-pr py-check sync-commands visual-verify; do
  mkdir -p plugins/wf-core/skills/$skill
  cp -r .claude/skills/$skill/* plugins/wf-core/skills/$skill/
done
rm plugins/wf-core/skills/.gitkeep
ls plugins/wf-core/skills/
```

Expected: `agent-browser  cmd-list  gh-issues  gh-pr  py-check  sync-commands  visual-verify  wf-dev-pipeline` (the `wf-dev-pipeline` dir was created in Task 2 and is still empty).

- [ ] **Step 3: Commit**

```bash
git add plugins/wf-core/skills/
git commit -m "feat(v2): copy 7 project skills into plugin (match-figma deferred to v2.2)"
```

---

### Task 8: Create plugin-format `hooks/hooks.json`

**Files:**
- Create: `plugins/wf-core/hooks/hooks.json`

- [ ] **Step 1: Write `plugins/wf-core/hooks/hooks.json`**

Exact content (from spec §3):

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

Difference from old `templates/settings-hooks.json`: `~/.claude/hooks/wf-orchestrator.py` → `${CLAUDE_PLUGIN_ROOT}/scripts/wf-orchestrator.py`. Events, matchers, and timeouts are unchanged.

- [ ] **Step 2: Validate JSON**

```bash
python3 -m json.tool plugins/wf-core/hooks/hooks.json > /dev/null
```

- [ ] **Step 3: Commit**

```bash
rm plugins/wf-core/hooks/.gitkeep
git add plugins/wf-core/hooks/hooks.json
git commit -m "feat(v2): add plugin-format hooks.json"
```

---

### Task 9: Move and modify `wf-orchestrator.py` for plugin format

**Files:**
- Move + modify: `hooks/wf-orchestrator.py` → `plugins/wf-core/scripts/wf-orchestrator.py`

This task has ~6 discrete modifications. Each is its own commit so any rollback is surgical.

- [ ] **Step 1: Copy the file into its new location**

```bash
cp hooks/wf-orchestrator.py plugins/wf-core/scripts/wf-orchestrator.py
rm plugins/wf-core/scripts/.gitkeep
```

- [ ] **Step 2: Replace the `HOOKS_DIR` hardcode with `CLAUDE_PLUGIN_ROOT`**

In `plugins/wf-core/scripts/wf-orchestrator.py`, find line 42:

```python
HOOKS_DIR = Path(os.path.expanduser("~/.claude/hooks"))
```

Replace with:

```python
# Plugin self-locates via the Claude Code plugin env var.
_PLUGIN_ROOT = os.environ.get("CLAUDE_PLUGIN_ROOT")
if _PLUGIN_ROOT:
    PLUGIN_ROOT = Path(_PLUGIN_ROOT)
else:
    # Fallback so the script is still runnable outside a plugin context (e.g., tests)
    PLUGIN_ROOT = Path(__file__).resolve().parent.parent
```

Note: the rest of this task DELETES the only consumer of `HOOKS_DIR`, so the old name no longer needs to exist.

- [ ] **Step 3: Move the state directory out of `~/.claude/hooks/`**

Find line 35:

```python
STATE_DIR = Path(os.path.expanduser("~/.claude/hooks/.wf-state"))
```

Replace with:

```python
STATE_DIR = Path(os.path.expanduser("~/.wf-state"))
```

Per spec §3, state should survive plugin reinstalls.

- [ ] **Step 4: Delete the entire version-check subsystem**

Delete the following ranges:

1. Lines around 39-42 (the `UPDATE_CHECK_INTERVAL` + `VERSION_URL` constants). Find them:

```python
# Update check configuration
UPDATE_CHECK_INTERVAL = 86400  # 24 hours in seconds
VERSION_URL = "https://raw.githubusercontent.com/matheusslg/wf-system/main/VERSION"
```

Delete these 3 lines. Also delete the `_PLUGIN_ROOT`-block's surrounding blank lines only if they become duplicated.

2. The entire `check_for_updates` method (~45 LOC, starts at `def check_for_updates(self) -> None:`). Delete the method definition and its body, plus the preceding `_version_compare` helper if it has no other callers.

Verify `_version_compare` has no other callers first:

```bash
grep -n "_version_compare" plugins/wf-core/scripts/wf-orchestrator.py
```

If the only matches are the definition and a call from `check_for_updates`, delete both.

3. The call to `self.check_for_updates()` (currently around line 682). Find and delete that single line.

4. Any import that is now unused (`urllib.request`, `time` if no other users). Verify:

```bash
grep -n "urllib\|time\." plugins/wf-core/scripts/wf-orchestrator.py
```

Delete `import urllib.request` if no remaining usage. Leave `time` alone unless there are zero other uses.

5. Any stray references to `.wf-last-check`, `.wf-update-available`, or `.wf-version`. Verify:

```bash
grep -n "wf-last-check\|wf-update-available\|wf-version" plugins/wf-core/scripts/wf-orchestrator.py
```

Expected after cleanup: **zero matches**.

- [ ] **Step 5: Gate the `afplay` call behind `sys.platform == "darwin"`**

Find line ~617:

```python
        try:
            subprocess.Popen(
                ["afplay", "/System/Library/Sounds/Glass.aiff"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
        except Exception:
            pass
```

Replace with:

```python
        if sys.platform == "darwin":
            try:
                subprocess.Popen(
                    ["afplay", "/System/Library/Sounds/Glass.aiff"],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )
            except Exception:
                pass
```

- [ ] **Step 6: Run the script in isolation to catch syntax errors**

```bash
python3 -c "import ast; ast.parse(open('plugins/wf-core/scripts/wf-orchestrator.py').read()); print('OK')"
```

Expected: `OK`

Then dry-run the module compile:

```bash
python3 -m py_compile plugins/wf-core/scripts/wf-orchestrator.py && echo "COMPILES"
```

Expected: `COMPILES`

- [ ] **Step 7: Commit the orchestrator changes**

```bash
git add plugins/wf-core/scripts/wf-orchestrator.py
git commit -m "refactor(v2): port orchestrator to plugin format

- Self-locate via \${CLAUDE_PLUGIN_ROOT}
- Move state dir from ~/.claude/hooks/.wf-state/ to ~/.wf-state/
- Delete version-check subsystem (~50 LOC) — /plugin update replaces it
- Gate afplay behind sys.platform == darwin (silent on Linux/Windows)"
```

**Do NOT delete the old `hooks/wf-orchestrator.py`** yet — that happens in Task 23 when we confirm the plugin loads correctly.

---

### Task 10: Manually smoke-test the plugin installs and hooks fire

**Why here:** We need to verify the plugin loads BEFORE investing effort in the F1 dedup (Phase C), because if there's a fundamental structural problem we want to know now, not after rewriting 3 commands.

- [ ] **Step 1: Temporarily install the plugin from the local repo as a marketplace**

```bash
# In Claude Code:
/plugin marketplace add ~/wf-system
/plugin install wf-core@wf-system
```

Restart if prompted.

- [ ] **Step 2: Verify command autocomplete**

Type `/wf-` in the Claude Code prompt and check the autocomplete list shows all 30 wf commands.

- [ ] **Step 3: Trigger PostToolUse and verify the orchestrator fires**

Run a trivial Bash command via Claude Code (e.g., `ls`). Check that the orchestrator context monitor counter ticks (you should see its PostToolUse output in the Claude Code hook debug output, or observe `~/.wf-state/` being created).

```bash
# In shell:
ls -la ~/.wf-state/ 2>/dev/null && echo "STATE DIR EXISTS"
```

- [ ] **Step 4: If anything broken, fix and re-install the plugin**

Bugs at this step are almost always in Task 8 (hooks.json) or Task 9 (orchestrator edits). Fix and commit separately, then re-install with `/plugin uninstall` + `/plugin install`.

- [ ] **Step 5: Uninstall the plugin and remove the local marketplace**

```
/plugin uninstall wf-core@wf-system
/plugin marketplace remove wf-system
```

No commit for this task — it's a verification gate.

---

## Phase C — F1 dedup

### Task 11: Create the `wf-dev-pipeline` shared skill

**Files:**
- Create: `plugins/wf-core/skills/wf-dev-pipeline/SKILL.md`

- [ ] **Step 1: Read the three current command files to extract the shared logic**

```bash
wc -l commands/wf-implement.md commands/wf-fix-bug.md commands/wf-improve.md
```

Expected: 448 / 434 / 356 lines.

- [ ] **Step 2: Write `plugins/wf-core/skills/wf-dev-pipeline/SKILL.md`**

Target length: ~350 lines. Structure (from spec §2):

```markdown
---
name: wf-dev-pipeline
description: Shared developer pipeline used by /wf-implement, /wf-fix-bug, and /wf-improve. Handles branch safety, context gathering, agent delegation, review/QA loops, issue updates, and progress logging.
---

# wf-dev-pipeline

You are the **wf-system dev pipeline**. Three commands (`/wf-implement`,
`/wf-fix-bug`, `/wf-improve`) share your logic. The calling command tells you
which mode to run in: `feature`, `bug`, or `improve`.

## Mode table

| Mode      | Verb      | Mission steps                                          | Commit prefix | Progress header        | Issue comment title      |
|-----------|-----------|--------------------------------------------------------|---------------|------------------------|--------------------------|
| feature   | Implement | Design / Create / Integrate / Test / Document          | feat:         | ### Implementation:    | Feature Implemented      |
| bug       | Fix       | Locate / Understand / Fix / Test / Verify              | fix:          | ### Bug Fix:           | Bug Fixed                |
| improve   | Improve   | Analyze / Plan / Implement / Test / Verify             | improve:      | ### Improvement:       | Improvement Complete     |

Whenever the pipeline output refers to "the verb", "the prefix", "the header",
or "the title", substitute from this table.

## ⛔ CRITICAL: ORCHESTRATOR BOUNDARIES

[full block from commands/wf-implement.md lines 12-29, mode-agnostic]

## ⛔ CRITICAL: Branch Safety

[full block from commands/wf-implement.md lines 33-41 — applies to ALL modes,
fixing the drift bug where wf-fix-bug and wf-improve omitted it]

## 0. Load Configuration

[from commands/wf-implement.md Section 0 — identical across modes]

## 1. Understand the Work

[merged from the three "Understand the ..." sections]

### If issue number
[gh issue fetch + comments — from wf-implement §1]

### If description
[parse description — from wf-implement §1]

## 2. Gather Context

[from wf-implement §2 — read progress.md, grep for similar patterns]

## 3. Determine Responsible Agent

[auto-detection table from wf-implement §3, plus the extra "Cannot Determine
Agent" error handler from wf-fix-bug.md — fixing drift bug #2]

## 4. Prepare Context Block

[from wf-implement §4 — verb and mission steps come from the mode table above]

## 5. Spawn Developer Agent

[from wf-implement §5 — plus the "Agent Failed" error handler from
wf-fix-bug.md, fixing drift bug #2]

## 6. Pipeline: Code Review

[from wf-implement §6 — loop back on CHANGES_REQUESTED]

## 7. Pipeline: QA Validation

[from wf-implement §7 — loop back on FAILED]

## 8. Update GitHub Issue

[from wf-implement §8 — applied to ALL modes, fixing drift bug #3 in wf-improve]

Comment title uses "the title" from the mode table.

## 9. Update Progress

[from wf-implement §9 — 450-line archive check + entry using "the header"]

## 10. Report Results

[from wf-implement §10 — suggested commit prefix comes from "the prefix"]

## Error Handling

### No Agents Available
[merged error block]

### Full-Stack Feature
[merged error block]

### Cannot Determine Agent
[from wf-fix-bug.md — fixing drift]

### Agent Failed
[from wf-fix-bug.md — fixing drift]

## Related Commands
- /wf-implement, /wf-fix-bug, /wf-improve (shims that call this skill)
- /wf-delegate, /wf-commit, /wf-test
```

**Fill in each bracketed section with the actual content** from the current command files. Do NOT leave bracketed placeholders in the committed file. Use `wf-implement.md` as the canonical base and merge in the unique bits from `wf-fix-bug.md` (extra error handlers) and ensure all sections apply to all three modes (don't hardcode "Implement" anywhere — always use "the verb").

- [ ] **Step 3: Verify the skill file is coherent**

```bash
wc -l plugins/wf-core/skills/wf-dev-pipeline/SKILL.md
```

Expected: ~350 lines (spec §2 LOC accounting).

Search for mode-specific leftover text:

```bash
grep -n -E "Implement|Fix|Improve" plugins/wf-core/skills/wf-dev-pipeline/SKILL.md | grep -v "the verb\|the prefix\|the header\|the title\|mode table"
```

Review every match. Any remaining mode-specific hardcoded word (other than in the mode table itself) is a bug — generalize to "the verb" / "the prefix" / etc.

- [ ] **Step 4: Commit**

```bash
git add plugins/wf-core/skills/wf-dev-pipeline/SKILL.md
git commit -m "feat(v2): add wf-dev-pipeline shared skill"
```

---

### Task 12: Rewrite `wf-implement.md` as a thin shim

**Files:**
- Modify: `plugins/wf-core/commands/wf-implement.md` (currently 448 lines, becomes ~12)

- [ ] **Step 1: Overwrite the file with the shim**

Exact content:

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

- [ ] **Step 2: Verify line count**

```bash
wc -l plugins/wf-core/commands/wf-implement.md
```

Expected: ~14 lines.

- [ ] **Step 3: Commit**

```bash
git add plugins/wf-core/commands/wf-implement.md
git commit -m "refactor(v2): replace wf-implement with shim into wf-dev-pipeline"
```

---

### Task 13: Rewrite `wf-fix-bug.md` as a thin shim

**Files:**
- Modify: `plugins/wf-core/commands/wf-fix-bug.md` (currently 434 lines, becomes ~12)

- [ ] **Step 1: Overwrite with the shim**

```markdown
---
description: Fix a bug from description or issue
allowed-tools: Read, Bash, Grep, Glob, Task
argument-hint: <bug description or issue number>
---

# Fix Bug

This command shares its orchestration logic with `/wf-implement` and `/wf-improve`.
The pipeline lives in the `wf-dev-pipeline` skill.

**Read** `${CLAUDE_PLUGIN_ROOT}/skills/wf-dev-pipeline/SKILL.md` and **follow its
instructions exactly**, applying the rules for `mode=bug`.

**User arguments:** $ARGUMENTS
```

- [ ] **Step 2: Commit**

```bash
git add plugins/wf-core/commands/wf-fix-bug.md
git commit -m "refactor(v2): replace wf-fix-bug with shim into wf-dev-pipeline"
```

---

### Task 14: Rewrite `wf-improve.md` as a thin shim

**Files:**
- Modify: `plugins/wf-core/commands/wf-improve.md` (currently 356 lines, becomes ~12)

- [ ] **Step 1: Overwrite with the shim**

```markdown
---
description: Improve / refactor existing code
allowed-tools: Read, Bash, Grep, Glob, Task
argument-hint: <improvement description or issue number>
---

# Improve

This command shares its orchestration logic with `/wf-implement` and `/wf-fix-bug`.
The pipeline lives in the `wf-dev-pipeline` skill.

**Read** `${CLAUDE_PLUGIN_ROOT}/skills/wf-dev-pipeline/SKILL.md` and **follow its
instructions exactly**, applying the rules for `mode=improve`.

**User arguments:** $ARGUMENTS
```

- [ ] **Step 2: Commit**

```bash
git add plugins/wf-core/commands/wf-improve.md
git commit -m "refactor(v2): replace wf-improve with shim into wf-dev-pipeline"
```

---

### Task 15: Add the cockpit event log seam to `wf-team-delegate.md`

**Why:** Spec §3.5.3 — add ~10 lines (off by default) that will let the future `wf-cockpit` plugin read team activity without re-instrumenting the loop.

**Files:**
- Modify: `plugins/wf-core/commands/wf-team-delegate.md`

- [ ] **Step 1: Locate Section 7 ("Blocking Monitoring Loop") in the file**

```bash
grep -n "Blocking Monitoring Loop\|## 7\." plugins/wf-core/commands/wf-team-delegate.md
```

- [ ] **Step 2: Inject the event-log instrumentation**

Inside Section 7, at the point where the loop detects a task state change (look for language like "status change" or "task status"), add this block:

```markdown
### Optional: Cockpit event log (off by default)

If `workflow.json` contains `cockpit.eventLog` (a file path), append a
JSON-line event each time the loop observes a task status change:

```json
{"ts": "<ISO 8601 UTC>", "team": "<team name>", "event": "task_status_change", "task_id": "<id>", "from": "<prev status>", "to": "<new status>", "owner": "<owner name>"}
```

Use `jq` or an equivalent JSON emitter. Append to the path with `>>`. If the
path is not set, skip this write entirely (the feature is off by default).

This seam feeds the future `wf-cockpit` plugin — it adds zero runtime cost
when `cockpit.eventLog` is unset.
```

Place the section AFTER the existing state-change detection logic, not inside it (so the existing behavior is unchanged).

- [ ] **Step 3: Verify the file is still well-formed**

```bash
wc -l plugins/wf-core/commands/wf-team-delegate.md
```

Expected: ~1,447 lines (was 1,437, now +10).

- [ ] **Step 4: Commit**

```bash
git add plugins/wf-core/commands/wf-team-delegate.md
git commit -m "feat(v2): add cockpit event log seam to wf-team-delegate (off by default)"
```

---

## Phase D — Migration helper (TDD)

This phase uses real test-driven development because the migration helper is pure bash mutating files — testable in isolation by overriding `$HOME`. Follow the write-test → see-fail → implement-minimum → see-pass → commit loop strictly.

### Task 16: Scaffold the test harness

**Files:**
- Create: `tests/migration/assertions.sh`
- Create: `tests/migration/run-tests.sh`
- Create: `scripts/migrate-to-plugin.sh` (empty-ish stub)

- [ ] **Step 1: Create `tests/migration/assertions.sh`**

```bash
#!/usr/bin/env bash
# Shared assertions for migration helper tests.
# All assertions print a PASS/FAIL line and increment counters in the caller.

set -u

_TESTS_PASSED=${_TESTS_PASSED:-0}
_TESTS_FAILED=${_TESTS_FAILED:-0}

assert_file_absent() {
  local path="$1"
  local desc="${2:-}"
  if [[ -e "$path" ]]; then
    echo "  FAIL: expected $path to be absent ${desc:+($desc)}"
    _TESTS_FAILED=$((_TESTS_FAILED + 1))
    return 1
  else
    echo "  pass: $path absent ${desc:+($desc)}"
    _TESTS_PASSED=$((_TESTS_PASSED + 1))
    return 0
  fi
}

assert_file_present() {
  local path="$1"
  local desc="${2:-}"
  if [[ -e "$path" ]]; then
    echo "  pass: $path present ${desc:+($desc)}"
    _TESTS_PASSED=$((_TESTS_PASSED + 1))
    return 0
  else
    echo "  FAIL: expected $path to exist ${desc:+($desc)}"
    _TESTS_FAILED=$((_TESTS_FAILED + 1))
    return 1
  fi
}

assert_settings_no_wf_hook() {
  local settings_path="$1"
  if [[ ! -f "$settings_path" ]]; then
    echo "  pass: $settings_path absent (nothing to check)"
    _TESTS_PASSED=$((_TESTS_PASSED + 1))
    return 0
  fi
  if grep -q "wf-orchestrator" "$settings_path"; then
    echo "  FAIL: $settings_path still contains wf-orchestrator reference"
    _TESTS_FAILED=$((_TESTS_FAILED + 1))
    return 1
  else
    echo "  pass: $settings_path contains no wf-orchestrator references"
    _TESTS_PASSED=$((_TESTS_PASSED + 1))
    return 0
  fi
}

assert_settings_contains() {
  local settings_path="$1"
  local pattern="$2"
  if grep -q "$pattern" "$settings_path"; then
    echo "  pass: $settings_path contains '$pattern'"
    _TESTS_PASSED=$((_TESTS_PASSED + 1))
    return 0
  else
    echo "  FAIL: $settings_path missing '$pattern'"
    _TESTS_FAILED=$((_TESTS_FAILED + 1))
    return 1
  fi
}

print_summary() {
  echo ""
  echo "=========================="
  echo "Tests passed: $_TESTS_PASSED"
  echo "Tests failed: $_TESTS_FAILED"
  echo "=========================="
  [[ $_TESTS_FAILED -eq 0 ]]
}
```

- [ ] **Step 2: Create `tests/migration/run-tests.sh` (skeleton)**

```bash
#!/usr/bin/env bash
# Entry point: runs all migration helper tests.
# Usage: tests/migration/run-tests.sh

# NOTE: we intentionally use `set -u` without `-e`. A failing assertion
# returns 1 from the test function, and with `-e` that would abort the
# entire runner before `print_summary` prints the PASS/FAIL counts.
set -u

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FIXTURES="$REPO_ROOT/tests/migration/fixtures"
HELPER="$REPO_ROOT/scripts/migrate-to-plugin.sh"

# shellcheck source=/dev/null
source "$REPO_ROOT/tests/migration/assertions.sh"

run_test() {
  local name="$1"
  shift
  echo ""
  echo "-- $name"
  "$@"
}

# Tests are appended here as each one is written (see Tasks 17-26).

print_summary
```

```bash
chmod +x tests/migration/assertions.sh tests/migration/run-tests.sh
```

- [ ] **Step 3: Create a stub `scripts/migrate-to-plugin.sh`**

```bash
#!/usr/bin/env bash
# Migrates a v1.x install.sh install of wf-system to v2.0 plugin format.
# (Implementation landed task-by-task in Phase D of the v2.0 plan.)

set -eu
echo "wf-system migrate-to-plugin.sh — not yet implemented"
exit 99
```

```bash
chmod +x scripts/migrate-to-plugin.sh
```

- [ ] **Step 4: Commit**

```bash
git add tests/migration/assertions.sh tests/migration/run-tests.sh scripts/migrate-to-plugin.sh
git commit -m "test(v2): scaffold migration helper test harness and stub"
```

---

### Task 17: Build the v1.11.1 fresh-install fixture

**Why first:** v1.11.1 is the most common case (the current release). Every later fixture is a variation of this one.

**Files:**
- Create: `tests/migration/fixtures/v1.11.1-fresh-install/.claude/hooks/wf-orchestrator.py`
- Create: `tests/migration/fixtures/v1.11.1-fresh-install/.claude/hooks/.wf-version`
- Create: `tests/migration/fixtures/v1.11.1-fresh-install/.claude/hooks/.wf-source`
- Create: `tests/migration/fixtures/v1.11.1-fresh-install/.claude/hooks/.wf-install-mode`
- Create: `tests/migration/fixtures/v1.11.1-fresh-install/.claude/hooks/.wf-last-check`
- Create: `tests/migration/fixtures/v1.11.1-fresh-install/.claude/hooks/.wf-state/placeholder.json`
- Create: `tests/migration/fixtures/v1.11.1-fresh-install/.claude/settings.json`
- Create: `tests/migration/fixtures/v1.11.1-fresh-install/.claude/commands/<30 wf-*.md files>` (empty stubs)
- Create: `tests/migration/fixtures/v1.11.1-fresh-install/.claude/scripts/wf-brain.js`
- Create: `tests/migration/fixtures/v1.11.1-fresh-install/.claude/scripts/wf-brain/placeholder.txt`
- Create: `tests/migration/fixtures/v1.11.1-fresh-install/.claude/mcp-servers/wf-brain/placeholder.txt`

- [ ] **Step 1: Create the fixture directory tree**

```bash
F=tests/migration/fixtures/v1.11.1-fresh-install
mkdir -p $F/.claude/hooks/.wf-state
mkdir -p $F/.claude/commands
mkdir -p $F/.claude/scripts/wf-brain
mkdir -p $F/.claude/mcp-servers/wf-brain
```

- [ ] **Step 2: Populate hooks/ metadata files**

```bash
F=tests/migration/fixtures/v1.11.1-fresh-install

echo '# stub orchestrator placeholder' > $F/.claude/hooks/wf-orchestrator.py
echo '1.11.1' > $F/.claude/hooks/.wf-version
echo 'git' > $F/.claude/hooks/.wf-source
echo 'symlink' > $F/.claude/hooks/.wf-install-mode
touch $F/.claude/hooks/.wf-last-check
echo '{}' > $F/.claude/hooks/.wf-state/placeholder.json
```

- [ ] **Step 3: Populate a representative `settings.json` matching what install.sh deep-merges**

```bash
F=tests/migration/fixtures/v1.11.1-fresh-install

cat > $F/.claude/settings.json <<'JSON'
{
  "hooks": {
    "Stop": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "python3 ~/.claude/hooks/wf-orchestrator.py --mode=stop",
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
            "command": "python3 ~/.claude/hooks/wf-orchestrator.py",
            "timeout": 5000
          }
        ]
      }
    ]
  }
}
JSON
```

- [ ] **Step 4: Populate 30 command file stubs**

```bash
F=tests/migration/fixtures/v1.11.1-fresh-install
for cmd in wf-ai-qa wf-brain-review wf-breakdown wf-commit wf-create-agent \
           wf-create-prd wf-create-ticket wf-debug wf-delegate wf-design-setup \
           wf-e2e wf-end-session wf-fix-bug wf-generate wf-implement wf-improve \
           wf-init wf-investigate wf-match-figma wf-overview wf-parse-prd \
           wf-pick-issue wf-pr-comments wf-pre-prod-review wf-qa-plan wf-refactor \
           wf-review wf-start-session wf-team-delegate wf-team-review wf-test \
           wf-ticket-status wf-update; do
  echo "# stub: $cmd" > $F/.claude/commands/$cmd.md
done
```

Note: this is 33 files (matches the current repo state including the brain/design commands that exist in v1.11.1 but are removed in v2.0). The fixture reflects the ACTUAL v1.11.1 state, not the v2.0 target.

- [ ] **Step 5: Populate brain component stubs (present in v1.9.0+)**

```bash
F=tests/migration/fixtures/v1.11.1-fresh-install
echo '// stub brain cli' > $F/.claude/scripts/wf-brain.js
echo 'stub' > $F/.claude/scripts/wf-brain/placeholder.txt
echo 'stub' > $F/.claude/mcp-servers/wf-brain/placeholder.txt
```

- [ ] **Step 6: Verify the fixture structure**

```bash
find tests/migration/fixtures/v1.11.1-fresh-install -type f | sort
```

Expected output includes the orchestrator, 5 metadata files, settings.json, 33 command stubs, and 3 brain component stubs.

- [ ] **Step 7: Commit the fixture**

```bash
git add tests/migration/fixtures/v1.11.1-fresh-install/
git commit -m "test(v2): add v1.11.1 fresh-install fixture for migration helper"
```

---

### Task 18: TDD — write the failing test for v1.11.1 global migration

**Files:**
- Modify: `tests/migration/run-tests.sh`

- [ ] **Step 1: Add the test function to `run-tests.sh`**

Append the following BEFORE the `print_summary` call at the end of `tests/migration/run-tests.sh`:

```bash
test_migrate_v1_11_1_global() {
  local tmp
  tmp=$(mktemp -d)
  trap "rm -rf $tmp" RETURN

  cp -a "$FIXTURES/v1.11.1-fresh-install/.claude" "$tmp/"

  HOME="$tmp" bash "$HELPER" --no-backup --yes >/dev/null 2>&1 || {
    echo "  FAIL: migrate-to-plugin.sh exited non-zero"
    _TESTS_FAILED=$((_TESTS_FAILED + 1))
    return 1
  }

  assert_file_absent "$tmp/.claude/hooks/wf-orchestrator.py" "hook removed"
  assert_file_absent "$tmp/.claude/hooks/.wf-version" "version file removed"
  assert_file_absent "$tmp/.claude/hooks/.wf-source" "source file removed"
  assert_file_absent "$tmp/.claude/hooks/.wf-install-mode" "mode file removed"
  assert_file_absent "$tmp/.claude/hooks/.wf-last-check" "last-check removed"
  assert_file_absent "$tmp/.claude/hooks/.wf-state" "state dir removed"
  assert_file_absent "$tmp/.claude/scripts/wf-brain.js" "brain cli removed"
  assert_file_absent "$tmp/.claude/scripts/wf-brain" "brain module removed"
  assert_file_absent "$tmp/.claude/mcp-servers/wf-brain" "brain mcp removed"
  assert_file_absent "$tmp/.claude/commands/wf-implement.md" "wf-implement cmd removed"
  assert_file_absent "$tmp/.claude/commands/wf-match-figma.md" "wf-match-figma cmd removed"
  assert_settings_no_wf_hook "$tmp/.claude/settings.json"
}

run_test "migrate v1.11.1 global" test_migrate_v1_11_1_global
```

- [ ] **Step 2: Run the tests — confirm they FAIL**

```bash
bash tests/migration/run-tests.sh
```

Expected: the test fails because the stub `scripts/migrate-to-plugin.sh` exits 99. Output shows `FAIL: migrate-to-plugin.sh exited non-zero`.

- [ ] **Step 3: Commit the failing test (red)**

```bash
git add tests/migration/run-tests.sh
git commit -m "test(v2): add failing test for v1.11.1 global migration"
```

---

### Task 19: Implement the migration helper backbone (dispatcher + backup phase)

**Files:**
- Modify: `scripts/migrate-to-plugin.sh`

- [ ] **Step 1: Replace the stub with a backbone implementation**

```bash
#!/usr/bin/env bash
# migrate-to-plugin.sh — one-shot helper for v1.x install.sh users moving to v2.0.
# See docs/superpowers/specs/2026-04-07-wf-system-plugin-migration-design.md §5.

set -eu

DRY_RUN=0
DO_BACKUP=1
PROJECT_PATH=""
INCLUDE_GLOBAL=0
ASSUME_YES=0

usage() {
  cat <<EOF
Usage: migrate-to-plugin.sh [OPTIONS]

Options:
  --dry-run             Print what would be done without making any changes
  --no-backup           Skip backup (NOT recommended)
  --project PATH        Migrate a project-local install at PATH
  --include-global      Used with --project: also migrate global install
  --yes                 Skip interactive confirmation (for tests/CI)
  -h, --help            Show this help

Examples:
  migrate-to-plugin.sh                      # migrate global install
  migrate-to-plugin.sh --dry-run            # preview changes
  migrate-to-plugin.sh --project ~/my-app   # migrate one project install
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --no-backup) DO_BACKUP=0; shift ;;
    --project) PROJECT_PATH="$2"; shift 2 ;;
    --include-global) INCLUDE_GLOBAL=1; shift ;;
    --yes) ASSUME_YES=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 2 ;;
  esac
done

CLAUDE_DIR="$HOME/.claude"

# ------------------------------------------------------------------
# Phase 0: detection guard
# ------------------------------------------------------------------
detect_install() {
  if [[ -f "$CLAUDE_DIR/hooks/.wf-version" ]]; then
    return 0
  fi
  if [[ -f "$CLAUDE_DIR/hooks/wf-orchestrator.py" ]]; then
    return 0
  fi
  return 1
}

if [[ -z "$PROJECT_PATH" ]] || [[ $INCLUDE_GLOBAL -eq 1 ]]; then
  if ! detect_install; then
    echo "[1/5] No wf-system global installation detected."
    echo "      Nothing to do."
    exit 0
  fi
fi

echo "[1/5] Detecting wf-system installation..."
if [[ -f "$CLAUDE_DIR/hooks/.wf-version" ]]; then
  VERSION=$(cat "$CLAUDE_DIR/hooks/.wf-version" 2>/dev/null || echo unknown)
  MODE=$(cat "$CLAUDE_DIR/hooks/.wf-install-mode" 2>/dev/null || echo unknown)
  echo "      Found global install (v$VERSION, mode: $MODE)"
else
  echo "      Found legacy global install (no version metadata)"
fi

# ------------------------------------------------------------------
# Phase 1: backup
# ------------------------------------------------------------------
BACKUP_DIR=""
if [[ $DO_BACKUP -eq 1 ]]; then
  TS=$(date -u +%Y-%m-%dT%H-%M-%SZ)
  BACKUP_DIR="$CLAUDE_DIR/wf-system-backup-$TS"
  echo "[2/5] Creating backup at $BACKUP_DIR..."

  if [[ $DRY_RUN -eq 0 ]]; then
    mkdir -p "$BACKUP_DIR"
    [[ -f "$CLAUDE_DIR/settings.json" ]] && cp "$CLAUDE_DIR/settings.json" "$BACKUP_DIR/settings.json"
    [[ -d "$CLAUDE_DIR/hooks" ]] && cp -rL "$CLAUDE_DIR/hooks" "$BACKUP_DIR/hooks" 2>/dev/null || true
    if [[ -d "$CLAUDE_DIR/scripts" ]]; then
      mkdir -p "$BACKUP_DIR/scripts"
      [[ -e "$CLAUDE_DIR/scripts/wf-brain.js" ]] && cp -L "$CLAUDE_DIR/scripts/wf-brain.js" "$BACKUP_DIR/scripts/" 2>/dev/null || true
      [[ -e "$CLAUDE_DIR/scripts/wf-brain" ]] && cp -rL "$CLAUDE_DIR/scripts/wf-brain" "$BACKUP_DIR/scripts/" 2>/dev/null || true
    fi
    if [[ -d "$CLAUDE_DIR/mcp-servers/wf-brain" ]]; then
      mkdir -p "$BACKUP_DIR/mcp-servers"
      cp -rL "$CLAUDE_DIR/mcp-servers/wf-brain" "$BACKUP_DIR/mcp-servers/" 2>/dev/null || true
    fi
  fi
  echo "      Backed up (see $BACKUP_DIR)"
else
  echo "[2/5] Skipping backup (--no-backup)"
fi

# ------------------------------------------------------------------
# Phase 2: remove wf-system files (stubbed in Task 20 — implemented next)
# ------------------------------------------------------------------
echo "[3/5] Removing wf-system files from $CLAUDE_DIR..."
# ... implemented in Task 20

# ------------------------------------------------------------------
# Phase 3: prune settings.json (stubbed in Task 21 — implemented next)
# ------------------------------------------------------------------
echo "[4/5] Pruning wf-system hooks from $CLAUDE_DIR/settings.json..."
# ... implemented in Task 21

echo "[5/5] Migration complete."
if [[ -n "$BACKUP_DIR" ]]; then
  echo ""
  echo "Backup: $BACKUP_DIR"
fi
echo ""
echo "Next steps:"
echo "  1. Open Claude Code"
echo "  2. Run: /plugin marketplace add matheusslg/wf-system"
echo "  3. Run: /plugin install wf-core@wf-system"
```

- [ ] **Step 2: Run the test again — still expected to FAIL**

```bash
bash tests/migration/run-tests.sh
```

Expected: `FAIL: expected .../wf-orchestrator.py to be absent` (backbone runs clean but removal isn't implemented yet).

- [ ] **Step 3: Commit the backbone (still red, but closer)**

```bash
git add scripts/migrate-to-plugin.sh
git commit -m "feat(v2): migration helper backbone (detection, args, backup)"
```

---

### Task 20: Implement the file-removal phase (global)

**Files:**
- Modify: `scripts/migrate-to-plugin.sh`

- [ ] **Step 1: Replace the Phase 2 stub with the removal logic**

Find in `scripts/migrate-to-plugin.sh`:

```bash
# ------------------------------------------------------------------
# Phase 2: remove wf-system files (stubbed in Task 20 — implemented next)
# ------------------------------------------------------------------
echo "[3/5] Removing wf-system files from $CLAUDE_DIR..."
# ... implemented in Task 20
```

Replace with:

```bash
# ------------------------------------------------------------------
# Phase 2: remove wf-system files (global install case)
# ------------------------------------------------------------------
echo "[3/5] Removing wf-system files from $CLAUDE_DIR..."

WF_COMMANDS=(
  wf-ai-qa wf-brain-review wf-breakdown wf-commit wf-create-agent
  wf-create-prd wf-create-ticket wf-debug wf-delegate wf-design-setup
  wf-e2e wf-end-session wf-fix-bug wf-generate wf-implement wf-improve
  wf-init wf-investigate wf-match-figma wf-overview wf-parse-prd
  wf-pick-issue wf-pr-comments wf-pre-prod-review wf-qa-plan wf-refactor
  wf-review wf-start-session wf-team-delegate wf-team-review wf-test
  wf-ticket-status wf-update
)

CMD_COUNT=0
for cmd in "${WF_COMMANDS[@]}"; do
  target="$CLAUDE_DIR/commands/$cmd.md"
  if [[ -e "$target" ]]; then
    if [[ $DRY_RUN -eq 0 ]]; then
      rm -f "$target"
    fi
    CMD_COUNT=$((CMD_COUNT + 1))
  fi
done

HOOK_COUNT=0
for path in \
  "$CLAUDE_DIR/hooks/wf-orchestrator.py" \
  "$CLAUDE_DIR/hooks/.wf-version" \
  "$CLAUDE_DIR/hooks/.wf-source" \
  "$CLAUDE_DIR/hooks/.wf-install-mode" \
  "$CLAUDE_DIR/hooks/.wf-last-check" \
  "$CLAUDE_DIR/hooks/.wf-update-available"; do
  if [[ -e "$path" ]]; then
    [[ $DRY_RUN -eq 0 ]] && rm -f "$path"
    HOOK_COUNT=$((HOOK_COUNT + 1))
  fi
done

if [[ -d "$CLAUDE_DIR/hooks/.wf-state" ]]; then
  [[ $DRY_RUN -eq 0 ]] && rm -rf "$CLAUDE_DIR/hooks/.wf-state"
  HOOK_COUNT=$((HOOK_COUNT + 1))
fi

BRAIN_COUNT=0
for path in \
  "$CLAUDE_DIR/scripts/wf-brain.js" \
  "$CLAUDE_DIR/scripts/wf-brain" \
  "$CLAUDE_DIR/mcp-servers/wf-brain"; do
  if [[ -e "$path" ]]; then
    [[ $DRY_RUN -eq 0 ]] && rm -rf "$path"
    BRAIN_COUNT=$((BRAIN_COUNT + 1))
  fi
done

echo "      Removed $CMD_COUNT commands, $HOOK_COUNT hook artifacts, $BRAIN_COUNT brain components"
```

- [ ] **Step 2: Run the tests**

```bash
bash tests/migration/run-tests.sh
```

Expected: the file-absence assertions pass. The `settings.json` assertion still FAILS (Phase 3 not yet implemented).

- [ ] **Step 3: Commit**

```bash
git add scripts/migrate-to-plugin.sh
git commit -m "feat(v2): migration helper removes wf-system files from \$HOME/.claude"
```

---

### Task 21: Implement the `settings.json` jq surgery

**Files:**
- Modify: `scripts/migrate-to-plugin.sh`

- [ ] **Step 1: Add a jq dependency check at the top of the script**

Just after the `set -eu` line and BEFORE argument parsing, insert:

```bash
if ! command -v jq >/dev/null 2>&1; then
  cat <<EOF >&2
ERROR: jq is required for safe settings.json migration.
Install it first:
  macOS:  brew install jq
  Debian: apt install jq
  Fedora: dnf install jq
Then re-run this script.
EOF
  exit 3
fi
```

- [ ] **Step 2: Replace the Phase 3 stub with the jq surgery**

Find:

```bash
# ------------------------------------------------------------------
# Phase 3: prune settings.json (stubbed in Task 21 — implemented next)
# ------------------------------------------------------------------
echo "[4/5] Pruning wf-system hooks from $CLAUDE_DIR/settings.json..."
# ... implemented in Task 21
```

Replace with:

```bash
# ------------------------------------------------------------------
# Phase 3: prune wf-orchestrator entries from settings.json
# ------------------------------------------------------------------
echo "[4/5] Pruning wf-system hooks from $CLAUDE_DIR/settings.json..."

SETTINGS="$CLAUDE_DIR/settings.json"

if [[ ! -f "$SETTINGS" ]]; then
  echo "      (no settings.json — nothing to prune)"
else
  PRUNED=0
  if grep -q "wf-orchestrator" "$SETTINGS"; then
    PRUNED=1
  fi

  if [[ $PRUNED -eq 1 ]] && [[ $DRY_RUN -eq 0 ]]; then
    TMP="${SETTINGS}.tmp"
    jq '
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
    ' "$SETTINGS" > "$TMP"
    mv "$TMP" "$SETTINGS"
    echo "      Pruned wf-orchestrator hook entries"
  elif [[ $PRUNED -eq 1 ]]; then
    echo "      [dry-run] would prune wf-orchestrator hook entries"
  else
    echo "      (no wf-orchestrator hook entries found)"
  fi
fi
```

- [ ] **Step 3: Run the tests — expected all-pass for the v1.11.1 test**

```bash
bash tests/migration/run-tests.sh
```

Expected: `Tests failed: 0`. The v1.11.1 global test passes fully.

- [ ] **Step 4: Commit**

```bash
git add scripts/migrate-to-plugin.sh
git commit -m "feat(v2): migration helper prunes wf-orchestrator from settings.json"
```

---

### Task 22: Add `--project` mode (project-local install migration)

**Files:**
- Modify: `scripts/migrate-to-plugin.sh`
- Modify: `tests/migration/run-tests.sh` (add project fixture test)
- Create: `tests/migration/fixtures/v1.11.1-project-install/<tree>`

- [ ] **Step 1: Create a project-local fixture**

```bash
F=tests/migration/fixtures/v1.11.1-project-install
mkdir -p $F/project/.claude/commands

for cmd in wf-implement wf-fix-bug wf-improve wf-commit wf-start-session; do
  echo "# stub: $cmd" > $F/project/.claude/commands/$cmd.md
done
```

(install.sh `--project` mode only installs commands; no hook, no settings, no brain.)

- [ ] **Step 2: Add a failing test for project migration**

In `tests/migration/run-tests.sh`, BEFORE `print_summary`, add:

```bash
test_migrate_v1_11_1_project() {
  local tmp
  tmp=$(mktemp -d)
  trap "rm -rf $tmp" RETURN

  cp -a "$FIXTURES/v1.11.1-project-install/project" "$tmp/proj"

  HOME="$tmp" bash "$HELPER" --no-backup --yes --project "$tmp/proj" >/dev/null 2>&1 || {
    echo "  FAIL: migrate-to-plugin.sh --project exited non-zero"
    _TESTS_FAILED=$((_TESTS_FAILED + 1))
    return 1
  }

  assert_file_absent "$tmp/proj/.claude/commands/wf-implement.md"
  assert_file_absent "$tmp/proj/.claude/commands/wf-fix-bug.md"
  assert_file_absent "$tmp/proj/.claude/commands/wf-commit.md"
}

run_test "migrate v1.11.1 project" test_migrate_v1_11_1_project
```

- [ ] **Step 3: Run tests and confirm the new one FAILS**

```bash
bash tests/migration/run-tests.sh
```

Expected: v1.11.1 global still passes; project test fails (not implemented).

- [ ] **Step 4: Implement `--project` in the helper**

In `scripts/migrate-to-plugin.sh`, BEFORE the `detect_install()` call block, add:

```bash
# ------------------------------------------------------------------
# Project-local install path
# ------------------------------------------------------------------
if [[ -n "$PROJECT_PATH" ]]; then
  PROJ_CLAUDE="$PROJECT_PATH/.claude"
  if [[ ! -d "$PROJ_CLAUDE/commands" ]]; then
    echo "No wf-system commands found at $PROJ_CLAUDE/commands — nothing to do"
  else
    echo "[project] Removing wf-* commands from $PROJ_CLAUDE/commands..."
    COUNT=0
    for cmd in wf-ai-qa wf-brain-review wf-breakdown wf-commit wf-create-agent \
               wf-create-prd wf-create-ticket wf-debug wf-delegate wf-design-setup \
               wf-e2e wf-end-session wf-fix-bug wf-generate wf-implement wf-improve \
               wf-init wf-investigate wf-match-figma wf-overview wf-parse-prd \
               wf-pick-issue wf-pr-comments wf-pre-prod-review wf-qa-plan wf-refactor \
               wf-review wf-start-session wf-team-delegate wf-team-review wf-test \
               wf-ticket-status wf-update; do
      target="$PROJ_CLAUDE/commands/$cmd.md"
      if [[ -e "$target" ]]; then
        [[ $DRY_RUN -eq 0 ]] && rm -f "$target"
        COUNT=$((COUNT + 1))
      fi
    done
    echo "[project] Removed $COUNT wf-* commands"
  fi

  if [[ $INCLUDE_GLOBAL -eq 0 ]]; then
    echo "[project] Done. Run with --include-global to also migrate ~/.claude"
    exit 0
  fi
fi
```

- [ ] **Step 5: Run tests — both should pass**

```bash
bash tests/migration/run-tests.sh
```

Expected: `Tests failed: 0`.

- [ ] **Step 6: Commit (tests + fixture + impl in one commit)**

```bash
git add tests/migration/fixtures/v1.11.1-project-install/ tests/migration/run-tests.sh scripts/migrate-to-plugin.sh
git commit -m "feat(v2): migration helper --project mode"
```

---

### Task 23: Add `--dry-run` test and verify dry-run truly makes no changes

**Files:**
- Modify: `tests/migration/run-tests.sh`

- [ ] **Step 1: Add a failing-expected test**

```bash
test_dry_run_no_mutation() {
  local tmp
  tmp=$(mktemp -d)
  trap "rm -rf $tmp" RETURN

  cp -a "$FIXTURES/v1.11.1-fresh-install/.claude" "$tmp/"

  local before_count
  before_count=$(find "$tmp/.claude" -type f | wc -l)

  HOME="$tmp" bash "$HELPER" --dry-run --yes >/dev/null 2>&1

  local after_count
  after_count=$(find "$tmp/.claude" -type f | wc -l)

  if [[ "$before_count" -eq "$after_count" ]]; then
    echo "  pass: dry-run mutated no files ($before_count → $after_count)"
    _TESTS_PASSED=$((_TESTS_PASSED + 1))
  else
    echo "  FAIL: dry-run mutated files ($before_count → $after_count)"
    _TESTS_FAILED=$((_TESTS_FAILED + 1))
  fi
}

run_test "dry-run no mutation" test_dry_run_no_mutation
```

- [ ] **Step 2: Run tests — expected PASS**

```bash
bash tests/migration/run-tests.sh
```

Expected: all tests pass. The dry-run flag was already implemented in Task 19-21 via the `$DRY_RUN` check before every destructive operation.

**If the test FAILS:** find where the helper mutates in dry-run mode (likely a `mkdir -p` for the backup dir or the `mv settings.json.tmp`). Add `[[ $DRY_RUN -eq 0 ]]` guard. Commit as a separate fix commit.

- [ ] **Step 3: Commit the test**

```bash
git add tests/migration/run-tests.sh
git commit -m "test(v2): verify --dry-run does not mutate filesystem"
```

---

### Task 24: Add idempotency test (run twice, second is a no-op)

**Files:**
- Modify: `tests/migration/run-tests.sh`

- [ ] **Step 1: Add the test**

```bash
test_idempotent() {
  local tmp
  tmp=$(mktemp -d)
  trap "rm -rf $tmp" RETURN

  cp -a "$FIXTURES/v1.11.1-fresh-install/.claude" "$tmp/"

  HOME="$tmp" bash "$HELPER" --no-backup --yes >/dev/null 2>&1
  # Second run
  if HOME="$tmp" bash "$HELPER" --no-backup --yes >/dev/null 2>&1; then
    echo "  pass: second run exits 0 (idempotent)"
    _TESTS_PASSED=$((_TESTS_PASSED + 1))
  else
    echo "  FAIL: second run exited non-zero (not idempotent)"
    _TESTS_FAILED=$((_TESTS_FAILED + 1))
  fi
}

run_test "idempotency" test_idempotent
```

- [ ] **Step 2: Run tests**

```bash
bash tests/migration/run-tests.sh
```

Expected: PASS. After the first run, `detect_install()` returns false on the second invocation, which triggers the "nothing to do" branch and `exit 0`.

**If it FAILS:** the detection guard is missing something. Debug and fix.

- [ ] **Step 3: Commit**

```bash
git add tests/migration/run-tests.sh
git commit -m "test(v2): verify migration helper is idempotent"
```

---

### Task 25: Add user-hook-preservation test

**Why:** Spec §5.4 — the jq filter must preserve hooks that are NOT wf-orchestrator.

**Files:**
- Create: `tests/migration/fixtures/v1.11.1-user-hook/.claude/<tree>`
- Modify: `tests/migration/run-tests.sh`

- [ ] **Step 1: Create a fixture with a user-defined hook alongside wf-orchestrator**

```bash
F=tests/migration/fixtures/v1.11.1-user-hook
mkdir -p $F/.claude/hooks
echo '# stub' > $F/.claude/hooks/wf-orchestrator.py
echo '1.11.1' > $F/.claude/hooks/.wf-version

cat > $F/.claude/settings.json <<'JSON'
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "echo 'user-defined hook'",
            "timeout": 3000
          }
        ]
      },
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "python3 ~/.claude/hooks/wf-orchestrator.py",
            "timeout": 5000
          }
        ]
      }
    ]
  }
}
JSON
```

- [ ] **Step 2: Add the test**

```bash
test_user_hook_preserved() {
  local tmp
  tmp=$(mktemp -d)
  trap "rm -rf $tmp" RETURN

  cp -a "$FIXTURES/v1.11.1-user-hook/.claude" "$tmp/"

  HOME="$tmp" bash "$HELPER" --no-backup --yes >/dev/null 2>&1

  assert_settings_no_wf_hook "$tmp/.claude/settings.json"
  assert_settings_contains "$tmp/.claude/settings.json" "user-defined hook"
}

run_test "user hook preserved" test_user_hook_preserved
```

- [ ] **Step 3: Run tests**

```bash
bash tests/migration/run-tests.sh
```

Expected: PASS. The jq filter strips only entries whose `.command` matches `wf-orchestrator`; the user's `echo 'user-defined hook'` survives.

**If it FAILS:** the jq filter is too aggressive. Re-read §5.4 and fix.

- [ ] **Step 4: Commit**

```bash
git add tests/migration/fixtures/v1.11.1-user-hook/ tests/migration/run-tests.sh
git commit -m "test(v2): verify migration helper preserves user-defined hooks"
```

---

### Task 26: Add v1.5.0 and v1.0.0 fixtures (older install variants)

**Why:** Spec §7.5 — v1.5.0 should not error on missing brain files (brain wasn't installed until v1.9.0). v1.0.0 has even fewer files.

**Files:**
- Create: `tests/migration/fixtures/v1.5.0-fresh-install/<tree>`
- Create: `tests/migration/fixtures/v1.0.0-fresh-install/<tree>`
- Modify: `tests/migration/run-tests.sh`

- [ ] **Step 1: Build the v1.5.0 fixture (no brain components)**

```bash
F=tests/migration/fixtures/v1.5.0-fresh-install
mkdir -p $F/.claude/hooks/.wf-state $F/.claude/commands

echo '# stub' > $F/.claude/hooks/wf-orchestrator.py
echo '1.5.0' > $F/.claude/hooks/.wf-version
echo 'git' > $F/.claude/hooks/.wf-source
echo 'copy' > $F/.claude/hooks/.wf-install-mode

# v1.5.0-era commands (approximate — use all 33 for simplicity; extra files
# just get ignored by the helper)
for cmd in wf-ai-qa wf-breakdown wf-commit wf-create-agent wf-create-prd \
           wf-create-ticket wf-debug wf-delegate wf-e2e wf-end-session \
           wf-fix-bug wf-generate wf-implement wf-improve wf-init \
           wf-investigate wf-overview wf-parse-prd wf-pick-issue wf-pr-comments \
           wf-pre-prod-review wf-qa-plan wf-refactor wf-review wf-start-session \
           wf-team-delegate wf-team-review wf-test wf-ticket-status wf-update; do
  echo "# stub: $cmd" > $F/.claude/commands/$cmd.md
done

cat > $F/.claude/settings.json <<'JSON'
{
  "hooks": {
    "Stop": [
      {
        "matcher": "*",
        "hooks": [{"type": "command", "command": "python3 ~/.claude/hooks/wf-orchestrator.py --mode=stop", "timeout": 60000}]
      }
    ]
  }
}
JSON
```

- [ ] **Step 2: Build the v1.0.0 fixture (bare minimum)**

```bash
F=tests/migration/fixtures/v1.0.0-fresh-install
mkdir -p $F/.claude/hooks $F/.claude/commands

echo '# stub' > $F/.claude/hooks/wf-orchestrator.py
echo '1.0.0' > $F/.claude/hooks/.wf-version

for cmd in wf-init wf-start-session wf-end-session wf-commit wf-update; do
  echo "# stub: $cmd" > $F/.claude/commands/$cmd.md
done

cat > $F/.claude/settings.json <<'JSON'
{
  "hooks": {
    "Stop": [
      {
        "matcher": "*",
        "hooks": [{"type": "command", "command": "python3 ~/.claude/hooks/wf-orchestrator.py --mode=stop", "timeout": 60000}]
      }
    ]
  }
}
JSON
```

- [ ] **Step 3: Add tests**

```bash
test_migrate_v1_5_0_no_brain() {
  local tmp
  tmp=$(mktemp -d)
  trap "rm -rf $tmp" RETURN

  cp -a "$FIXTURES/v1.5.0-fresh-install/.claude" "$tmp/"

  HOME="$tmp" bash "$HELPER" --no-backup --yes >/dev/null 2>&1 || {
    echo "  FAIL: migrate-to-plugin.sh exited non-zero on v1.5.0 fixture"
    _TESTS_FAILED=$((_TESTS_FAILED + 1))
    return 1
  }

  assert_file_absent "$tmp/.claude/hooks/wf-orchestrator.py"
  assert_file_absent "$tmp/.claude/hooks/.wf-version"
  assert_settings_no_wf_hook "$tmp/.claude/settings.json"
}

test_migrate_v1_0_0_minimal() {
  local tmp
  tmp=$(mktemp -d)
  trap "rm -rf $tmp" RETURN

  cp -a "$FIXTURES/v1.0.0-fresh-install/.claude" "$tmp/"

  HOME="$tmp" bash "$HELPER" --no-backup --yes >/dev/null 2>&1 || {
    echo "  FAIL: migrate-to-plugin.sh exited non-zero on v1.0.0 fixture"
    _TESTS_FAILED=$((_TESTS_FAILED + 1))
    return 1
  }

  assert_file_absent "$tmp/.claude/hooks/wf-orchestrator.py"
  assert_file_absent "$tmp/.claude/commands/wf-init.md"
  assert_settings_no_wf_hook "$tmp/.claude/settings.json"
}

run_test "migrate v1.5.0 (no brain)" test_migrate_v1_5_0_no_brain
run_test "migrate v1.0.0 (minimal)" test_migrate_v1_0_0_minimal
```

- [ ] **Step 4: Run tests**

```bash
bash tests/migration/run-tests.sh
```

Expected: all tests pass. The helper already handles missing optional files via `[[ -e ]]` checks before every `rm`.

- [ ] **Step 5: Commit**

```bash
git add tests/migration/fixtures/v1.5.0-fresh-install/ tests/migration/fixtures/v1.0.0-fresh-install/ tests/migration/run-tests.sh
git commit -m "test(v2): add v1.5.0 and v1.0.0 migration fixtures"
```

---

### Task 27: Add never-installed fixture + no-op test

**Files:**
- Create: `tests/migration/fixtures/never-installed/.claude/` (empty)
- Modify: `tests/migration/run-tests.sh`

- [ ] **Step 1: Create an empty `.claude/` fixture**

```bash
F=tests/migration/fixtures/never-installed
mkdir -p $F/.claude
touch $F/.claude/.gitkeep
```

- [ ] **Step 2: Add the test**

```bash
test_never_installed_noop() {
  local tmp
  tmp=$(mktemp -d)
  trap "rm -rf $tmp" RETURN

  cp -a "$FIXTURES/never-installed/.claude" "$tmp/"
  local before
  before=$(find "$tmp/.claude" -type f | wc -l)

  HOME="$tmp" bash "$HELPER" --no-backup --yes >/dev/null 2>&1 || {
    echo "  FAIL: helper exited non-zero on never-installed fixture"
    _TESTS_FAILED=$((_TESTS_FAILED + 1))
    return 1
  }

  local after
  after=$(find "$tmp/.claude" -type f | wc -l)

  if [[ "$before" -eq "$after" ]]; then
    echo "  pass: never-installed fixture untouched"
    _TESTS_PASSED=$((_TESTS_PASSED + 1))
  else
    echo "  FAIL: helper mutated a never-installed fixture"
    _TESTS_FAILED=$((_TESTS_FAILED + 1))
  fi
}

run_test "never-installed no-op" test_never_installed_noop
```

- [ ] **Step 3: Run tests**

```bash
bash tests/migration/run-tests.sh
```

Expected: all tests pass. The detection guard in Phase 0 short-circuits with `exit 0`.

- [ ] **Step 4: Commit**

```bash
git add tests/migration/fixtures/never-installed/ tests/migration/run-tests.sh
git commit -m "test(v2): verify migration helper no-ops on never-installed system"
```

---

## Phase E — Cleanup, docs, and release infrastructure

### Task 28: Delete `install.sh`, `uninstall.sh`, `templates/settings-hooks.json`, old `hooks/` dir

**Why now:** All content has been verified copied into `plugins/wf-core/`. The plugin install path in Task 10 worked. Time to retire the old infrastructure.

**Files:**
- Delete: `install.sh`
- Delete: `uninstall.sh`
- Delete: `templates/settings-hooks.json`
- Delete: `hooks/wf-orchestrator.py`
- Delete: `hooks/` (empty after the file removal)
- Delete: `commands/*.md` (the originals — 33 files)
- Delete: `templates/agents/` (moved into plugin)
- Delete: `.claude/skills/*` (moved into plugin) — **NO, see step 4**

- [ ] **Step 1: Delete the install scripts and related templates**

```bash
git rm install.sh uninstall.sh templates/settings-hooks.json
```

- [ ] **Step 2: Delete the old hooks directory**

```bash
git rm -r hooks/
```

- [ ] **Step 3: Delete the original commands directory**

```bash
git rm -r commands/
```

- [ ] **Step 4: Decide on `.claude/skills/` fate**

`.claude/skills/` is **this project's OWN Claude Code setup** (dogfood). It should remain, because this repo still uses Claude Code for development. The plugin's skills now live in `plugins/wf-core/skills/` — they're separate copies.

**Do NOT delete `.claude/skills/`.**

- [ ] **Step 5: Delete `templates/agents/` but keep other templates**

```bash
git rm -r templates/agents/
# Check what's left
ls templates/
```

Expected: `progress.md.example  workflow.json.example` (still needed by `/wf-init`).

- [ ] **Step 6: Verify repo state**

```bash
ls
git status --short
```

Expected: top-level has no `install.sh`, no `uninstall.sh`, no `hooks/`, no `commands/`. `plugins/`, `scripts/`, `tests/`, `docs/`, `CHANGELOG.md`, `README.md`, `VERSION`, `LICENSE`, `package.json`, etc. remain.

- [ ] **Step 7: Commit**

```bash
git commit -m "chore(v2): remove install.sh and legacy directories

- Delete install.sh and uninstall.sh (replaced by plugin marketplace flow)
- Delete templates/settings-hooks.json (plugin auto-loads hooks/hooks.json)
- Delete hooks/ dir (moved to plugins/wf-core/scripts/)
- Delete commands/ dir (moved to plugins/wf-core/commands/)
- Delete templates/agents/ (moved to plugins/wf-core/agents/)"
```

---

### Task 29: Rewrite `README.md` with the plugin install flow

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Read the current README to know what sections to preserve**

```bash
wc -l README.md
head -40 README.md
```

- [ ] **Step 2: Replace the Install / Getting Started section**

Find the section that starts with the current install.sh instructions and replace it entirely with:

```markdown
## Install (v2.0+)

Inside Claude Code:

    /plugin marketplace add matheusslg/wf-system
    /plugin install wf-core@wf-system

That's it. The plugin auto-loads commands, agents, skills, hooks, and the orchestrator script.

Restart Claude Code when prompted, then run `/wf-init` in any project to scaffold a workflow.

## Migrating from v1.x (install.sh users)

If you previously installed wf-system via `install.sh`, run the one-shot migration helper before installing the plugin:

    curl -fsSL https://raw.githubusercontent.com/matheusslg/wf-system/main/scripts/migrate-to-plugin.sh | bash

This removes the old `~/.claude/hooks/wf-orchestrator.py`, surgically prunes wf-system entries from `~/.claude/settings.json`, and clears `.wf-version` / `.wf-source` metadata. Then install the plugin as above.

The migration helper creates a timestamped backup at `~/.claude/wf-system-backup-<UTC>/` before making any changes. See `docs/v2.0-rollback.md` for rollback instructions.

## Coming soon

- `wf-brain` (v2.1) — RAG knowledge layer with hybrid search
- `wf-design` (v2.2) — Figma + pixelmatch verification
- `wf-cockpit` (v2.3+) — Web UI for agent team observability
```

- [ ] **Step 3: Remove any remaining references to `install.sh`**

```bash
grep -n "install\.sh\|install-mode\|wf-source\|wf-last-check" README.md
```

Expected after edits: zero matches.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs(v2): rewrite README to lead with plugin install flow"
```

---

### Task 30: Add the v2.0.0 entry to `CHANGELOG.md`

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Insert the v2.0.0 entry above the current `[1.11.1]` entry**

Find line 9 (`## [1.11.1] - 2026-04-07`) and insert ABOVE it:

```markdown
## [2.0.0] - <release-date>

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
- `scripts/bump-version.sh` lockstep version bumper
- LICENSE file (MIT) — previously the README claimed MIT but no LICENSE existed
- Cockpit-ready event log seam in `/wf-team-delegate` (off by default; reads
  `cockpit.eventLog` from `workflow.json`)
- Automated test harness for the migration helper (`tests/migration/run-tests.sh`)
  with fixtures for v1.0.0, v1.5.0, v1.11.1, and never-installed states

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
- `uninstall.sh` (replaced by `/plugin uninstall`)
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
```

Leave `<release-date>` as a literal placeholder — Task 35 replaces it with the actual date when v2.0.0 is tagged.

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs(v2): add v2.0.0 CHANGELOG entry"
```

---

### Task 31: Create `docs/v2.0-rollback.md`

**Files:**
- Create: `docs/v2.0-rollback.md`

- [ ] **Step 1: Write the rollback doc**

```markdown
# v2.0 Rollback Guide

Both a user rollback path (you installed v2.0 and hit problems) and a maintainer rollback path (we need to yank v2.0 for all users).

## User rollback

### Option 1 — You used the migration helper with backup (recommended)

The migration helper created a backup at `~/.claude/wf-system-backup-<UTC-timestamp>/` before making any changes. Find the most recent one:

    ls -la ~/.claude/ | grep wf-system-backup

Then restore it:

    cp -a ~/.claude/wf-system-backup-<timestamp>/* ~/.claude/

Uninstall the v2.0 plugin:

    # In Claude Code:
    /plugin uninstall wf-core@wf-system

You're back to your pre-migration v1.x state.

### Option 2 — You ran the migration helper with `--no-backup`

You can re-install v1.11.1 directly from the tagged v1.x release:

    git clone https://github.com/matheusslg/wf-system.git
    cd wf-system
    git checkout v1.11.1-final-installer
    ./install.sh

Then uninstall the v2.0 plugin as in Option 1.

## Maintainer rollback (post-release)

### Preferred — ship a v2.0.1 fix

If v2.0 has an issue affecting many users, the fastest fix is always to ship `v2.0.1` with the correction. `/plugin update` picks it up automatically.

### Fallback — re-ship v1.x patch

If `v2.0.1` isn't viable quickly, cut a `v1.11.2` from the `v1.11.1-final-installer` tag with the minimum fix:

    git checkout -b hotfix/v1.11.2 v1.11.1-final-installer
    # ... apply fix ...
    git tag v1.11.2
    git push origin v1.11.2

Tell users to install from that tag via the legacy install.sh (which lives in git history at `v1.11.1-final-installer`):

    git clone https://github.com/matheusslg/wf-system.git
    cd wf-system
    git checkout v1.11.2
    ./install.sh

Note: `install.sh` has been deleted from `main` in v2.0 — it only exists on the `v1.11.1-final-installer` and earlier tags.
```

- [ ] **Step 2: Commit**

```bash
git add docs/v2.0-rollback.md
git commit -m "docs(v2): add rollback guide (user + maintainer paths)"
```

---

### Task 32: Create `scripts/bump-version.sh` and bump to 2.0.0

**Files:**
- Create: `scripts/bump-version.sh`
- Modify: `VERSION`, `plugins/wf-core/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` (via the script)

- [ ] **Step 1: Write the bump script**

File: `scripts/bump-version.sh`

```bash
#!/usr/bin/env bash
# Lockstep version bumper for wf-system.
# Usage: bump-version.sh <new-version>   (e.g., bump-version.sh 2.0.0)

set -eu

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <new-version>" >&2
  exit 2
fi

NEW="$1"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# 1. VERSION file
echo "$NEW" > "$REPO_ROOT/VERSION"

# 2. plugin.json
PLUGIN_JSON="$REPO_ROOT/plugins/wf-core/.claude-plugin/plugin.json"
python3 - "$PLUGIN_JSON" "$NEW" <<'PY'
import json, sys
path, new = sys.argv[1], sys.argv[2]
with open(path) as f:
    data = json.load(f)
data["version"] = new
with open(path, "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
PY

# 3. marketplace.json
MKT_JSON="$REPO_ROOT/.claude-plugin/marketplace.json"
python3 - "$MKT_JSON" "$NEW" <<'PY'
import json, sys
path, new = sys.argv[1], sys.argv[2]
with open(path) as f:
    data = json.load(f)
data["metadata"]["version"] = new
with open(path, "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
PY

echo "Version bumped to $NEW in:"
echo "  - VERSION"
echo "  - $PLUGIN_JSON"
echo "  - $MKT_JSON"
```

```bash
chmod +x scripts/bump-version.sh
```

- [ ] **Step 2: Run the bump**

```bash
./scripts/bump-version.sh 2.0.0
cat VERSION
```

Expected: `2.0.0`

- [ ] **Step 3: Verify all three files**

```bash
cat VERSION
python3 -c "import json; print(json.load(open('plugins/wf-core/.claude-plugin/plugin.json'))['version'])"
python3 -c "import json; print(json.load(open('.claude-plugin/marketplace.json'))['metadata']['version'])"
```

Expected: all three print `2.0.0`.

- [ ] **Step 4: Commit**

```bash
git add scripts/bump-version.sh VERSION plugins/wf-core/.claude-plugin/plugin.json .claude-plugin/marketplace.json
git commit -m "chore(v2): add bump-version.sh and bump to 2.0.0"
```

---

### Task 33: Create `tests/smoke/v2.0-smoke-test.md` (manual checklist)

**Files:**
- Create: `tests/smoke/v2.0-smoke-test.md`

- [ ] **Step 1: Write the manual smoke test checklist**

```markdown
# v2.0.0 Manual Smoke Test Checklist

Run this checklist against every RC and before cutting `v2.0.0`. All five categories from spec §7 must pass. No partial pass.

## Category 1 — Plugin format validation

- [ ] `${CLAUDE_PLUGIN_ROOT}` resolves inside the Python hook (verified via Task 1 probe before day-one implementation)
- [ ] `hooks/hooks.json` PostToolUse hook fires on tool use
- [ ] `hooks/hooks.json` Stop hook fires on session end
- [ ] `/wf-` autocomplete shows all 30 wf commands
- [ ] `/wf-implement "test"` successfully Reads `${CLAUDE_PLUGIN_ROOT}/skills/wf-dev-pipeline/SKILL.md`
- [ ] `/plugin marketplace add matheusslg/wf-system@feature/plugin-migration-v2` succeeds (RC dogfood path)

## Category 2 — F1 dedup correctness

- [ ] Branch safety blocks `/wf-implement` on `main`
- [ ] Branch safety blocks `/wf-fix-bug` on `main`
- [ ] Branch safety blocks `/wf-improve` on `main`
- [ ] `/wf-implement` against a real gh issue posts closing comment titled "Feature Implemented"
- [ ] `/wf-fix-bug` against a real gh issue posts closing comment titled "Bug Fixed"
- [ ] `/wf-improve` against a real gh issue posts closing comment titled "Improvement Complete"
- [ ] `/wf-implement` suggested commit prefix is `feat:`
- [ ] `/wf-fix-bug` suggested commit prefix is `fix:`
- [ ] `/wf-improve` suggested commit prefix is `improve:`
- [ ] Forcing reviewer CHANGES_REQUESTED loops back to developer
- [ ] Forcing QA FAILED loops back to developer

## Category 3 — Migration helper safety

- [ ] `tests/migration/run-tests.sh` exits 0 on a clean checkout
- [ ] Manual dry-run against maintainer's real `~/.claude/` produces sensible output

## Category 4 — Orchestrator hook behavior parity

- [ ] Context monitoring soft warning fires at ~75%
- [ ] Context monitoring critical warning fires at ~90%
- [ ] WIP detection still works in stop hook
- [ ] `_brain_search()` silently no-ops (brain not installed in v2.0)
- [ ] Stop sound plays on macOS
- [ ] Stop sound does NOT error on Linux (skip if no Linux test machine)
- [ ] `~/.wf-state/` created on first hook fire (NOT `~/.claude/hooks/.wf-state/`)
- [ ] workflow.json discovery walks 3 parent dirs

## Category 5 — End-to-end smoke test

Run this full sequence in a fresh Claude Code session:

- [ ] `/plugin marketplace add matheusslg/wf-system` → marketplace registers
- [ ] `/plugin install wf-core@wf-system` → installation completes
- [ ] Restart Claude Code
- [ ] `cd ~/wf-system-test-project && claude` (throwaway test project)
- [ ] `/wf-init` → creates `.claude/workflow.json`
- [ ] `/wf-start-session` → logs session start; orchestrator fires
- [ ] `/wf-implement "Add a hello-world endpoint"` → branch safety → agent chain → progress.md updated
- [ ] `/wf-commit` → creates a `feat:` commit
- [ ] `/wf-end-session` → Stop hook fires, sound plays (macOS)
- [ ] `/plugin uninstall wf-core@wf-system` → cleanly uninstalls
- [ ] `rm -rf ~/wf-system-test-project` (cleanup)

## Shippability gate

**All boxes above must be checked for the current RC before cutting `v2.0.0`.**
```

- [ ] **Step 2: Commit**

```bash
git add tests/smoke/v2.0-smoke-test.md
git commit -m "test(v2): add manual smoke test checklist"
```

---

## Phase F — RC and release

### Task 34: Run full smoke test suite → cut v2.0.0-rc.1

**Why:** Spec §6.3 mandates at least one RC before tagging v2.0.0. This task is the dogfood entry point.

- [ ] **Step 1: Run the automated migration helper tests**

```bash
bash tests/migration/run-tests.sh
```

Expected: `Tests failed: 0`. Any failure blocks the RC.

- [ ] **Step 2: Work through every checkbox in `tests/smoke/v2.0-smoke-test.md` (Categories 1-5)**

For each checkbox:
- If it passes, mark it in the file.
- If it fails, STOP, commit a fix on `feature/plugin-migration-v2`, re-run the affected category.

**Do NOT proceed to Step 3 until every box is checked.**

- [ ] **Step 3: Commit the smoke test results (the checked checklist)**

```bash
git add tests/smoke/v2.0-smoke-test.md
git commit -m "test(v2): smoke test passes for v2.0.0-rc.1"
```

- [ ] **Step 4: Tag `v2.0.0-rc.1`**

```bash
git tag -a v2.0.0-rc.1 -m "Release candidate 1 for v2.0.0 plugin migration"
git push origin feature/plugin-migration-v2
git push origin v2.0.0-rc.1
```

- [ ] **Step 5: Reset the smoke checklist for next RC**

Uncheck all boxes in `tests/smoke/v2.0-smoke-test.md` (so a later RC gets a clean run). Commit that.

```bash
git commit -am "test(v2): reset smoke checklist for next RC"
```

---

### Task 35: Dogfood v2.0.0-rc.N for ≥3 days, then cut v2.0.0

**Why:** Spec §6.3 requires a 3-day minimum dogfood period before the final tag.

- [ ] **Step 1: Install the RC locally via the feature branch marketplace path**

```bash
# In Claude Code:
/plugin marketplace add matheusslg/wf-system@feature/plugin-migration-v2
/plugin install wf-core@wf-system
```

**If `@branch-ref` syntax is not supported:** use the local filesystem install path (`/plugin marketplace add ~/wf-system`) and document the branch-ref limitation in `docs/v2.0-rollback.md` as a known issue.

- [ ] **Step 2: Use the RC for daily work on wf-system itself**

For at least 3 days, use the RC for every development task on `wf-system`. Specifically:
- Start sessions with `/wf-start-session`
- End sessions with `/wf-end-session`
- Use `/wf-implement`, `/wf-fix-bug`, `/wf-improve` for any work on this branch
- Watch for hook failures, context monitoring issues, and any surprising behavior

Log every issue found to a scratch file at `~/wf-system-rc-issues.md`.

- [ ] **Step 3: For each issue found, cut a new RC**

```bash
# Fix the bug on feature/plugin-migration-v2
git commit -m "fix(v2): <description of fix>"

# Re-run the affected smoke test category
# Then cut rc.N+1
./scripts/bump-version.sh 2.0.0   # no-op if already 2.0.0
git tag -a v2.0.0-rc.N+1 -m "Release candidate N+1"
git push origin v2.0.0-rc.N+1
```

Reset the dogfood clock with each new RC. Only tag v2.0.0 after 24 hours of clean dogfooding on the latest RC with zero new issues.

- [ ] **Step 4: Fill in the release date in `CHANGELOG.md`**

Find the line `## [2.0.0] - <release-date>` and replace `<release-date>` with today's actual UTC date (`YYYY-MM-DD`).

```bash
git commit -am "docs(v2): set v2.0.0 release date"
```

- [ ] **Step 5: Tag v2.0.0**

```bash
git tag -a v2.0.0 -m "v2.0.0 — plugin migration (hard cutover from install.sh)"
git push origin v2.0.0
```

- [ ] **Step 6: Open the cutover PR**

```bash
gh pr create \
  --base main \
  --head feature/plugin-migration-v2 \
  --title "v2.0.0 — plugin migration (hard cutover)" \
  --body "$(cat <<'EOF'
## Summary

Migrates wf-system from install.sh distribution to the Claude Code Plugins
Marketplace format. Hard cutover — no parallel install paths.

Ships v2.0 with one plugin (`wf-core`) containing the daily workflow loop.
wf-brain, wf-design, and wf-cockpit are deferred to v2.1/v2.2/v2.3+.

Also includes the F1 dedup of `/wf-implement`, `/wf-fix-bug`, `/wf-improve`
into a shared `wf-dev-pipeline` skill. ~855 LOC removed; three drift bugs
fixed in the process.

**Spec:** docs/superpowers/specs/2026-04-07-wf-system-plugin-migration-design.md
**Plan:** docs/superpowers/plans/2026-04-08-wf-system-plugin-migration-v2.md
**Rollback:** docs/v2.0-rollback.md

## Test plan

- [x] `tests/migration/run-tests.sh` exits 0
- [x] Manual smoke test (5 categories) passed for v2.0.0-rc.N
- [x] ≥3-day dogfood on the latest RC with no new issues

## Breaking changes

install.sh is removed. v1.x users must run
`scripts/migrate-to-plugin.sh` before installing v2.0. See CHANGELOG for
the full breaking-changes notice.

Users who want to stay on v1.x can pin to the `v1.11.1-final-installer` tag.
EOF
)"
```

- [ ] **Step 7: Merge the PR (after user approval)**

Merge as a single merge commit (preserving the granular feature branch history). The PR should also include the `docs/plugin-migration-spec` branch if that's still separate — ensure both land in main together.

- [ ] **Step 8: Create the GitHub release**

```bash
gh release create v2.0.0 \
  --title "v2.0.0 — Plugin Migration" \
  --notes "$(awk '/^## \[2.0.0\]/,/^## \[1.11.1\]/' CHANGELOG.md | sed '$d')"
```

- [ ] **Step 9: Final verification**

```bash
# Uninstall any local dev installs
/plugin marketplace remove wf-system

# Install from the public marketplace flow as if a new user
/plugin marketplace add matheusslg/wf-system
/plugin install wf-core@wf-system
```

Expected: installs cleanly against the published `main` + the v2.0.0 tag.

---

## Self-review (run after plan is written; fix inline)

**Spec coverage check:**

| Spec section | Covered by task |
|---|---|
| §1 Plugin architecture | Tasks 2-10 (scaffolding, manifests, content migration, hook bundling) |
| §2 F1 dedup | Tasks 11-14 (shared skill + three shims) |
| §3 Orchestrator hook bundling | Tasks 8, 9 (hooks.json, orchestrator edits) |
| §3.5.1 wf-team-* unchanged | Task 5 (copied byte-identical) + Task 15 (additive event-log) |
| §3.5.2 Future plugin announcement | Task 29 (README "Coming soon") |
| §3.5.3 Cockpit event log seam | Task 15 |
| §3.5.4 wf-delegate audit deferred | N/A (deferred item, not in this plan) |
| §4 Manifests | Tasks 3, 4 (plugin.json, marketplace.json, LICENSE) |
| §4.5 README rewrite | Task 29 |
| §5 Migration helper | Tasks 16-27 (TDD loop) |
| §6.1 Branch strategy | Task 2 (branch + tag), Task 35 (cutover PR) |
| §6.2 Version lockstep | Task 32 (bump-version.sh) |
| §6.3 RC strategy | Tasks 34, 35 |
| §6.4 CHANGELOG | Task 30 |
| §6.7 Rollback docs | Task 31 |
| §7 Testing (5 categories) | Task 33 (checklist), Task 34 (execution gate) |
| §7.5 Migration fixtures (v1.0.0/v1.5.0/v1.11.1/never-installed) | Tasks 17, 26, 27 |

All spec sections have at least one task. No gaps.

**Placeholder scan:** this plan contains no "TBD" / "implement later" / "similar to" / bracketed-without-content items. Task 11 (wf-dev-pipeline skill) contains bracketed section references to the source files the engineer reads — those are instructions to copy real content from real files, not placeholders.

**Type/naming consistency:**

- `wf-dev-pipeline` skill is referenced consistently across Task 11, Tasks 12-14 (shim content), and the spec mode table.
- `${CLAUDE_PLUGIN_ROOT}` appears in Task 8 (hooks.json), Task 9 (orchestrator), Tasks 12-14 (shim Read paths) — always with the same syntax.
- `wf-system` marketplace name (kebab-case) vs `matheusslg/wf-system` github path — distinguished correctly in Tasks 3, 29, 35.
- Test fixture paths use consistent naming: `tests/migration/fixtures/v<version>-fresh-install/.claude/...`.
- Migration helper flags: `--dry-run`, `--no-backup`, `--project`, `--include-global`, `--yes` — used identically in Tasks 19, 22, 23, 24, 25, 27.

**KISS check (user's explicit directive):**

- No speculative flexibility. The helper has 5 flags; none are "just in case". Each has a specific test in Tasks 22-27.
- No premature abstractions. Three shim commands have the same structure but are written out explicitly rather than generated.
- Manual testing for everything except the helper (which is properly testable in isolation). No CI, no command unit tests.
- `scripts/bump-version.sh` is 30 lines of bash+Python rather than a Node.js tool.

---

## Deliverables after plan completes

At v2.0.0 tag:

- `plugins/wf-core/` — a working Claude Code plugin with 30 commands, 5 agent templates, 8 skills (including `wf-dev-pipeline`), 1 hook, 1 orchestrator script
- `.claude-plugin/marketplace.json` — marketplace registry
- `scripts/migrate-to-plugin.sh` — one-shot migration helper with 5 flags, tested against 5 fixtures
- `scripts/bump-version.sh` — lockstep version bumper
- `tests/migration/` — automated test harness (~10 test cases)
- `tests/smoke/v2.0-smoke-test.md` — manual verification checklist
- `LICENSE` — MIT
- `CHANGELOG.md` — v2.0.0 entry with full breaking-changes notice
- `docs/v2.0-rollback.md` — user + maintainer rollback procedures
- `README.md` — rewritten to lead with plugin install
- Tags: `v1.11.1-final-installer`, `v2.0.0-rc.N` (≥1), `v2.0.0`

Out of scope for v2.0 (deferred per spec):
- `wf-brain` plugin → v2.1
- `wf-design` plugin → v2.2
- `wf-cockpit` plugin → v2.3+
- `wf-delegate` vs `wf-team-delegate` audit → v2.x
- progress.md retirement → v3.x (with concerns to resolve first)
