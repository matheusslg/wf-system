# wf-system: System Audit

> **Date:** 2026-04-07
> **Auditor:** Claude (Opus 4.6) via Claude Code, instructed to be opinionated and critical
> **Repo state at audit time:** branch `release/web-v1.0.1`, version `1.10.0`, last release 2026-04-03
> **Status:** Open — findings not yet acted on

---

## How to use this document

You are a future Claude Code session in the `~/wf-system` repo. The owner asked the previous session for an opinionated assessment of what's weak in this codebase. This document captures those findings so you don't have to repeat the exploration.

**Read this first, then verify before acting.** Findings include file:line citations from the audit pass, but the codebase moves; check current state before applying any fix. If a finding contradicts what you see in the code now, trust the code, not this doc.

**The owner's stated values** (from `~/.claude/CLAUDE.md`): KISS, do not overengineer, no `as any` in TypeScript, devil's advocate perspectives, intellectual honesty over agreement, neutral analysis. Findings here were written to those standards. Do not water them down.

**This audit was produced in the context of a broader conversation** about improving the owner's daily workflow, including parallel discussions about: tmux for multi-Claude sessions, Claude Code Agent Teams visibility, long-lived agents with memory (Letta Code, mem0, Zep), MCP memory servers, and "harness engineering" as a discipline. wf-system is the owner's existing answer to many of these problems — that context is why several findings reference memory architecture and the wf-brain feature.

---

## Top-line verdict

wf-system is **architecturally sound but suffering from feature accretion and half-finished bets.** The Python orchestrator hook is solid engineering. The CHANGELOG shows real velocity (10 versions in ~3 months). The conceptual model — sessions → pipelines → agents — is coherent. Most "Claude Code workflow systems" on GitHub are 3 markdown files and a dream. This is a real project.

Three patterns are quietly eroding it:

1. **Command sprawl with duplicate intent.** Three near-identical commands force a daily decision tax.
2. **Two large in-flight features that are partially built and partially documented.** wf-brain (memory) and Ralph integration (external loop). Half-shipped means worst-of-both-worlds.
3. **Documentation/reality drift.** progress.md is three weeks stale, the installer references a renamed command, three different sources of truth disagree on the progress.md line limit.

You can fix all of it without a rewrite. But **stop adding features until you do.**

---

## Findings, ranked by impact

Each finding has: **Impact** (high/medium/low), **Effort** (S/M/L), **Status** (open by default), and **Evidence** with file:line citations where possible. Update Status as you act.

---

### Finding 1 — Three commands are functionally identical: `/wf-implement`, `/wf-fix-bug`, `/wf-improve`

**Impact:** HIGH | **Effort:** M (half day) | **Status:** OPEN

**What:** `/wf-implement`, `/wf-fix-bug`, and `/wf-improve` all:
- Use the same allowed-tools set
- Spawn identical Developer → Reviewer → QA pipelines via `Task()`
- Update `progress.md` the same way
- Accept the same `--skip-pipeline` flag
- Differ only in the verb fed to the spawned sub-agent ("implement" vs "fix" vs "improve")

**Evidence:**
- `commands/wf-implement.md:163-175` ↔ `commands/wf-fix-bug.md:168-175` ↔ `commands/wf-improve.md:130-136` — identical `Task()` spawn signatures
- `commands/wf-implement.md:365-377` ↔ `commands/wf-fix-bug.md:344-354` ↔ `commands/wf-improve.md:280-288` — identical progress.md update logic
- `CHANGELOG.md` line for `6af3d01`: "delegate /wf-fix-bug, /wf-implement, /wf-improve to sub-agents" — single commit had to touch all three, evidence of the maintenance tax

**Why it matters specifically:**
- **Daily friction.** Every time the owner pauses to decide which to type, that's flow tax.
- **Maintenance.** Any pipeline change must be ported to three files. The CHANGELOG shows this has happened repeatedly.
- **Violates standards.md** ("Keep commands focused and single-purpose") — three commands sharing one purpose violates the principle from the duplicate-fan-out direction.
- **Token cost paid 3x.** progress.md Session 6 already flagged these as token hogs.

**Recommended fix:** Collapse to **one** command — `/wf-do <description>` or keep `/wf-implement` as the canonical name — that infers intent from the description. If explicit framing is needed, a single `--type=fix|feature|improvement` flag suffices. If full backwards compat is required, alias the other two as thin shims that delegate to the canonical command. **Estimated deletion: ~600-1000 lines of duplicated prompt.**

**Open question for the owner:** How attached are you to the semantic distinction in command names? If "muscle memory" matters, keeping the aliases is cheap. If it doesn't, just delete them.

---

### Finding 2 — `/wf-refactor` breaks the orchestrator pattern entirely

**Impact:** MEDIUM | **Effort:** S | **Status:** OPEN

**What:** Every other development command in the system enforces "the orchestrator does not implement directly — it spawns sub-agents." `/wf-refactor` allows direct `Edit`/`Write` and has no sub-agent spawning. This contradicts `commands/wf-implement.md:12-15` ("YOU ARE THE ORCHESTRATOR, NOT THE IMPLEMENTER").

**Why it matters:** Either the rule is load-bearing or it isn't. If it is, `/wf-refactor` violates it and should be brought into the pipeline. If it isn't, all the other commands are wasting context with an unenforceable rule.

**Recommended fix:** Decide. Either bring `/wf-refactor` into the pipeline (sub-agent + reviewer at minimum) or delete the orchestrator-vs-implementer rule from the other commands.

---

### Finding 3 — `/wf-breakdown` is an 835-line monolith doing seven things

**Impact:** HIGH | **Effort:** L (real refactor, several days) | **Status:** OPEN

**What:** `commands/wf-breakdown.md` (835 lines) handles:
1. GitHub issue fetch
2. Jira issue fetch
3. Codebase analysis
4. Figma context fetch (lines 188-261 — embedded, not optional)
5. Sub-task sizing rules (lines 288-290)
6. Agent assignment matrix (lines 293-302)
7. Dependency ordering (lines 304-314)
8. Dry-run mode (line 326)
9. Approval flow (line 384)
10. Multi-platform ticket creation

That's 7+ discrete concerns in one file. progress.md Session 6 already flagged it as a token hog (~4.6K).

**Why it matters:**
- Long prompts are fragile prompts. The longer the instruction set, the more the model drifts from the parts that matter.
- Figma is conceptually orthogonal to task breakdown. Embedding it taxes anyone who doesn't have Figma configured.
- Adding a third platform (Linear, etc.) means adding another conditional branch to an already-overgrown file.
- Single point of failure: if the Figma API or the Jira v3 endpoint changes, this entire command breaks.

**Recommended fix:** Split along concerns, not platforms:
- `/wf-analyze-ticket` — fetches the issue, parses requirements (platform-agnostic)
- `/wf-plan-tasks` — codebase analysis + sub-task sizing + agent assignment
- `/wf-create-tasks` — writes the tickets (only this needs to know about GitHub/Jira/Linear)
- Optional Figma support moves to a separate command (`/wf-add-design-context`?) or behind a flag

**Don't do this until Finding 1 is done.** It's a real refactor and has more failure modes.

---

### Finding 4 — `/wf-pre-prod-review` and `/wf-team-review` duplicate ~80% of each other

**Impact:** MEDIUM-HIGH | **Effort:** M | **Status:** OPEN

**What:** `commands/wf-pre-prod-review.md` is 765 lines. `commands/wf-team-review.md` is 557 lines. Both spawn the same audit dimensions (security, performance, error handling, testing, database, API contract, infrastructure, dependencies, accessibility) with copy-pasted prompts. The delta is ~200 lines of "make them a persistent team and have them cross-examine each other."

**Why it matters:** When you tweak the security audit prompt in one, you'll forget the other. Classic DRY violation that rots silently. You've already paid this tax — the audit confirmed the dimension prompts are duplicated verbatim.

**Recommended fix:** One command, one optional flag. `/wf-review --adversarial` or `--teams`. Pull dimension prompts out into a single source of truth (a JSON config or separate skill files) and have both modes load from it. **Saves ~400 lines and an entire class of "I forgot to update both" bugs.**

---

### Finding 5 — wf-brain is in a half-shipped state and the rest of the system already depends on it

**Impact:** STRATEGIC | **Effort:** L (decision + execution) | **Status:** OPEN

**What:** This is the most strategically interesting finding in the audit.

**The current reality, reconstructed:**
- `CHANGELOG.md` line 66 (1.5.0, 2026-03-12): "integrate brain into init, session, delegate, and team-delegate commands"
- `CHANGELOG.md` line 36 (1.9.0, 2026-03-17): "install brain scripts globally to ~/.claude/scripts/"
- `progress.md` (Session 17, dated 2026-03-12): "Phase: wf-brain Implementation (3/10 tasks done)"
- Disk state (`scripts/wf-brain/`): contains `cli.js`, `db.js`, `embed.js`, `search.js`, `seed.js` — at least 5 modules exist
- `hooks/wf-orchestrator.py:322-352`: `_brain_search()` calls the brain CLI, silently returns `None` if missing
- `hooks/wf-orchestrator.py:415, 460`: brain results auto-injected into session-start additional context
- `install.sh:101-143`: brain scripts installed as part of normal install
- Multiple commands reference `~/.claude/scripts/wf-brain.js` directly without `cli.exists()` guards

**The contradiction:** progress.md says 3/10 tasks done. Disk + CHANGELOG suggest you're at task 5+ and shipping. **progress.md is three weeks stale** (dated 2026-03-12, while CHANGELOG goes through 2026-04-03).

**Why this matters most:**
- Several commands depend on wf-brain in production code paths. The previous audit's exploration agent — reading the commands cold — *thought wf-brain might not exist at all*, because the references look ghostly. If a subagent gets confused, the owner will too in three months.
- **This is the answer to the long-running conversation about long-lived agents with memory.** wf-brain is structurally the same idea as Letta Code's memory blocks, mem0's fact extraction, and Zep's knowledge graph: SQLite + embeddings (MiniLM) + hybrid search + MCP server wrapper + auto-injection at session start. The owner is *already building* the memory layer they were asking about.

**Two paths, must pick one:**

**(a) Commit to wf-brain as a real feature.**
- Finish tasks 4-10 from the original 10-task plan (`docs/superpowers/plans/2026-03-12-wf-brain.md`)
- Update `progress.md` to reflect actual state
- Add hard preconditions in commands that need brain — fail loudly, not silently
- Document the brain in README under a "Memory System" section
- Ship a 2.0 release with brain as a headline feature
- **Stop adding other features until this is done**

**(b) Replace wf-brain with a battle-tested MCP memory server.**
- Candidates: `mem0`, `doobidoo/mcp-memory-service`, `Zep Knowledge Graph MCP`
- Keep the *workflow* (auto-injection at session start, brain references in commands) but outsource the storage layer
- wf-brain becomes a thin wrapper that calls the MCP
- Trade-off: lose the fun of building it; gain ~6 weeks of life and a maintained dependency

**Auditor's recommendation: (b).** The reason wf-brain is interesting is the *workflow* of automatic memory injection during sessions, not the embeddings algorithm. Outsource storage; keep the workflow. The owner will move 5x faster on what actually differentiates wf-system (orchestrator hook, pipeline, agent teams).

**The owner has not made this decision yet. Don't pick for them; surface it.**

---

### Finding 6 — Ralph integration is half-built and partially undocumented

**Impact:** MEDIUM | **Effort:** S-M | **Status:** OPEN

**What:** `docs/ralph-integration.md` lays out a clean implementation path with three required pieces:
1. Env vars in the hook (`WF_EXTERNAL_LOOP`, `WF_UNATTENDED`) — **DONE**, see `hooks/wf-orchestrator.py:364, 510-513, 574`
2. `scripts/ralph-wf.sh` wrapper script — **MISSING** (not in `scripts/`)
3. `.claude/pipeline-state.json` for cross-session pipeline persistence — **MISSING**

**Why it matters:** You did the hard part (hook integration) and stopped before the easy parts (wrapper script and state file). **Half-implemented integrations rot fastest** because they look done from the outside but break the moment anyone tries to use them.

**Side smell:** `docs/ralph-integration.md:281` references "Claude Code + Ralph (Medium, paywalled)" as the canonical source. Trusting an unverifiable paywalled article as the design reference is a smell.

**Recommended fix:** Either (a) finish the wrapper script and state file, or (b) rip the env-var handling out of the orchestrator and delete `docs/ralph-integration.md`. Pick one. The current state benefits no one.

---

### Finding 7 — Multi-project story is partially solved but undocumented, and `install.sh` references a renamed command

**Impact:** MEDIUM | **Effort:** S (one-line bug + docs) | **Status:** OPEN

**What's actually working** (and the original audit got this wrong on first pass):
- The orchestrator hook **does** walk up 3 parent directories looking for `workflow.json` (`hooks/wf-orchestrator.py:165-178`). So a parent monorepo's `workflow.json` applies to children. This is more graceful than a flat per-project requirement.

**What's broken:**

1. **README and command docs don't mention parent-walking.** Users don't know they have this capability. Power users would benefit from knowing.
2. **The 3-level limit is arbitrary.** Deeply nested layouts (e.g., `~/Documents/Gnarlysoft New/sxrx/sxrx-app/apps/web`) silently fall outside the lookup window.
3. **`install.sh:227` and `install.sh:233` both reference `/wf-init-project`** — a command that was renamed to `/wf-init` in version 1.1.0 (`CHANGELOG.md` line 178). **The installer is telling new users to run a command that doesn't exist anymore.** Easy fix, embarrassing miss for an OSS project.

**Recommended fixes (in priority order):**
1. **One-line bug fix:** Change `install.sh:227,233` to `/wf-init`. (Five minutes of work.)
2. Document the parent-walking behavior in `README.md` under a "Multi-project usage" section.
3. Make `parentLookupDepth` a configurable setting (default 3). Power users with deep layouts can bump it.
4. **Bigger improvement:** Support a `~/.claude/wf-system/global-workflow.json` as the ultimate fallback. The owner explicitly works across many professional projects — a global default with per-project overrides would directly serve that.

---

### Finding 8 — `/wf-overview` and `/wf-debug` are stubs hiding inside a mature framework

**Impact:** LOW-MEDIUM | **Effort:** S (delete) or M (build out) | **Status:** OPEN

**What:**
- `commands/wf-overview.md` (71 lines) just reads the last 50 lines of `progress.md` and suggests other commands. It's a 10-line shell function pretending to be a workflow command.
- `commands/wf-debug.md` (111 lines) has no actual debugging methodology. Step 5 has no content. Step 7 "Propose Solution" is a placeholder.

**Why it matters:** Half-done commands are worse than missing commands because they erode trust in the rest of the system. They occupy the same cognitive slot as real commands.

**Recommended fix:** Either invest in them properly or delete them. **Default recommendation: delete both.** `/wf-overview`'s value is tiny — `cat progress.md | tail -50` does the same thing. `/wf-debug`'s methodology is missing entirely; if you want a debug helper, build one with actual structured questions (root cause analysis, hypothesis tracking, etc.) — don't ship a placeholder.

---

### Finding 9 — Documentation drift across `progress.md`, `CHANGELOG.md`, and reality

**Impact:** MEDIUM (compounds over time) | **Effort:** S (per-incident) | **Status:** OPEN

**What:**
- `progress.md` last updated 2026-03-12, says wf-brain is 3/10 done.
- `CHANGELOG.md` says wf-brain shipped in 1.5.0 on 2026-03-12 *and* 1.9.0 added "install brain scripts globally" on 2026-03-17.
- Version 1.10.0 (2026-04-03) added a whole "relay" feature you've never written about in `progress.md` (`CHANGELOG.md` lines 11-21).
- The "Next Session Should" list in `progress.md` is months out of date.
- **Three different sources disagree** on the progress.md line limit:
  - `progress.md:5` says 400 lines
  - `hooks/wf-orchestrator.py:36` (`PROGRESS_LINE_LIMIT`) says 450
  - The exploration agent reported `wf-end-session.md` archives at 500

**Why it matters:** This is the documentation entropy that kills personal projects. You can't trust your own notes, so you stop reading them, so you forget what you decided, so you re-decide things badly. **It's almost always the leading indicator of a project that's about to stall.**

**The structural fix (not cosmetic):**
- **`progress.md` should be generated by `wf-brain`**, not maintained by hand. `/wf-end-session` already updates it; make that the *only* writer. If you're hand-editing `progress.md`, you've already lost.
- Pick one number for the line limit. Put it in `templates/workflow.json.example` so it's configurable. Update all three references to read from one source.

---

### Finding 10 — Zero automated tests for commands or hooks

**Impact:** MEDIUM (bus factor risk) | **Effort:** M | **Status:** OPEN

**What:** `standards.md` testing section: "Test commands manually by running them in a test project." That's the entire strategy.

**What is tested:** Only `scripts/wf-brain/` has tests (CHANGELOG: `13 tests passing`, `9 tests passing`, `3 tests passing`).

**What is NOT tested:**
- 32 command markdown files
- 700-line `wf-orchestrator.py`
- The installer (`install.sh`)
- The MCP server wrapper

**Why it matters:** For an OSS project with bus factor 1, this is real risk. Evidence: the YAML escaping bug in `argument-hint` had to be fixed twice (CHANGELOG: `quote argument-hint values to prevent YAML parsing error`, `fix YAML parsing crash in 7 commands`). A frontmatter linter would have caught both before merge.

**Minimum viable test suite:**
1. **Hook smoke test:** pipe a fake `hook_input` JSON into `wf-orchestrator.py`, assert it doesn't crash and returns valid JSON.
2. **Installer integration test:** run `install.sh` against a temp directory, assert symlinks/files exist.
3. **Frontmatter linter:** parse all `commands/*.md` and assert YAML frontmatter is valid and contains required keys (`description`, `allowed-tools`, `argument-hint`).

This is ~half a day of work and dramatically reduces the risk surface.

---

## Smaller smells (Tier 4)

These are individual issues, not patterns. Worth fixing but not urgent.

### S1. `PRE_COMPACT_THRESHOLD` and `WARNING_THRESHOLD` are both 75
**Location:** `hooks/wf-orchestrator.py:32-33`
```python
PRE_COMPACT_THRESHOLD = 75  # Trigger /wf-end-session (first alert)
WARNING_THRESHOLD = 75      # Repeated warning threshold (same as above)
```
The two-threshold abstraction is fiction. They're the same number. The two `if` branches at lines 517-555 produce nearly identical messages. **Either delete one or actually use different values** (e.g., warn at 70%, force at 85%). Right now this is dead architectural ceremony.

### S2. macOS-only sound notification with no fallback
**Location:** `hooks/wf-orchestrator.py:591`
```python
subprocess.Popen(["afplay", "/System/Library/Sounds/Glass.aiff"], ...)
```
Linux users in autonomy mode get silent notifications. Not a bug per se, but a portability gap for an OSS tool. Consider: use Python's `bell` (`\a`) as fallback, or skip the sound on non-Darwin.

### S3. Brittle regex for `/context` output parsing
**Location:** `hooks/wf-orchestrator.py:219`
```python
m = re.search(r'\*\*Tokens:\*\*\s+([\d.]+)k?\s*/\s*([\d.]+)k?\s*\((\d+)%\)', text)
```
If Anthropic changes the `/context` output format, context monitoring silently breaks. The fallback to JSONL parsing is good, but the regex should at least log a warning when it fails to match. (This is actually a clever use of `claude -p -r` to call Claude Code's own command — don't remove it, just make the failure mode visible.)

### S4. Hardcoded `~/.claude/scripts/wf-brain.js` path repeated everywhere
**Locations:** `hooks/wf-orchestrator.py:327` and across ~6 commands
**Fix:** Single constant in the hook; commands should reference a config var or environment variable.

### S5. MCP server install silently no-ops if source files don't exist
**Location:** `install.sh:127-139`
```bash
for f in index.js package.json; do
  SRC="$REPO_DIR/.claude/mcp-servers/wf-brain/$f"
  if [ -f "$SRC" ]; then
    # ...
  fi
done
```
No `else`, no warning. The kind of failure that's invisible until weeks later when the brain MCP isn't loading and you can't figure out why.

### S6. `/wf-update` URL is hardcoded to one user's GitHub fork
**Location:** `hooks/wf-orchestrator.py:40`
```python
VERSION_URL = "https://raw.githubusercontent.com/matheusslg/wf-system/main/VERSION"
```
Fine while you (`matheusslg`) are the maintainer. Failure mode if you ever transfer ownership or rename the repo. Consider: read from `~/.claude/hooks/.wf-source` (which install.sh writes) and derive the URL from it.

### S7. WIP detection regex on free-form markdown
**Location:** `hooks/wf-orchestrator.py:309-311`
```python
match = re.search(r'Working on [#\w-]+\d+', content)
```
A typo or formatting drift in `progress.md` silently breaks WIP detection — and the failure is invisible because the hook just doesn't show the WIP banner. If you're going to parse markdown, at least define a strict format and validate it on save in `/wf-end-session`.

---

## What's actually strong (do not break these)

Intellectual honesty: this audit was asked to find weakness, and it did. But the foundation is good. Don't let the criticism distract you from preserving what works.

### ★ The orchestrator hook is solid Python
**File:** `hooks/wf-orchestrator.py`

- Type hints throughout (`Dict[str, Any]`, `Optional[str]`, `Tuple[int, float]`)
- `pathlib.Path` for all file operations (per your own standards.md)
- Defensive exception handling that doesn't hide errors maliciously
- State persistence with automatic 7-day cleanup (lines 81-89)
- Daily background update checks with 3-second timeout (non-blocking)
- The clever `claude -p -r <session_id> "/context" --output-format json` trick for authoritative context monitoring (lines 211-225) with JSONL fallback
- Workflow detection that walks up 3 parent directories (lines 165-178)
- Multi-mode entry point (PostToolUse vs Stop) with clean separation

**This is the kind of code I'd expect from a production-grade tool, not a personal project. Don't refactor it for the sake of refactoring.**

### ★ The Agent Teams pipeline (`/wf-team-delegate`) is conceptually ambitious
Persistent teammates that retain context across review/QA cycles, with direct DMs between Reviewer and Developer to avoid re-loading context on iteration. This is an early adoption of Anthropic's experimental Agent Teams feature, applied with real architectural thinking. Even if `/wf-team-delegate.md` itself is bloated (750+ lines per agent count), the *idea* is valuable.

### ★ Adversarial review (`/wf-team-review`) addresses anchoring bias
The cross-examination phase between independent reviewers is a genuinely novel pattern that addresses a real failure mode of single-reviewer audits. The implementation is bloated (see Finding 4), but **keep the idea**.

### ★ `/wf-pr-comments` and `/wf-qa-plan` are the highest-quality commands
Per the audit's command-by-command review, these two are focused, complete, and don't bleed into adjacent concerns. They're the pattern the rest of the commands should aspire to.

### ★ Ralph integration research shows real systems thinking
`docs/ralph-integration.md` correctly identifies the architectural conflicts (context management, pipeline persistence, stop-hook interactivity) and proposes concrete solutions. Even though the integration is half-built (Finding 6), the *analysis* is high-quality.

### ★ Project hygiene
- 11 versioned releases in 3 months
- Conventional Commits enforced (per `standards.md`)
- Semver followed
- Real CHANGELOG that tracks features and fixes separately
- Symlink-vs-copy choice in installer with sensible default
- Graceful degradation when `jq` not available (`install.sh:180-201`)

For a 1-person OSS project, this discipline is rare.

### ★ wf-brain architecture is correct
SQLite + embeddings (MiniLM) + hybrid search (semantic + keyword fallback) + MCP server wrapper + auto-injection at session start. This is structurally the same as mem0/Letta/Zep. **You're not faking memory — you're building a real memory layer.** The question isn't whether the architecture is right (it is); the question is whether to finish building it yourself or to swap the storage layer for an existing MCP server (Finding 5).

---

## The single highest-leverage move

If you do **one thing**, do **Finding 1**: collapse `/wf-implement`, `/wf-fix-bug`, `/wf-improve` into one command and delete the other two.

- ~600-1000 lines of duplicated prompt deleted
- The single most common cognitive friction in your daily workflow eliminated
- Zero risk of breaking anything that matters
- Half-day of work
- Pure subtraction (KISS, your stated value)

If you want a slightly bigger move: **make the wf-brain decision (Finding 5)**. Either commit to finishing it or replace it with mem0/doobidoo. The current half-state is the worst of both worlds. Don't keep adding features until this is decided.

---

## Quick action checklist

Use this as a working TODO. Update Status as you act.

### Immediate (one-line / under an hour)
- [ ] **S6.1:** Fix `install.sh:227,233` — change `/wf-init-project` to `/wf-init`. Five-minute fix.
- [ ] **S1:** Either delete `WARNING_THRESHOLD` or set it to a different value than `PRE_COMPACT_THRESHOLD`. Thirty seconds + a test.
- [ ] **F9.1:** Pick ONE number for the progress.md line limit. Update `progress.md:5`, `hooks/wf-orchestrator.py:36`, and `wf-end-session.md` to agree.

### Short (half-day)
- [ ] **F1:** Collapse `/wf-implement`, `/wf-fix-bug`, `/wf-improve` into one canonical command. Delete the others or alias them.
- [ ] **F2:** Decide if `/wf-refactor` joins the orchestrator pipeline or if the orchestrator-vs-implementer rule gets relaxed.
- [ ] **F8:** Decide whether to delete `/wf-overview` and `/wf-debug` or build them out properly. Default: delete.

### Medium (1-2 days)
- [ ] **F4:** Collapse `/wf-pre-prod-review` and `/wf-team-review` into one command with an `--adversarial` flag. Pull dimension prompts into a single source of truth.
- [ ] **F6:** Either finish Ralph integration (wrapper script + state file) or rip the env-var handling out and delete `docs/ralph-integration.md`.
- [ ] **F7:** Document the parent-walking workflow.json behavior in README. Optionally add a global fallback at `~/.claude/wf-system/global-workflow.json`.
- [ ] **F10:** Add minimum viable test suite: hook smoke test + installer integration test + frontmatter linter.

### Big strategic decision (must be made before continuing)
- [ ] **F5:** **Decide wf-brain path (a) or (b).** Either commit to finishing it as your own feature, or replace storage layer with an existing MCP server. **Stop adding other features until this is decided.**

### Larger refactor (only after F1 is done)
- [ ] **F3:** Split `/wf-breakdown` into `/wf-analyze-ticket`, `/wf-plan-tasks`, `/wf-create-tasks`. Move Figma support to a separate command or behind a flag.

### Hygiene improvements (low priority)
- [ ] **S2:** Add non-macOS fallback for sound notification in autonomy mode.
- [ ] **S3:** Log a warning when `/context` regex parse fails (to detect Claude Code format changes).
- [ ] **S4:** Centralize the `~/.claude/scripts/wf-brain.js` path.
- [ ] **S5:** Add warning when MCP server source files are missing during install.
- [ ] **S6:** Derive `VERSION_URL` from `.wf-source` instead of hardcoding.
- [ ] **S7:** Define a strict WIP format and validate on save, instead of regex-parsing free-form markdown.

---

## What was NOT verified during this audit

Methodological honesty: this audit had blind spots. A future session might want to fill them in.

- **Did not read end-to-end:** `commands/wf-team-delegate.md` (the most ambitious command in the system). Worth careful read if you're planning to invest more in agent teams.
- **Did not read:** `docs/superpowers/specs/2026-03-12-wf-brain-design.md` and `docs/superpowers/plans/2026-03-12-wf-brain.md`. These probably contain design rationale for wf-brain that contextualize Finding 5.
- **Did not read:** `commands/wf-generate.md` (file too large for a single Read in the audit pass; got a token error).
- **Did not read:** `commands/wf-team-review.md` end-to-end (the exploration agent read it but my structural read focused on the hook and CHANGELOG).
- **Did not run:** any of the commands. The findings are from reading prompt text, which is the right level for "are these well-designed" but not for "do they actually work correctly."
- **Did not audit:** `templates/agents/` to see what the generated agents actually look like.
- **Did not audit:** `scripts/wf-brain/cli.js, db.js, embed.js, search.js, seed.js` source code. Confirmed they exist and have tests; did not read implementation.
- **Did not verify:** that `commands/wf-implement.md`, `wf-fix-bug.md`, and `wf-improve.md` are actually as duplicate as the exploration agent reported. Trust but verify before acting on Finding 1.

**Recommended next step if continuing the audit:** Read the three duplicate commands directly and verify Finding 1 with your own eyes before deleting anything. Then read `commands/wf-team-delegate.md` to assess whether the agent teams pipeline is worth investing more in.

---

## Methodology notes

This audit was produced via:

1. **Structural reads (manual):** README, CHANGELOG, standards.md, progress.md, install.sh, hooks/wf-orchestrator.py (full), docs/ralph-integration.md (full), scripts/wf-brain.js entry point, wf-brain folder listing.
2. **Command-by-command audit (delegated to Explore subagent):** All 32 command files in `commands/` read end-to-end. Subagent given the explicit mandate to find overlapping responsibilities, inconsistent conventions, thin/incomplete commands, bloated commands, brittle prompt engineering, unmaintained references, and KISS violations. Findings cross-referenced against the structural reads.
3. **Verification pass:** Several findings from the exploration subagent were corrected or refined based on direct reading (e.g., subagent thought wf-brain might not exist; structural reads confirmed it exists but is in flight).

**Bias declaration:** This audit was instructed to be opinionated and critical. It may be too harsh in places and miss positive patterns in others. Preserve the dissent — but don't take any single finding as gospel without verifying.

---

## For the next Claude session reading this

If the owner asks you to **act on this audit**, the recommended order is:

1. Verify Finding 1 with a direct read of the three command files. If correct, do the collapse.
2. Apply the immediate fixes (S6.1, S1, F9.1) — they're trivial and remove embarrassment.
3. Surface the wf-brain decision (Finding 5) to the owner. Don't pick (a) or (b) for them. Present both with the trade-offs.
4. Wait for the wf-brain decision before touching anything else. Several other findings depend on which direction wf-brain goes.

If the owner asks you to **continue exploring** what this audit missed, start with:

1. `commands/wf-team-delegate.md` end-to-end
2. `docs/superpowers/specs/2026-03-12-wf-brain-design.md` and `docs/superpowers/plans/2026-03-12-wf-brain.md`
3. The actual `scripts/wf-brain/*.js` source code — confirm wf-brain works, not just that it exists

If the owner asks you to **disagree with this audit**, push back. The audit could be wrong about anything. Especially worth questioning:

- Is collapsing the three duplicate commands actually a good idea, or does the semantic distinction in command names provide value the audit underestimated?
- Is wf-brain self-build vs. swap really binary, or is there a hybrid path (e.g., use wf-brain for project-local memory, use mem0 for cross-project memory)?
- Is `/wf-overview` actually serving a purpose the audit missed?

Intellectual honesty over agreement. Always.
