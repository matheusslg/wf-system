---
description: Select the next issue to work on based on priority
allowed-tools: Read, Bash, Grep
argument-hint: "<label or filter>"
---

# Pick Issue

Select the next issue to work on from GitHub Issues.

## Arguments
- `$ARGUMENTS` - Optional label filter (e.g., "bug", "feature", "phase-1")

## 1. List Available Issues

Get open issues:
```bash
# All open issues
gh issue list --state open --limit 20

# Or filtered by label if $ARGUMENTS provided
gh issue list --state open --label "$ARGUMENTS" --limit 20
```

## 2. Prioritize

Consider these factors:
1. **Labels**: priority-high, priority-medium, blocking
2. **Milestones**: Current milestone first
3. **Dependencies**: Issues that unblock others
4. **Size**: Quick wins vs larger efforts
5. **Assignment**: Prefer unassigned issues

## 3. Check Current Context

Read progress file for context:
```bash
cat progress.md 2>/dev/null | head -50 || cat claude-progress.md 2>/dev/null | head -50
```

Consider:
- What's already in progress?
- What was the previous focus?
- Any blockers to address first?

## 4. Present Options

Show top 3-5 candidates:

```
## Available Issues

**Recommended** (based on priority/context):
1. #42 - [Title] - [labels] - [reason for recommendation]

**Other Options**:
2. #38 - [Title] - [labels]
3. #45 - [Title] - [labels]

**In Progress** (if any):
- #40 - [Title] - [status]
```

## 5. Confirm Selection

Ask user to confirm which issue to work on.

## 6. Start Work

Once selected:
```bash
# View full issue details
gh issue view [number]

# Create branch (if not exists)
git checkout -b feature/[issue-number]-[short-description]

# Assign to self
gh issue edit [number] --add-assignee @me
```

## 7. Report

```
## Issue Selected

**Issue**: #[number] - [title]
**Branch**: feature/[number]-[description]
**Labels**: [labels]

**Description**:
[Issue body summary]

**Acceptance Criteria**:
- [ ] [criteria from issue]

Ready to start. Use `/wf-implement` or begin working on the issue.
```
