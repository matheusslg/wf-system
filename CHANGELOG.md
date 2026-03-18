# Changelog

All notable changes to wf-system will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [1.9.1] - 2026-03-18

### Fixed
- use absolute paths in .mcp.json instead of /home/runner (#15) (94d2904)


## [1.9.0] - 2026-03-17

### Added
- install brain scripts globally to ~/.claude/scripts/ (#14) (c9e4bdd)


## [1.8.0] - 2026-03-17

### Added
- auto-store knowledge directly, remove pending review queue (#13) (2880485)


## [1.7.1] - 2026-03-16

### Fixed
- prevent self-referencing symlinks when run from repo dir (#12) (d6795f3)


## [1.7.0] - 2026-03-16

### Added
- add wf-ai-qa command for AI-driven exploratory testing (#11) (dd15314)


## [1.6.0] - 2026-03-16

### Added
- use Claude Code /context command for accurate context usage (#10) (33cbe7c)


## [1.5.0] - 2026-03-12

### Added
- integrate brain into init, session, delegate, and team-delegate commands (b75753a)
- integrate brain search + pending nudge into orchestrator (f476b57)
- add MCP server wrapping CLI tools (a851ea7)
- add interactive review command for pending entries (83761d8)
- add seeding from standards.md and progress.md on init (734c6a6)
- add CLI entry point with all commands (2c125bf)
- add hybrid search with keyword fallback (e602bbc)
- add embedding module with MiniLM integration (894b34d)
- add database layer with schema, CRUD, and migrations (4f4614d)
- add match-figma skill for sub-agent visual comparison (d2bdd32)
- add /wf-match-figma command for pixel-level Figma comparison (236eb12)
- add HTML report generation to pixelmatch-diff.js (3a7c158)
- add pixelmatch-diff.js for pixel-level image comparison (f3d625a)

### Fixed
- always exit 0 from pixelmatch-diff.js per spec (1018be5)


## [1.4.0] - 2026-03-02

### Added
- integrate agent-browser for E2E testing and visual verification (02dfc73)

### Fixed
- use AskUserQuestion tool instead of text-based approval prompt (9d36295)


## [1.3.0] - 2026-02-19

### Added
- add Agent Teams commands for pipeline delegation and adversarial review (d1119cd)

### Fixed
- clarify wf-end-session instruction wording in context warnings (cbc9a7d)


## [1.2.1] - 2026-02-03

### Fixed
- remove SXRX-specific references from commands and templates (a262eb5)


## [1.2.0] - 2026-02-03

### Added
- add jira-cli.sh and make it primary for Jira operations (b0862f3)
- add /wf-qa-plan for structured QA test plan generation (d4721ae)
- add /wf-pre-prod-review for multi-agent pre-production audit (d3abac7)

### Fixed
- use project .env as primary for Jira credentials (a923bb7)
- add global config support and script distribution for jira-cli (e5dd1d6)
- update wf-generate to copy jira-cli.sh into user projects (dbe69bc)

### Changed
- make pre-prod-review dimensions dynamic instead of fixed (7f8396b)


## [1.1.0] - 2026-01-29

### Added
- add automated release workflow (d4720da)
- add branch safety checks and enhance commands (1c85dcf)
- add /wf-create-agent for custom agent creation (43821cb)
- add update notification system (43208ff)
- delegate fixes to sub-agents (7bad9df)
- add /wf-pr-comments for PR review comment handling (f488cfe)
- add Ralph compatibility env vars (5ca2796)
- add /wf-investigate for proactive codebase exploration (8d44079)
- use opus model for all sub-agents (f434816)
- add parallel execution mode for concurrent tasks (0582e13)
- add screenshot documentation for sub-tasks (96c5f0f)
- add step to update agents with generated skills (1df9b66)
- add agent templates for stack-based generation (1decead)
- add name field and improve skill discovery (4a81125)
- add visual-verify skill for UI verification (8a3b8eb)
- generate agents and skills for wf-system (8b4d385)
- delegate /wf-fix-bug, /wf-implement, /wf-improve to sub-agents (6af3d01)
- add --until-done flag for autonomous mode (4d12fcd)
- add MCP prerequisites check to workflow commands (40ad444)
- add design system integration (Figma, design tokens, style guide) (41d719b)
- enforce Developer → Reviewer → QA pipeline (f9f5d67)
- improved skill templates with context gathering (9aa5a5c)
- always ask for tech stack (1e24514)
- add optional GitHub repo creation (00dbe9f)
- add installation scope options (global vs project) (4a18bf8)
- add wf-create-prd and rename wf-prd to wf-parse-prd (8ec5de9)

### Fixed
- add orchestrator boundaries to prevent direct implementation (05f586f)
- enforce 450-line limit on progress.md (b496dba)
- implement fixes by default, not just evaluate (7747466)
- explicitly tell Claude to invoke skill, not manually update progress (0f4aa0f)
- quote argument-hint values to prevent YAML parsing error (3e87b91)
- update legacy config key names in orchestrator (bcf70fb)
- make context warning more forceful at 75%+ (83fc3f4)
- enforce pipeline execution in autonomous mode (d2c1abd)
- work around Task tool custom agent limitation (564f26d)
- correct context monitoring to use latest API call tokens (72dcb71)
- add systemMessage for visible user feedback (8a1bb12)
- reviewer/QA issues loop back to developer for fixes (f7a010e)
- use [[command]] placeholders in skill templates (2872232)
- escape inline command syntax in explanation text (fc40ead)
- remove {{}} from docker template (0ef192c)
- add missing skill templates (2eacfa7)
- read project name from workflow.json (b87a7b8)
- use  as project name (9035f33)

### Changed
- simplify branch naming to {type}/{ticket-key} (067dfe1)
- use .claude/skills/ for Agent Skills instead of commands (f746dfc)
- split wf-init into wf-init (minimal) and wf-generate (stack-aware) (13f3a61)
- rename wf-init-project to wf-init (e0667d9)
- rename tech-lead commands for clarity (53faef7)

## [1.0.0] - 2025-01-26

### Added
- Initial versioned release
- Update notification system with daily background checks
- `/wf-update` command for checking and applying updates
- Version tracking via `~/.claude/hooks/.wf-version`
- Install mode tracking (symlink vs copy)

### Changed
- Enhanced `install.sh` to write version metadata
- Updated orchestrator to check for updates daily
- Modified `/wf-start-session` to show update notices
