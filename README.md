# WF System

A workflow management system for [Claude Code](https://claude.com/claude-code) that provides session management, progress tracking, and Jira/GitHub integration.

## Features

- **Session Management**: Start and end sessions with automatic progress tracking
- **Context Monitoring**: Auto-triggers session end at 75% context usage
- **Ticket Breakdown**: Break down tickets into sub-tasks with agent delegation
- **Multi-Platform**: Works with both GitHub Issues and Jira
- **Autonomous Mode**: Optional checkpoint system for multi-task execution

## Installation

```bash
git clone https://github.com/matheusslg/wf-system.git ~/wf-system
~/wf-system/install.sh
```

The installer will ask:

1. **Installation scope**:
   - `Global` (default) → `~/.claude/commands/` - Available in all projects
   - `Project` → `./.claude/commands/` - Only for current project

2. **Installation method** (global only):
   - `Symlink` (default) → Auto-updates when you `git pull`
   - `Copy` → Standalone, no dependency on cloned repo

**Global install** includes the orchestrator hook for context monitoring.
**Project install** only copies commands (no hook).

Restart Claude Code after installation.

## Quick Start

1. Navigate to your project directory
2. Run `/wf-init` to set up the workflow system
3. Use `/wf-start-session` to begin working
4. Use `/wf-end-session` when done (or let the context monitor trigger it)

## Commands

| Command | Description |
|---------|-------------|
| `/wf-start-session` | Start a development session |
| `/wf-end-session` | End session and save progress |
| `/wf-overview` | Quick status overview |
| `/wf-pick-issue` | Select next issue to work on |
| `/wf-implement` | Build a new feature |
| `/wf-fix-bug` | Debug and fix an issue |
| `/wf-test` | Run tests and fix failures |
| `/wf-refactor` | Restructure code safely |
| `/wf-review` | Review code changes |
| `/wf-commit` | Create conventional commit |
| `/wf-create-prd` | Create a PRD from scratch with guided questions |
| `/wf-parse-prd` | Parse existing PRD and create parent issues |
| `/wf-breakdown` | Break ticket into sub-tasks |
| `/wf-delegate` | Execute assigned sub-task |
| `/wf-ticket-status` | Check implementation progress |
| `/wf-create-ticket` | Create GitHub/Jira ticket |
| `/wf-debug` | Deep investigation mode |
| `/wf-improve` | Enhance existing code |
| `/wf-init` | Bootstrap workflow system |

See [docs/COMMANDS.md](docs/COMMANDS.md) for detailed documentation.

## Configuration

Create `.claude/workflow.json` in your project root:

```json
{
  "project": "my-project",
  "github": {
    "owner": "your-username",
    "repo": "your-repo"
  },
  "breakdown": {
    "enabled": true,
    "agents": {
      "frontend": { "label": "frontend" },
      "backend": { "label": "backend" }
    }
  }
}
```

See [docs/CONFIGURATION.md](docs/CONFIGURATION.md) for all options.

## How It Works

### Session Start
When you start Claude Code in a project with `workflow.json`, the orchestrator hook:
1. Detects the workflow type (GitHub or Jira)
2. Checks for work in progress
3. Suggests the appropriate next command

### Context Monitoring
The orchestrator monitors token usage via the transcript file:
- At **75%**: Triggers `/wf-end-session` to save progress
- At **85%**: Shows warning message

### Session End
When ending a session:
1. Progress is saved to `progress.md`
2. Current work is committed
3. Session is archived for continuity

## Uninstall

```bash
~/wf-system/uninstall.sh
```

## Requirements

- Claude Code CLI
- Python 3.x
- `jq` (optional, for settings merge)

## License

MIT
