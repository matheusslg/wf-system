---
description: Execute a sub-task with its assigned agent
allowed-tools: Read, Bash, Grep, Glob, Task
argument-hint: <GitHub issue number>
---

# Execute Sub-Task

Execute a specific sub-task from a breakdown plan by spawning the appropriate specialized agent with full context.

## Arguments
- `$ARGUMENTS` - GitHub issue number(s) of the sub-task(s) to execute
  - Single: `125`, `#125`
  - Multiple (for parallel): `107 109 110 111`

## Flags
- `--list` - List available sub-tasks from tech-lead tracked issues
- `--until-done` - Autonomous mode: work through ALL sub-tasks without human intervention
- `--parallel` - Execute multiple tasks concurrently (use with multiple issue numbers)
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

### Screenshot Documentation (IMPORTANT)
Document your work with screenshots at key milestones. This creates a visual audit trail.

**When to take screenshots**:
| Milestone | When | Example |
|-----------|------|---------|
| Initial State | Before making changes (UI tasks) | Current page state |
| Progress | After each significant change | Added component, fixed layout |
| Validation | After running tests/builds | Terminal output, test results |
| Final Result | When task is complete | Final UI state |
| Errors | When encountering issues | Error messages, failed tests |

**How to take screenshots**:
```
# Use Playwright MCP
mcp__playwright__browser_take_screenshot(
  filename: "/tmp/issue-{issue_number}/step-{N}-{description}.png"
)

# Or with full page capture for long content
mcp__playwright__browser_take_screenshot(
  filename: "/tmp/issue-{issue_number}/step-{N}-{description}.png",
  fullPage: true
)
```

**Directory structure**:
```
/tmp/issue-{issue_number}/
├── step-01-initial-state.png
├── step-02-component-added.png
├── step-03-tests-passing.png
└── step-04-final-result.png
```

**Naming convention**: `step-{NN}-{short-description}.png`
- Use zero-padded numbers (01, 02, 03) for correct ordering
- Keep descriptions short and descriptive (kebab-case)

**For non-UI tasks** (backend, API, etc.):
- Take screenshots of terminal output when relevant
- Or skip screenshots if purely backend logic
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

## 11.1. MANDATORY PIPELINE GATE

**⛔ STOP - DO NOT CLOSE THE ISSUE YET ⛔**

After a developer agent completes, you MUST check for pipeline agents before closing:

```bash
# Check for reviewer agent
REVIEWER=$(ls .claude/agents/*reviewer*.md .claude/agents/*review*.md 2>/dev/null | head -1)

# Check for QA agent
QA_AGENT=$(ls .claude/agents/*qa*.md .claude/agents/*test*.md 2>/dev/null | head -1)
```

**Pipeline Decision Tree**:

```
IF $REVIEWER exists:
  → GO TO Section 13 (Workflow Pipeline)
  → DO NOT proceed to Section 14 (Close Issue)

ELSE IF $QA_AGENT exists:
  → GO TO Section 13.5 (QA Only Pipeline)
  → DO NOT proceed to Section 14 (Close Issue)

ELSE:
  → No pipeline agents, proceed to Section 14
```

**CRITICAL**: You cannot close an issue until the pipeline completes successfully. Track pipeline state:

```markdown
### Pipeline State for #{issue_number}
- [ ] Developer: Complete
- [ ] Reviewer: {Pending | Approved | N/A}
- [ ] QA: {Pending | Passed | N/A}
- [ ] Ready to Close: {Yes | No}
```

## 11.5. Collect and Upload Screenshots

After the agent completes, check for screenshots and upload them to the repository.

### Check for Screenshots

```bash
ls /tmp/issue-{issue_number}/*.png 2>/dev/null | wc -l
```

If screenshots exist, proceed with upload.

### Prepare Files for Upload

```bash
# List all screenshots
for f in /tmp/issue-{issue_number}/*.png; do
  echo "$(basename $f)"
done
```

### Upload to Repository

Use GitHub MCP to push screenshots to a dedicated folder:

```
# For each screenshot, read as base64 and push
mcp__github__push_files(
  owner: breakdown.githubOwner,
  repo: breakdown.githubRepo,
  branch: "main",  # or current feature branch
  files: [
    {
      path: ".github/issue-screenshots/{issue_number}/step-01-initial-state.png",
      content: "{base64_encoded_content}"
    },
    {
      path: ".github/issue-screenshots/{issue_number}/step-02-component-added.png",
      content: "{base64_encoded_content}"
    }
    # ... all screenshots
  ],
  message: "docs: add screenshots for issue #{issue_number}"
)
```

**Note**: If `push_files` doesn't support binary, use `create_or_update_file` for each:

```
# Alternative: Push screenshots one by one
mcp__github__create_or_update_file(
  owner: breakdown.githubOwner,
  repo: breakdown.githubRepo,
  path: ".github/issue-screenshots/{issue_number}/{filename}",
  content: "{base64_encoded_content}",
  message: "docs: add screenshot {filename} for issue #{issue_number}",
  branch: "main"
)
```

### Generate Screenshot URLs

After uploading, construct the raw GitHub URLs for each screenshot:

```
https://raw.githubusercontent.com/{owner}/{repo}/{branch}/.github/issue-screenshots/{issue_number}/{filename}
```

Example:
```
https://raw.githubusercontent.com/myorg/myrepo/main/.github/issue-screenshots/125/step-01-initial-state.png
```

### Cleanup Local Screenshots

```bash
rm -rf /tmp/issue-{issue_number}
```

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

### Implementation Screenshots

<details>
<summary>📸 Visual Documentation (click to expand)</summary>

#### Step 1: Initial State
![Initial State](https://raw.githubusercontent.com/{owner}/{repo}/{branch}/.github/issue-screenshots/{issue_number}/step-01-initial-state.png)

#### Step 2: {Description of change}
![{Description}](https://raw.githubusercontent.com/{owner}/{repo}/{branch}/.github/issue-screenshots/{issue_number}/step-02-{description}.png)

#### Step 3: Final Result
![Final Result](https://raw.githubusercontent.com/{owner}/{repo}/{branch}/.github/issue-screenshots/{issue_number}/step-03-final-result.png)

</details>

---
*Completed by `{agent_name}` via `/wf-delegate`*
```

**Note**: Only include the Screenshots section if screenshots were taken. Use `<details>` to keep the comment collapsible and clean.

## 13. Workflow Pipeline (REQUIRED)

**⛔ THIS SECTION IS MANDATORY - DO NOT SKIP ⛔**

After a developer agent completes implementation, **the work MUST go through the pipeline** if reviewer/QA agents exist. **You CANNOT close the issue until the pipeline completes.**

### Pipeline Order

```
Developer (backend/frontend) → Reviewer → QA → Close
                                  ↓          ↓
                              (issues?)  (issues?)
                                  ↓          ↓
                              Developer ←────┘
                              (fix loop)
```

### Pipeline Retry Limits

**MAX_REVIEW_RETRIES**: 3
**MAX_QA_RETRIES**: 3

Track retry count for each stage. If exceeded:
```markdown
## Pipeline Blocked - Human Intervention Required

**Issue**: #{number}
**Stage**: {Reviewer | QA}
**Retries**: {count}/3 EXCEEDED

The pipeline has looped {count} times without resolution.
This issue requires human intervention.

Adding label `needs-human` and pausing...
```

```bash
gh issue edit {number} --add-label "needs-human"
```

### Check Available Pipeline Agents

```bash
REVIEWER=$(ls .claude/agents/*reviewer*.md .claude/agents/*review*.md 2>/dev/null | head -1)
QA_AGENT=$(ls .claude/agents/*qa*.md .claude/agents/*test*.md 2>/dev/null | head -1)
echo "Reviewer: $REVIEWER"
echo "QA: $QA_AGENT"
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

  **Screenshot Documentation**:
  If you find issues, take screenshots to document them:
  - Save to: `/tmp/issue-{issue_number}/review-{NN}-{issue-description}.png`
  - Examples: `review-01-missing-null-check.png`, `review-02-accessibility-issue.png`
  - Use Playwright MCP: `browser_take_screenshot(filename: '...')`

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

  **Screenshot Documentation**:
  Document your fixes with screenshots:
  - Save to: `/tmp/issue-{issue_number}/fix-{NN}-{description}.png`
  - Examples: `fix-01-null-check-added.png`, `fix-02-accessibility-fixed.png`
  - Show before/after if helpful

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

  **Screenshot Documentation**:
  Document your QA validation with screenshots:
  - Save to: `/tmp/issue-{issue_number}/qa-{NN}-{description}.png`
  - Required: `qa-01-tests-passing.png` (terminal with test results)
  - If UI: `qa-02-acceptance-criteria.png` (showing feature works)
  - If failed: `qa-03-bug-{description}.png` (showing the issue)
  - Use Playwright MCP: `browser_take_screenshot(filename: '...')`

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

  **Screenshot Documentation**:
  Document your bug fixes with screenshots:
  - Save to: `/tmp/issue-{issue_number}/bugfix-{NN}-{description}.png`
  - Examples: `bugfix-01-edge-case-fixed.png`, `bugfix-02-regression-resolved.png`
  - Show the fix working if it's a UI bug

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

**⛔ VALIDATION REQUIRED BEFORE CLOSING ⛔**

Before closing ANY issue, verify the pipeline state:

### Pre-Close Checklist

```bash
# Check if pipeline agents exist
REVIEWER=$(ls .claude/agents/*reviewer*.md .claude/agents/*review*.md 2>/dev/null | head -1)
QA_AGENT=$(ls .claude/agents/*qa*.md .claude/agents/*test*.md 2>/dev/null | head -1)
```

**If pipeline agents exist, you MUST have completed the pipeline:**

| Condition | Can Close? |
|-----------|------------|
| No reviewer AND no QA agents | ✅ Yes |
| Reviewer exists, got `APPROVED` | ✅ Continue to QA |
| QA exists, got `PASSED` | ✅ Yes |
| Reviewer exists, NOT run yet | ❌ **NO - Run Section 13 first** |
| QA exists, NOT run yet | ❌ **NO - Run Section 13 first** |
| Reviewer returned `CHANGES_REQUESTED` | ❌ **NO - Fix and re-review** |
| QA returned `FAILED` | ❌ **NO - Fix and re-test** |

### Verify Pipeline Completion

Before closing, confirm you received one of these responses:
- From Reviewer: `APPROVED` (exact word)
- From QA: `PASSED` (exact word)

**If you cannot confirm these responses were received, DO NOT CLOSE. Go back to Section 13.**

### Close Prompt

Only after pipeline validation passes:

```markdown
## Ready to Close

**Pipeline State**:
- Developer: ✅ Complete
- Reviewer: {✅ APPROVED | ⏭️ N/A (no reviewer agent)}
- QA: {✅ PASSED | ⏭️ N/A (no QA agent)}

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
2. **Parallel Mode**: Use `--parallel` with multiple issues to execute independent tasks concurrently
3. **Pipeline is Mandatory**: Developer → Reviewer → QA flow is enforced when those agents exist
4. **Dependencies**: Always check dependencies are complete first
5. **Parallel First**: Check `/wf-breakdown` output for parallel-eligible tasks before starting
6. **Progress Tracking**: Use `/wf-ticket-status` to see overall progress
7. **Manual Override**: Use `--force` to skip dependency checks if needed
8. **Re-run**: If agent fails, you can re-run the delegate command
9. **Skip Pipeline**: Use `--skip-pipeline` only if you need to bypass review/QA (not recommended)

## 16. Autonomous Mode (--until-done)

If `$ARGUMENTS` contains `--until-done`, enable autonomous execution loop.

### How It Works

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         AUTONOMOUS MODE                                    │
│                                                                           │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌────────┐ │
│  │ Find Next    │───>│ Developer    │───>│ Reviewer     │───>│ QA     │ │
│  │ Available    │    │ Agent        │    │ (if exists)  │    │(exists)│ │
│  └──────────────┘    └──────────────┘    └──────┬───────┘    └───┬────┘ │
│         ↑                                       │                 │      │
│         │                                       │ CHANGES_REQ     │FAILED│
│         │                                       ▼                 ▼      │
│         │                                  ┌─────────────────────────┐   │
│         │                                  │ Developer Fixes         │   │
│         │                                  │ (retry ≤ 3 times)       │   │
│         │                                  └───────────┬─────────────┘   │
│         │                                              │                  │
│         │         ┌────────────────────────────────────┘                  │
│         │         │ (re-review or re-test)                               │
│         │         ▼                                                       │
│         │    ┌──────────────┐                                            │
│         │    │ APPROVED/    │                                            │
│         │    │ PASSED       │                                            │
│         │    └──────┬───────┘                                            │
│         │           │                                                     │
│         │           ▼                                                     │
│         │    ┌──────────────┐                                            │
│         └────│ Close Issue  │                                            │
│              │ (validated)  │                                            │
│              └──────────────┘                                            │
│                                                                           │
│  Stops when: No more open sub-tasks with met dependencies                │
└──────────────────────────────────────────────────────────────────────────┘
```

**⛔ CRITICAL FOR AUTONOMOUS MODE ⛔**

Each task MUST complete the FULL pipeline before moving to the next task:
1. Developer executes task
2. **IF reviewer exists**: Run reviewer → handle APPROVED/CHANGES_REQUESTED
3. **IF QA exists**: Run QA → handle PASSED/FAILED
4. **ONLY THEN**: Close issue and move to next task

**DO NOT skip steps 2-3 even in autonomous mode.**

### Starting Autonomous Mode

First, check what pipeline agents exist:

```bash
REVIEWER=$(ls .claude/agents/*reviewer*.md .claude/agents/*review*.md 2>/dev/null | head -1)
QA_AGENT=$(ls .claude/agents/*qa*.md .claude/agents/*test*.md 2>/dev/null | head -1)
echo "Pipeline: Developer → ${REVIEWER:+Reviewer →} ${QA_AGENT:+QA →} Close"
```

```markdown
## Autonomous Mode Enabled

**Mode**: `--until-done`
**Will process**: All open sub-tasks with met dependencies
**Pipeline agents found**:
- Reviewer: {$REVIEWER or "None"}
- QA: {$QA_AGENT or "None"}

**Each task will go through**: Developer {→ Reviewer} {→ QA} → Close

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
**Pipeline**: Developer → {Reviewer →} {QA →} Close

---
```

**Execute the FULL flow for this task:**

1. **Sections 3-11**: Validate issue, load agent, spawn developer task, collect results
2. **Section 11.1**: ⛔ MANDATORY PIPELINE GATE - Check for reviewer/QA agents
3. **Section 13**: IF pipeline agents exist, run the FULL pipeline:
   - Spawn Reviewer → Get APPROVED/CHANGES_REQUESTED
   - If CHANGES_REQUESTED: Developer fixes → Re-review (max 3 retries)
   - Spawn QA → Get PASSED/FAILED
   - If FAILED: Developer fixes → Re-test (max 3 retries)
4. **Section 14**: Validate pipeline completion, THEN close issue

**⛔ DO NOT proceed to next task until current task passes Section 14 validation ⛔**

### Progress Tracking

After each task completes the FULL pipeline:

```markdown
## Task #{N} Complete

**Issue**: #{number} - {title}
**Pipeline Result**:
- Developer: ✅ Implemented
- Reviewer: {✅ APPROVED | ⏭️ N/A}
- QA: {✅ PASSED | ⏭️ N/A}
**Status**: Closed ✓

**Progress**: {completed}/{total} sub-tasks done
**Remaining**: {list_remaining}

Continuing to next task...

---
```

**Note**: A task is only "complete" after the full pipeline passes. Developer completion alone is NOT sufficient to close.

### Autonomous Mode Completion

When no more tasks are available:

```markdown
## Autonomous Mode Complete

### Summary
**Total Processed**: {N} sub-tasks
**Duration**: {time_if_available}

### Completed Tasks
| # | Title | Agent | Reviewer | QA | Status |
|---|-------|-------|----------|-------|--------|
| #125 | Backend API | backend | ✅ APPROVED | ✅ PASSED | ✓ Closed |
| #126 | Frontend UI | frontend | ✅ APPROVED | ✅ PASSED | ✓ Closed |
| #127 | Unit tests | qa | ⏭️ N/A | ⏭️ N/A | ✓ Closed |

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

**⛔ MANDATORY RULES - DO NOT VIOLATE ⛔**

1. **Pipeline is NON-NEGOTIABLE**: IF reviewer/QA agents exist, they MUST run for EVERY task
2. **No Shortcuts**: Developer completion → Reviewer → QA → Close (never skip steps)
3. **Validate Before Close**: Section 14 validation MUST pass before closing ANY issue
4. **Retry Limits**: Max 3 retries per pipeline stage, then escalate to human
5. **One Task at a Time**: Complete full pipeline for task N before starting task N+1

**Standard Rules**:
6. **Respects Dependencies**: Won't start task if dependencies are open
7. **Auto-closes Issues**: Closes issues ONLY after successful pipeline completion
8. **Continues on Success**: Moves to next task automatically after pipeline passes
9. **Stops on Critical Error**: If agent fails critically or retries exceeded, stops and reports

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

## 17. Parallel Mode (--parallel)

Execute multiple independent tasks concurrently using parallel Task tool calls.

### When to Use

Use parallel mode when `/wf-breakdown` identifies tasks that can run simultaneously:

```
Execution Order:
1. Parallel: #107, #109, #110, #111 (no dependencies)  ← Use --parallel
2. Sequential: #108 (depends on #107)
3. Final: #112 (depends on all above)
```

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                      PARALLEL MODE                               │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Task #107    │  │ Task #109    │  │ Task #110    │  ...     │
│  │ (frontend)   │  │ (frontend)   │  │ (frontend)   │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                   │
│         └────────────┬────┴────────────────┘                   │
│                      ▼                                          │
│              Collect Results                                    │
│                      ▼                                          │
│         Upload All Screenshots                                  │
│                      ▼                                          │
│          Post Completion Comments                               │
│                      ▼                                          │
│             Pipeline (if exists)                                │
└─────────────────────────────────────────────────────────────────┘
```

### Starting Parallel Mode

If `$ARGUMENTS` contains `--parallel` with multiple issue numbers:

```markdown
## Parallel Execution Mode

**Issues**: #107, #109, #110, #111
**Mode**: Concurrent execution
**Agents**: {list unique agents}

Spawning {N} parallel tasks...
```

### Parse Multiple Issue Numbers

Extract all issue numbers from `$ARGUMENTS`:

```
# Input: "107 109 110 111 --parallel"
# Output: [107, 109, 110, 111]
```

### Validate All Issues

For each issue number, perform validation (Section 3-7):
- Fetch issue from GitHub
- Verify it's a sub-task
- Check dependencies (all must be met or use --force)
- Verify agent exists

**If any issue fails validation**:
```markdown
## Parallel Mode Blocked

Cannot start parallel execution:

| Issue | Problem |
|-------|---------|
| #107 | ✓ Ready |
| #109 | ✗ Dependency #107 still open |
| #110 | ✓ Ready |

**Fix**: Close blocking dependencies first, or use `--force` to override.
```

### Spawn Parallel Tasks

**CRITICAL**: Use a single message with multiple Task tool calls to execute in parallel.

For each validated issue, prepare the task context (Section 8-9), then spawn ALL at once:

```
# In a SINGLE response, call Task multiple times:

Task(
  subagent_type: "general-purpose",
  prompt: "{agent_107_content}\n\n---\n\n{task_107_context}",
  description: "Execute #107: Create Staff Mode Context"
)

Task(
  subagent_type: "general-purpose",
  prompt: "{agent_109_content}\n\n---\n\n{task_109_context}",
  description: "Execute #109: Make CategorySidebar Responsive"
)

Task(
  subagent_type: "general-purpose",
  prompt: "{agent_110_content}\n\n---\n\n{task_110_context}",
  description: "Execute #110: Optimize ProductGrid for Tablet"
)

Task(
  subagent_type: "general-purpose",
  prompt: "{agent_111_content}\n\n---\n\n{task_111_context}",
  description: "Execute #111: Improve Touch Targets"
)
```

### Collect Parallel Results

Wait for all tasks to complete, then collect:
- Files modified by each task
- Screenshots from each task's `/tmp/issue-{N}/` directory
- Success/failure status
- Agent reports

### Handle Conflicts

If multiple tasks modified the same file:

```markdown
## Potential Conflict Detected

Multiple tasks modified the same file(s):

| File | Modified By |
|------|-------------|
| `src/components/Layout.tsx` | #107, #109 |

**Action Required**:
1. Review the changes: `git diff src/components/Layout.tsx`
2. Resolve any conflicts manually
3. Run tests: `npm run test`
```

### Upload All Screenshots

Collect screenshots from all parallel tasks:

```bash
# Merge all screenshot directories
for issue in 107 109 110 111; do
  ls /tmp/issue-$issue/*.png 2>/dev/null
done
```

Upload to `.github/issue-screenshots/` for each issue (Section 11.5).

### Post Completion Comments

For each completed issue, post the completion comment (Section 12) with:
- Summary of what was done
- Files modified
- Screenshots (if any)

### Parallel Pipeline Handling

After all parallel tasks complete:

**Option A**: If tasks are independent (different scopes), run pipeline in parallel too:
```
Review #107 ─┬─► QA #107 ─┬─► Close
Review #109 ─┤            │
Review #110 ─┤            │
Review #111 ─┘            └─► Close all
```

**Option B**: If tasks touch related code, run pipeline sequentially:
```
Review all changes together → QA all → Close all
```

### Parallel Mode Completion

```markdown
## Parallel Execution Complete

### Summary
**Tasks Executed**: 4
**Successful**: 4
**Failed**: 0

### Results
| Issue | Title | Agent | Status | Files |
|-------|-------|-------|--------|-------|
| #107 | Staff Mode Context | frontend | ✓ | 3 files |
| #109 | CategorySidebar Responsive | frontend | ✓ | 2 files |
| #110 | ProductGrid Tablet | frontend | ✓ | 1 file |
| #111 | Touch Targets | frontend | ✓ | 2 files |

### Total Changes
- **Files modified**: 8
- **Tests added**: 4
- **Screenshots captured**: 12

### Next Steps
1. Run full test suite: `npm run test`
2. Review all changes: `git diff HEAD~4`
3. Continue with dependent task: `/wf-delegate 108`
4. Check overall progress: `/wf-ticket-status 106`
```

### Parallel Mode Rules

1. **Independence Required**: All tasks must have dependencies met
2. **Conflict Detection**: Warns if same files modified
3. **Screenshot Collection**: Gathers from all `/tmp/issue-{N}/` directories
4. **Atomic Commits**: Each task should commit separately (or batch at end)
5. **Pipeline Flexibility**: Can review together or separately

### Usage Examples

```bash
# Execute specific tasks in parallel (from breakdown output)
/wf-delegate 107 109 110 111 --parallel

# Parallel with force (skip dependency check)
/wf-delegate 107 108 109 --parallel --force

# Auto-detect parallel tasks (finds all with no deps)
/wf-delegate --parallel --auto
```

### Recommended Workflow

Based on `/wf-breakdown` output:

```bash
# Step 1: Run parallel group
/wf-delegate 107 109 110 111 --parallel

# Step 2: Run sequential tasks
/wf-delegate 108

# Step 3: Run QA
/wf-delegate 112
```

## Related Commands
- `/wf-breakdown` - Create new sub-tasks from Jira ticket or GitHub issue
- `/wf-ticket-status` - Check implementation progress
- `/wf-commit` - Create conventional commit after implementation
