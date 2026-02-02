---
description: Generate a structured QA test plan from a ticket and post it as a comment
allowed-tools: Read, Bash, Grep, Glob, Task
argument-hint: <Jira ticket, GitHub issue number, or URL>
---

# QA Plan

Generate a comprehensive "How to QA" test plan by analyzing the ticket requirements and the actual implementation code. Spawns sub-agents to understand the full scope, then produces a structured test plan and posts it as a comment on the ticket.

**This command reads code and tickets — it does NOT modify source code.**

## Arguments
- `$ARGUMENTS` - Issue identifier (Jira or GitHub)
  - **Jira**: `PROJECT-1023`, `https://yoursite.atlassian.net/browse/PROJECT-1023`
  - **GitHub**: `#42`, `42`, `https://github.com/owner/repo/issues/42`

## 0. Load Configuration

```bash
cat .claude/workflow.json 2>/dev/null || echo "{}"
```

Extract:
- `ticketing.platform`: `"jira"` or `"github"`
- `ticketing.jiraProject`, `ticketing.jiraCloudId` (if Jira)
- `github.owner`, `github.repo` (if GitHub)

## 1. Parse Input & Fetch Ticket

Parse `$ARGUMENTS` to determine source type using the same detection logic as `/wf-breakdown`:

**GitHub Issue patterns**:
- `#42` or `42` — Issue number
- `https://github.com/owner/repo/issues/42` — Full URL

**Jira Ticket patterns**:
- `PROJ-1023` — Ticket key
- `https://yoursite.atlassian.net/browse/PROJ-1023` — Full URL

### Fetch ticket details

**If GitHub**:
```
mcp__github__issue_read(
  owner: "{owner}",
  repo: "{repo}",
  issue_number: {number}
)
```

**If Jira**:
```
mcp__atlassian__getJiraIssue(
  cloudId: {jiraCloudId},
  issueIdOrKey: "{ticket_key}"
)
```

Also fetch any linked sub-tasks or child issues to understand full scope.

**Extract**:
- Title and description
- Acceptance criteria
- Linked PRs or branches
- Sub-tasks (if any)
- Environment/deployment info (ephemeral URLs, staging, etc.)

## 2. Identify the Implementation Branch/PR

Find the code changes related to this ticket:

```bash
# Search for branches matching ticket key
git branch -a | grep -i "{ticket_key}"

# Search for PRs
gh pr list --search "{ticket_key}" --state all
```

If a branch or PR is found, get the diff:
```bash
git diff main...{branch} --name-only
git diff main...{branch} --stat
```

If no branch/PR found, ask the user which branch contains the implementation.

## 3. Spawn Parallel Analysis Agents

Spawn sub-agents to understand the implementation from different angles. Each agent reads the changed files and ticket details, then reports back what was implemented and what needs testing.

**IMPORTANT**: All Task() calls must be made in a SINGLE response to run in parallel.

The agents to spawn depend on what changed (same logic as `/wf-pre-prod-review` dimension selection). At minimum, spawn agents for each distinct area of the codebase that was touched.

**Example agents based on changes detected:**

### If backend files changed:

```
Task(
  subagent_type: "general-purpose",
  prompt: "You are analyzing a backend implementation for QA test plan generation.

## Context
Ticket: {ticket_title}
Description: {ticket_description}
Acceptance Criteria: {acceptance_criteria}

## Changed Files
{list_of_backend_files}

## Your Mission
Read every changed backend file and report:
1. What endpoints were added or modified (method, path, request/response shapes)
2. What business logic was implemented (validations, transformations, rules)
3. What database changes were made (new tables, columns, migrations)
4. What edge cases exist (empty inputs, max limits, permissions, error states)
5. What integrations are involved (external APIs, queues, email, etc.)

Be thorough and specific — include field names, validation rules, character limits, enum values, and any hardcoded constraints you find in the code.",
  description: "QA analysis: backend implementation"
)
```

### If frontend files changed:

```
Task(
  subagent_type: "general-purpose",
  prompt: "You are analyzing a frontend implementation for QA test plan generation.

## Context
Ticket: {ticket_title}
Description: {ticket_description}
Acceptance Criteria: {acceptance_criteria}

## Changed Files
{list_of_frontend_files}

## Your Mission
Read every changed frontend file and report:
1. What UI components were added or modified (what they render, user interactions)
2. What user flows are involved (step by step, from entry point to completion)
3. What form fields, validations, or input constraints exist
4. What states the UI handles (loading, empty, error, success, disabled)
5. What different user roles or permissions affect the UI
6. What responsive/mobile considerations exist
7. What accessibility features were implemented (or should be tested)

Be thorough and specific — include button labels, field names, error messages, character limits, and any conditional rendering logic.",
  description: "QA analysis: frontend implementation"
)
```

### If mobile/native files changed:

```
Task(
  subagent_type: "general-purpose",
  prompt: "You are analyzing a mobile implementation for QA test plan generation.

## Context
Ticket: {ticket_title}
Description: {ticket_description}

## Changed Files
{list_of_mobile_files}

## Your Mission
Read every changed mobile file and report:
1. What mobile-specific features were added (native plugins, platform APIs)
2. What differs between iOS and Android behavior
3. What offline/connectivity scenarios exist
4. What push notification or deep link changes were made
5. What platform-specific UI adjustments exist

Be specific about platform differences and device-specific behavior.",
  description: "QA analysis: mobile implementation"
)
```

### If config/infra files changed:

```
Task(
  subagent_type: "general-purpose",
  prompt: "You are analyzing infrastructure/config changes for QA test plan generation.

## Context
Ticket: {ticket_title}

## Changed Files
{list_of_config_files}

## Your Mission
Read every changed config/infra file and report:
1. What environment variables are new or changed
2. What deployment prerequisites exist
3. What infrastructure resources were created or modified
4. What feature flags or configuration toggles were added

Focus on what QA needs to know about the environment setup.",
  description: "QA analysis: config/infra changes"
)
```

You may spawn additional agents if the changes span other areas (e.g., email templates, cron jobs, third-party integrations). Use your judgment.

## 4. Consolidate Agent Reports

After all agents complete, merge their findings into a unified understanding:

1. Combine all reported features and behaviors
2. Map features to user-facing test scenarios
3. Group scenarios by functional area and user role
4. Identify prerequisites (accounts, data setup, environment)
5. Identify edge cases and regression risks

## 5. Generate QA Plan

Produce the test plan in the following structure. The sections and test cases should be derived entirely from the agent reports — not from a generic template.

```
How to QA

Prerequisites

{Environment URL (ephemeral, staging, etc.)}
{Required accounts or credentials}
{Required test data or setup steps}
{Required devices or browsers if applicable}

{Section Letter}. {Functional Area / User Role - Feature}

#    | Test Case                    | Steps                                      | Expected Result
{N}  | {descriptive test case name} | {step-by-step user actions}                | {what should happen}
{N}  | {next test case}             | {steps}                                    | {expected result}
...

{Next Section Letter}. {Next Functional Area}

#    | Test Case                    | Steps                                      | Expected Result
...

{Last Section Letter}. Edge Cases & Regression

#    | Test Case                    | Steps                                      | Expected Result
{N}  | {edge case name}             | {steps to trigger edge case}               | {expected safe behavior}
...
```

### Section Organization Rules

- Group by **functional area + user role** (e.g., "Surgeon - Protocol Editor", "Patient Portal - Guidelines Display")
- Use letter prefixes for sections (A, B, C, ...) and numbered rows within each section (A1, A2, B1, B2, ...)
- Order sections by user flow: creation → viewing → editing → edge cases
- Always include an **Edge Cases & Regression** section at the end
- Include **XSS/injection** test if any user input is rendered as HTML
- Include **empty state** and **max length** tests for any input fields
- Include **existing data** regression test if the change modifies how existing records are displayed

### Test Case Quality Rules

- **Steps** must be concrete actions a QA person can follow, not vague instructions
- **Expected Results** must be observable and verifiable, not subjective
- Each test case should test ONE thing
- Include the specific UI path (e.g., "Go to Edit Protocol → select a phase" not "Open the editor")

## 6. Post QA Plan

### If Jira:

Post the QA plan as a comment on the ticket:
```
mcp__atlassian__addCommentToJiraIssue(
  issueIdOrKey: "{ticket_key}",
  cloudId: {jiraCloudId},
  body: "{qa_plan_text}"
)
```

### If GitHub:

Post the QA plan as a comment on the issue:
```
mcp__github__add_issue_comment(
  owner: "{owner}",
  repo: "{repo}",
  issue_number: {number},
  body: "{qa_plan_text}"
)
```

## 7. Report

```markdown
## QA Plan Generated

**Ticket**: [{ticket_key}]({ticket_url})
**Sections**: {count} test sections
**Test Cases**: {total_count} test cases
**Posted**: Comment added to {Jira ticket / GitHub issue}

### Sections Overview
| Section | Area | Test Cases |
|---------|------|------------|
| A | {area description} | {count} |
| B | {area description} | {count} |
| ... | ... | ... |

The QA plan has been posted as a comment on the ticket.
```

## Error Handling

### No Branch/PR Found
```
Could not find a branch or PR for ticket {ticket_key}.

Please specify the branch:
/wf-qa-plan {ticket_key} --branch feature/my-branch
```

### Ticket Not Found
```
Could not find ticket: {identifier}

Verify the ticket exists and you have access.
```

### No Code Changes
```
No code changes found for {ticket_key}.

The QA plan requires actual implementation to analyze.
Make sure the code has been committed and pushed.
```

## Related Commands
- `/wf-breakdown` - Break down ticket into sub-tasks
- `/wf-pre-prod-review` - Multi-agent pre-production audit
- `/wf-review` - Code review for a PR
- `/wf-ticket-status` - Check implementation progress
