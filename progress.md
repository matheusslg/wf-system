# Project Progress

> This file tracks progress across sessions. Update before ending each session.
> **Keep this file under 400 lines** - archive old sessions to `.claude/session-archive/`

## Current Status
**Phase**: Development Ready
**Last Updated**: 2026-01-09

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
- [x] Verified: Task tool should accept custom agent names (needs session restart to test)
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
- Custom agents from `.claude/agents/` with `skills` field DO have access
**Next**:
- Test custom agent invocation via Task tool (after session restart)
- Update `/wf-generate` to use templates + assign skills to agents
- Update `/wf-delegate` to use custom agents when available

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
- [ ] Test hooks in a fresh session to confirm visible feedback
- [ ] Create GitHub issues for planned features/improvements
- [ ] Run `/wf-pick-issue` to start development

## Decisions Made
- Tech stack: Shell (Bash), Python, Markdown, Git/GitHub
- Scopes: commands, hooks, docs
- Three agents: commands (development), hooks (development), reviewer (read-only)
- Hook output uses `systemMessage` for visible user feedback (not just `additionalContext`)

## Notes
- This is the wf-system repository - the workflow management tool itself
- Commands are in commands/*.md, hooks in hooks/*.py
- Hook installed at ~/.claude/hooks/wf-orchestrator.py
