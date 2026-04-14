<p align="center">
  <img src="docs/assets/logo.svg" alt="WF System" width="120" />
</p>

<h1 align="center">WF System</h1>

<p align="center">
  <strong>End-to-end dev workflow for Claude Code</strong><br/>
  Structured sessions · Multi-agent teams · Autonomous task delegation
</p>

<p align="center">
  <a href="https://buymeacoffee.com/matheusslg">
    <img src="https://img.shields.io/badge/Buy%20Me%20A%20Coffee-support-yellow?style=flat-square&logo=buy-me-a-coffee" alt="Buy Me A Coffee">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License">
  </a>
  <a href="https://claude.com/claude-code">
    <img src="https://img.shields.io/badge/Claude%20Code-plugin-purple?style=flat-square" alt="Claude Code Plugin">
  </a>
</p>

---

## What it does

WF System turns Claude Code into a managed development environment. Every session is tracked, every task flows through a developer → reviewer → QA pipeline, and context monitoring ensures nothing is lost when a session ends.

- **Session lifecycle** — `/wf-start-session` loads previous context; `/wf-end-session` saves progress, commits, and archives. Context monitoring auto-triggers wrap-up before you hit the limit.
- **Agent teams** — Spin up parallel developer teammates with a shared reviewer and QA. Teammates retain context across retries and communicate via direct messages.
- **Dev pipeline** — `/wf-implement`, `/wf-fix-bug`, and `/wf-improve` each run a full agent chain: branch safety → implementation → code review → QA → commit.
- **Autonomous delegation** — Break tickets into sub-tasks and delegate with `--until-done` to process them without intervention.
- **GitHub & Jira** — Pick issues, create tickets, post QA plans, handle PR comments — all from slash commands.

---

## Install

Inside Claude Code:

    /plugin marketplace add matheusslg/wf-system
    /plugin install wf-core@wf-system

Restart when prompted. Then in any project:

    /wf-init

---

## Daily workflow

```
/wf-start-session → /wf-pick-issue → /wf-implement → /wf-commit → /wf-end-session
```

---

## Commands

### Setup

| Command | Description |
|---------|-------------|
| `/wf-init` | Bootstrap workflow structure |
| `/wf-generate` | Generate agents and skills for your stack |
| `/wf-create-agent` | Create a custom agent |

### Session

| Command | Description |
|---------|-------------|
| `/wf-start-session` | Load progress, verify environment |
| `/wf-end-session` | Save progress, commit, archive |
| `/wf-overview` | Quick status of current work |

### Development

| Command | Description |
|---------|-------------|
| `/wf-pick-issue` | Select next issue by priority |
| `/wf-implement` | Build a feature (agent pipeline) |
| `/wf-fix-bug` | Debug and fix an issue |
| `/wf-improve` | Enhance existing code |
| `/wf-test` | Run tests and fix failures |
| `/wf-refactor` | Restructure without behavior change |
| `/wf-debug` | Deep investigation |
| `/wf-investigate` | Explore how things work |

### Tickets & Delegation

| Command | Description |
|---------|-------------|
| `/wf-delegate` | Execute sub-task with agent |
| `/wf-team-delegate` | Team pipeline with persistent teammates |
| `/wf-breakdown` | Break ticket into sub-tasks |
| `/wf-create-ticket` | Create GitHub/Jira ticket |
| `/wf-ticket-status` | Check implementation progress |

### Code Quality

| Command | Description |
|---------|-------------|
| `/wf-review` | Review changes or a PR |
| `/wf-pre-prod-review` | Multi-agent pre-production audit |
| `/wf-team-review` | Adversarial cross-examination review |
| `/wf-pr-comments` | Handle PR review comments |
| `/wf-qa-plan` | Generate structured QA plan |
| `/wf-e2e` | Browser-based E2E testing |
| `/wf-commit` | Conventional commit |

### Planning

| Command | Description |
|---------|-------------|
| `/wf-create-prd` | Create a PRD from scratch |
| `/wf-parse-prd` | Parse PRD into GitHub Issues |

---

## Configuration

`/wf-init` creates `.claude/workflow.json`:

```json
{
  "project": "my-project",
  "github": { "owner": "you", "repo": "your-repo" },
  "progressFile": "progress.md",
  "standardsFile": "standards.md"
}
```

See [docs/CONFIGURATION.md](docs/CONFIGURATION.md) for all options (breakdown, autonomy, teams, etc).

---

## Migrating from v1.x

If you used `install.sh` before v2.0, run the migration helper first:

    curl -fsSL https://raw.githubusercontent.com/matheusslg/wf-system/main/scripts/migrate-to-plugin.sh | bash

This cleans up the old hook, prunes settings.json, and creates a backup. Then install the plugin as above. See [docs/v2.0-rollback.md](docs/v2.0-rollback.md) if you need to roll back.

---

## Roadmap

- **wf-brain** (v2.1) — RAG knowledge layer with hybrid search
- **wf-design** (v2.2) — Figma + pixelmatch verification
- **wf-cockpit** (v2.3+) — Web UI for agent team observability

---

## Uninstall

    /plugin uninstall wf-core@wf-system

---

<p align="center">
  <a href="https://buymeacoffee.com/matheusslg">
    <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="50" />
  </a>
</p>

<p align="center">
  MIT · Made with Claude Code
</p>
