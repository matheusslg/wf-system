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
- `--until-done` - Autonomous mode: work through ALL sub-tasks without human intervention
- `--force` - Override dependency checks

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

**Note**: The Task tool doesn't support custom agent names directly. We work around this by:
1. Reading the agent's system prompt from its file
2. Including that prompt in the Task to `general-purpose`

### Read Agent Instructions

First, read the full agent file:
```bash
cat .claude/agents/{agent_name}.md
```

### Build Task Prompt

Combine the agent instructions with the task context:

```markdown
## Agent Role (from {agent_name})

{full_content_of_agent_file}

---

## Task Assignment

{prepared_task_context_from_section_9}
```

### Spawn via general-purpose

```
Task(
  subagent_type: "general-purpose",
  prompt: "{combined_agent_role_and_task_context}",
  description: "Execute sub-task #{number} as {agent_name}"
)
```

The agent will:
1. Follow the instructions from the agent file (included in prompt)
2. Execute the task with those capabilities
3. Return completion report

### Why This Works

- `general-purpose` has access to all tools including MCP tools
- By including the agent's system prompt, we give it the same "personality"
- The agent follows the same protocols defined in the agent file

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

## 13. Workflow Pipeline (REQUIRED)

After a developer agent completes implementation, **the work MUST go through the pipeline** if reviewer/QA agents exist.

### Pipeline Order

```
Developer (backend/frontend) → Reviewer → QA → Close
```

### Check Available Pipeline Agents

```bash
ls .claude/agents/*reviewer*.md .claude/agents/*review*.md 2>/dev/null
ls .claude/agents/*qa*.md .claude/agents/*test*.md 2>/dev/null
```

### Pipeline Rules

| Current Agent Type | Result | Next Step |
|-------------------|--------|-----------|
| `*-backend`, `*-frontend`, `*-developer` | Complete | → Reviewer (if exists) |
| `*-reviewer`, `*-review` | **Approved** | → QA (if exists) |
| `*-reviewer`, `*-review` | **Issues Found** | → **Back to Developer** to fix |
| `*-qa`, `*-test` | **Passed** | → Close issue |
| `*-qa`, `*-test` | **Issues Found** | → **Back to Developer** to fix |
| No pipeline agents | N/A | → Close issue |

### Pipeline Flow with Feedback Loop

```
                    ┌─────────────────────────────────┐
                    │                                 │
                    ▼                                 │
Developer ──► Reviewer ──► QA ──► Close              │
                │          │                         │
                │          │    (issues found)       │
                │          └─────────────────────────┤
                │               (issues found)       │
                └────────────────────────────────────┘
```

**Key Rule**: Reviewer and QA agents **only review/test** - they do NOT fix code. All fixes go back to the original developer agent.

### After Developer Completes

If a reviewer agent exists in `.claude/agents/`:

```markdown
## Implementation Complete - Review Required

The developer agent has completed the implementation.

**Workflow Pipeline**: Developer ✓ → **Reviewer** → QA → Close

A reviewer agent exists. Starting code review...
```

Then read the reviewer agent file and spawn via general-purpose:

```bash
cat .claude/agents/{project}-reviewer.md
```

```
Task(
  subagent_type: "general-purpose",
  prompt: "{content_of_reviewer_agent_file}

  ---

  ## Review Task

  Review the implementation for issue #{number}.

  **Files to review**: {files_changed}

  **Review checklist**:
  - [ ] Code correctness
  - [ ] Follows project standards
  - [ ] No security issues
  - [ ] Tests are adequate
  - [ ] No unnecessary complexity

  **Your response MUST end with one of**:
  - `APPROVED` - Code is ready for QA
  - `CHANGES_REQUESTED` - Issues need fixing (list them with file:line references)

  **IMPORTANT**: You do NOT fix code. You only review and report issues.",
  description: "Review implementation for #{number}"
)
```

### After Reviewer Completes

Parse reviewer response for `APPROVED` or `CHANGES_REQUESTED`.

**If APPROVED** and QA agent exists:

```markdown
## Review Approved - QA Required

**Workflow Pipeline**: Developer ✓ → Reviewer ✓ → **QA** → Close

Starting QA validation...
```

Then spawn QA agent (see below).

**If CHANGES_REQUESTED**:

```markdown
## Review Found Issues - Developer Fix Required

**Workflow Pipeline**: Developer → Reviewer → Developer (fixing) → Reviewer → ...

The reviewer found issues that need to be fixed.

### Issues to Fix
{reviewer_issues_list}

Sending back to developer agent for fixes...
```

Then read the original developer agent file and spawn via general-purpose:

```bash
cat .claude/agents/{original_developer_agent}.md  # e.g., {project}-backend
```

```
Task(
  subagent_type: "general-purpose",
  prompt: "{content_of_developer_agent_file}

  ---

  ## Fix Task

  Fix the issues found during code review for issue #{number}.

  **Review Feedback**:
  {reviewer_issues_list}

  **Your task**:
  1. Fix each issue listed above
  2. Ensure tests still pass
  3. Report what you fixed

  **When done**: List the fixes made for each issue.",
  description: "Fix review issues for #{number}"
)
```

After developer fixes, **re-run the reviewer** (loop back).

### After QA Agent

Read QA agent file and spawn via general-purpose:

```bash
cat .claude/agents/{project}-qa.md
```

```
Task(
  subagent_type: "general-purpose",
  prompt: "{content_of_qa_agent_file}

  ---

  ## QA Task

  QA validation for issue #{number}.

  **What was implemented**: {implementation_summary}
  **Files changed**: {files_changed}

  **QA checklist**:
  - [ ] Run all tests: `npm run test`
  - [ ] Check test coverage
  - [ ] Verify acceptance criteria from issue
  - [ ] Test edge cases
  - [ ] Check for regressions

  **Your response MUST end with one of**:
  - `PASSED` - All tests pass, ready to close
  - `FAILED` - Issues found (list failing tests or bugs)

  **IMPORTANT**: You do NOT fix code. You only test and report issues.",
  description: "QA validation for #{number}"
)
```

### After QA Completes

Parse QA response for `PASSED` or `FAILED`.

**If PASSED**: Proceed to close issue.

**If FAILED**:

```markdown
## QA Found Issues - Developer Fix Required

**Workflow Pipeline**: Developer → Reviewer ✓ → QA → Developer (fixing) → QA → ...

QA testing found issues that need to be fixed.

### Issues to Fix
{qa_issues_list}

Sending back to developer agent for fixes...
```

Then read the original developer agent file and spawn via general-purpose:

```bash
cat .claude/agents/{original_developer_agent}.md  # e.g., {project}-backend
```

```
Task(
  subagent_type: "general-purpose",
  prompt: "{content_of_developer_agent_file}

  ---

  ## Fix Task

  Fix the issues found during QA for issue #{number}.

  **QA Feedback**:
  {qa_issues_list}

  **Your task**:
  1. Fix each issue/bug listed above
  2. Ensure all tests pass
  3. Add tests for the bugs if missing
  4. Report what you fixed

  **When done**: List the fixes made for each issue.",
  description: "Fix QA issues for #{number}"
)
```

After developer fixes, **re-run QA** (loop back) - skip reviewer since those issues were already approved.

### Pipeline Completion

Only after ALL pipeline steps complete (with no pending issues):

```markdown
## Pipeline Complete

**Workflow Pipeline**: Developer ✓ → Reviewer ✓ → QA ✓

All pipeline stages passed. Issue #{number} is ready to close.
```

## 14. Close Issue

**Only close after pipeline is complete** (or if no pipeline agents exist).

Ask user:
```markdown
Pipeline complete. **Close issue #{number}?**
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

## 15. Report Results

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

1. **Autonomous Mode**: Use `--until-done` to process all sub-tasks without intervention
2. **Pipeline is Mandatory**: Developer → Reviewer → QA flow is enforced when those agents exist
3. **Dependencies**: Always check dependencies are complete first
4. **One at a Time**: In manual mode, complete one sub-task before starting another
5. **Progress Tracking**: Use `/wf-ticket-status` to see overall progress
6. **Manual Override**: Use `--force` to skip dependency checks if needed
7. **Re-run**: If agent fails, you can re-run the delegate command
8. **Skip Pipeline**: Use `--skip-pipeline` only if you need to bypass review/QA (not recommended)

## 16. Autonomous Mode (--until-done)

If `$ARGUMENTS` contains `--until-done`, enable autonomous execution loop.

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                    AUTONOMOUS MODE                           │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │ Find Next    │───>│ Execute Task │───>│ Pipeline     │  │
│  │ Available    │    │ (Developer)  │    │ (Review/QA)  │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         ↑                                       │           │
│         │                                       │           │
│         └───────────── Loop ────────────────────┘           │
│                                                              │
│  Stops when: No more open sub-tasks with met dependencies   │
└─────────────────────────────────────────────────────────────┘
```

### Starting Autonomous Mode

```markdown
## Autonomous Mode Enabled

**Mode**: `--until-done`
**Will process**: All open sub-tasks with met dependencies
**Pipeline**: Developer → Reviewer → QA (if agents exist)

Starting autonomous execution...
```

### Find Next Available Sub-Task

After completing each task (or at start if no issue number provided):

```
mcp__github__search_issues(
  query: "label:sub-task state:open",
  owner: breakdown.githubOwner,
  repo: breakdown.githubRepo
)
```

For each issue found, check:
1. Has `sub-task` label
2. Is `open` state
3. All dependencies are closed (parse body for "Depends on: #X")

**Priority order**:
1. Tasks with no dependencies first
2. Then tasks whose dependencies are all closed
3. Skip tasks with open dependencies

### Execute Next Task

For each available task:

```markdown
## Autonomous Progress

**Completed**: {N} of {total} sub-tasks
**Current**: #{issue_number} - {title}
**Agent**: `{agent_name}`

---
```

Then execute the full delegation flow (sections 3-15) for this task.

### Progress Tracking

After each task completion:

```markdown
## Task #{N} Complete

**Issue**: #{number} - {title}
**Status**: Closed ✓

**Progress**: {completed}/{total} sub-tasks done
**Remaining**: {list_remaining}

Continuing to next task...

---
```

### Autonomous Mode Completion

When no more tasks are available:

```markdown
## Autonomous Mode Complete

### Summary
**Total Processed**: {N} sub-tasks
**Duration**: {time_if_available}

### Completed Tasks
| # | Title | Agent | Status |
|---|-------|-------|--------|
| #125 | Backend API | backend | ✓ Closed |
| #126 | Frontend UI | frontend | ✓ Closed |
| #127 | Unit tests | qa | ✓ Closed |

### Skipped (Blocking Dependencies)
| # | Title | Blocked By |
|---|-------|------------|
| #128 | Integration | #129 (still open) |

### Next Steps
- Check parent issue: `/wf-ticket-status #{parent}`
- Review all changes: `git log --oneline -20`
- Run full test suite: `npm run test`

**All available sub-tasks have been processed.**
```

### Autonomous Mode Rules

1. **Respects Pipeline**: Every task goes through Developer → Reviewer → QA
2. **Respects Dependencies**: Won't start task if dependencies are open
3. **Auto-closes Issues**: Closes issues after successful pipeline completion
4. **Continues on Success**: Moves to next task automatically
5. **Stops on Critical Error**: If agent fails critically, stops and reports

### Error During Autonomous Mode

If a task fails during autonomous execution:

```markdown
## Autonomous Mode Paused

**Failed Task**: #{number} - {title}
**Error**: {error_description}

**Completed so far**: {N} sub-tasks

**Options**:
1. Fix the issue manually, then resume:
   ```bash
   /wf-delegate --until-done
   ```
2. Skip this task and continue:
   ```bash
   gh issue edit {number} --add-label "blocked"
   /wf-delegate --until-done
   ```
3. Investigate the error:
   ```bash
   /wf-debug "#{number} failed: {error}"
   ```
```

### Usage Examples

```bash
# Start autonomous mode from scratch (finds first available task)
/wf-delegate --until-done

# Start with specific task, then continue with rest
/wf-delegate 125 --until-done

# Force start even if some dependencies are unmet
/wf-delegate --until-done --force
```

## Related Commands
- `/wf-breakdown` - Create new sub-tasks from Jira ticket or GitHub issue
- `/wf-ticket-status` - Check implementation progress
- `/wf-commit` - Create conventional commit after implementation
