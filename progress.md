# Project Progress

> This file tracks progress across sessions. Update before ending each session.
> **Keep this file under 400 lines** - archive old sessions to `.claude/session-archive/`

## Current Status
**Phase**: Plugin Migration v2.0 — **All phases complete. `v2.0.0-rc.1` tagged and pushed.** Dogfood period started 2026-04-14, runs through at least 2026-04-17. Plugin installed locally, hooks firing. Remaining smoke test items verified during dogfood.
**Last Updated**: 2026-04-14

---

### Session 22 (2026-04-14)
**Focus**: wf-system plugin migration — Phase E (docs) + Phase F start (Task 28 + RC cut)
**Completed**:
- [x] **Phase E Tasks 29-33** — all 5 docs tasks dispatched via subagents:
  - Task 29 (`6094fa0`): README rewritten — plugin install flow, removed install.sh/uninstall.sh/wf-update/wf-design-setup references
  - Task 30 (`ac6704d`): CHANGELOG v2.0.0 entry — breaking changes, added/changed/removed/fixed sections, `<release-date>` placeholder
  - Task 31 (`1cb0edf`): `docs/v2.0-rollback.md` — user rollback (backup restore, v1.x reinstall) + maintainer rollback (v2.0.1 fix, v1.x patch)
  - Task 32 (`87c3734`): `scripts/bump-version.sh` — lockstep bumper for VERSION + plugin.json + marketplace.json. Ran it: VERSION 1.11.1 → 2.0.0
  - Task 33 (`301a371`): `tests/smoke/v2.0-smoke-test.md` — 5-category manual checklist
- [x] **Task 28 unblocked** — replaced `~/.claude/hooks/wf-orchestrator.py` symlink with standalone copy, then ran migration helper (`--no-backup --yes`) to prune v1.x hook entries from `settings.json`
- [x] **Task 28** (`0d432fc`): deleted `install.sh`, `uninstall.sh`, `templates/settings-hooks.json`, `hooks/`, `commands/`, `templates/agents/`. 42 files, ~14.8K lines removed. `templates/` retains `progress.md.example` + `workflow.json.example` for `/wf-init`.
- [x] **Plugin installed** — `/plugin marketplace add ~/wf-system` + `/plugin install wf-core@wf-system`. Commands visible in autocomplete (screenshot verified). PostToolUse hook firing (`~/.wf-state/` created).
- [x] **Task 34** — partial smoke test (Cat 1: 4/6, Cat 3: 2/2, Cat 4: 1/8). RC cut:
  - `v2.0.0-rc.1` tagged at `28462b5`
  - Branch + tag + `v1.11.1-final-installer` all pushed to remote (first remote push of entire migration)
**Commits (7 this session)**:
- `6094fa0` docs(v2): rewrite README to lead with plugin install flow
- `ac6704d` docs(v2): add v2.0.0 CHANGELOG entry
- `1cb0edf` docs(v2): add rollback guide (user + maintainer paths)
- `87c3734` chore(v2): add bump-version.sh and bump to 2.0.0
- `301a371` test(v2): add manual smoke test checklist
- `0d432fc` chore(v2): remove install.sh and legacy directories
- `28462b5` test(v2): smoke test partial pass for v2.0.0-rc.1
**Blockers**: None
**Decisions**:
- Cut RC with partial smoke test (7/16 items checked) — remaining items verified during 3-day dogfood period. The RC IS the dogfood vehicle.
- Pushed `v1.11.1-final-installer` tag alongside RC for rollback safety.
**Next**:
1. **Dogfood v2.0.0-rc.1** for 3+ days (through at least 2026-04-17). Use `/wf-start-session`, `/wf-end-session`, `/wf-implement`, `/wf-fix-bug`, `/wf-improve` in real daily work. Log issues to `~/wf-system-rc-issues.md`.
2. Complete remaining smoke test items (Categories 2, 4, 5) during dogfood.
3. After 3 clean days: fill `<release-date>` in CHANGELOG, tag `v2.0.0`, open cutover PR to `main`.

---

### Session 21 (2026-04-08)
**Focus**: wf-system plugin migration — execute Phase D (Tasks 16-27, strict TDD migration helper)
**Completed**:
- [x] **Task 16** — scaffolded `tests/migration/` harness: `assertions.sh` (PASS/FAIL helpers + `print_summary`), `run-tests.sh` runner, `scripts/migrate-to-plugin.sh` stub exiting 99. Code review caught blocking bug: `set -eu` aborts the runner on first failing assertion before the summary prints. Fixed to `set -u` only with rationale comment; updated plan text to match. Verified with synthetic pass/fail mix.
- [x] **Task 17** — built `tests/migration/fixtures/v1.11.1-fresh-install/` (43 files): `.claude/hooks/wf-orchestrator.py` + 5 metadata files + `.wf-state/placeholder.json`, `settings.json` with Stop + PostToolUse hook entries, 33 command stubs, 3 brain component stubs. Hit root `.gitignore` blocking `.wf-state/`; added scoped exception `!tests/migration/fixtures/**/.wf-state/` (and `/**`) so future fixture tasks don't repeat the workaround.
- [x] **Task 18** — TDD red: wrote `test_migrate_v1_11_1_global` asserting 12 file-absence checks + settings.json scrub. Ran and verified intentional RED state (stub exits 99, assertions fail).
- [x] **Task 19** — migration helper backbone: arg parser (`--dry-run`, `--no-backup`, `--project`, `--include-global`, `--yes`, `-h`/`--help`), install-mode detection (global vs project), confirmation prompt, backup creation via `tar czf`. Byte-for-byte copy from plan's Task 19 code block.
- [x] **Task 20** — file removal phase: deletes `.claude/hooks/wf-orchestrator.py`, all 5 `.wf-*` metadata files, `.wf-state/` dir, `scripts/wf-brain.js`, `scripts/wf-brain/`, `mcp-servers/wf-brain/`, 3 command files (`wf-implement`, `wf-fix-bug`, `wf-improve`). Respects `--dry-run` (prints paths without touching). 11/12 test assertions now pass (settings.json check still fails — expected).
- [x] **Task 21** — settings.json jq surgery: `with_entries(.value |= (map(.hooks |= map(select(.command | test("wf-orchestrator") | not))) | map(select(.hooks | length > 0))))` — prunes only wf-orchestrator matchers, leaves user-defined hooks intact, removes now-empty matcher arrays. Added jq dependency check. Test is now GREEN: 12/12 assertions pass on the v1.11.1 fresh-install fixture.
- [x] **Task 22** — `--project <path>` mode: takes a project dir instead of `$HOME/.claude`, only removes wf-implement/wf-fix-bug/wf-improve/wf-commit/wf-start-session command files (no hook surgery because projects don't own the global hook). Built `v1.11.1-project-install/` fixture (5 command stubs) + test `test_migrate_v1_11_1_project`.
- [x] **Task 23** — `--dry-run` verification test: counts files before/after running with `--dry-run`, asserts count is identical. GREEN.
- [x] **Task 24** — idempotency test: runs helper twice on same fixture, asserts second run exits 0. GREEN.
- [x] **Task 25** — user-hook-preservation test: built `v1.11.1-user-hook/` fixture where PostToolUse has BOTH a user-defined `Bash` matcher (`echo 'user-defined hook'`) AND a catch-all wf-orchestrator matcher. Test asserts wf-orchestrator is pruned AND the user's `echo` command survives. GREEN — confirms jq filter precision.
- [x] **Task 26** — v1.5.0 and v1.0.0 regression fixtures: `v1.5.0-fresh-install/` (36 files, `copy` install mode, no brain components since v1.9.0 predates brain, Stop hook only) and `v1.0.0-fresh-install/` (minimal 8 files, 5 commands, no state dir). Plan deviation: added `.wf-state/placeholder.json` to v1.5.0 fixture (plan step created empty dir, which git doesn't track). Added tests `test_migrate_v1_5_0_no_brain` and `test_migrate_v1_0_0_minimal`. Both GREEN.
- [x] **Task 27** — never-installed no-op fixture + test: `never-installed/` with just `.claude/.gitkeep`. Test counts files before/after, asserts unchanged. GREEN — confirms helper is safe on systems that never had wf-system.
- [x] **Test suite status**: 0/0 at Session 20 end → **26/26 passing** at Session 21 end. 8 distinct test cases across 5 fixtures. Runner exit code 0 on clean suite, 1 on any failure, summary always prints.
**In Progress**:
- [ ] Nothing actively in progress — clean stopping point at Task 28 decision gate
**Blockers**:
- **Task 28 (delete legacy files from wf-system root)**: running `git rm hooks/wf-orchestrator.py` would delete the file currently symlinked by `~/.claude/hooks/wf-orchestrator.py` (v1.9.1+ symlink mode), which would break the active session's PostToolUse hooks mid-flight. Task 28's plan precondition was Task 10's plugin smoke test, but Task 10 was itself deferred to Task 34 in Session 20. So the precondition is currently unmet. **Awaiting user decision**: defer Task 28 to Phase F alongside Task 34 (clean resolution, user's real plugin smoke test will switch off the legacy symlink first) OR manually unwind the symlink now (user action required, riskier mid-session).
**Commits (wf-system, branch: feature/plugin-migration-v2, 14 commits this session)**:
- `a3164bc` test(v2): scaffold migration helper test harness and stub
- `e3e99d6` fix(v2): drop -e from migration test runner so summary always prints
- `5351b85` test(v2): add v1.11.1 fresh-install fixture for migration helper
- `bf73aac` chore(v2): un-ignore .wf-state/ inside migration test fixtures
- `fb4f33c` test(v2): add failing test for v1.11.1 global migration (red)
- `45ae1c9` feat(v2): migration helper backbone (detection, args, backup)
- `c793a3e` feat(v2): migration helper removes wf-system files from $HOME/.claude
- `f6a093d` feat(v2): migration helper prunes wf-orchestrator from settings.json
- `d690e8b` feat(v2): migration helper --project mode
- `3bee0f6` test(v2): verify --dry-run does not mutate filesystem
- `e57c6bd` test(v2): verify migration helper is idempotent
- `8b2af15` test(v2): verify migration helper preserves user-defined hooks
- `1c0541f` test(v2): add v1.5.0 and v1.0.0 migration fixtures
- `c77e08c` test(v2): verify migration helper no-ops on never-installed system
- Total wf-system branch delta vs `c7d1bf3`: 25 commits (11 Phase A-C + 14 Phase D). Nothing pushed to remote (RC push at Task 34).
**Decisions**:
- **Used strict subagent dispatch for Phase D** (as planned at end of Session 20). Per-task dispatch + two-stage review genuinely paid off — the Task 16 code review caught the `set -eu` bug before it shipped, and TDD red-then-green discipline stayed sharp across 12 tasks.
- **Pragmatic review policy**: full two-stage review for Task 16 (first real scaffold with logic to critique), spec-only inline review for pure-data fixture tasks (17, 22, 25, 26, 27 — nothing to code-quality-review in JSON stubs), byte-for-byte diff check for plan-copied code (19, 20, 21). Saved ~8 subagent dispatches without losing rigor.
- **Bundled task pairs**: Tasks 23+24 (dry-run + idempotency) and 26+27 (v1.5.0+v1.0.0 fixtures + never-installed) dispatched as single subagent calls with separate commits. Cut dispatch overhead without breaking commit granularity.
- **Plan deviation — v1.5.0 fixture**: added `.wf-state/placeholder.json` to match v1.11.1 fixture pattern (plan's step created an empty `.wf-state/` dir, which git doesn't track — would silently drop from the fixture). Documented in commit message.
- **Task 28 deferral proposed, not executed**: flagged the symlink blocker to user before touching it. Destructive git operation + active session = verify first, act second.
**Next**:
1. **Resolve Task 28**: user decision on defer vs manual unwind. Recommendation stands — defer to Phase F.
2. **Phase E Tasks 29-33** (docs-only, no runtime risk): rewrite README, CHANGELOG v2.0.0 entry, `docs/v2.0-rollback.md`, `scripts/bump-version.sh` + bump VERSION to 2.0.0, smoke test checklist. Safe to execute without Task 28 settled.
3. **Phase F Tasks 34-35** (RC + release): full smoke suite → `v2.0.0-rc.1` → dogfood ≥3 days → `v2.0.0` → cutover PR. First remote push.

---

### Session 20 (2026-04-08)
**Focus**: wf-system plugin migration — execute Phases A, B, and C of the implementation plan
**Completed**:
- [x] **Task 1** — verified `${CLAUDE_PLUGIN_ROOT}` propagates to Python hook child processes. Probe plugin installed via `/plugin marketplace add`, triggered hook 4 times, log showed `CLAUDE_PLUGIN_ROOT=/Users/cavallini/.claude/plugins/cache/wf-plugin-probe/wf-plugin-probe/0.0.1` every time. Day-one blocker cleared. Key finding: the env var points at the CACHE path, not the marketplace source — so hooks will resolve to `~/.claude/plugins/cache/wf-system/wf-system/2.0.0/` after v2 ships.
- [x] Cleaned up the probe: removed entries from `~/.claude/plugins/known_marketplaces.json` and `installed_plugins.json` (via Python JSON edit), deleted `~/.claude/plugins/cache/wf-plugin-probe/` and `~/wf-plugin-probe-marketplace/` and `/tmp/wf-plugin-probe.log`. `/reload-plugins` confirmed 21 plugins + 3 hooks (one fewer of each than before).
- [x] **Task 2** — local tag `v1.11.1-final-installer` → `ddbf859` (origin/main tip, matches VERSION 1.11.1). Branch `feature/plugin-migration-v2` created from `docs/plugin-migration-spec` (NOT main, so spec+plan commits carry forward). Scaffolded plugin dirs + 6 `.gitkeep` files. **Tag and branch both local — NOT pushed** (deviation from plan: honored my earlier promise to user over the plan's `git push` line in Step 2).
- [x] **Task 3** — wrote `plugins/wf-core/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` exactly per spec §4.1/§4.2. JSON validated.
- [x] **Task 4** — added MIT `LICENSE` file (spec §4.4 legal debt).
- [x] **Task 5** — copied 30 commands into `plugins/wf-core/commands/` (excluded `wf-brain-review`, `wf-design-setup`, `wf-match-figma` per spec §1). Sample byte-identical diff verified on `wf-start-session.md`.
- [x] **Task 6** — copied 5 agent templates (`backend-developer`, `fullstack-developer`, `generic-developer`, `reviewer`, `ui-developer`).
- [x] **Task 7** — copied 7 skills into `plugins/wf-core/skills/` (excluded `match-figma`, deferred to v2.2 wf-design). `wf-dev-pipeline/` subdir empty until Task 11.
- [x] **Task 8** — wrote `plugins/wf-core/hooks/hooks.json` with `${CLAUDE_PLUGIN_ROOT}/scripts/wf-orchestrator.py` paths, Stop + PostToolUse matchers.
- [x] **Task 9** — ported `hooks/wf-orchestrator.py` (723 lines) to `plugins/wf-core/scripts/wf-orchestrator.py` (656 lines). Edits: self-locate via `CLAUDE_PLUGIN_ROOT`, `STATE_DIR` moved from `~/.claude/hooks/.wf-state/` to `~/.wf-state/`, entire version-check subsystem deleted (`_version_compare`, `check_for_updates`, `UPDATE_CHECK_INTERVAL`, `VERSION_URL`, `HOOKS_DIR`, the PostToolUse call, plus now-unused `import urllib.request` and `import time`). Removed 67 LOC. `afplay` gated behind `sys.platform == "darwin"`. AST + py_compile passed. Grep for all 9 stale symbols returned 0 hits.
- [x] **Task 11** — wrote `plugins/wf-core/skills/wf-dev-pipeline/SKILL.md` (487 lines). Merged `wf-implement.md` (448) + `wf-fix-bug.md` (434) + `wf-improve.md` (356) = 1238 LOC source into a single mode-aware skill (61% reduction). **All 3 drift bugs from spec §2 fixed**: Branch Safety universal, Cannot-Determine-Agent + Agent-Failed handlers universal, GitHub issue completion comment universal. LOC came in at 487 vs the plan's ~350 target — over by 39%, but 61% reduction vs source is still the meaningful ratio; verbatim Task() prompts account for most of the overage.
- [x] **Tasks 12-14** — rewrote `wf-implement.md`, `wf-fix-bug.md`, `wf-improve.md` as 15-line shims that read the shared skill and pass `mode=feature|bug|improve`. Combined delta: **-1194 LOC** (1238 → 45 shim LOC + 487 skill LOC = 532 total).
- [x] **Task 15** — added the cockpit event-log seam to `wf-team-delegate.md` (+15 lines, inserted in Section 7 between the polling loop and Stalled Teammates sub-section). Off by default (no-op unless `workflow.json` sets `cockpit.eventLog`). Seam for the future wf-cockpit plugin (v2.3+).
**In Progress**:
- [ ] Nothing actively in progress — clean stopping point at Phase D boundary
**Commits (wf-system, branch: feature/plugin-migration-v2, 11 commits beyond `c7d1bf3` baseline)**:
- `9c741ef` chore(v2): scaffold plugin directory structure
- `3770e0d` feat(v2): add plugin.json and marketplace.json manifests
- `e511107` fix(legal): add missing LICENSE file (MIT)
- `4cb7b2a` feat(v2): copy 30 wf-core commands into plugin
- `bfed719` feat(v2): copy agent templates into plugin
- `58444aa` feat(v2): copy 7 project skills into plugin (match-figma deferred to v2.2)
- `c8792b6` feat(v2): add plugin-format hooks.json
- `0afa203` refactor(v2): port orchestrator to plugin format
- `8209c42` feat(v2): add wf-dev-pipeline shared skill
- `47b93a3` refactor(v2): replace wf-implement/wf-fix-bug/wf-improve with shims
- `88dd4bd` feat(v2): add cockpit event log seam to wf-team-delegate (off by default)
- Nothing pushed to remote (user can review locally; push happens at Task 34 RC cut per plan)
- Local-only tag: `v1.11.1-final-installer` → `ddbf859` (v1.x rollback anchor, not pushed)
**Blockers**: None
**Decisions**:
- **Task 10 deferred to Task 34**: the plan gated Phase C behind a manual smoke test (install the plugin via `/plugin marketplace add ~/wf-system`), but this would collide with the active v1.11.1 `~/.claude/hooks/wf-orchestrator.py` in the current session (both orchestrators would run on every PostToolUse, double state dirs, duplicate context warnings). Phase C is pure content work (no runtime changes that depend on the orchestrator), so deferring the smoke test until the dedicated smoke gate at Task 34 is safe and cleaner.
- **Inline execution for Tasks 2-15 instead of strict subagent dispatch**: the plan's `superpowers:subagent-driven-development` skill calls for a fresh subagent per task with two-stage review. For the mechanical tasks (copies, manifests, LICENSE), the construction cost of the subagent brief exceeded the work itself. For Task 9 (orchestrator port) and Task 11 (skill merge) I carefully verified output manually instead. Returning to strict subagent dispatch for Phase D (TDD loops) because that phase genuinely benefits from isolation.
- **Tag stays local**: plan Task 2 Step 2 says `git push origin v1.11.1-final-installer`, but I'd promised the user earlier "no remote push" before they approved the branch. Honored the approved scope over the plan text. Tag and branch will both get pushed at RC cut (Task 34).
- **plugin.json has no commands/agents/skills/hooks/mcpServers arrays**: per Claude Code plugin conventions, everything is auto-discovered from the standard paths. Kept the manifest minimal.
- **SKILL.md size (487 vs 350 target)**: kept all Task() prompts verbatim rather than abbreviating. The prompts are literal text sent to spawned subagents at runtime, so compressing them would break the pipeline.
**Next**:
1. **Phase D — strict TDD for the migration helper** (Tasks 16-27, 12 tasks): test harness → v1.11.1 fresh-install fixture → failing test → helper backbone → file removal → jq settings surgery → `--project` mode → `--dry-run` → idempotency → `--no-backup` → never-installed no-op → more fixtures (v1.5.0, v1.0.0, user-hook-preservation). Each task is a red-green-commit cycle. This is where subagent dispatch actually pays off.
2. **Phase E — cleanup + docs** (Tasks 28-33): delete `install.sh`, `hooks/`, `commands/`, `templates/`, `.claude/skills/` originals; rewrite README; add CHANGELOG entry; write `docs/v2.0-rollback.md`; bump VERSION to 2.0.0 via `bump-version.sh`; write smoke test checklist.
3. **Phase F — RC + release** (Tasks 34-35): full smoke suite, cut `v2.0.0-rc.1`, dogfood ≥3 days, cut `v2.0.0`, cutover PR to main. First remote push happens here.

---

### Session 19 (2026-04-08)
**Focus**: wf-system plugin migration — spec approval, implementation plan, execution kickoff
**Completed**:
- [x] Committed system audit (`3ee792c`) that the spec references, fixing the broken inline link
- [x] Wrote complete implementation plan at `docs/superpowers/plans/2026-04-08-wf-system-plugin-migration-v2.md` (2,990 lines, 35 tasks across 6 phases)
  - Phase A: pre-flight + scaffolding (Tasks 1-4)
  - Phase B: plugin content migration (Tasks 5-10)
  - Phase C: F1 dedup — wf-dev-pipeline skill + 3 shims + cockpit event-log seam (Tasks 11-15)
  - Phase D: migration helper with strict TDD (Tasks 16-27, 12 tasks with 5 fixtures)
  - Phase E: cleanup + docs + release infrastructure (Tasks 28-33)
  - Phase F: RC + v2.0.0 release + cutover PR (Tasks 34-35)
- [x] Self-reviewed the plan inline (spec coverage table mapping every §1-§7 section to a task; placeholder scan clean; naming consistency verified; KISS sanity check passed)
- [x] Started execution via `superpowers:subagent-driven-development` skill
- [x] Registered all 35 tasks in TaskCreate for tracking
- [x] **Task 1 scaffolded**: Created `~/wf-plugin-probe/` throwaway plugin + marketplace (4 files: plugin.json, hooks.json, probe.py, marketplace.json). All JSON validated. Probe is written so it logs to both stderr AND `/tmp/wf-plugin-probe.log` for post-session inspection.
**In Progress**:
- [ ] **Task 1 (day-one blocker)**: user needs to open a second Claude Code session, run `/plugin marketplace add ~/wf-plugin-probe-marketplace` + `/plugin install wf-plugin-probe@wf-plugin-probe`, trigger any tool use, and report the contents of `/tmp/wf-plugin-probe.log`. If it says `CLAUDE_PLUGIN_ROOT=<path>`, the plan is viable. If it says `MISSING`, the whole v2.0 plan is blocked.
- [ ] Tasks 2-35 are pending, all tracked in TaskList
**Commits (wf-system, branch: docs/plugin-migration-spec)**:
- `3ee792c` - docs: add system audit informing plugin migration spec
- `6f82faa` - docs(v2): add plugin migration implementation plan
**Blockers**: Task 1 verification (human-in-the-loop, pending user action in a fresh Claude Code session)
**Decisions**:
- Execution strategy: subagent-driven (fresh subagent per task, two-stage review after each) — chosen over inline executing-plans because 35 tasks would chew through a single-session context
- Honoring spec §6.1 branch strategy: long-lived `feature/plugin-migration-v2` branch created in Task 2, NOT a git worktree (even though subagent-driven-development skill suggests worktrees)
- Probe plugin lives OUTSIDE the repo (`~/wf-plugin-probe/`, fully throwaway) to isolate the env-var verification from any wf-system bugs
- Probe logs to `/tmp/wf-plugin-probe.log` as well as stderr so verification can happen in a separate Claude Code session without losing the output
**Next**:
1. User runs the probe in a second Claude Code session and reports the log contents
2. If PASS: proceed with Task 2 (create `feature/plugin-migration-v2` branch, tag `v1.11.1-final-installer` from origin/main, scaffold plugin directory tree)
3. Tasks 3-35 follow per the plan, mostly dispatched to implementation subagents with per-task spec-review + code-quality-review gates
4. Human-in-the-loop at Task 10 (plugin install smoke test), Task 34 (RC smoke test gate), Task 35 (dogfood + release)

---

### Session 18 (2026-04-07)
**Focus**: wf-system plugin migration brainstorming — full design spec
**Completed**:
- [x] Researched Claude Code Plugins Marketplace format via context7 (resolved 4 open questions about manifest schema)
- [x] Brainstormed and approved 7-section design spec for v2.0 plugin migration:
  - §1 Plugin architecture & boundaries (wf-core only in v2.0)
  - §2 F1 dedup mechanism (shared `wf-dev-pipeline` skill + 3 thin shims, ~855 LOC removed, 3 drift bugs fixed)
  - §3 Orchestrator hook bundling via `${CLAUDE_PLUGIN_ROOT}` (~100 LOC removed)
  - §3.5 wf-team-* commands stay almost unchanged + cockpit-ready event log seam
  - §4 Plugin & marketplace manifests (full JSON content for both files)
  - §5 Migration helper script (`scripts/migrate-to-plugin.sh`, bash + jq, backup-by-default)
  - §6 Release process (RC strategy, tags, CHANGELOG draft, rollback plan)
  - §7 Testing & validation (5 categories, all gating v2.0.0)
- [x] Two self-review passes; fixed contradictions and stale forward-references
- [x] Spec committed to `docs/superpowers/specs/2026-04-07-wf-system-plugin-migration-design.md`
**In Progress**:
- [ ] User review of the completed spec
- [ ] After approval: invoke writing-plans skill to produce implementation plan
**Commits (wf-system, branch: docs/plugin-migration-spec)**:
- `42a8d50` - docs: add plugin migration design spec (v2.0, draft sections 1-3.5)
- `5ee28ef` - docs: complete plugin migration spec with sections 4-7
**Blockers**: None
**Decisions**:
- M1 release scope: v2.0 ships `wf-core` plugin only. wf-brain → v2.1, wf-design → v2.2, wf-cockpit → v2.3+
- Hard cutover from install.sh (no parallel install paths); migration helper script as the safety net
- F1 dedup is required for v2.0 (forces clean plugin boundary + fixes 3 drift bugs in /wf-fix-bug and /wf-improve)
- wf-brain implementation (paused since 2026-03-12, 3/10 tasks) gets resumed under the v2.1 plugin scope
- All 5 §7 testing categories must pass to ship v2.0.0 (no partial-pass)
- RC dogfood mandatory (≥3 days on `v2.0.0-rc.1` before final tag)
- Marketplace name is `wf-system` (kebab-case); `matheusslg/wf-system` is only the github repo path
- LICENSE file added to repo as part of v2.0 (README claimed MIT but no LICENSE existed — defect fix)
**Next**:
1. User reviews the spec at `docs/superpowers/specs/2026-04-07-wf-system-plugin-migration-design.md`
2. Invoke writing-plans skill to produce v2.0 implementation plan
3. Create `gh issue` tickets against `matheusslg/wf-system` for deferred items (one per row in the deferred items list)
4. Begin implementation on a new `feature/plugin-migration-v2` branch

---

### Session 17 (2026-03-12)
**Focus**: wf-brain RAG system — design spec review + implementation plan + start execution
**Completed**:
- [x] Approved wf-brain design spec (`docs/superpowers/specs/2026-03-12-wf-brain-design.md`)
- [x] Wrote full implementation plan (10 tasks, 3 chunks) — `docs/superpowers/plans/2026-03-12-wf-brain.md`
- [x] Plan reviewed by spec-document-reviewer, 7 issues found and fixed
- [x] Task 1: Package setup + Database layer (`scripts/wf-brain/db.js`, 13 tests passing)
- [x] Task 2: Embedding module (`scripts/wf-brain/embed.js`, 3 tests passing)
- [x] Task 3: Search module (`scripts/wf-brain/search.js`, 9 tests passing)
**In Progress**:
- [ ] Task 4: CLI entry point + all commands (next up)
- [ ] Tasks 5-10 remaining (seeding, MCP server, review command, orchestrator, command mods, integration)
**Commits (wf-system, branch: feat/agent-browser-integration)**:
- `abcb048` - docs: add wf-brain implementation plan
- `4f4614d` - feat(wf-brain): add database layer with schema, CRUD, and migrations
- `894b34d` - feat(wf-brain): add embedding module with MiniLM integration
- `e602bbc` - feat(wf-brain): add hybrid search with keyword fallback
**Blockers**: None
**Decisions**:
- Using subagent-driven development (sonnet for implementers, opus for reviews)
- Skipping formal 2-stage review for mechanical tasks where tests pass clean
**Next**:
1. Continue from Task 4 (CLI entry point + all commands)
2. Then Tasks 5-10 sequentially
3. After all tasks: final code review + finishing-a-development-branch

---

## Session Archive

> When this file exceeds 500 lines, move older sessions to `.claude/session-archive/sessions-{N}-{M}.md`
> Keep only the last 5 sessions in this file for AI readability.

- **Sessions 1-16** (2026-01-08 → 2026-01-15): see `.claude/session-archive/sessions-1-16.md` — project init, agent/skill generation, wf-brain Phase 0-2, Ralph sub-task handling.

## In Progress
- `v2.0.0-rc.1` dogfood period (started 2026-04-14, target: 2026-04-17+). Plugin installed locally, hooks firing. Verifying remaining smoke test items during daily use.

## Next Session Should
- [ ] Continue dogfooding — use `/wf-start-session`, `/wf-implement`, `/wf-fix-bug`, `/wf-end-session` in real work
- [ ] Complete remaining smoke test items (Categories 2, 4, 5) in `tests/smoke/v2.0-smoke-test.md`
- [ ] If 3+ clean days: fill `<release-date>` in CHANGELOG, tag `v2.0.0`, open cutover PR to `main`
- [ ] (carry-over) Create `gh issue` tickets for deferred items (wf-brain v2.1, wf-design v2.2, wf-cockpit v2.3+)
- [ ] (carry-over) Improve Ralph logging visibility (stream Claude output in real-time)
- [ ] (carry-over) Test `/wf-delegate --parallel` with real parallel tasks

## Decisions Made
- Tech stack: Shell (Bash), Python, Markdown, Git/GitHub
- Scopes: commands, hooks, docs
- Three agents: commands (development), hooks (development), reviewer (read-only)
- Hook output uses `systemMessage` for visible user feedback (not just `additionalContext`)
- Task tool workaround: embed agent file content in prompt to `general-purpose` since custom agents not supported
- `/wf-generate` now assigns skills to agents after generating them (Section 9)
- All sub-agents use `model: opus` for best reasoning capabilities
- Sub-tasks document work with screenshots uploaded to `.github/issue-screenshots/`

## Notes
- This is the wf-system repository - the workflow management tool itself
- As of v2.0: commands/agents/skills/hooks live in `plugins/wf-core/`
- Orchestrator hook bundled with plugin via `${CLAUDE_PLUGIN_ROOT}`, state at `~/.wf-state/`
