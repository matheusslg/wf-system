# Project Progress

> This file tracks progress across sessions. Update before ending each session.
> **Keep this file under 400 lines** - archive old sessions to `.claude/session-archive/`

## Current Status
**Phase**: Development Ready
**Last Updated**: 2026-01-14

---

### Session 11 (2026-01-14)
**Focus**: Ralph improvements - better Jira comments, verbose mode, Chrome/vision
**Completed**:
- [x] Fixed ephemeral env URL format: `app-sxrx-XXX` instead of `sxrx-XXX`
- [x] Enhanced Jira completion comment to include PR link
- [x] Added "How to QA" comment with rich ADF formatting (headings, links, lists)
- [x] Added `VERBOSE=true` option for detailed Claude output (tools, agents, skills)
- [x] Added `CHROME=true` (default) for browser automation / vision capability
- [x] Explored wf-system vision usage - found `visual-verify` skill exists but needs auth solution
- [x] Tested Ralph on SXRX-421 (MFA feature) - successfully ran `/wf-breakdown`
**Ralph SXRX-421 Progress** (still running):
- Created 7 GitHub issues in sxrx-agentic repo
- Completed #28 (Cognito MFA already configured)
- Completed #30 (DB migration for MFA preferences)
- Working through remaining 4 sub-tasks
**Commits (sxrx-agentic)**:
- `077b160` - feat(ralph): improve Jira comments with PR link and How to QA section
- `c5c4a58` - feat(ralph): add VERBOSE mode to see detailed Claude activity
- `98d15a8` - feat(ralph): enable Chrome browser automation by default
**Deferred**: Visual verification for authenticated pages (needs auth bypass solution)

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
- None

## Next Session Should
- [ ] Improve Ralph logging visibility (stream Claude output in real-time)
- [ ] Test Ralph with a more complex ticket requiring `/wf-breakdown`
- [ ] Test `/wf-delegate --parallel` with real parallel tasks
- [ ] Consider adding Jira comment with PR link (currently only logs)

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
