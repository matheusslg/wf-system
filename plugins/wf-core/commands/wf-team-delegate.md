---
description: Execute sub-tasks using Agent Teams for persistent pipeline delegation
allowed-tools: Read, Bash, Grep, Glob, Task, TaskCreate, TaskUpdate, TaskList, TaskGet, TeamCreate, TeamDelete, SendMessage
argument-hint: <issue key or number> [--until-done] [--list] [--relay] [--on-failure=continue|stop]
note: "Edit and Write are INTENTIONALLY excluded - orchestrator must delegate, not implement. Uses Agent Teams instead of stateless Task() subagents for context retention and direct inter-agent communication."
---

# Team Pipeline Delegation

Execute sub-tasks using Claude Code's Agent Teams feature. Unlike `/wf-delegate` which spawns stateless subagents, this command creates persistent teammates that retain context across retries and communicate directly with each other.

**When to use this vs `/wf-delegate`:**
- Use `/wf-team-delegate` when tasks require review/QA feedback loops (teammates keep context)
- Use `/wf-team-delegate --until-done` for multi-task pipelines (parallel developer teammates)
- Use `/wf-delegate` as a stable fallback if Agent Teams misbehaves
- Use `/wf-team-delegate --relay #101 #102 #103` for sequential tasks where each agent needs context from the previous
- Use `/wf-team-delegate --relay --until-done` to auto-detect relay chains from dependency graph

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
- `--relay` - Sequential execution with context handoffs between agents. With explicit issue numbers, execution follows the given order. With `--until-done`, auto-detects order from dependency graph (topological sort). Independent chains run in parallel, dependency chains run as relays.
- `--on-failure=continue|stop` - Relay mode only. `continue` (default): skip failed tasks and flag issues in handoff. `stop`: halt the entire relay on failure.

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

**Run tasks as a relay (sequential with handoffs):**
```bash
/wf-team-delegate --relay 125 126 127
```
```

Exit after listing.

## 2. Fetch & Validate Issues

Parse issue numbers from `$ARGUMENTS` (strip `#`, `--flags`, etc.).

### Validate Relay Flags

If `--relay` is present in `$ARGUMENTS`:
- If NO explicit issue numbers AND `--until-done` is NOT present → error:
  ```
  Error: --relay requires either explicit issue numbers or --until-done flag.
  Usage: /wf-team-delegate --relay #101 #102 #103
         /wf-team-delegate --relay --until-done
  ```
- Parse `--on-failure` value. If not provided, default to `continue`. If value is not `continue` or `stop` → error:
  ```
  Error: --on-failure must be 'continue' or 'stop'. Got: '{value}'
  ```
- Store relay state:
  - `IS_RELAY = true`
  - `ON_FAILURE = "continue"` or `"stop"`
  - `RELAY_ORDER = [list of issue numbers in argument order]` (empty if `--until-done`)

### Resolve Relay Execution Order

If `IS_RELAY` is true:

**With explicit issue numbers (`RELAY_ORDER` is not empty):**
- Use `RELAY_ORDER` as-is. All issues form a single relay chain. No parallelism.
- Set `RELAY_CHAINS = [RELAY_ORDER]` (single chain)
- Set `RELAY_DIR = /tmp/relay-{parent_issue_number}`
- Set `CHAIN_SUBDIR = ""` (no subdirectory — files go directly in RELAY_DIR)

**With `--until-done` (auto-detect from dependency graph):**

1. Fetch all open sub-tasks (same as `--list` logic in Section 1)
2. Build dependency graph from issue metadata:
   - For each issue, extract "Depends on: #X, #Y" from the issue body
   - Build adjacency list: `deps[issue] = [list of issues it depends on]`
3. Topological sort to determine execution order
4. Partition into relay chains:
   ```
   chains = []
   visited = set()

   For each issue with no dependents (root nodes), sorted by issue number:
     chain = []
     current = root
     WHILE current is not None:
       chain.append(current)
       visited.add(current)
       # Find the next issue that depends ONLY on current (and already-visited)
       next = find issue where ALL deps are in visited AND current is a dep
       current = next
     chains.append(chain)

   # Any remaining unvisited issues form their own single-item chains
   For each unvisited issue:
     chains.append([issue])
   ```
5. Set `RELAY_CHAINS = chains`
6. Set `RELAY_DIR = /tmp/relay-{parent_issue_number}`
7. Set `CHAIN_SUBDIR = "chain-{root_issue}/"` for each chain (substituting the chain's root issue number)

**Create relay directory:**
```bash
mkdir -p {RELAY_DIR}
# For each chain, create subdirectory
# Single explicit chain: no subdirectory needed
# Multiple auto-detected chains: mkdir -p {RELAY_DIR}/chain-{root_issue}/
```

Log the resolved order:
```markdown
## Relay Execution Order

| Chain | Issues | Mode |
|-------|--------|------|
| Chain #101 | #101 → #102 → #103 | Relay (sequential + handoffs) |
| Chain #104 | #104 → #105 | Relay (sequential + handoffs) |

Chains run in PARALLEL. Issues within a chain run SEQUENTIALLY with handoffs.
```

If there are NO dependency chains (all issues independent):
```markdown
Note: No dependencies detected between tasks. --relay has no effect — all tasks will run in parallel (same as without --relay).
```
Set `IS_RELAY = false` and continue with normal parallel mode.

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
- **Comments**: Last 10 comments (see below)

### Fetch Issue Comments

For each issue, fetch the last 10 comments to provide additional context.

**If platform is "github":**
```bash
gh api repos/{owner}/{repo}/issues/{number}/comments --jq '.[0:10] | reverse | .[] | "**\(.user.login)** (\(.created_at)):\n\(.body)\n"'
```

Or via MCP:
```
mcp__github__list_issues(
  owner: delegate.githubOwner,
  repo: delegate.githubRepo,
  issue_number: {number},
  per_page: 10,
  sort: "created",
  direction: "desc"
)
```

**If platform is "jira":**
```
mcp__atlassian__getJiraIssueComments(
  issueIdOrKey: {issue_key},
  cloudId: {jiraCloudId}
)
```

Or use jira-cli.sh fallback:
```bash
./scripts/jira-cli.sh get-comments {issue_key} --limit 10
```

**Format comments** (last 10, chronological order):
```markdown
- **{author}** ({date}): {comment_body}
```

Store as `issue_comments`. If no comments or fetching fails, set to empty string.

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

## 4.5. Transition Jira Issues to In Progress

**If platform is "jira":**

Before spawning teammates, transition each sub-task to "In Progress" so the board reflects active work.

For each issue being worked on:

First, discover available transitions:
```
mcp__atlassian__getJiraIssueTransitions(
  issueIdOrKey: {issue_key},
  cloudId: {jiraCloudId}
)
```

Find the transition whose `name` matches "In Progress" (case-insensitive). Store as `in_progress_transition_id`.

Then transition:
```
mcp__atlassian__transitionJiraIssue(
  issueIdOrKey: {issue_key},
  cloudId: {jiraCloudId},
  transitionId: {in_progress_transition_id}
)
```

Or use jira-cli.sh fallback:
```bash
./scripts/jira-cli.sh transition {issue_key} "In Progress"
```

If transition fails (e.g., workflow doesn't have "In Progress"), log a warning and continue — don't block the pipeline.

**Note for relay mode (`--relay`):** Only transition the FIRST issue in each chain to "In Progress" now. Subsequent issues should be transitioned when their turn comes (when the previous pipeline completes).

**If platform is "github":** No action needed.

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

  {IF IS_RELAY AND step_index > 0:}
  ## Relay Context

  You are step {step_index + 1} of {total_steps} in a relay pipeline. Previous agents have worked on this codebase before you. Use their handoffs to understand what changed and avoid duplicating work or conflicting with existing patterns.

  {IF step_index >= 3:}
  ### Previous Handoffs (available on disk — read if you need deeper context)
  {FOR i in range(1, step_index - 1):}
  - `{RELAY_DIR}/{CHAIN_SUBDIR}handoff-{i}-{issue_number_at_i}.md` (step {i})
  {END FOR}
  {END IF}

  ### Recent Handoffs

  {IF step_index >= 2:}
  #### Step {step_index - 1}: #{issue_at_step_minus_2}
  ```
  {full content of handoff file at step_index - 2}
  ```

  ---
  {END IF}

  #### Step {step_index}: #{issue_at_step_minus_1}
  ```
  {full content of handoff file at step_index - 1}
  ```

  ---

  **Use the information above to:**
  - Avoid duplicating patterns or utilities already created
  - Build on conventions established by previous agents
  - Be aware of known issues from previous steps
  {END IF}

  **Your first task:**
  Implement issue #{number}: {title}

  **Issue description:**
  {issue_body}

  {IF issue_comments is not empty:}
  **Discussion & Comments (last 10):**

  The following comments may contain additional context, clarifications, or requirements not in the description. Treat the description as primary source of truth; use comments for supplementary context.

  {issue_comments}
  {END IF}

  **Project Knowledge (from brain):**
  {brain_search_results}

  **Acceptance criteria:**
  {acceptance_criteria}

  Wait for task assignment via TaskList before starting work."
)
```

To read the handoff file content for injection:
```bash
cat {RELAY_DIR}/{CHAIN_SUBDIR}handoff-{step}-{issue}.md 2>/dev/null || echo "Handoff not available"
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

### Relay Mode Task Creation

If `IS_RELAY` is true:

For each relay chain in `RELAY_CHAINS`:

```
# Chain: #101 → #102 → #103
# previous_qa_task_id tracks the last pipeline's final task

previous_qa_task_id = None

For step_index, issue in enumerate(chain):
  # --- Implementation task ---
  TaskCreate(subject: "Implement #{issue}: {title}", description: "Relay step {step_index + 1} of {len(chain)}...")
  → impl_task_id

  # Block on previous pipeline's final stage (if not first in chain)
  IF previous_qa_task_id is not None:
    TaskUpdate(taskId: impl_task_id, addBlockedBy: [previous_qa_task_id])

  TaskUpdate(taskId: impl_task_id, owner: "developer")

  # --- Review task (if reviewer exists) ---
  IF reviewer_agent exists:
    TaskCreate(subject: "Review #{issue}", description: "...")
    → review_task_id
    TaskUpdate(taskId: review_task_id, addBlockedBy: [impl_task_id])
    TaskUpdate(taskId: review_task_id, owner: "reviewer")

  # --- QA task (if QA exists) ---
  IF qa_agent exists:
    qa_blocked_by = review_task_id IF reviewer exists ELSE impl_task_id
    TaskCreate(subject: "QA #{issue}", description: "...")
    → qa_task_id
    TaskUpdate(taskId: qa_task_id, addBlockedBy: [qa_blocked_by])
    TaskUpdate(taskId: qa_task_id, owner: "qa")

  # Track final task in this pipeline for next issue's dependency
  previous_qa_task_id = qa_task_id IF qa exists ELSE (review_task_id IF reviewer exists ELSE impl_task_id)
```

Multiple chains: each chain creates its own independent dependency sequence. Chains are NOT blocked by each other — they run in parallel, each with their own developer teammate.

**Developer assignment for relay chains:**
- Single chain (explicit `--relay`): one developer, reused across all steps
- Multiple chains (`--relay --until-done`): one developer PER chain, up to `maxDeveloperTeammates`
  - If more chains than `maxDeveloperTeammates`, extra chains queue (blocked until a developer finishes a chain)

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
  Discover available transitions, then transition to "Done":
  ```
  mcp__atlassian__getJiraIssueTransitions(
    issueIdOrKey: {issue_key},
    cloudId: {jiraCloudId}
  )
  ```
  Find the transition whose `name` matches "Done" (case-insensitive). Store as `done_transition_id`.
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

### Relay Pipeline Progression

**This logic runs ONLY when `IS_RELAY` is true.**

When the monitoring loop detects a relay step's pipeline is fully complete (all stages passed OR skipped-on-failure):

1. **Request handoff** (Section 7.5):
   - Send handoff request to the developer
   - Wait for handoff file to appear on disk
   - Read the handoff content

2. **Determine next step**:
   - Look up the current chain and find the next issue in sequence
   - If no next issue in this chain → this chain is complete

3. **Inject context and unblock next step**:
   - Read the last 2 handoff files from disk
   - Build the relay context section (per Section 5 relay context template)
   - Send the relay context to the next developer via SendMessage:
     ```
     SendMessage(
       type: "message",
       recipient: "developer{-N if multiple chains}",
       content: "Your next task is now unblocked. Here is the relay context from previous agents:\n\n{relay_context_section}\n\nYour task: Implement #{next_issue}: {title}\n\n{issue_body}",
       summary: "Relay: unblocking step {next_step} — #{next_issue}"
     )
     ```
   - Mark the next implementation task as unblocked (the `blockedBy` dependency should auto-resolve when the previous QA task is marked complete)

4. **Update progress table**:
   - Add handoff status to the progress log:
     ```markdown
     ## Relay Progress

     | Step | Issue | Pipeline | Handoff | Status |
     |------|-------|----------|---------|--------|
     | 1    | #101  | ✅ All passed | ✅ Generated | Complete |
     | 2    | #102  | 🔄 In Progress | ⏳ Pending | Active |
     | 3    | #103  | ⏳ Blocked | ⏳ Pending | Queued |
     ```

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
5. **Relay failure (`--on-failure=stop`)**: If `IS_RELAY` and `ON_FAILURE == "stop"` and any relay step's pipeline failed after retry limit → EXIT loop immediately. Mark all remaining relay tasks as blocked. Report:
   ```markdown
   ## Relay Halted

   Relay stopped at step {step_index} (#{issue_number}) due to --on-failure=stop.
   Pipeline failure: {stage} failed after {retry_count} retries.

   **Completed steps**: {list}
   **Remaining steps**: {list} (not started)
   ```

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

## 7.5. Relay Handoff Generation

**This section only applies when `IS_RELAY` is true.**

When the monitoring loop (Section 7) detects that a relay step's full pipeline is complete (QA PASSED, or reviewer APPROVED with no QA, or developer done with no reviewer/QA, or skipped-on-failure), the orchestrator requests a handoff from the developer BEFORE unblocking the next step.

### Handoff Request

Send to the developer:

```
SendMessage(
  type: "message",
  recipient: "developer",
  content: "Your pipeline for #{issue_number} is complete. Before the next agent takes over, generate a RELAY HANDOFF document.

Write this file: {RELAY_DIR}/{CHAIN_SUBDIR}handoff-{step_index + 1}-{issue_number}.md

Use this EXACT template:

# Relay Handoff: #{issue_number} — {issue_title}
**Agent**: {your_agent_name}
**Status**: COMPLETED | COMPLETED_WITH_ISSUES
**Timestamp**: {current ISO timestamp}

## Files Changed
- `path/to/file` — created | modified | deleted (brief what/why)
(list ALL files you created, modified, or deleted)

## Commits
- `hash` — commit message
(list ALL commits you made)

## Key Decisions
- Decision 1 and why
(list architectural or implementation choices you made and WHY)

## Patterns Introduced
- Pattern description at `path/to/file` — when to reuse
(list any new patterns, utilities, or conventions you established)

## Known Issues
- ⚠️ Description of any unresolved issues
(include review/QA failures that weren't fixed, known limitations, TODOs)
(if Status is COMPLETED with no issues, write 'None')

## Briefing for Next Agent
Write 2-4 paragraphs explaining:
- What you built and how it fits together
- What the next agent should know before starting their task
- Any gotchas, quirks, or non-obvious things you discovered
- Suggestions for the next agent based on what you learned

IMPORTANT: Write the file to disk using the Write tool. Confirm when done.",
  summary: "Requesting relay handoff for #{issue_number}"
)
```

### Wait for Handoff File

After sending the handoff request, poll for the file:

```
WHILE handoff file does not exist at {RELAY_DIR}/{CHAIN_SUBDIR}handoff-{step_index + 1}-{issue_number}.md:
  Bash("sleep 15")
  Check if file exists: Bash("test -f '{path}' && echo EXISTS || echo MISSING")
  If 5 polls pass with no file (75 seconds), send a reminder:
    SendMessage(recipient: "developer", content: "Reminder: please write the handoff file to {path}")
  If 10 polls pass (150 seconds), skip handoff generation and continue with empty handoff:
    Log: "Warning: Developer did not produce handoff for #{issue_number}. Continuing without handoff context."
```

### Handle On-Failure Skip

If the pipeline for this step ended due to retry limit exceeded (not QA PASSED / reviewer APPROVED):

- Still request the handoff (developer has context about what went wrong)
- The developer should set `**Status**: COMPLETED_WITH_ISSUES`
- The `Known Issues` section should capture what failed and why
- Do NOT close the issue — leave it open with a comment:

  **If platform is "github":**
  ```
  mcp__github__add_issue_comment(
    owner: delegate.githubOwner,
    repo: delegate.githubRepo,
    issue_number: {number},
    body: "⚠️ Relay pipeline: skipped after {retry_count} failed attempts at {stage}. Relay continued to next task. See handoff: {handoff_path}"
  )
  ```

  **If platform is "jira":**
  ```
  mcp__atlassian__addCommentToJiraIssue(
    issueIdOrKey: {issue_key},
    cloudId: {jiraCloudId},
    body: "⚠️ Relay pipeline: skipped after {retry_count} failed attempts at {stage}. Relay continued to next task. See handoff: {handoff_path}"
  )
  ```

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
Discover available transitions, then transition to "Done":
```
mcp__atlassian__getJiraIssueTransitions(
  issueIdOrKey: {issue_key},
  cloudId: {jiraCloudId}
)
```
Find the transition whose `name` matches "Done" (case-insensitive). Store as `done_transition_id`.
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

### Relay Cleanup (if IS_RELAY)

Handoff files in `{RELAY_DIR}/` are intentionally NOT deleted after the pipeline. They serve as documentation of what each agent did and can be inspected by the user.

Log:
```markdown
Relay handoff files preserved at: {RELAY_DIR}/
To clean up manually: `rm -rf {RELAY_DIR}`
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

### Relay Mode Report

```markdown
## Relay Pipeline Complete

### Configuration
**Mode**: Relay (sequential with handoffs)
**Failure handling**: {ON_FAILURE}
**Chains**: {number_of_chains}

### Relay Chain{s}

#### Chain #{root_issue}: {root_issue_title}
| Step | Issue | Pipeline | Handoff | Status |
|------|-------|----------|---------|--------|
| 1 | #101 | ✅ Dev → Review → QA | ✅ Generated | Closed |
| 2 | #102 | ✅ Dev → Review → QA | ✅ Generated | Closed |
| 3 | #103 | ✅ Dev → Review → QA | — (final step) | Closed |

{IF multiple chains:}
#### Chain #{root_issue_2}: {title}
| Step | Issue | Pipeline | Handoff | Status |
|------|-------|----------|---------|--------|
| 1 | #104 | ✅ Dev → Review → QA | ✅ Generated | Closed |
| 2 | #105 | ⚠️ QA FAILED (skipped) | ✅ Generated | Open |
{END IF}

### Skipped Issues (--on-failure=continue)
| # | Title | Failed Stage | Retries | Known Issues |
|---|-------|-------------|---------|--------------|
| #105 | Edge case handler | QA | 3 | Token validation edge case |

### Handoff Files
All handoff documents available at: `{RELAY_DIR}/`
- `handoff-1-101.md` (step 1)
- `handoff-2-102.md` (step 2)
- `handoff-3-103.md` (step 3)

### Context Chain Summary
Total context passed through relay: {count} handoffs
Average handoff size: ~{estimate} lines

PR_URL: https://github.com/{owner}/{repo}/pull/{pr_number}
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
8. **Relay Mode**: Use `--relay` when tasks build on each other — each agent gets a handoff document from the previous agent with files changed, key decisions, patterns introduced, and known issues
9. **Relay Context Window**: Only the last 2 handoffs are injected into the agent's prompt. Older handoffs are available on disk if the agent needs them — keeps prompt size bounded for long relays
10. **On-Failure**: Default is `continue` (skip and flag). Use `--on-failure=stop` when building on broken work would be wasteful (e.g., tightly coupled data layer → API → UI)
