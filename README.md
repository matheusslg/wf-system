<p align="center">
  <h1 align="center">WF System</h1>
  <p align="center">
    <strong>A workflow management system for Claude Code</strong>
  </p>
  <p align="center">
    Session management, progress tracking, and seamless GitHub/Jira integration
  </p>
</p>

<p align="center">
  <a href="https://buymeacoffee.com/matheusslg">
    <img src="https://img.shields.io/badge/Buy%20Me%20A%20Coffee-support-yellow?style=flat-square&logo=buy-me-a-coffee" alt="Buy Me A Coffee">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License">
  </a>
  <a href="https://claude.com/claude-code">
    <img src="https://img.shields.io/badge/Claude%20Code-compatible-purple?style=flat-square" alt="Claude Code Compatible">
  </a>
</p>

---

## Features

| Feature | Description |
|---------|-------------|
| **Session Management** | Start and end sessions with automatic progress tracking |
| **Context Monitoring** | Auto-triggers session end at 75% context usage |
| **Ticket Breakdown** | Break down tickets into sub-tasks with agent delegation |
| **Autonomous Mode** | `--until-done` flag processes all sub-tasks without intervention |
| **Multi-Agent Pipeline** | Developer → Reviewer → QA workflow enforcement |
| **Design Integration** | Figma, design systems, and design tokens support |
| **Multi-Platform** | Works with both GitHub Issues and Jira |

---

## Installation

```bash
git clone https://github.com/matheusslg/wf-system.git ~/wf-system
~/wf-system/install.sh
```

The installer will ask:

| Option | Choices | Description |
|--------|---------|-------------|
| **Scope** | `Global` (default) / `Project` | Global: `~/.claude/commands/` • Project: `./.claude/commands/` |
| **Method** | `Symlink` (default) / `Copy` | Symlink auto-updates with `git pull` |

> **Note**: Global install includes the orchestrator hook for context monitoring. Restart Claude Code after installation.

---

## Quick Start

### Choose Your Workflow

<table>
<tr>
<td width="50%">

#### Starting Fresh (PRD-First)

Best for new projects where you want to define requirements first.

```
/wf-init
    ↓
/wf-create-prd
    ↓
/wf-design-setup  ← (optional)
    ↓
/wf-parse-prd
    ↓
/wf-generate
    ↓
/wf-start-session
```

</td>
<td width="50%">

#### Existing Codebase

Best for projects that already have code and structure.

```
/wf-init
    ↓
/wf-generate
    ↓
/wf-start-session
```

</td>
</tr>
</table>

### Daily Development Loop

Once set up, your daily workflow looks like this:

```
/wf-start-session → /wf-pick-issue → [work] → /wf-commit → /wf-end-session
```

---

## Commands

### Project Setup

| Command | Description |
|---------|-------------|
| `/wf-init` | Bootstrap minimal workflow structure (checks for required MCPs) |
| `/wf-generate` | Generate agents and skills based on detected tech stack |
| `/wf-design-setup` | Configure design resources (Figma, design system, tokens) |

### PRD & Planning

| Command | Description |
|---------|-------------|
| `/wf-create-prd` | Create a PRD from scratch with guided questions |
| `/wf-parse-prd` | Parse existing PRD and create GitHub Issues |
| `/wf-breakdown` | Break ticket into atomic sub-tasks with agent assignments |

### Session Management

| Command | Description |
|---------|-------------|
| `/wf-start-session` | Start session - loads progress, verifies environment, shows MCP status |
| `/wf-end-session` | End session - saves progress, commits changes, archives session |
| `/wf-overview` | Quick status overview of current work state |

### Development

| Command | Description |
|---------|-------------|
| `/wf-pick-issue` | Select next issue to work on based on priority |
| `/wf-implement` | Build a new feature from description |
| `/wf-fix-bug` | Debug and fix an issue |
| `/wf-test` | Run tests and fix any failures |
| `/wf-refactor` | Restructure code without changing behavior |
| `/wf-improve` | Enhance existing code or feature quality |
| `/wf-debug` | Deep investigation for complex issues |

### Ticket Management

| Command | Description |
|---------|-------------|
| `/wf-delegate` | Execute sub-task with agent (`--until-done` for autonomous mode) |
| `/wf-ticket-status` | Check implementation progress for a tracked ticket |
| `/wf-create-ticket` | Create GitHub/Jira ticket from user story |

### Code Quality

| Command | Description |
|---------|-------------|
| `/wf-review` | Review recent code changes or a specific PR |
| `/wf-commit` | Create a well-formatted conventional commit |

> See [docs/COMMANDS.md](docs/COMMANDS.md) for detailed documentation.

---

## Configuration

WF System creates `.claude/workflow.json` in your project root:

```json
{
  "project": "my-project",
  "github": {
    "owner": "your-username",
    "repo": "your-repo"
  },
  "design": {
    "figma": {
      "fileKey": "abc123",
      "fileUrl": "https://figma.com/design/abc123/..."
    },
    "system": "shadcn",
    "styleGuide": "docs/STYLE_GUIDE.md"
  },
  "scopes": ["frontend", "backend", "api"],
  "agents": {
    "frontend": { "file": "frontend.md", "label": "frontend" },
    "backend": { "file": "backend.md", "label": "backend" }
  }
}
```

> See [docs/CONFIGURATION.md](docs/CONFIGURATION.md) for all options.

---

## How It Works

### Session Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                        SESSION START                             │
│  /wf-start-session                                              │
│  ├── Check MCP availability (GitHub, Figma)                     │
│  ├── Load progress.md (previous session state)                  │
│  ├── Verify environment (git, dependencies)                     │
│  └── Show open issues summary                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                         DEVELOPMENT                              │
│  /wf-pick-issue → /wf-implement or /wf-fix-bug → /wf-commit     │
│                                                                  │
│  Context Monitoring:                                             │
│  • 75% usage → Auto-triggers /wf-end-session                    │
│  • 85% usage → Shows warning message                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                         SESSION END                              │
│  /wf-end-session                                                │
│  ├── Save progress to progress.md                               │
│  ├── Commit pending changes                                     │
│  ├── Archive session if file exceeds 500 lines                  │
│  └── Verify clean git state                                     │
└─────────────────────────────────────────────────────────────────┘
```

### Multi-Agent Pipeline

When using `/wf-delegate`, work automatically flows through the pipeline:

```
Developer (frontend/backend)
         ↓
    [Implementation]
         ↓
      Reviewer  ← (if reviewer agent exists)
         ↓
     [Code Review]
         ↓
        QA       ← (if QA agent exists)
         ↓
    [Testing & Validation]
         ↓
       Close
```

---

## Requirements

### Core Requirements

| Requirement | Purpose |
|-------------|---------|
| [Claude Code CLI](https://claude.ai/code) | Required - The AI-powered CLI |
| Python 3.x | Required - For orchestrator hook |
| `jq` | Optional - For settings merge |
| `gh` CLI | Optional - For GitHub operations |

### MCP Servers (Recommended)

WF System works best with these MCP servers installed:

| MCP Server | Required For | Status |
|------------|--------------|--------|
| **[GitHub MCP](https://github.com/modelcontextprotocol/servers/tree/main/src/github)** | Issue management, PRs, ticket tracking | Recommended |
| **[Figma MCP](https://github.com/figma/figma-mcp-server)** | Design context, tokens, screenshots | Optional |
| **[Context7](https://github.com/upstash/context7)** | Library documentation lookup | Optional |

> `/wf-init` will check for these and guide installation if missing.

**Without MCPs:**
- **No GitHub MCP**: Manual issue management (copy/paste)
- **No Figma MCP**: `/wf-design-setup` will skip Figma integration

---

## Project Structure

After running `/wf-init` and `/wf-generate`:

```
your-project/
├── .claude/
│   ├── workflow.json          # Workflow configuration
│   ├── agents/                # Agent definitions
│   │   ├── frontend.md
│   │   ├── backend.md
│   │   └── ...
│   ├── skills/                # Agent skills
│   │   └── {skill-name}/
│   │       └── SKILL.md
│   └── session-archive/       # Archived sessions
├── progress.md                # Session progress tracking
├── standards.md               # Code standards
└── PRD.md                     # Product requirements (if using PRD-first)
```

---

## Uninstall

```bash
~/wf-system/uninstall.sh
```

---

## Support

If you find WF System helpful, consider supporting its development:

<a href="https://buymeacoffee.com/matheusslg">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="50" />
</a>

---

## License

MIT

---

<p align="center">
  Made with Claude Code
</p>
