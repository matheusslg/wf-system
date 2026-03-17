---
description: Execute sub-tasks using Agent Teams for persistent pipeline delegation
allowed-tools: Read, Bash, Grep, Glob, Task, TaskCreate, TaskUpdate, TaskList, TaskGet, TeamCreate, TeamDelete, SendMessage
argument-hint: <issue key or number> [--until-done] [--list]
note: "Edit and Write are INTENTIONALLY excluded - orchestrator must delegate, not implement. Uses Agent Teams instead of stateless Task() subagents for context retention and direct inter-agent communication."
---

# Team Pipeline Delegation

Execute sub-tasks using Claude Code's Agent Teams feature. Unlike `/wf-delegate` which spawns stateless subagents, this command creates persistent teammates that retain context across retries and communicate directly with each other.

**When to use this vs `/wf-delegate`:**
- Use `/wf-team-delegate` when tasks require review/QA feedback loops (teammates keep context)
- Use `/wf-team-delegate --until-done` for multi-task pipelines (parallel developer teammates)
- Use `/wf-delegate` as a stable fallback if Agent Teams misbehaves

## CRITICAL: ORCHESTRATOR BOUNDARIES

**YOU ARE THE TEAM LEAD, NOT THE IMPLEMENTER.**

Your ONLY allowed actions:
- **READ** files, issues, and configuration (for context gathering)
- **MANAGE** the team via TeamCreate, Task (spawning), SendMessage, TaskCreate/TaskUpdate/TaskList
- **REPORT** results back to the user

**YOU MUST NOT:**
- Edit or Write any source code files
- Run implementation commands (npm, git commit, etc.)
- Fix bugs or implement features directly
- Make any changes to the codebase yourself

**ALL implementation happens INSIDE spawned teammates.**

## Arguments
- `$ARGUMENTS` - Issue key(s) or number(s) of the sub-task(s) to execute
  - Jira: `PROJ-123` or just `123` (project prefix added from config)
  - GitHub: `125`, `#125`
  - Multiple: `107 109 110` (spawns parallel developer teammates)

## Flags
- `--list` - List available sub-tasks from tracked issues
- `--until-done` - Autonomous mode: work through ALL sub-tasks using persistent teammates
- `--force` - Override dependency checks

## 0. Load Configuration

Check for workflow configuration:
```bash
cat .claude/workflow.json 2>/dev/null || echo "{}"
```

**CRITICAL: Check `ticketing.platform` first to determine which system to use.**

Extract these fields:
- `ticketing.platform`: **REQUIRED** - Either `"jira"` or `"github"`
- `ticketing.jiraProject`: Jira project key (when platform is "jira")
- `ticketing.jiraCloudId`: Jira cloud domain (when platform is "jira")
- `delegate.githubOwner`: GitHub repository owner (when platform is "github")
- `delegate.githubRepo`: GitHub repository name (when platform is "github")
- `agents`: Map of available agents
- `teams.enabled`: Whether Agent Teams is enabled (default: true)
- `teams.maxDeveloperTeammates`: Max parallel developer teammates (default: 3)

**Platform Detection:**
```bash
PLATFORM=$(cat .claude/workflow.json 2>/dev/null | jq -r '.ticketing.platform // "github"')
echo "Ticketing platform: $PLATFORM"
```

**Teams Check:**
```bash
TEAMS_ENABLED=$(cat .claude/workflow.json 2>/dev/null | jq -r '.teams.enabled // true')
MAX_DEVS=$(cat .claude/workflow.json 2>/dev/null | jq -r '.teams.maxDeveloperTeammates // 3')
```

If `teams.enabled` is `false`, tell the user:
```
Agent Teams is disabled in workflow.json. Use /wf-delegate instead, or set teams.enabled to true.
```
Exit.

## 1. Handle List Flag

If `$ARGUMENTS` contains `--list`:

### If platform is "jira":
```
mcp__atlassian__searchJiraIssuesUsingJql(
  jql: "project = {jiraProject} AND labels = sub-task AND labels = tech-lead AND status != Done",
  cloudId: {jiraCloudId}
)
```

Or use jira-cli.sh fallback:
```bash
./scripts/jira-cli.sh search "project = {jiraProject} AND labels = sub-task AND labels = tech-lead AND status != Done"
```

### If platform is "github":
```
mcp__github__search_issues(
  query: "label:sub-task label:tech-lead state:open",
  owner: delegate.githubOwner,
  repo: delegate.githubRepo
)
```

### Present Results

```markdown
## Available Sub-Tasks (Team Pipeline)

| # | Title | Agent | Dependencies | Status |
|---|-------|-------|--------------|--------|
| #125 | Backend API endpoints | backend | None | Ready |
| #126 | Frontend dashboard | frontend | None | Ready |
| #127 | Integration tests | qa | #125, #126 | Blocked |

**Run a single task:**
```bash
/wf-team-delegate 125
```

**Run all tasks autonomously:**
```bash
/wf-team-delegate --until-done
```

**Run independent tasks in parallel:**
```bash
/wf-team-delegate 125 126
```
```

Exit after listing.

## 2. Fetch & Validate Issues

Parse issue numbers from `$ARGUMENTS` (strip `#`, `--flags`, etc.).

### Fetch Issue Details

### If platform is "github":
```
mcp__github__issue_read(
  owner: delegate.githubOwner,
  repo: delegate.githubRepo,
  issue_number: {number}
)
```

### If platform is "jira":
```
mcp__atlassian__getJiraIssue(
  issueIdOrKey: {issue_key},
  cloudId: {jiraCloudId}
)
```

Or use jira-cli.sh fallback:
```bash
./scripts/jira-cli.sh get {issue_key}
```

### Validate Each Issue

1. **Is a sub-task**: Has `sub-task` label
2. **Is open**: State is open/not done
3. **Dependencies met**: All "Depends on:" issues are closed (unless `--force`)

If validation fails:
```markdown
Issue #{number} is not valid for delegation:
- {reason}

Use `--force` to override dependency checks.
```

### Extract Issue Context

For each valid issue, collect:
- **Number**: Issue number/key
- **Title**: Issue title
- **Body**: Full description with acceptance criteria
- **Agent label**: `agent:{name}` label (e.g., `agent:backend`)
- **Dependencies**: Other issues this depends on
- **Files hint**: Files mentioned in the issue body (if any)

## 3. Resolve Pipeline Agents

Detect which pipeline agents exist in `.claude/agents/`:

```bash
# Get project name from config
PROJECT=$(cat .claude/workflow.json 2>/dev/null | jq -r '.project // "project"')

# Check for pipeline agents
DEVELOPER_AGENTS=$(ls .claude/agents/*developer*.md .claude/agents/*backend*.md .claude/agents/*frontend*.md .claude/agents/*fullstack*.md 2>/dev/null)
REVIEWER_AGENT=$(ls .claude/agents/*reviewer*.md .claude/agents/*review*.md 2>/dev/null | head -1)
QA_AGENT=$(ls .claude/agents/*qa*.md .claude/agents/*test*.md 2>/dev/null | head -1)
```

For each issue, resolve which developer agent to use:
1. Check the `agent:{name}` label on the issue
2. Look for `.claude/agents/{project}-{name}.md`
3. Fall back to `.claude/agents/{project}-developer.md` or generic

```markdown
## Pipeline Configuration

**Developer agents**: {list_found}
**Reviewer**: {$REVIEWER_AGENT or "None (will skip review)"}
**QA**: {$QA_AGENT or "None (will skip QA)"}

**Pipeline**: Developer {→ Reviewer} {→ QA} → Close
```

## 4. Create Team

Create a team for this pipeline execution:

```
TeamCreate(
  team_name: "pipeline-{issue_number}",
  description: "Pipeline execution for #{issue_number}"
)
```

For `--until-done` mode, use a generic team name:
```
TeamCreate(
  team_name: "pipeline-batch",
  description: "Autonomous pipeline execution for all open sub-tasks"
)
```

## 5. Spawn Teammates

Read each agent file and spawn as persistent teammates with Agent Teams communication instructions appended.

### Spawn Developer Teammate(s)

For each unique developer agent needed, first search the brain for relevant context:

```bash
node ~/.claude/scripts/wf-brain.js search "{issue_title}" --limit 3 2>/dev/null
```

Format each result as: `- [{category}] {content}`. Store as `brain_search_results` (empty string if brain not available or no results).

```bash
cat .claude/agents/{agent_file}
```

Then spawn:
```
Task(
  subagent_type: "general-purpose",
  team_name: "pipeline-{issue_number}",
  name: "developer",
  mode: "bypassPermissions",
  prompt: "{content_of_developer_agent_file}

  ---

  ## Team Communication Protocol

  You are a persistent teammate in a development pipeline team. You retain full context across all messages — you do NOT need to re-discover the codebase between tasks.

  **How to communicate:**
  - When you complete a task, use TaskUpdate to mark it as completed
  - If you receive a message from 'reviewer' or 'qa' with issues to fix, fix them immediately — you already have full context from your original implementation
  - After fixing issues, reply via SendMessage to the reviewer/QA confirming what you fixed
  - Check TaskList periodically for new tasks assigned to you

  ## CRITICAL: Git Branch + Push + PR Workflow

  **BEFORE writing any code**, create a feature branch:
  ```bash
  git checkout -b feat/issue-{parent_issue_number}
  ```

  Use `{parent_issue_number}` (the epic/parent issue number, NOT the sub-task number).

  **After implementing ALL sub-tasks** (and after reviewer/QA fixes if any):
  1. Stage and commit with conventional commits (you should already be doing this)
  2. Push the branch:
     ```bash
     git push -u origin feat/issue-{parent_issue_number}
     ```
  3. Create a Pull Request using the GitHub MCP tool:
     ```
     mcp__github__create_pull_request(
       owner: "{github_owner}",
       repo: "{github_repo}",
       title: "feat: {parent_issue_title}",
       body: "Implements #{parent_issue_number}\n\nSub-tasks:\n- {list of sub-task titles}",
       head: "feat/issue-{parent_issue_number}",
       base: "main"
     )
     ```
  4. **Output the PR URL** in your final message so the orchestrator can capture it.

  **Important:**
  - Create the branch FIRST, before any file edits
  - Push and create the PR AFTER all review/QA feedback is addressed
  - If you need to fix reviewer/QA issues, commit and push again (the PR updates automatically)

  **Your first task:**
  Implement issue #{number}: {title}

  **Issue description:**
  {issue_body}

  **Project Knowledge (from brain):**
  {brain_search_results}

  **Acceptance criteria:**
  {acceptance_criteria}

  Wait for task assignment via TaskList before starting work."
)
```

### Spawn Reviewer Teammate (if exists)

```bash
cat .claude/agents/{reviewer_agent_file}
```

```
Task(
  subagent_type: "general-purpose",
  team_name: "pipeline-{issue_number}",
  name: "reviewer",
  mode: "plan",
  prompt: "{content_of_reviewer_agent_file}

  ---

  ## Team Communication Protocol

  You are a persistent reviewer teammate in a development pipeline team. You retain context across all interactions.

  **How to communicate:**
  - When a review task is unblocked in TaskList, read the implementation and review it
  - Send specific feedback directly to 'developer' via SendMessage — include file:line references
  - End your review by updating your task with TaskUpdate:
    - metadata: {\"verdict\": \"APPROVED\"} — if code is ready
    - metadata: {\"verdict\": \"CHANGES_REQUESTED\"} — if issues need fixing
  - If CHANGES_REQUESTED: your task stays in_progress. Wait for developer to fix and message you back, then re-review
  - After re-review, update task metadata with final verdict

  **Screenshot Documentation:**
  If you find issues, document them:
  - Save to: /tmp/issue-{issue_number}/review-{NN}-{description}.png

  **Review checklist:**
  - [ ] Code correctness
  - [ ] Follows project standards
  - [ ] No security issues
  - [ ] Tests are adequate
  - [ ] No unnecessary complexity

  Wait for your review task to be unblocked in TaskList before starting."
)
```

### Spawn QA Teammate (if exists)

```bash
cat .claude/agents/{qa_agent_file}
```

```
Task(
  subagent_type: "general-purpose",
  team_name: "pipeline-{issue_number}",
  name: "qa",
  mode: "bypassPermissions",
  prompt: "{content_of_qa_agent_file}

  ---

  ## Team Communication Protocol

  You are a persistent QA teammate in a development pipeline team. You retain context across all interactions.

  **How to communicate:**
  - When a QA task is unblocked in TaskList, run tests and validate the implementation
  - Send specific bug reports directly to 'developer' via SendMessage — include reproduction steps
  - End your QA run by updating your task with TaskUpdate:
    - metadata: {\"verdict\": \"PASSED\"} — if all tests pass and acceptance criteria met
    - metadata: {\"verdict\": \"FAILED\"} — if bugs or test failures found
  - If FAILED: your task stays in_progress. Wait for developer to fix and message you back, then re-test
  - After re-test, update task metadata with final verdict

  **Screenshot Documentation:**
  Document QA validation:
  - Save to: /tmp/issue-{issue_number}/qa-{NN}-{description}.png
  - Required: qa-01-tests-passing.png (terminal with test results)

  **QA checklist:**
  - [ ] Run all tests
  - [ ] Check test coverage
  - [ ] Verify acceptance criteria from issue
  - [ ] Test edge cases
  - [ ] Check for regressions

  Wait for your QA task to be unblocked in TaskList before starting."
)
```

### For `--until-done` with Multiple Independent Tasks

When there are N independent tasks (no inter-dependencies), spawn up to `maxDeveloperTeammates` developer teammates:

```
# If 3 independent tasks and maxDeveloperTeammates = 3:
Task(name: "developer-1", ...)  # Assigned to task #125
Task(name: "developer-2", ...)  # Assigned to task #126
Task(name: "developer-3", ...)  # Assigned to task #127

# Shared reviewer and QA pick up tasks as they complete
Task(name: "reviewer", ...)
Task(name: "qa", ...)
```

Limit developer count to `min(independent_task_count, maxDeveloperTeammates)`.

## 6. Create Tasks with Dependencies

Create pipeline tasks in the shared TaskList with proper dependency chains.

### Single Issue Pipeline

```
TaskCreate(subject: "Implement #{number}: {title}", description: "...")
→ task_id = 1

TaskCreate(subject: "Review #{number}", description: "...")
→ task_id = 2
TaskUpdate(taskId: "2", addBlockedBy: ["1"])

TaskCreate(subject: "QA #{number}", description: "...")
→ task_id = 3
TaskUpdate(taskId: "3", addBlockedBy: ["2"])
```

Then assign:
```
TaskUpdate(taskId: "1", owner: "developer")
TaskUpdate(taskId: "2", owner: "reviewer")
TaskUpdate(taskId: "3", owner: "qa")
```

If no reviewer exists, skip the review task (QA blocked by implement directly).
If no QA exists, skip the QA task.

### Multiple Issues (`--until-done`)

Create ALL tasks upfront from the issue tracker:

```
# Issue #125 (backend)
TaskCreate(subject: "Implement #125: Backend API")       → id=1, owner: "developer-1"
TaskCreate(subject: "Review #125")                        → id=2, owner: "reviewer", blockedBy: [1]
TaskCreate(subject: "QA #125")                            → id=3, owner: "qa", blockedBy: [2]

# Issue #126 (frontend) — independent, runs in parallel
TaskCreate(subject: "Implement #126: Frontend dashboard") → id=4, owner: "developer-2"
TaskCreate(subject: "Review #126")                        → id=5, owner: "reviewer", blockedBy: [4]
TaskCreate(subject: "QA #126")                            → id=6, owner: "qa", blockedBy: [5]

# Issue #127 (depends on #125 and #126)
TaskCreate(subject: "Implement #127: Integration tests")  → id=7, owner: "developer-1", blockedBy: [3, 6]
TaskCreate(subject: "Review #127")                        → id=8, owner: "reviewer", blockedBy: [7]
TaskCreate(subject: "QA #127")                            → id=9, owner: "qa", blockedBy: [8]
```

## 7. Blocking Monitoring Loop

**CRITICAL: YOU MUST NOW ENTER A BLOCKING POLLING LOOP. Do NOT end your turn. Do NOT proceed to Section 8 until exit conditions are met. Your turn stays alive by calling tools (sleep + TaskList) in a loop.**

This is the core coordination mechanism. You (the team lead) stay active by **polling** — calling `Bash("sleep 45")` then checking the filesystem and task state on each iteration. This keeps your turn alive while teammates work in the background. **You MUST NOT end your turn or produce a final response until the loop exits.**

### CRITICAL: You Cannot Receive Messages

**You are running in non-interactive (`--print`) mode.** This means:
- **Ending your turn = ending the session permanently.** There are NO follow-up turns.
- **Agent messages (SendMessage) will NOT be delivered to you.** Messages queue but your turn never yields to receive them.
- **Do NOT exit the loop "to allow message delivery"** — that kills the entire session and all agents.
- **Your ONLY way to observe progress** is via `TaskList()` (for task status/verdicts) and `Bash` (for filesystem changes like modified files, git log, etc.)
- **Stay in the loop until exit conditions are met.** Even if you've been polling for 30+ minutes, that is NORMAL. Do not break out early.

### How It Works

Teammates update task statuses via `TaskUpdate` as they work. You poll `TaskList()` every ~45 seconds to check for status changes and verdicts. You also check the filesystem directly (`ls -la`, `wc -l`, `git status`) to verify actual file changes.

**IMPORTANT**: Do NOT just spawn agents and print a status table. You MUST enter this loop immediately after spawning. Your turn does not end until ALL exit conditions are met.

### The Loop

```
iteration = 0
WHILE true:
    iteration += 1

    1. CALL Bash("sleep 45")           ← keeps your turn alive, DO NOT SKIP

    2. CHECK PROGRESS via filesystem:
       - Bash("find . -name '*.sqf' -newer /tmp/loop-marker -o -name '*.ts' -newer /tmp/loop-marker | head -20")
       - Bash("git diff --stat 2>/dev/null || true")
       - Touch marker: Bash("touch /tmp/loop-marker") on first iteration

    3. CHECK task verdicts (if TaskList is available):
       - tasks = TaskList()
       - FOR each task: IF has verdict metadata → handle verdict (see below)
       - IF TaskList not available, rely on filesystem checks only

    4. CHECK if pipeline stages are complete:
       - Developer done? Check if files are modified/created as expected
       - Reviewer done? Check for review comments or verdict in task metadata
       - QA done? Check for test results or verdict in task metadata
       - IF issue pipeline fully complete → close issue immediately

    5. Log progress status table (every 3rd iteration to reduce noise)

    6. CHECK exit conditions:
       - IF all issues are closed or marked blocked → EXIT loop
       - IF 90-minute wallclock timeout exceeded → EXIT loop
       - IF all remaining issues are blocked (retry limit exceeded) → EXIT loop
       - **DO NOT EXIT for any other reason (e.g., "messages queued", "been polling too long")**

    7. CONTINUE (go back to step 1)
```

**NEVER break out of this loop early.** The only valid exits are the conditions in step 6. Polling for 30, 45, or even 60 minutes is completely normal for agent team work.

### Handling Verdicts

On each loop iteration, scan all tasks returned by `TaskList()` for verdict metadata.

**When a reviewer task completes with metadata `{verdict: "APPROVED"}`:**
- The QA task automatically unblocks (via dependency chain)
- Log progress:
```markdown
## Review Complete: #{number}

**Verdict**: APPROVED
**Pipeline**: Developer ✅ → Reviewer ✅ → **QA** (unblocked)
```

**When a reviewer task has metadata `{verdict: "CHANGES_REQUESTED"}`:**
- Send context to the developer via message:
```
SendMessage(
  type: "message",
  recipient: "developer",
  content: "The reviewer found issues with your implementation of #{number}. Please check the reviewer's feedback (they sent you a DM with details). Fix the issues and let the reviewer know when done.",
  summary: "Review: changes requested for #{number}"
)
```
- Track retry count. If retries exceed 3:
```
SendMessage(
  type: "message",
  recipient: "developer",
  content: "Review for #{number} has failed 3 times. Escalating to human.",
  summary: "Escalating #{number} - retry limit reached"
)
```
- Add "blocked" label to the issue and report to user.

**When a QA task completes with metadata `{verdict: "PASSED"}`:**
- **Close the issue immediately** (do not defer to Section 8):

  **If platform is "github":**
  ```
  mcp__github__update_issue(
    owner: delegate.githubOwner,
    repo: delegate.githubRepo,
    issue_number: {number},
    state: "closed"
  )
  ```

  **If platform is "jira":**
  ```
  mcp__atlassian__transitionJiraIssue(
    issueIdOrKey: {issue_key},
    cloudId: {jiraCloudId},
    transitionId: {done_transition_id}
  )
  ```

- Upload any screenshots for this issue:
  ```bash
  ls /tmp/issue-{issue_number}/*.png 2>/dev/null
  ```
  If screenshots exist, upload them as issue comments (same logic as wf-delegate Section 11.5).

- Log:
  ```markdown
  ## Pipeline Complete: #{number}

  **Verdict**: PASSED
  **Pipeline**: Developer ✅ → Reviewer ✅ → QA ✅
  **Issue**: CLOSED
  ```

**When a QA task has metadata `{verdict: "FAILED"}`:**
- Send context to developer:
```
SendMessage(
  type: "message",
  recipient: "developer",
  content: "QA found issues with #{number}. Please check the QA agent's feedback (they sent you a DM with details). Fix the bugs and let QA know when done.",
  summary: "QA: bugs found in #{number}"
)
```
- Same retry limit logic (max 3).

**When developer completes and NO reviewer or QA exists:**
- Close the issue immediately (same close logic as QA PASSED above).

### Closing Issues Inside the Loop

Only close an issue when its FULL pipeline has completed:

| Condition | Can Close? |
|-----------|------------|
| No reviewer AND no QA agents | Yes (after developer completes) |
| Reviewer exists, got APPROVED | Continue to QA |
| QA exists, got PASSED | Yes — close NOW |
| Reviewer returned CHANGES_REQUESTED | NO - fix and re-review |
| QA returned FAILED | NO - fix and re-test |

### Pipeline Rules

| Teammate | Verdict | Next Step |
|----------|---------|-----------|
| developer | Task complete | → Reviewer reviews (auto-unblocked) |
| reviewer | APPROVED | → QA tests (auto-unblocked) |
| reviewer | CHANGES_REQUESTED | → Lead messages developer to fix |
| qa | PASSED | → Close issue immediately |
| qa | FAILED | → Lead messages developer to fix |

### Retry Tracking

Track retries per issue per stage:
- `review_retries_{issue}`: Count of review → fix → re-review cycles
- `qa_retries_{issue}`: Count of QA → fix → re-test cycles

Max 3 retries per stage. On exceeding:
1. Add "blocked" label to the issue
2. Report to user with full context
3. In `--until-done` mode, skip this issue and continue with others

### Progress Status Table

On each loop iteration, log a table showing current state:

```markdown
## Pipeline Status (iteration {N})

| Issue | Developer | Reviewer | QA | Issue Status |
|-------|-----------|----------|----|--------------|
| #125  | ✅ Done   | ✅ APPROVED | 🔄 In Progress | Open |
| #126  | ✅ Done   | 🔄 In Progress | ⏳ Blocked | Open |
| #127  | ⏳ Blocked | ⏳ Blocked | ⏳ Blocked | Open |
```

### Exit Conditions

The loop exits when ANY of these is true:

1. **All issues resolved**: Every issue is either closed or marked blocked
2. **Timeout**: 90-minute wallclock timeout exceeded — log remaining state and proceed to cleanup
3. **All blocked**: Every remaining open issue has exceeded its retry limit — no further progress possible
4. **No progress**: TaskList has shown identical statuses for 10+ consecutive iterations (~7.5 minutes) — teammates may be stuck

### Knowledge Extraction (Post-Pipeline)

After all pipelines complete and before cleanup, review the pipeline outcomes and store knowledge entries:

For each completed pipeline, consider:
- Did the reviewer find non-obvious issues? → gotcha candidate
- Did QA find bugs that required fixes? → gotcha candidate
- Were there architectural decisions made during implementation? → decision candidate

For each entry worth preserving (0-2 per pipeline):
```bash
node ~/.claude/scripts/wf-brain.js store --category <category> --tags "<tags>" --source "issue:{issue_number}" "<content>"
```

On exit, proceed to **Section 8 (Post-Pipeline Verification)**.

### Stalled Teammates

If `TaskList()` shows identical statuses for 10+ consecutive polls (no task progress), a teammate may be stuck. Refer to **Error Handling: Teammate Unresponsive** below for recovery steps.

## 8. Post-Pipeline Verification

**This section runs ONCE after the monitoring loop (Section 7) exits.**

The monitoring loop closes issues as each pipeline completes. This step is a safety net to catch any issues that should have been closed but weren't (e.g., API call failure during the loop).

### Final Verification

```
tasks = TaskList()
```

For each issue in the pipeline:
1. Check if the issue's QA task (or final pipeline stage) has verdict PASSED/APPROVED
2. Check if the issue is still open in the tracker

If an issue should be closed but isn't:

**If platform is "github":**
```
mcp__github__update_issue(
  owner: delegate.githubOwner,
  repo: delegate.githubRepo,
  issue_number: {number},
  state: "closed"
)
```

**If platform is "jira":**
```
mcp__atlassian__transitionJiraIssue(
  issueIdOrKey: {issue_key},
  cloudId: {jiraCloudId},
  transitionId: {done_transition_id}
)
```

### Push Branch and Create PR (if developer didn't)

After verifying all pipeline stages passed, ensure the branch is pushed and a PR exists:

```bash
# Check if branch was pushed and PR created
git log --oneline main..HEAD
```

If there are commits above main but no PR was created by the developer:
1. Push the branch: `Bash("git push -u origin feat/issue-{parent_issue_number}")`
2. Create PR via GitHub MCP tool (same as developer instructions in Section 5)

**CRITICAL — Output the PR URL for pipeline capture:**

After confirming the PR exists (created by developer or by you), output it in this exact format:

```
PR_URL: https://github.com/{owner}/{repo}/pull/{number}
```

This line is parsed by `InvokeClaudeStep` and stored as `ctx.variables.prUrl`, which `ForEachIssue` uses for auto-merge on the next iteration.

### Summary Before Cleanup

Log a final status table before proceeding to Section 9 (Cleanup):

```markdown
## Final Pipeline Status

| Issue | Pipeline Result | Issue Status | PR | Notes |
|-------|----------------|--------------|-----|-------|
| #125  | ✅ All stages passed | Closed | PR #4 merged | — |
| #126  | ✅ All stages passed | Closed | PR #5 merged | — |
| #127  | ❌ Blocked | Open | — | Review retry limit exceeded |

PR_URL: https://github.com/{owner}/{repo}/pull/{latest_pr_number}

**Proceeding to Section 9 (Cleanup).**
```

## 9. Cleanup

After all pipeline work is done:

### Shutdown Teammates

Send shutdown requests to all teammates:

```
SendMessage(type: "shutdown_request", recipient: "developer", content: "Pipeline complete. Shutting down.")
SendMessage(type: "shutdown_request", recipient: "reviewer", content: "Pipeline complete. Shutting down.")
SendMessage(type: "shutdown_request", recipient: "qa", content: "Pipeline complete. Shutting down.")
```

For `--until-done` with multiple developer teammates:
```
SendMessage(type: "shutdown_request", recipient: "developer-1", content: "All tasks complete.")
SendMessage(type: "shutdown_request", recipient: "developer-2", content: "All tasks complete.")
SendMessage(type: "shutdown_request", recipient: "developer-3", content: "All tasks complete.")
```

Wait for shutdown confirmations, then clean up:

```
TeamDelete()
```

## 10. Report Results

### Single Task Report

```markdown
## Team Pipeline Complete

### Issue
- **#{number}**: {title}
- **Team**: pipeline-{number}

### Pipeline Result
- Developer: ✅ Implemented
- Reviewer: {✅ APPROVED | ⏭️ N/A (no reviewer agent)}
- QA: {✅ PASSED | ⏭️ N/A (no QA agent)}

### Implementation Summary
{developer_report_summary}

### Files Changed
{list_of_files}

### Review Notes
{reviewer_findings_if_any}

### Next Steps
{suggestions_based_on_remaining_sub_tasks}

**Check parent issue progress:**
```bash
/wf-ticket-status #{parent_number}
```
```

### Autonomous Mode Report (`--until-done`)

```markdown
## Autonomous Team Pipeline Complete

### Summary
**Total Processed**: {N} sub-tasks
**Team**: pipeline-batch
**Developer Teammates**: {count}
**Pipeline**: Developer → {Reviewer →} {QA →} Close

### Completed Tasks
| # | Title | Developer | Reviewer | QA | Status |
|---|-------|-----------|----------|------|--------|
| #125 | Backend API | developer-1 | ✅ APPROVED | ✅ PASSED | ✓ Closed |
| #126 | Frontend UI | developer-2 | ✅ APPROVED | ✅ PASSED | ✓ Closed |
| #127 | Integration | developer-1 | ✅ APPROVED | ✅ PASSED | ✓ Closed |

### Skipped (Blocked/Failed)
| # | Title | Reason |
|---|-------|--------|
| #128 | Edge cases | Retry limit exceeded (3x review) |

### Key Advantages Over wf-delegate
- Developers retained context across fix cycles (no re-discovery)
- Reviewer/QA communicated directly with developers
- Independent tasks #{125} and #{126} ran in parallel

### Next Steps
- Check parent issue: `/wf-ticket-status #{parent}`
- Review all changes: `git log --oneline -20`
- Run full test suite
```

## Error Handling

### Agent Teams Not Supported

If TeamCreate or SendMessage tools are not available:
```markdown
Agent Teams tools not available in this environment.

Falling back to standard delegation:
```bash
/wf-delegate {original_arguments}
```
```

### Teammate Spawn Failed

If a teammate fails to spawn:
```markdown
Error: Could not spawn teammate '{name}'

**Attempting recovery:**
1. Retrying spawn...
2. If retry fails, falling back to stateless Task() for this agent
```

Retry once. If still fails, fall back to spawning a stateless Task() subagent for that role (same as wf-delegate behavior).

### Teammate Unresponsive

If a teammate doesn't complete their task within a reasonable time (no TaskUpdate progress):
```markdown
Teammate '{name}' appears unresponsive.

**Options:**
1. Send a follow-up message to check status
2. Shut down and re-spawn the teammate
3. Fall back to stateless Task() for this role
```

Send a follow-up message first. If still no response, shut down and re-spawn.

### Team Cleanup on Error

If the pipeline fails critically, always clean up:
```
# Shut down any active teammates
SendMessage(type: "shutdown_request", recipient: "{each_teammate}", content: "Pipeline failed. Cleaning up.")

# Delete the team
TeamDelete()
```

### Ticketing Platform MCP Not Available

Same handling as `/wf-delegate` — fall back to jira-cli.sh for Jira, or report GitHub MCP unavailability.

## Tips

1. **Context Retention**: The main advantage over `/wf-delegate` — developers keep their full context when fixing reviewer/QA feedback
2. **Direct Communication**: Reviewers DM developers directly — no nuance lost through orchestrator relay
3. **Parallel Developers**: Use `--until-done` with independent tasks to run multiple developers simultaneously
4. **Fallback**: If Agent Teams has issues, `/wf-delegate` remains as a stable alternative
5. **Cost**: Persistent teammates use more tokens per session but fewer retry loops and no re-discovery overhead
6. **File Conflicts**: If multiple developers work in parallel, wf-breakdown should have assigned different file sets. The lead warns if file overlap is detected in task descriptions
7. **One Team Per Session**: Each invocation creates one team — this is by design
