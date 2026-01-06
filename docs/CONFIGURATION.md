# Configuration Guide

The workflow system is configured via `.claude/workflow.json` in your project root.

## Full Configuration Example

```json
{
  "project": "my-awesome-app",
  "description": "A SaaS platform for task management",

  "github": {
    "owner": "your-org",
    "repo": "my-awesome-app"
  },

  "breakdown": {
    "enabled": true,
    "jiraProject": "PROJ",
    "jiraCloudId": "abc123",
    "defaultAssignee": "your-username",
    "labelPrefix": "task/",
    "agents": {
      "frontend": {
        "label": "frontend",
        "description": "React/Next.js UI components and pages"
      },
      "backend": {
        "label": "backend",
        "description": "API endpoints, business logic, database"
      },
      "infra": {
        "label": "infra",
        "description": "Infrastructure, CI/CD, DevOps"
      },
      "qa": {
        "label": "qa",
        "description": "Testing, quality assurance"
      }
    }
  },

  "autonomy": {
    "enabled": false,
    "maxTasks": 5
  },

  "progressFile": "progress.md",
  "standardsFile": "standards.md",

  "figma": {
    "fileKey": "abc123xyz",
    "accessToken": "env:FIGMA_TOKEN"
  }
}
```

---

## Configuration Options

### `project` (required)
Project name used in logging and progress tracking.

### `description` (optional)
Short project description for context.

---

### `github` (required for GitHub workflow)
GitHub repository configuration.

| Field | Type | Description |
|-------|------|-------------|
| `owner` | string | Repository owner (user or org) |
| `repo` | string | Repository name |

---

### `breakdown` (optional)
Breakdown mode configuration for ticket decomposition.

| Field | Type | Description |
|-------|------|-------------|
| `enabled` | boolean | Enable breakdown mode |
| `jiraProject` | string | Jira project key (triggers Jira workflow) |
| `jiraCloudId` | string | Jira Cloud instance ID |
| `defaultAssignee` | string | Default assignee for sub-tasks |
| `labelPrefix` | string | Prefix for agent labels (default: `task/`) |
| `agents` | object | Agent definitions (see below) |

#### Agent Definition

```json
{
  "frontend": {
    "label": "frontend",
    "description": "React/Next.js UI work"
  }
}
```

Agents are used for:
- Automatic task assignment based on label
- Specialized context loading
- Delegation via `/wf-delegate`

---

### `autonomy` (optional)
Autonomous execution mode.

| Field | Type | Description |
|-------|------|-------------|
| `enabled` | boolean | Enable autonomy mode |
| `maxTasks` | number | Maximum tasks before checkpoint |

When enabled, the Stop hook shows an interactive checkpoint:
- **Enter/c**: Continue to next task
- **s/stop**: Stop execution
- **r/review**: Show progress before deciding

---

### `progressFile` (optional)
Custom progress file name. Default: `progress.md`

### `standardsFile` (optional)
Custom standards file name. Default: `standards.md`

---

### `figma` (optional)
Figma integration for design context.

| Field | Type | Description |
|-------|------|-------------|
| `fileKey` | string | Figma file key |
| `accessToken` | string | Figma access token (use `env:VAR_NAME` for env vars) |

---

## Workflow Detection

The orchestrator automatically detects workflow type:

1. **Jira Workflow**: Has `breakdown.jiraProject`
2. **GitHub Workflow**: Has `github.owner` without Jira
3. **Unknown**: Minimal config, suggests `/wf-init-project`

---

## File Locations

| File | Location | Purpose |
|------|----------|---------|
| `workflow.json` | `.claude/workflow.json` | Project configuration |
| `progress.md` | Project root | Session progress tracking |
| `standards.md` | Project root | Code standards reference |
| `agents/*.md` | `.claude/agents/` | Agent-specific prompts |

---

## Environment Variables

For sensitive values, use the `env:` prefix:

```json
{
  "figma": {
    "accessToken": "env:FIGMA_TOKEN"
  }
}
```

This reads from the `FIGMA_TOKEN` environment variable.
