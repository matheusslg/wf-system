---
description: Check implementation progress for a tracked ticket
allowed-tools: Read, Bash, Grep, Glob
argument-hint: <ticket-key or GitHub issue>
---

# Ticket Status - Check Implementation Progress

Check implementation progress for a feature tracked by breakdown.

**⚠️ CRITICAL: Check `ticketing.platform` in workflow.json to determine where sub-tasks are tracked.**

- **If `ticketing.platform` is "jira"**: Sub-tasks are tracked in Jira
- **If `ticketing.platform` is "github"**: Sub-tasks are tracked as GitHub issues

## Arguments
- `$ARGUMENTS` - Identifier for the feature to check
  - Examples: `PROJ-1023`, `#123`, `123`

## Flags
- `--all` - Show all tech-lead tracked features
- `--open` - Show only features with open sub-tasks
- `--blocked` - Show only blocked sub-tasks
- `--ready` - Show sub-tasks ready for pickup (no unmet dependencies)

## 0. Load Configuration

Check for workflow configuration:
```bash
cat .claude/workflow.json 2>/dev/null || echo "{}"
```

**⚠️ FIRST: Determine ticketing platform:**
```bash
PLATFORM=$(cat .claude/workflow.json 2>/dev/null | jq -r '.ticketing.platform // "github"')
echo "Ticketing platform: $PLATFORM"
```

Extract based on platform:

**If platform is "jira"**:
- `ticketing.jiraProject`: Jira project key prefix
- `ticketing.jiraCloudId`: Jira cloud domain

**If platform is "github"**:
- `delegate.githubOwner`: GitHub repository owner
- `delegate.githubRepo`: GitHub repository name

## 1. Handle Flags

### --all Flag
If `$ARGUMENTS` contains `--all`:

**If platform is "jira"**:
Search Jira for tracked parent issues:
```
mcp__atlassian__searchJiraIssuesUsingJql(
  jql: "project = {jiraProject} AND labels = tech-lead AND labels = tracked AND type != Sub-task",
  cloudId: {jiraCloudId}
)
```

Or use jira-cli.sh fallback:
```bash
./scripts/jira-cli.sh search "project = {jiraProject} AND labels = tech-lead AND labels = tracked AND type != Sub-task"
```

**If platform is "github"**:
Search for all tech-lead parent issues:
```
mcp__github__search_issues(
  query: "label:tech-lead label:tracked -label:sub-task",
  owner: delegate.githubOwner,
  repo: delegate.githubRepo
)
```

Present summary:
```markdown
## Tracked Features

| Issue | Title | Progress | Status |
|-------|-------|----------|--------|
| {key} | Feature A | 3/5 (60%) | In Progress |
| {key} | Feature B | 5/5 (100%) | Complete |
| {key} | Feature C | 0/4 (0%) | Not Started |

**Totals**:
- Features: {count}
- Complete: {complete_count}
- In Progress: {in_progress_count}
- Not Started: {not_started_count}

**View specific feature**:
```bash
/wf-ticket-status {issue_key}
```
```

Exit after listing.

### --blocked Flag

**If platform is "jira"**:
```
mcp__atlassian__searchJiraIssuesUsingJql(
  jql: "project = {jiraProject} AND labels = sub-task AND labels = blocked AND status != Done",
  cloudId: {jiraCloudId}
)
```

**If platform is "github"**:
```
mcp__github__search_issues(
  query: "label:sub-task label:blocked state:open",
  owner: delegate.githubOwner,
  repo: delegate.githubRepo
)
```

### --ready Flag
Search for sub-tasks, then filter by checking dependencies are closed.

## 2. Parse Input

Determine input type from `$ARGUMENTS`:
- `PROJECT-1023` - Jira ticket key -> search for matching GitHub issue
- `#123` or `123` - GitHub issue number -> fetch directly

## 3. Find Parent Issue

**If platform is "jira"**:

Fetch the Jira ticket directly:
```
mcp__atlassian__getJiraIssue(
  issueIdOrKey: {issue_key},
  cloudId: {jiraCloudId}
)
```

Or use jira-cli.sh fallback:
```bash
./scripts/jira-cli.sh get-ticket {issue_key}
```

Verify it's a parent issue (has `tech-lead` label, type is not Sub-task).

**If platform is "github"**:

### If Jira Key Provided (for reference only)
Search GitHub for matching parent issue:
```
mcp__github__search_issues(
  query: "[{PROJECT}-{number}] label:tech-lead -label:sub-task",
  owner: delegate.githubOwner,
  repo: delegate.githubRepo
)
```

### If GitHub Number Provided
Fetch the issue directly:
```
mcp__github__get_issue(
  owner: delegate.githubOwner,
  repo: delegate.githubRepo,
  issue_number: {number}
)
```

Verify it's a parent issue (has `tech-lead` label, not `sub-task` label).

**If not found**:
```markdown
Error: Could not find tracked feature for `{input}`

**Search options**:
- List all: `/wf-ticket-status --all`

**Create sub-tasks for a ticket**:
```bash
/wf-breakdown {issue_key}
```
```

## 4. Extract Source Reference

Parse parent issue title for source reference:
- Pattern: `[{reference}]` at start of title (e.g., `[PROJ-1023]` or `[#42]`)
- Extract the reference identifier

## 5. Find Child Issues

**If platform is "jira"**:

Search for Jira sub-tasks:
```
mcp__atlassian__searchJiraIssuesUsingJql(
  jql: "parent = {parentKey} AND labels = sub-task",
  cloudId: {jiraCloudId}
)
```

Or use jira-cli.sh fallback:
```bash
./scripts/jira-cli.sh search "parent = {parentKey} AND labels = sub-task"
```

**If platform is "github"**:

Search for sub-tasks linked to this parent:
```
mcp__github__search_issues(
  query: "label:sub-task \"Part of #{parent_number}\"",
  owner: delegate.githubOwner,
  repo: delegate.githubRepo
)
```

Alternative: Parse parent issue body for sub-task links:
- Look for `- [ ] #{number}` or `- [x] #{number}` patterns

## 6. Fetch Sub-Task Details

**If platform is "jira"**:

For each sub-task found:
```
mcp__atlassian__getJiraIssue(
  issueIdOrKey: {sub_task_key},
  cloudId: {jiraCloudId}
)
```

**Extract**:
- `key` - Issue key (e.g., PROJ-124)
- `summary` - Task title
- `status.name` - Status (To Do, In Progress, Done, etc.)
- `labels` - Find `agent:{name}` label
- `assignee` - Who's working on it
- Dependencies from description

**If platform is "github"**:

For each sub-task found:
```
mcp__github__get_issue(
  owner: delegate.githubOwner,
  repo: delegate.githubRepo,
  issue_number: {sub_task_number}
)
```

**Extract**:
- `number` - Issue number
- `title` - Task title
- `state` - open/closed
- `labels` - Find `agent:{name}` label
- `assignee` - Who's working on it
- Dependencies from body

## 7. Calculate Progress

**Metrics**:
- Total sub-tasks
- Completed (closed)
- In progress (open with assignee or activity)
- Blocked (has unmet dependencies)
- Ready (open, no unmet dependencies)

**Progress percentage**: `(completed / total) * 100`

## 8. Check for Blockers

For each open sub-task:
1. Parse dependencies from body ("Depends on: #X")
2. Check if dependency issues are closed
3. Mark as "blocked" if any dependency is open

## 9. Present Status Report

```markdown
# Feature Status: {reference}

## Overview
**Source**: [{reference}]({referenceUrl})
**GitHub Parent**: #{parent_issue_number}
**Title**: {title}

## Progress
**Status**: {Not Started | In Progress | Blocked | Complete}
**Progress**: {completed}/{total} sub-tasks ({percentage}%)

```
[=========>          ] 60%
```

## Sub-Tasks

### Completed
| # | Title | Agent | Closed |
|---|-------|-------|--------|
| #{n} | {title} | `{agent}` | {date} |

### In Progress
| # | Title | Agent | Assignee | Dependencies |
|---|-------|-------|----------|--------------|
| #{n} | {title} | `{agent}` | @{user} | None |

### Blocked
| # | Title | Agent | Blocked By |
|---|-------|-------|------------|
| #{n} | {title} | `{agent}` | #{dep} (open) |

### Ready for Pickup
| # | Title | Agent | Dependencies |
|---|-------|-------|--------------|
| #{n} | {title} | `{agent}` | All met |

## Dependency Graph
```
#125 (Backend API) -----> #126 (Frontend UI)
                    \---> #127 (Tests)
```

## Next Actions
1. **Unblock**: Close #{blocking_issue} to unblock #{blocked_issue}
2. **Pick up**: #{ready_issue} is ready for `{agent}`
3. **Review**: #{completed_issue} may need code review

## Commands

```bash
# Execute next ready sub-task
/wf-delegate {ready_issue_number}

# View specific sub-task
gh issue view {sub_task_number}

# View parent issue
gh issue view {parent_number}
```
```

## 10. Handle Edge Cases

### No Sub-Tasks Found
```markdown
## Feature Status: {reference}

**GitHub Issue**: #{parent_number}
**Sub-Tasks**: None found

This parent issue has no linked sub-tasks.

**Options**:
1. The issue may have been created manually (not via `/wf-breakdown`)
2. Sub-tasks may not be linked properly

**Re-analyze and create sub-tasks**:
```bash
/wf-breakdown {reference}
```
```

### All Complete
```markdown
## Feature Status: {reference}

**Status**: COMPLETE
**Progress**: {total}/{total} sub-tasks (100%)

All sub-tasks have been completed!

**Next Steps**:
1. Review the implementation
2. Close parent issue if ready
3. Update source issue status (if applicable)

```bash
# Close parent issue
gh issue close {parent_number}

# Create PR if needed
/wf-commit
```
```

### Feature Not Started
```markdown
## Feature Status: {reference}

**Status**: NOT STARTED
**Progress**: 0/{total} sub-tasks (0%)

No sub-tasks have been started yet.

**Pick up first task**:
```bash
/wf-delegate {first_sub_task_number}
```
```

## Error Handling

### Platform MCP Not Available

**If platform is "jira" and Atlassian MCP fails**:
```markdown
Atlassian MCP unavailable. Falling back to jira-cli.sh...
```
Use `./scripts/jira-cli.sh` commands as documented above.

**If platform is "github" and GitHub MCP fails**:
```markdown
Error: GitHub MCP not available

The status command requires the GitHub MCP server.
Check that `github` is enabled in your Claude settings.
```

### Missing Configuration
```markdown
Error: ticketing configuration not found

Add the following to `.claude/workflow.json`:

For Jira:
```json
{
  "ticketing": {
    "platform": "jira",
    "jiraProject": "YOUR_PROJECT",
    "jiraCloudId": "your-domain.atlassian.net"
  }
}
```

For GitHub:
```json
{
  "ticketing": {
    "platform": "github"
  },
  "delegate": {
    "githubOwner": "your-org",
    "githubRepo": "your-repo"
  }
}
```
```

## Tips

1. **Regular Check**: Run status check before starting work each day
2. **Blocked First**: Address blocked issues before picking up new ones
3. **Dependencies**: Complete dependencies in order to unblock downstream tasks
4. **Progress File**: Also update `progress.md` for session continuity

## Related Commands
- `/wf-breakdown` - Create new sub-tasks from Jira ticket or GitHub issue
- `/wf-delegate` - Execute a specific sub-task
- `/wf-overview` - General project status (not just tech-lead issues)
