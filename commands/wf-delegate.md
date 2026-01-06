---
description: Execute a sub-task with its assigned agent
allowed-tools: Read, Bash, Grep, Glob, Task
argument-hint: <GitHub issue number>
---

# Execute Sub-Task

Execute a specific sub-task from a breakdown plan by spawning the appropriate specialized agent with full context.

## Arguments
- `$ARGUMENTS` - GitHub issue number of the sub-task to execute
  - Examples: `125`, `#125`

## Flags
- `--list` - List available sub-tasks from tech-lead tracked issues

## 0. Load Configuration

Check for workflow configuration:
```bash
cat .claude/workflow.json 2>/dev/null || echo "{}"
```

Extract:
- `breakdown.githubOwner`: GitHub repository owner
- `breakdown.githubRepo`: GitHub repository name
- `agents`: Map of available agents

## 1. Handle List Flag

If `$ARGUMENTS` contains `--list`:

Search for tech-lead sub-tasks:
```
mcp__github__search_issues(
  query: "label:sub-task label:tech-lead state:open",
  owner: breakdown.githubOwner,
  repo: breakdown.githubRepo
)
```

Present available sub-tasks:
```markdown
## Available Sub-Tasks

| # | Title | Agent | Parent | Dependencies |
|---|-------|-------|--------|--------------|
| #125 | Backend API endpoints | `sxrx-backend` | #123 | None |
| #126 | Frontend components | `sxrx-frontend` | #123 | #125 |
| #127 | Unit tests | `sxrx-qa` | #123 | #125, #126 |

**Pick a sub-task**:
```bash
/wf-delegate 125
```
```

Exit after listing.

## 2. Parse Issue Number

Extract issue number from `$ARGUMENTS`:
- `125` -> `125`
- `#125` -> `125`

Validate it's a number.

## 3. Fetch GitHub Issue

```
mcp__github__get_issue(
  owner: breakdown.githubOwner,
  repo: breakdown.githubRepo,
  issue_number: {parsed_number}
)
```

**Extract from response**:
- `title` - Issue title
- `body` - Full task description
- `labels` - Look for `agent:{name}` label
- `state` - Should be "open"

**If issue not found**:
```markdown
Error: GitHub issue #{number} not found

Verify:
- Issue exists in {owner}/{repo}
- Issue number is correct

List available sub-tasks:
```bash
/wf-delegate --list
```
```

**If issue is closed**:
```markdown
Issue #{number} is already closed.

To reopen and work on it:
```bash
gh issue reopen {number}
/wf-delegate {number}
```
```

## 4. Validate Sub-Task

Check issue has required labels:
- `sub-task` label (confirms it's a tech-lead sub-task)
- `agent:{name}` label (identifies assigned agent)

**If not a sub-task**:
```markdown
Error: Issue #{number} is not a breakdown sub-task

This command only works with issues created by `/wf-breakdown`.
Sub-tasks have the `sub-task` label.

To create sub-tasks from a source issue:
```bash
/wf-breakdown SXRX-1023   # From Jira
/wf-breakdown #42         # From GitHub issue
```
```

**If no agent label**:
```markdown
Error: No agent assignment found on issue #{number}

The issue should have a label like `agent:{project}-backend`.

**To find available agents**:
```bash
ls .claude/agents/*.md
```

**To fix**, add the appropriate label:
```bash
gh issue edit {number} --add-label "agent:{project}-backend"
```

Then run `/wf-delegate {number}` again.
```

## 5. Extract Agent Name

Parse agent from labels:
- Find label matching pattern `agent:*`
- Extract agent name (e.g., `agent:sxrx-backend` -> `sxrx-backend`)

## 6. Check Dependencies

Parse issue body for dependency mentions:
- Look for "Depends on: #X" pattern
- Look for "Dependencies: #X, #Y" pattern

For each dependency:
```
mcp__github__get_issue(
  owner: breakdown.githubOwner,
  repo: breakdown.githubRepo,
  issue_number: {dependency_number}
)
```

**If dependency is still open**:
```markdown
## Blocked by Dependencies

Issue #{number} depends on:
- #{dep_1} - {title} - **OPEN** (blocking)
- #{dep_2} - {title} - Closed (OK)

Complete the blocking issues first:
```bash
/wf-delegate {dep_1}
```

Or override if you know what you're doing:
```bash
/wf-delegate {number} --force
```
```

If `--force` flag not present and has open dependencies, exit.

## 7. Verify Agent Exists

Check if agent file exists in project:
```bash
ls .claude/agents/{agent_name}.md 2>/dev/null || echo "NOT_FOUND"
```

**If agent not found**:
```markdown
Error: Agent `{agent_name}` not found in this project

Expected file: `.claude/agents/{agent_name}.md`

**Available agents in this project**:
```bash
ls .claude/agents/*.md
```

**Options**:
1. Create the agent using `/wf-init` (adds standard agents)
2. Manually create `.claude/agents/{agent_name}.md`
3. Re-assign to existing agent:
   ```bash
   gh issue edit {number} --remove-label "agent:{agent_name}" --add-label "agent:sxrx-backend"
   ```
```

## 8. Load Agent Context

Read the agent definition:
```bash
cat .claude/agents/{agent_name}.md
```

Extract:
- Agent description and capabilities
- Session protocol
- Responsibilities
- Code standards
- Working pattern
- Key files
- Commands

## 9. Prepare Task Context

Build comprehensive context for the agent:

```markdown
## Task Assignment from breakdown

### GitHub Issue
**Issue**: #{number}
**Title**: {title}
**URL**: https://github.com/{owner}/{repo}/issues/{number}

### Task Details
{issue_body}

### Agent Instructions
You are being delegated this task from the breakdown.

**Your Mission**:
1. Implement the task as described above
2. Follow your standard working pattern
3. Write tests for your changes
4. Validate with `npx tsc --noEmit` and `npm run test`

**When Complete**:
1. Report what you implemented
2. List files created/modified
3. Confirm all tests pass

**Do NOT**:
- Work on other tasks
- Modify code outside your scope
- Skip testing

### Session Protocol Reminder
Before starting:
1. Read `progress.md` for current state
2. Read `standards.md` for conventions
3. Create feature branch if not exists
```

## 10. Spawn Agent via Task Tool

Use the Task tool to spawn the appropriate agent:

```
Task(
  subagent_type: "{agent_name}",
  prompt: "{prepared_task_context}",
  description: "Execute sub-task #{number}"
)
```

The agent will:
1. Read its own agent file for protocols
2. Execute the task
3. Return completion report

## 11. Process Agent Results

When agent completes, capture:
- Files created/modified
- Tests added
- Any issues encountered
- Validation results

## 12. Update GitHub Issue

Add completion comment:
```
mcp__github__add_issue_comment(
  owner: breakdown.githubOwner,
  repo: breakdown.githubRepo,
  issue_number: {number},
  body: "{completion_comment}"
)
```

**Completion Comment Template**:
```markdown
## Task Completed

**Agent**: `{agent_name}`
**Status**: Implemented

### Summary
{brief_summary_of_what_was_done}

### Files Modified
- `path/to/file1.ts` - {what_changed}
- `path/to/file2.ts` - {what_changed}

### Files Created
- `path/to/new_file.ts` - {purpose}

### Tests
- Added: `path/to/test.spec.ts`
- Status: Passing

### Validation
- [x] TypeScript compiles: `npx tsc --noEmit`
- [x] Lint passes: `npm run lint`
- [x] Tests pass: `npm run test`

---
*Completed by `{agent_name}` via `/wf-delegate`*
```

## 13. Close Issue (Optional)

Ask user if task is complete:
```markdown
Task implementation complete.

**Close issue #{number}?**
- `yes` - Close the issue
- `no` - Keep open for further work
```

If yes:
```
mcp__github__update_issue(
  owner: breakdown.githubOwner,
  repo: breakdown.githubRepo,
  issue_number: {number},
  state: "closed"
)
```

## 14. Report Results

```markdown
## Sub-Task Delegation Complete

### Issue
- **#{number}**: {title}
- **Agent**: `{agent_name}`
- **Status**: {Completed | In Progress}

### Implementation Summary
{agent_report_summary}

### Files Changed
{list_of_files}

### Next Steps
{suggestions_based_on_remaining_sub_tasks}

**Check parent issue progress**:
```bash
/wf-ticket-status #{parent_number}
```

**Pick up next sub-task**:
```bash
/wf-delegate --list
```
```

## Error Handling

### GitHub MCP Not Available
```markdown
Error: GitHub MCP not available

The delegate command requires the GitHub MCP server.
Check that `github` is enabled in your Claude settings.
```

### Task Tool Failed
```markdown
Error: Could not spawn agent `{agent_name}`

Possible causes:
1. Agent file not found
2. Task tool unavailable
3. Agent encountered an error

**Try manual approach**:
1. Read the issue: `gh issue view {number}`
2. Implement the task directly
3. Update the issue when done
```

### Agent Returned Error
```markdown
## Agent Encountered Issues

**Agent**: `{agent_name}`
**Issue**: #{number}

### Problem
{error_description}

### Suggested Actions
1. {suggestion_1}
2. {suggestion_2}

**The issue remains open for retry**:
```bash
/wf-delegate {number}
```
```

## Tips

1. **Dependencies**: Always check dependencies are complete first
2. **One at a Time**: Complete one sub-task before starting another
3. **Progress Tracking**: Use `/wf-ticket-status` to see overall progress
4. **Manual Override**: Use `--force` to skip dependency checks if needed
5. **Re-run**: If agent fails, you can re-run the delegate command

## Related Commands
- `/wf-breakdown` - Create new sub-tasks from Jira ticket or GitHub issue
- `/wf-ticket-status` - Check implementation progress
- `/wf-commit` - Create conventional commit after implementation
