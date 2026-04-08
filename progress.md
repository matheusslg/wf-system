# Project Progress

> This file tracks progress across sessions. Update before ending each session.
> **Keep this file under 400 lines** - archive old sessions to `.claude/session-archive/`

## Current Status
**Phase**: Plugin Migration v2.0 — Implementation plan complete, Task 1 (CLAUDE_PLUGIN_ROOT probe) scaffolded, awaiting user to run probe in a second Claude Code session
**Last Updated**: 2026-04-08

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

### Session 16 (2026-01-15)
**Focus**: Ralph sub-task handling completion + testing
**Completed**:
- [x] Finished Ralph sub-task handling in `ralph-sxrx.sh`
  - Added conditional Claude prompt (sub-task vs standalone)
  - Sub-tasks: checkout existing branch, push to existing PR, no create-infra
  - Standalone: create new branch, new PR, add create-infra label
  - Fall back to standalone if parent has no existing PRs
- [x] Tested Ralph with SXRX-1060/1061 sub-tasks
  - Sub-task detection working correctly
  - Found existing PRs for parent SXRX-421
  - Claude made changes but tests failing (MFA function name mismatch)
**In Progress**:
- [ ] MFA test failures - 31 tests failing due to function name changes
  - `setupMfaTotp`, `verifyMfaTotp` in service but tests expect old names
  - Uncommitted changes in sxrx-app on feature/SXRX-421 branch
- [ ] User requested `/ralph-fix` comment feature for Jira
  - Allow posting `/ralph-fix <issue>` in Jira comments for Ralph to process
**Commits (sxrx-agentic)**:
- `7f97215` - feat(ralph): handle sub-tasks by reusing parent PRs
**Blockers**: OAuth token keeps expiring during Ralph runs
**Next**:
1. Fix MFA test failures (function name alignment)
2. Implement `/ralph-fix` Jira comment feature

---

### Session 15 (2026-01-15)
**Focus**: /wf-pr-comments command + Ralph sub-task handling
**Completed**:
- [x] Created `/wf-pr-comments` command for handling PR review comments
- [x] Created Jira sub-tasks for email MFA (SXRX-1060, SXRX-1061)
**Commits (wf-system)**:
- `f488cfe` - feat(commands): add /wf-pr-comments
- `7747466` - fix(wf-pr-comments): implement fixes by default
- `7bad9df` - feat(wf-pr-comments): delegate fixes to sub-agents

---

### Session 14 (2026-01-14)
**Focus**: Ralph error detection + SXRX-1050 test + Jira comment fixes
**Completed**:
- [x] Fixed Ralph to detect Claude auth errors before marking tickets complete
  - Added `check_claude_errors()` function (detects OAuth expiry, API errors, rate limits)
  - Prevents false-positive completions when Claude fails
- [x] Tested Ralph with SXRX-1050 - caught OAuth expiration issue
- [x] Reverted SXRX-1050 to "To Do" (was falsely marked complete)
- [x] Updated SXRX-421 Jira comments with both PR links (api #266, app #410)
- [x] Updated SXRX-421 "How to QA" comment with proper MFA test steps
- [x] Researched Cognito email MFA - requires Essentials/Plus tier (paid)
  - SXRX uses Lite tier = TOTP was correct choice for "no cost" requirement
**Commits (sxrx-agentic)**:
- `0526fd0` - fix(ralph): collect and post ALL PR URLs in Jira completion comment
- `8911ae3` - fix(ralph): detect Claude errors before marking ticket complete
**Decisions**:
- TOTP MFA is correct for SXRX (Cognito Lite tier doesn't support email MFA)
- Ralph should explain tradeoffs in comments when deviating from AC
**Next**: Run Ralph on SXRX-1050 after OAuth refresh

---

### Session 13 (2026-01-14)
**Focus**: SXRX-421 cleanup - close duplicate PRs/issues + Fix Ralph multi-PR comment
**Completed**:
- [x] Closed GitHub issue #32 (MFA Settings Page sub-task)
- [x] Closed 4 duplicate PRs created by Ralph
- [x] Fixed Ralph to post ALL PR URLs in Jira completion comment
**Commits (sxrx-agentic)**:
- `0526fd0` - fix(ralph): collect and post ALL PR URLs in Jira completion comment
**Next**: Test Ralph with another ticket

---

### Session 12 (2026-01-14)
**Focus**: Fix migration failure + Ralph improvements
**Completed**:
- [x] Diagnosed ephemeral env migration failure (PR #266) - RDS DNS unreachable from GitHub runners
- [x] Created sxrx-iac PR #45 to use self-hosted runners for Terraform
- [x] Fixed Jira links to be clickable (proper ADF link marks)
- [x] Fixed "How to QA" empty summary issue with fallback logic
- [x] Updated Ralph prompt: ONE branch/PR per repo, close all issues when done
**In Progress**:
- [ ] Merge sxrx-iac PR #45 to enable ephemeral env creation
**Blockers**: PR #45 needs approval before ephemeral envs work
**Decisions**:
- Terraform jobs need self-hosted runners with VPC access for postgresql provider
- Ralph should enforce: one feature branch, one PR per repo, close all sub-issues
**Commits (sxrx-iac)**:
- `671d662` - fix(terraform): use self-hosted runners for VPC access
**Next**: Merge PR #45, re-run Terraform for sxrx-421, verify migration passes

---

### Session 11 (2026-01-14)
**Focus**: Ralph improvements + SXRX-421 MFA implementation
**Completed**:
- [x] Fixed ephemeral env URL format: `app-sxrx-XXX` instead of `sxrx-XXX`
- [x] Enhanced Jira completion comment to include PR link
- [x] Added "How to QA" comment with rich ADF formatting
- [x] Added `VERBOSE=true` for detailed Claude output
- [x] Added `CHROME=true` (default) for browser automation
- [x] **Ralph completed SXRX-421 (MFA) autonomously!**
  - 6/6 sub-tasks completed (#28-#33)
  - PRs: sxrx-api #266, sxrx-app #410
  - 91 MFA tests added, all 1897 app tests pass
  - ~53 min total runtime
- [x] Monitored API calls during execution (Anthropic + Google)
**In Progress**:
- [ ] Adding `STREAM=true` mode for real-time output (partial)
**Commits (sxrx-agentic)**:
- `077b160` - feat(ralph): improve Jira comments with PR link and How to QA section
- `c5c4a58` - feat(ralph): add VERBOSE mode to see detailed Claude activity
- `98d15a8` - feat(ralph): enable Chrome browser automation by default
**Deferred**: Visual verification for authenticated pages

---

### Session 10 (2026-01-14)
**Focus**: Fix PR #408 build failure - missing AWS secrets for ephemeral environments
**Completed**:
- [x] Diagnosed build failure: missing keys in `sxrx-frontend-app-secrets-ephemeral-envs`
- [x] Added 5 missing secrets via AWS CLI:
  - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` = 131728710440
  - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` = sxrx-dev.appspot.com
  - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` = sxrx-dev.firebaseapp.com
  - `NEXT_PUBLIC_SEALD_APP_ID`, `NEXT_PUBLIC_SEALD_API_URL`, `NEXT_PUBLIC_SEALD_KEY_STORAGE_URL`
- [x] Re-ran failed workflow - build now passes
- [x] Ephemeral environment deployed to https://sxrx-995.sxrxprotocols.com
**Result**: PR #408 ready for review (all checks green)

---

### Session 9 (2026-01-14)
**Focus**: Ralph debugging - fixing permission issues and completing SXRX-995
**Completed**:
- [x] Diagnosed why SXRX-995 wasn't implemented (Claude couldn't access Jira)
- [x] Added `get_ticket_content()` function to fetch ticket from Jira before invoking Claude
- [x] Fixed false-positive completion (tests passed on main without implementation)
- [x] Added `--dangerously-skip-permissions` flag for non-interactive Claude execution
- [x] **Successfully completed full Ralph cycle on SXRX-995**:
  - Feature branch `feature/SXRX-995` created
  - OTP highlight fix implemented
  - PR #408 created with `create-infra` label
  - All 1839 tests passed
  - Ticket transitioned to "Code Review"
  - Label removed automatically
**Commits (sxrx-agentic)**:
- `b6efb52` - fix(ralph): fetch ticket content before invoking Claude
- `8b012f6` - fix(ralph): add --dangerously-skip-permissions flag for non-interactive use
**Result**:
- PR: https://github.com/gnarlysoft-ai/sxrx-app/pull/408
- Commit: `97901bc9` - fix(frontend): prevent multiple OTP boxes from appearing highlighted on mobile

---

### Session 8 (2026-01-14)
**Focus**: Ralph integration - full implementation and testing
**Completed**:
- [x] Fixed Jira API - migrated to new v3 POST endpoint
- [x] Added auto-transition to "Code Review" after PR creation
- [x] Refactored to use `create-infra` PR label (existing workflow)
  - Removed manual sxrx-iac commits
  - Removed 5-minute Terraform wait
  - Claude adds `create-infra` label to PRs for auto-provisioning
- [x] Tested dry-run successfully with SXRX-995
- [x] Started real test with SXRX-995 (OTP highlight bug)
**Commits (sxrx-agentic)**:
- `e7a3fa4` - fix(ralph): use new Jira v3 search API endpoint
- `585307b` - feat(ralph): auto-transition tickets to Code Review after PR
- `4204cf1` - refactor(ralph): use create-infra PR label for ephemeral envs
**Status**: Completed in Session 9

---

### Session 7 (2026-01-14)
**Focus**: Hook fix + new command + Ralph integration research
**Completed**:
- [x] Fixed orchestrator hook to explicitly instruct Claude to invoke skill (not manually update progress.md)
- [x] Created `/wf-investigate` command for proactive codebase exploration
  - Quick mode: answer specific questions with file:line refs
  - Deep mode (`--deep`): full architectural analysis report
- [x] Researched Ralph autonomous coding loop integration
  - Identified blockers: context management conflict, task source mismatch, pipeline incompatibility
  - Proposed solutions: `WF_EXTERNAL_LOOP` and `WF_UNATTENDED` env vars
- [x] Analyzed SXRX ephemeral environment infrastructure (Terraform workspaces)
  - Confirmed SXRX-1054 ticket is implementable (~12 hours effort)
**Commits**:
- `0f4aa0f` - fix(hooks): explicitly tell Claude to invoke skill, not manually update progress
- `8d44079` - feat(commands): add /wf-investigate for proactive codebase exploration

---

### Session 6 (2026-01-13)
**Focus**: Pipeline enforcement + bug fixes + token analysis
**Completed**:
- [x] Enforced pipeline execution (Developer→Reviewer→QA) in `/wf-delegate`
  - Added Section 11.1: MANDATORY PIPELINE GATE
  - Added retry limits (max 3) for review/QA loops
  - Strengthened Section 13 with ⛔ warnings
  - Added Section 14 validation before closing
  - Updated autonomous mode with explicit pipeline steps
- [x] Made context warning more forceful at 75%+ in orchestrator hook
- [x] Fixed legacy config keys: `techLead` → `breakdown`, removed `ticketing`
- [x] Fixed YAML parsing crash in 7 commands (bracket syntax in argument-hint)
  - wf-test, wf-commit, wf-init, wf-parse-prd, wf-pick-issue, wf-review, wf-generate
- [x] Identified token hogs: wf-delegate (~10K), wf-generate (~7.5K), wf-breakdown (~4.6K)
**Commits**:
- `d2c1abd` - fix(delegate): enforce pipeline execution in autonomous mode
- `83fc3f4` - fix(hooks): make context warning more forceful at 75%+
- `bcf70fb` - fix(hooks): update legacy config key names in orchestrator
- `3e87b91` - fix(commands): quote argument-hint values to prevent YAML parsing error
**Next Session**:
- Consider splitting large commands to reduce token consumption
- Test pipeline enforcement with real `/wf-delegate --until-done` run

---

### Session 5 (2026-01-12)
**Focus**: Enhanced sub-task documentation + parallel execution + opus model
**Completed**:
- [x] Added screenshot documentation for sub-tasks in `/wf-delegate`
  - Section 9: Screenshot instructions for developer tasks
  - Section 11.5: Screenshot collection and upload to repo
  - Section 12: Enhanced completion comment with collapsible screenshot gallery
  - Pipeline sections: Reviewer, QA, Fix tasks all have screenshot docs
- [x] Added `--parallel` flag to `/wf-delegate` for concurrent task execution
  - Execute multiple independent tasks simultaneously
  - Based on `/wf-breakdown` output (parallel-eligible tasks)
  - Conflict detection for same-file modifications
  - Batch screenshot collection from all parallel tasks
- [x] Updated all agent templates to use `model: opus` instead of `sonnet`
  - ui-developer.md, backend-developer.md, fullstack-developer.md, generic-developer.md
  - reviewer.md already had opus
**Commits**:
- `96c5f0f` - feat(delegate): add screenshot documentation for sub-tasks
- `0582e13` - feat(delegate): add parallel execution mode for concurrent tasks
- `f434816` - feat(agents): use opus model for all sub-agents
**Synced to global**: wf-delegate.md, wf-generate.md

---

### Session 4 (2026-01-09)
**Focus**: Task tool custom agent testing + template integration + skill assignment
**Completed**:
- [x] Tested custom agent invocation via Task tool - DOES NOT WORK
- [x] Updated `/wf-generate` to use role-based templates from `templates/agents/`
- [x] Updated `/wf-delegate` with workaround for Task tool limitation
- [x] Documented Task tool limitations in `docs/CONFIGURATION.md`
- [x] Added Playwright MCP to README recommended servers
- [x] Added Section 9 to `/wf-generate`: circle back and update agents with generated skills
- [x] Validated via claude-code-guide: custom agents CAN use skills IF Task tool supported them
**Key Finding - Task Tool Limitation**:
- Task tool `subagent_type` ONLY accepts built-in agents: general-purpose, Explore, Plan, Bash, claude-code-guide, statusline-setup
- Custom agents from `.claude/agents/` CANNOT be invoked via Task tool
- Error: "Agent type 'X' not found. Available agents: ..."
- BUT: docs say custom agents with `skills` field CAN access skills - chain breaks at Task tool
**Workaround Implemented**:
- Read custom agent file content
- Include full agent prompt in Task prompt to `general-purpose`
- This preserves agent personality while using available infrastructure
**Commits**:
- `564f26d` - fix(commands): work around Task tool custom agent limitation
- `8c9cf0f` - docs(readme): add Playwright MCP to recommended servers
- `1df9b66` - feat(wf-generate): add step to update agents with generated skills
**Synced to global**: wf-generate.md, wf-delegate.md

---

### Session 3 (2026-01-09)
**Focus**: Context monitoring fix + visual-verify skill + agent templates
**Completed**:
- [x] Fixed context monitoring bug - was summing ALL historical tokens (6000%+), now uses latest input_tokens (correct ~50%)
- [x] Created `visual-verify` skill for UI verification against Figma designs
- [x] Added fallback chain: Chrome → Playwright MCP → MCP_DOCKER
- [x] Created agent templates: ui-developer, backend-developer, fullstack-developer, reviewer, generic-developer
- [x] Researched Claude Code docs on skills + subagents
- [x] Verified: Custom agents CAN access skills via `skills` field, but built-in agents (Explore, Plan) cannot
- [x] CORRECTED: Task tool does NOT accept custom agent names (tested in Session 4)
**Commits**:
- `72dcb71` - fix(hooks): correct context monitoring to use latest API call tokens
- `8a3b8eb` - feat(skills): add visual-verify skill for UI verification
- `2e13789` - docs(skills): add Playwright MCP reference to visual-verify
- `4a81125` - feat(skills): add name field and improve skill discovery
- `1decead` - feat(templates): add agent templates for stack-based generation
**Key Findings**:
- Skills load at session startup only (new skills need restart)
- Subagents don't inherit skills automatically - need explicit `skills` field
- Built-in agents (Explore, Plan, general-purpose) have NO skill access
- Custom agents ARE NOT SUPPORTED by Task tool (corrected from initial assumption)

---

### Session 2 (2026-01-09)
**Focus**: Workflow initialization and hook visibility fix
**Completed**:
- [x] Ran `/wf-init` - initialized workflow for wf-system repo
- [x] Ran `/wf-generate` - created agents and skills based on tech stack
- [x] Ran `/wf-start-session` - verified environment
- [x] Pushed commits to GitHub
- [x] Fixed hook visibility issue - hooks now use `systemMessage` for visible user feedback
**Commits**:
- `6d6ef6d` - chore: initialize claude workflow system
- `8b4d385` - feat: generate agents and skills for wf-system
- `8a1bb12` - fix(hooks): add systemMessage for visible user feedback
**Next**: Test hooks in new session, create issues for planned work

---

### Session 1 (2026-01-08)
**Focus**: Project initialization and agent generation
**Completed**:
- Created workflow configuration (.claude/workflow.json)
- Set up progress tracking (progress.md)
- Updated standards.md with project-specific conventions
- Generated 3 agents:
  - `wf-system-commands` - For command development
  - `wf-system-hooks` - For Python hooks and installer
  - `wf-system-reviewer` - For code review (read-only)
- Generated 5 skills:
  - `gh-pr` - Create GitHub PRs
  - `gh-issues` - List/manage GitHub issues
  - `py-check` - Check Python syntax
  - `cmd-list` - List all commands
  - `sync-commands` - Sync commands to global install

---

## Session Archive

> When this file exceeds 500 lines, move older sessions to `.claude/session-archive/sessions-{N}-{M}.md`
> Keep only the last 5 sessions in this file for AI readability.

## In Progress
- Plugin migration v2.0 implementation — spec approved, 35-task plan written, Task 1 (CLAUDE_PLUGIN_ROOT probe) scaffolded at `~/wf-plugin-probe/` and awaiting user verification in a second Claude Code session
- Subagent-driven execution mode active — Tasks 2-35 pending dispatch once Task 1 returns PASS

## Next Session Should
- [ ] Read `/tmp/wf-plugin-probe.log` first — if it shows `CLAUDE_PLUGIN_ROOT=/Users/cavallini/wf-plugin-probe` the plan is viable; if `MISSING` the whole plan is blocked and needs escalation
- [ ] If PASS: uninstall probe plugin (`/plugin uninstall wf-plugin-probe@wf-plugin-probe` + `/plugin marketplace remove wf-plugin-probe`), then `rm -rf ~/wf-plugin-probe ~/wf-plugin-probe-marketplace`
- [ ] Start Task 2 per the plan: tag `v1.11.1-final-installer` from `origin/main`, create `feature/plugin-migration-v2`, scaffold plugin dirs
- [ ] Continue subagent-driven execution through Tasks 3-35 (implementation plan at `docs/superpowers/plans/2026-04-08-wf-system-plugin-migration-v2.md`)
- [ ] (carry-over) Create `gh issue` tickets for deferred items (wf-brain v2.1, wf-design v2.2, wf-cockpit v2.3+, wf-delegate vs wf-team-delegate audit, wf-brain mandatory + progress.md retirement v3.x) — happens after implementation plan landed, which it now has
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
- Commands are in commands/*.md, hooks in hooks/*.py
- Hook installed at ~/.claude/hooks/wf-orchestrator.py
