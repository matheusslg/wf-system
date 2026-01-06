---
description: Read and analyze PRD to extract actionable tasks
allowed-tools: Read, Bash, Grep, Glob, Task, AskUserQuestion, mcp__github__create_issue, mcp__github__list_issues
argument-hint: [action: summary|tasks|issues|context]
---

# Read PRD

Parse the Product Requirements Document to extract context, tasks, and optionally create GitHub issues.

## Arguments
- `$ARGUMENTS` - Optional action:
  - `summary` (default): Show PRD overview and key points
  - `tasks`: Extract actionable tasks from roadmap/user stories
  - `issues`: Create GitHub issues from PRD tasks
  - `context`: Generate context for agents (update progress.md)

## 0. Locate PRD

Search for PRD file in common locations:

```bash
# Check common PRD locations
ls -la PRD.md prd.md docs/PRD.md docs/prd.md documentation/PRD.md 2>/dev/null | head -5
```

If not found, search recursively:

```bash
find . -maxdepth 3 -iname "*prd*.md" -type f 2>/dev/null | head -5
```

If still not found, ask user for the PRD location.

## 1. Read PRD Content

Once located, read the full PRD:

```bash
cat <prd-file-path>
```

Parse and identify key sections (adapt to actual structure):
- **Vision/Problem/Solution**: What the product does
- **Personas**: Who uses it
- **User Stories**: What users need to do
- **Features**: MVP vs future phases
- **Architecture**: Tech stack, structure
- **Roadmap**: Phases and tasks
- **Metrics**: Success criteria

## 2. Execute Action

### If `summary` (default):

Provide a concise overview:

```
## PRD Summary

**Product**: [name from PRD]
**Vision**: [one-line summary]

**Problem**:
- [key problem 1]
- [key problem 2]

**Solution**:
- [key differentiator 1]
- [key differentiator 2]

**Target Users**:
- [persona 1]: [brief description]
- [persona 2]: [brief description]

**Tech Stack**: [from architecture section]

**MVP Scope**:
- [feature 1]
- [feature 2]
- [feature 3]

**Key Metrics**:
- [metric 1]: [target]
- [metric 2]: [target]
```

### If `tasks`:

Extract actionable tasks from roadmap and user stories:

```
## Extracted Tasks

### Phase 0: Setup
- [ ] [task from roadmap]
- [ ] [task from roadmap]

### Phase 1: MVP
**Sprint 1-2**:
- [ ] [task]
- [ ] [task]

**Sprint 3-4**:
- [ ] [task]

### User Stories to Implement
| ID | Story | Priority | Estimated Effort |
|----|-------|----------|------------------|
| C1 | [story] | Alta | [S/M/L] |
| C2 | [story] | Alta | [S/M/L] |
```

Ask user: "Do you want me to create GitHub issues for these tasks?"

### If `issues`:

**Step 1**: Check if repo has GitHub:
```bash
gh repo view --json name,owner 2>/dev/null || echo "Not a GitHub repo"
```

**Step 2**: Check existing issues to avoid duplicates:
```bash
gh issue list --state all --limit 50 2>/dev/null
```

**Step 3**: Ask user which tasks to create as issues:
- Show extracted tasks
- Let user select (all, by phase, specific ones)
- Confirm before creating

**Step 4**: Create issues with proper labels:

For each selected task, create issue with:
- **Title**: Clear, actionable title
- **Body**: Description, acceptance criteria, related PRD section
- **Labels**: `phase:0-setup`, `phase:1-mvp`, `priority:high`, etc.

Example issue body template:
```markdown
## Description
[Task description from PRD]

## Acceptance Criteria
- [ ] [Criteria based on user story]
- [ ] [Criteria based on user story]

## PRD Reference
- Section: [Roadmap/User Stories/Features]
- Priority: [from PRD]

## Technical Notes
[Any relevant architecture notes from PRD]

---
*Generated from PRD.md*
```

**Step 5**: Report created issues:
```
## GitHub Issues Created

| # | Title | Labels |
|---|-------|--------|
| #1 | Setup NX monorepo | phase:0-setup |
| #2 | Implement auth with NextAuth | phase:1-mvp, priority:high |
```

### If `context`:

Update progress.md with PRD context for agents:

**Step 1**: Read current progress.md
```bash
cat progress.md 2>/dev/null || echo "No progress file"
```

**Step 2**: Add PRD context section:

```markdown
## PRD Context

> Auto-generated from PRD.md. Reference for all agents.

**Product**: [name]
**Vision**: [one-line]

**MVP Features**:
1. [feature]
2. [feature]

**Tech Stack**:
- Frontend: [tech]
- Backend: [tech]
- Database: [tech]

**Current Phase**: [from roadmap]

**Key Decisions**:
- [decision from PRD]

**Standards**:
- [from PRD architecture section]
```

**Step 3**: Confirm with user before writing.

## 3. Cross-Reference with Existing Work

If project already has:
- **progress.md**: Check what's already done vs PRD roadmap
- **GitHub issues**: Compare with PRD tasks to find gaps
- **.claude/agents/**: Verify agents match PRD architecture

Report any discrepancies:
```
## Alignment Check

**PRD vs Current State**:
- [x] Tech stack matches agents
- [ ] Missing issues for Sprint 2 tasks
- [ ] progress.md needs PRD context update
```

## 4. Suggest Next Steps

Based on action and current state:

```
## Suggested Next Steps

1. [Most logical next action based on PRD phase]
2. [Second priority]
3. [Third priority]

**Recommended command**: `/wf-implement <first task>` or `/wf-pick-issue`
```

## Examples

**Read PRD and show summary**:
```
/wf-read-prd
/wf-read-prd summary
```

**Extract tasks from PRD**:
```
/wf-read-prd tasks
```

**Create GitHub issues from PRD**:
```
/wf-read-prd issues
```

**Update progress.md with PRD context**:
```
/wf-read-prd context
```

## Notes

- This command is read-only by default (summary, tasks)
- `issues` and `context` actions modify external state (GitHub, files)
- Always confirm with user before creating issues or modifying files
- Works with any PRD structure - adapts parsing to actual content
- Can be run multiple times as PRD evolves
