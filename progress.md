# Project Progress

> This file tracks progress across sessions. Update before ending each session.
> **Keep this file under 400 lines** - archive old sessions to `.claude/session-archive/`

## Current Status
**Phase**: Development Ready
**Last Updated**: 2026-01-09

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
- [ ] Test `/wf-generate` in a real project to verify template + skill assignment works
- [ ] Test `/wf-delegate` with the workaround to verify agent prompts work correctly
- [ ] Create GitHub issues for planned features/improvements
- [ ] Monitor if Claude Code adds custom agent support to Task tool

## Decisions Made
- Tech stack: Shell (Bash), Python, Markdown, Git/GitHub
- Scopes: commands, hooks, docs
- Three agents: commands (development), hooks (development), reviewer (read-only)
- Hook output uses `systemMessage` for visible user feedback (not just `additionalContext`)
- Task tool workaround: embed agent file content in prompt to `general-purpose` since custom agents not supported
- `/wf-generate` now assigns skills to agents after generating them (Section 9)

## Notes
- This is the wf-system repository - the workflow management tool itself
- Commands are in commands/*.md, hooks in hooks/*.py
- Hook installed at ~/.claude/hooks/wf-orchestrator.py
