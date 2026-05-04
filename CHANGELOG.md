# Changelog

All notable changes to wf-system will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [2.1.0] - 2026-05-04

### Added
- /wf-core: prefix in user-facing strings + workflow.json contextMonitor.enabled opt-out (96cf48d)

### Fixed
- reliable context monitor — JSONL-only extraction, model-aware window, warning-first threshold ordering (81f9b8a)


## [Unreleased]

### Added

- **Per-project opt-out for the context monitor** via `workflow.json`:

      {
        "contextMonitor": { "enabled": false }
      }

  Mirrors the resolution layering used elsewhere — `WF_DISABLE_CONTEXT_CHECK=true`
  still wins, then the `workflow.json` field, then the default-on behaviour.
  Useful for repos where the host environment already manages context (Ralph,
  external loops, custom monitoring) without forcing every contributor to
  export an env var.

### Changed

- **User-facing slash references updated to plugin-namespaced form.** All
  `/wf-<cmd>` strings in command markdown, skill SKILL.md files, agent prompts,
  orchestrator system messages, the top-level `README.md` (Quick Start, command
  tables, examples), and `docs/ralph-integration.md` (shell snippets and
  inline references) now use `/wf-core:wf-<cmd>` to match the Claude Code
  plugin format introduced in v2.0.0. Bare-form references would have
  rendered as broken links / unrecognised commands inside Claude Code
  sessions; the prefixed form is what the runtime actually exposes.
  Historical mentions in `CHANGELOG.md`'s `[2.0.0]` section,
  `docs/2026-04-07-system-audit.md`, and `tests/migration/fixtures/v1.x/`
  intentionally remain on the bare form — those describe pre-v2 state for
  posterity and migration testing.

### Fixed

- **Release workflow now uses the lockstep version bumper.**
  `.github/workflows/release.yml` previously inlined a single
  `echo "<new>" > VERSION` step and committed only `VERSION CHANGELOG.md`,
  bypassing `scripts/bump-version.sh` entirely. As a result, the v2.1.0
  release commit (`219d26b`) bumped only `VERSION` while
  `plugins/wf-core/.claude-plugin/plugin.json` and
  `.claude-plugin/marketplace.json` stayed at `2.0.0`. Claude Code's
  `/plugin update wf-core` is keyed on the plugin manifest's own
  `version` field, so users who installed v2.0.0 saw the manager
  report "up to date" and never received the v2.1.0 hook fixes.
  The workflow now calls `bash scripts/bump-version.sh "$NEW_VERSION"`
  (which already writes all three files in one shot) and adds the
  two JSON paths to the release commit's `git add`. Backfilled both
  JSONs to `2.1.0` in this commit so the next workflow run starts
  from a consistent state.
- **Context monitor reliability** (`plugins/wf-core/scripts/wf-orchestrator.py`).
  Reported by Pietro Pilau: Sonnet 4.6 sessions on 1M-token windows tripped the
  `CRITICAL Context at 280%` lockdown immediately, skipping the 75% warning entirely
  ("Tokens: 562,888 / 200,000"). Three compounding root causes:

  1. **Hardcoded 200K window** — Sonnet 4.6 ships with 1M; a 560K-token session
     in a 1M window (real ~56%) was computing as 280% against the wrong divisor.
     Now self-calibrates from observed peak transcript usage against the standard
     Anthropic tiers `[200K, 1M, 2M]`. New `WF_CONTEXT_LIMIT` env var and
     `contextLimit` field in `workflow.json` for explicit overrides. No model-name
     dict — works across model releases without code updates.
  2. **Missing `cache_creation_input_tokens` in token math** — the fallback path
     summed only `input_tokens + cache_read_input_tokens`, undercounting
     occupancy. Now sums all three usage fields per Anthropic's API contract.
  3. **Brittle subprocess `/context` extraction dropped** — recursive `claude -p
     -r <session>` spawn with regex-parsed markdown output was timing out and
     leaking env vars. JSONL-only extraction is now the sole source of truth.
  4. **Threshold ordering** — when a session resumed already past critical, the
     warning never fired (`if pct >= critical / elif pct >= warning` skipped the
     elif). Reordered so warning takes priority on the first crossing; critical
     fires on subsequent ticks.
  5. **Auto-reset post-`/compact`** — `warning_shown` and `pre_compact_ran` flags
     now clear when usage drops below `warning * 0.9`, so a fresh expansion gets
     a fresh warning instead of sticking on `True` forever.

  Test suite added: `tests/orchestrator/test_context_monitor.py` (24 tests
  covering token math, window resolution priority order, threshold ordering,
  auto-reset, and the disable flag). Runner: `tests/orchestrator/run-tests.sh`.


## [2.0.0] - 2026-04-14

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


## [1.11.1] - 2026-04-07

### Fixed
- tier context warnings — soft warning at 75%, critical at 90% (960fdd0)


## [1.11.0] - 2026-04-03

### Added
- add Jira status transitions (In Progress + Done discovery) (46636f2)


## [1.10.0] - 2026-04-03

### Added
- fetch and inject issue comments in fix-bug, implement, and breakdown (0c55ad1)
- fetch and inject issue comments into agent context (9ed827d)
- fetch and inject issue comments into agent context (d848b6d)
- add relay report, help text, tips, and cleanup (ae903ce)
- add relay sequencing to monitoring loop (338680c)
- add rolling context window injection for relay (eeba875)
- add relay handoff generation phase (b8318c9)
- add relay dependency chain task creation (ef59ed2)
- add topological sort for relay chain detection (1be502e)
- add --relay and --on-failure flags (e3b98a4)

### Fixed
- fix step numbering, define chain_subdir, add Jira comment (738e431)


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
