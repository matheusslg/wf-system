---
description: Create a GitHub Issue or Jira ticket from user story
allowed-tools: Read, Bash, Grep, Glob, mcp__github__create_issue, mcp__github__list_issues, mcp__github__get_issue, WebFetch
argument-hint: <user story description>
---

# Create Ticket

Create a well-structured ticket from a user story description with acceptance criteria.

## Arguments
- `$ARGUMENTS` - User story description (can include acceptance criteria)

## Input Formats Supported

The user can provide input in various formats:

**Simple description**:
```
Add dark mode toggle to settings
```

**User story format**:
```
As a user, I want to toggle dark mode so that I can reduce eye strain
```

**With acceptance criteria**:
```
Add export functionality

AC:
- Can export to PDF
- Can export to CSV
- Shows progress indicator
```

**Jira-style**:
```
[EPIC-123] Implement user notifications
```

## 1. Detect Target Platform

Check for configuration:
```bash
cat .claude/workflow.json 2>/dev/null || echo "{}"
```

Look for:
- `ticketing.platform`: "github" (default) or "jira"
- `ticketing.jiraProject`: Jira project key if using Jira
- `ticketing.jiraUrl`: Jira instance URL
- `github.owner` and `github.repo`: For GitHub issues

If not configured, detect from git remote:
```bash
git remote get-url origin
```

## 2. Parse User Input

From `$ARGUMENTS`, extract:

1. **Title**: First line or summary
2. **User Story**: "As a... I want... so that..." format (if provided)
3. **Description**: Additional context
4. **Acceptance Criteria**: Bulleted list of requirements
5. **Labels**: Infer from content (bug, feature, enhancement, etc.)
6. **Epic/Parent**: Reference to parent issue if mentioned

## 3. Enrich with Context

Search codebase for related information:
```bash
# Find related files/components mentioned
grep -r "<keywords from story>" --include="*.ts" --include="*.tsx" --include="*.py" -l | head -5
```

Check for existing related issues:
- Search GitHub issues for similar titles/keywords
- Avoid duplicates

## 4. Structure the Ticket

### For GitHub Issues:

```markdown
## User Story
As a [user type], I want [goal] so that [benefit].

## Description
[Expanded description of the feature/fix]

## Acceptance Criteria
- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] [Criterion 3]

## Technical Notes
- Related files: [list if found]
- Dependencies: [if any]

## Definition of Done
- [ ] Code implemented
- [ ] Tests passing
- [ ] Code reviewed
- [ ] Documentation updated (if needed)
```

### For Jira:

Use similar structure but format for Jira's fields:
- Summary (title)
- Description (body)
- Acceptance Criteria (custom field or in description)
- Labels
- Epic Link (if provided)

## 5. Determine Labels

Auto-suggest labels based on content:

| Keywords | Suggested Label |
|----------|-----------------|
| bug, fix, broken, error | `bug` |
| feature, add, new, implement | `enhancement` |
| refactor, clean, improve | `refactor` |
| docs, documentation | `documentation` |
| test, testing | `testing` |
| ui, design, style | `frontend` |
| api, endpoint, database | `backend` |
| deploy, infra, aws | `infrastructure` |

Also check for phase labels if project uses them:
```bash
gh label list 2>/dev/null | grep -i phase
```

## 6. Confirm with User

Before creating, show preview:

```
## Ticket Preview

**Platform**: GitHub Issues
**Repository**: owner/repo

**Title**: [generated title]

**Labels**: enhancement, frontend

**Body**:
[full formatted body]

---

Create this ticket? (Respond with any adjustments or "yes" to create)
```

## 7. Create the Ticket

### GitHub:

Use the GitHub MCP tool:
```
mcp__github__create_issue(
  owner: "<owner>",
  repo: "<repo>",
  title: "<title>",
  body: "<formatted body>",
  labels: ["<label1>", "<label2>"]
)
```

### Jira (if configured):

```bash
# Using Jira CLI or API
curl -X POST \
  -H "Authorization: Basic <token>" \
  -H "Content-Type: application/json" \
  -d '{"fields": {"project": {"key": "<PROJECT>"}, "summary": "<title>", "description": "<body>", "issuetype": {"name": "Story"}}}' \
  https://<jira-url>/rest/api/2/issue
```

## 8. Report Results

After creation:

```
## Ticket Created

**Platform**: GitHub Issues
**Number**: #[number]
**URL**: [link to issue]

**Title**: [title]
**Labels**: [labels]

---

Next steps:
- `/wf-pick-issue` to start working on it
- Add to project board if using GitHub Projects
- Assign to team member
```

## Examples

### Example 1: Simple feature
Input: `Add dark mode toggle`

Output:
- Title: "Add dark mode toggle to application"
- Labels: `enhancement`, `frontend`
- AC auto-generated based on common patterns

### Example 2: Bug report
Input: `Fix: Google login fails with PKCE error`

Output:
- Title: "Fix Google login PKCE error"
- Labels: `bug`, `frontend`, `auth`
- Links to auth-related files found in codebase

### Example 3: Full user story
Input:
```
As a conference organizer, I want to bulk upload multiple recordings so that I can process an entire event at once

AC:
- Support drag and drop for multiple files
- Show upload progress for each file
- Allow canceling individual uploads
- Maximum 10 files at once
```

Output: Fully structured issue with all AC as checkboxes

## Error Handling

- If GitHub token not configured: Show instructions to set up `gh auth login`
- If Jira not configured: Default to GitHub or show setup instructions
- If duplicate found: Show existing issue and ask to confirm creation
