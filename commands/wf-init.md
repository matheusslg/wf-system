---
description: Bootstrap workflow system with minimal setup
allowed-tools: Read, Write, Bash, AskUserQuestion
argument-hint: [project-name]
---

# Initialize Project Workflow

Set up the minimal Claude workflow structure for this project. Creates generic templates that can be customized later by `/wf-generate`.

## Arguments
- `$ARGUMENTS` - Optional project name (defaults to directory name)

## 1. Check Current State

Verify we're in a project directory:
```bash
pwd
ls -la
```

Check if workflow already exists:
```bash
ls -la .claude/workflow.json 2>/dev/null && echo "WORKFLOW_EXISTS" || echo "NO_WORKFLOW"
ls progress.md 2>/dev/null && echo "PROGRESS_EXISTS" || echo "NO_PROGRESS"
```

### If Workflow Already Exists

If `.claude/workflow.json` or `progress.md` already exists, **ask the user**:

| Option | Behavior |
|--------|----------|
| **Overwrite** | Replace all workflow files (WARNING: loses existing progress) |
| **Cancel** | Exit without changes |

If "Cancel" selected:
- Exit with message: "Workflow initialization cancelled. Existing files preserved."

If "Overwrite" selected:
- Warn user that progress.md history will be lost
- Proceed with initialization

## 1.5. Check MCP Prerequisites

Check if essential MCP servers are available for full workflow functionality.

### GitHub MCP (Recommended)

Required for: Issue management, PR creation, ticket tracking

```bash
# Try to check GitHub MCP availability
echo "Checking GitHub MCP..."
```

Then attempt:
```
mcp__github__get_me()
```

**If GitHub MCP available**: Continue normally.

**If GitHub MCP NOT available or fails**:

Display warning and ask user:

```markdown
⚠️ **GitHub MCP Not Detected**

The GitHub MCP server is recommended for full workflow functionality:
- Creating and managing issues (`/wf-create-ticket`, `/wf-breakdown`)
- Parsing PRDs into issues (`/wf-parse-prd`)
- Tracking ticket status (`/wf-ticket-status`)

**To install GitHub MCP**:
1. Add to your Claude Code MCP settings
2. Configure with your GitHub token
3. Restart Claude Code

See: https://github.com/modelcontextprotocol/servers/tree/main/src/github
```

| Option | Behavior |
|--------|----------|
| **Continue without GitHub MCP** | Proceed with limited functionality (manual issue management) |
| **Cancel and install first** | Exit to let user install MCP |

### Optional MCPs

Inform user about other helpful MCPs (don't block on these):

```markdown
**Optional MCP Servers** (can be added later):

| MCP | Purpose | When Needed |
|-----|---------|-------------|
| **Figma** | Design context, screenshots, tokens | If using Figma designs (`/wf-design-setup`) |
| **Context7** | Up-to-date library documentation | For framework/library lookups |
| **Firecrawl** | Web scraping for research | For gathering external docs |

Run `/wf-design-setup` later to configure Figma integration.
```

## 2. Get Project Info

### Project Name

If `$ARGUMENTS` is empty:
```bash
basename "$(pwd)"
```
Use directory name as default, but confirm with user.

### GitHub Configuration (Optional)

Ask user: "Do you want to configure GitHub integration now?"

**If No**:
- Leave blank (can be set later by `/wf-generate`)
- Skip to Step 3

**If Yes**, follow this flow:

#### Step 2a: Check if repo exists

Ask: "Does the GitHub repository already exist?"

**If Yes (repo exists)**:
- Ask for GitHub owner (username or org)
- Ask for repository name
- Verify with: `gh repo view owner/repo --json name 2>/dev/null && echo "FOUND" || echo "NOT_FOUND"`
- If NOT_FOUND, warn user and ask to re-enter or create

**If No (need to create repo)**:

#### Step 2b: Create GitHub Repository

Ask for:
1. **Owner**: GitHub username or organization
2. **Repository name**: Name for the new repo (default: project name)
3. **Visibility**: Public or Private (default: Private)
4. **Description**: Optional repo description

Create the repository:
```bash
gh repo create [owner]/[repo] --[public|private] --description "[description]" --confirm
```

If successful, store owner and repo for workflow.json.

If `gh` CLI not installed or not authenticated:
```bash
gh auth status 2>/dev/null || echo "NOT_AUTHENTICATED"
```
- Suggest: `gh auth login`
- Or skip GitHub setup and continue without it

## 3. Create Directory Structure

```bash
mkdir -p .claude
mkdir -p .claude/agents
mkdir -p .claude/skills
mkdir -p .claude/session-archive
```

## 4. Create workflow.json

Create `.claude/workflow.json` with generic template:

```json
{
  "project": "[project-name]",
  "github": {
    "owner": "[owner or empty]",
    "repo": "[repo or empty]"
  },
  "design": {
    "figma": null,
    "system": null,
    "styleGuide": null
  },
  "scopes": [],
  "agents": {},
  "init_script": null
}
```

Note: The `design` section is populated by `/wf-design-setup`.

Fill in:
- `project`: From user input or directory name
- `github.owner`: From user input or leave empty
- `github.repo`: From user input or leave empty

Note: `scopes` and `agents` will be populated by `/wf-generate`.

## 5. Create progress.md

Create `progress.md` in project root:

```markdown
# Project Progress

> This file tracks progress across sessions. Update before ending each session.
> **Keep this file under 400 lines** - archive old sessions to `.claude/session-archive/`

## Current Status
**Phase**: Setup
**Last Updated**: [TODAY'S DATE]

---

### Session 1 ([TODAY'S DATE])
**Focus**: Project initialization
**Completed**:
- Created workflow configuration
- Set up progress tracking
**Next**: Run /wf-generate to create agents and skills

---

## Session Archive

> When this file exceeds 500 lines, move older sessions to `.claude/session-archive/sessions-{N}-{M}.md`
> Keep only the last 5 sessions in this file for AI readability.

## In Progress
- None

## Next Session Should
- [ ] Run /wf-generate to create agents based on tech stack
- [ ] Begin development

## Decisions Made
- [Record architectural decisions here]

## Notes
- [Project-specific notes]
```

## 6. Create standards.md

Create `standards.md` with generic template:

```markdown
# Code Standards

> This file contains coding standards for the project.
> Stack-specific conventions will be added by `/wf-generate`.

## General

- Follow existing patterns in the codebase
- Write tests for new functionality
- Keep functions focused and small
- Prefer explicit over implicit
- Document non-obvious decisions

## Commits

Use conventional commits: `type(scope): description`

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code restructuring
- `docs`: Documentation only
- `test`: Adding/updating tests
- `chore`: Build, config, dependencies
- `style`: Formatting, whitespace

**Examples**:
```
feat(auth): add password reset flow
fix(api): handle null response from external service
refactor(users): extract validation logic
```

## Code Style

[To be updated by /wf-generate based on detected stack]

## Testing

[To be updated by /wf-generate based on detected stack]

## File Organization

[To be updated by /wf-generate based on project structure]
```

## 7. Git Integration (Optional)

Ask user: "Do you want to commit the workflow files?"

If yes:
```bash
git add .claude/ progress.md standards.md
git commit -m "chore: initialize claude workflow system"
```

If no:
- Skip commit, files are ready but uncommitted

## 8. Report Results

```
## Workflow Initialized

**Project**: [name]

**Files Created**:
- `.claude/workflow.json` - Workflow configuration (generic)
- `progress.md` - Session progress tracking
- `standards.md` - Code standards (generic)

**Directories Created**:
- `.claude/` - Workflow configuration root
- `.claude/agents/` - Agent definitions (empty)
- `.claude/skills/` - Agent skills (empty)
- `.claude/session-archive/` - Archived sessions (empty)

**Next Steps**:
1. **Option A (PRD-first)**: Run `/wf-create-prd` to define your project and tech stack
2. **Option B (Existing code)**: Run `/wf-generate` to detect stack and create agents

**Typical Workflows**:

```
# Starting fresh (PRD-first):
/wf-init → /wf-create-prd → /wf-parse-prd → /wf-generate → /wf-start-session

# Existing codebase:
/wf-init → /wf-generate → /wf-start-session
```

**Note**: Agents and skills will be created by `/wf-generate` based on your tech stack.
```

---

## Error Handling

### Not in a git repository

If not a git repo and user wants commits:
```bash
git rev-parse --git-dir 2>/dev/null || echo "NOT_GIT"
```

Options:
- Initialize git: `git init`
- Skip git integration
- Cancel

### Write permission errors

If can't create files:
- Check directory permissions
- Suggest running with appropriate permissions
