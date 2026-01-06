---
description: Parse PRD and create parent issues
allowed-tools: Read, Bash, Grep, Glob, Task, AskUserQuestion, mcp__github__create_issue, mcp__github__list_issues
argument-hint: [prd-file-path]
---

# Parse PRD

Read a Product Requirements Document and create GitHub Issues for parent-level tasks.

## Arguments
- `$ARGUMENTS` - Optional path to PRD file (auto-detected if not provided)

## 0. Locate PRD

Search for PRD file in common locations:

```bash
ls -la PRD.md prd.md docs/PRD.md docs/prd.md documentation/PRD.md 2>/dev/null | head -5
```

If not found, search recursively:

```bash
find . -maxdepth 3 -iname "*prd*.md" -type f 2>/dev/null | head -5
```

If still not found, ask user for the PRD location.

## 1. Read & Parse PRD

Read the full PRD content and identify key sections:

- **Vision/Problem/Solution**: Product overview
- **Personas**: Target users
- **User Stories**: What users need
- **Features**: MVP vs future phases
- **Architecture**: Tech stack
- **Roadmap**: Phases and milestones
- **Metrics**: Success criteria

## 2. Extract Parent Tasks

From the Roadmap section, extract high-level tasks organized by phase:

**Look for patterns like**:
- Phase headers (Phase 0, Phase 1, Sprint 1-2, etc.)
- Milestone markers
- Feature groupings
- Epic-level items

**Extract structure**:
```
Phase 0: Setup
  - Task 1: [description]
  - Task 2: [description]

Phase 1: MVP
  - Task 3: [description]
  - Task 4: [description]
```

## 3. Present Tasks for Confirmation

Display extracted tasks and ask for confirmation:

```markdown
## Extracted Parent Tasks from PRD

### Phase 0: Setup
- [ ] Set up project infrastructure
- [ ] Configure development environment

### Phase 1: MVP (Sprint 1-2)
- [ ] Implement user authentication
- [ ] Build core dashboard

### Phase 1: MVP (Sprint 3-4)
- [ ] Add payment integration
- [ ] Implement notifications

---

**Total**: {count} parent tasks

Do you want to create GitHub Issues for these tasks?
- [All] Create all issues
- [Select] Let me choose which ones
- [Cancel] Don't create issues
```

## 4. Create GitHub Issues

For each confirmed task, create a GitHub Issue:

**Check existing issues first**:
```bash
gh issue list --state all --limit 100 2>/dev/null
```

**Issue template**:
```markdown
## Description
{task description from PRD}

## Context
- **Phase**: {phase name}
- **Priority**: {inferred from roadmap position}
- **PRD Section**: {section reference}

## Acceptance Criteria
{extracted from user stories if available, otherwise leave for breakdown}

## Next Steps
Use `/wf-breakdown #{this_issue_number}` to create sub-tasks.

---
*Generated from PRD via `/wf-parse-prd`*
```

**Labels to apply**:
- `phase:{phase_number}` (e.g., `phase:0-setup`, `phase:1-mvp`)
- `type:epic` or `type:feature`
- `priority:{level}` if determinable

## 5. Report Results

After creating issues:

```markdown
## GitHub Issues Created

| # | Title | Phase | Labels |
|---|-------|-------|--------|
| #1 | Set up project infrastructure | Phase 0 | phase:0-setup |
| #2 | Implement user authentication | Phase 1 | phase:1-mvp, priority:high |
| #3 | Build core dashboard | Phase 1 | phase:1-mvp |

## Next Steps

1. **Break down issues**: Use `/wf-breakdown #N` to create sub-tasks
2. **Start working**: Use `/wf-pick-issue` to select first task
3. **Track progress**: Use `/wf-ticket-status #N` to monitor

**Recommended**: Start with `/wf-breakdown #1` to break down the first issue.
```

## 6. Handle Edge Cases

### No Roadmap Section
If PRD lacks a clear roadmap:
- Extract tasks from User Stories instead
- Ask user to identify main features
- Create issues for each major feature

### Existing Issues
If similar issues already exist:
- Show potential duplicates
- Ask user whether to skip, update, or create anyway

### No GitHub Repo
If not in a GitHub repository:
```bash
gh repo view --json name,owner 2>/dev/null || echo "Not a GitHub repo"
```
Offer to:
- Output tasks as markdown checklist instead
- Create issues in a specified repo

## Examples

**Parse PRD and create issues**:
```
/wf-parse-prd
/wf-parse-prd docs/PRD.md
```

**Typical workflow**:
```
/wf-parse-prd                    # Create parent issues from PRD
/wf-breakdown #1           # Break first issue into sub-tasks
/wf-delegate #5            # Execute a sub-task
/wf-ticket-status #1       # Check progress on parent issue
```

## Notes

- Creates **parent-level issues only** (epics/features)
- Use `/wf-breakdown` to create sub-tasks for each parent
- Always confirms before creating issues
- Skips duplicate detection to avoid creating redundant issues
- Works with any PRD structure - adapts parsing to content
