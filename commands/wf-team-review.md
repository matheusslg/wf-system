---
description: Adversarial multi-agent pre-production review with cross-examination
allowed-tools: Read, Bash, Grep, Glob, Task, TaskCreate, TaskUpdate, TaskList, TaskGet, TeamCreate, TeamDelete, SendMessage
argument-hint: "[PR number, branch, or commit range] [--no-debate]"
note: "Uses Agent Teams for persistent reviewers that cross-examine each other's findings. Fallback: /wf-pre-prod-review"
---

# Adversarial Pre-Production Review

Multi-agent audit that goes beyond independent reviews. After each reviewer completes their initial analysis, they cross-examine each other's findings — challenging false positives, identifying contradictions, and flagging cross-cutting concerns.

**This is READ-ONLY. No code is modified.**

**When to use this vs `/wf-pre-prod-review`:**
- Use `/wf-team-review` for thorough reviews where cross-dimensional insights matter
- Use `/wf-pre-prod-review` for quick independent reviews or as a stable fallback
- Use `--no-debate` to skip cross-examination (behaves like `/wf-pre-prod-review` but with Agent Teams)

## Arguments
- `$ARGUMENTS` - Optional PR number, branch name, or commit range (defaults to current branch vs main)

## Flags
- `--no-debate` - Skip the cross-examination phase (Phase 2)

## 0. Load Configuration

```bash
cat .claude/workflow.json 2>/dev/null || echo "{}"
```

Extract relevant fields if present (e.g., `ticketing.platform`, branch naming conventions, `teams.enabled`).

**Teams Check:**
```bash
TEAMS_ENABLED=$(cat .claude/workflow.json 2>/dev/null | jq -r '.teams.enabled // true')
```

If `teams.enabled` is `false`:
```
Agent Teams is disabled in workflow.json. Use /wf-pre-prod-review instead, or set teams.enabled to true.
```
Exit.

## 1. Determine Review Scope

Parse `$ARGUMENTS` to determine the diff source.

**If `$ARGUMENTS` is a PR number** (e.g., `123`, `#123`):
```bash
gh pr view $PR_NUMBER --json headRefName,baseRefName,changedFiles,additions,deletions
gh pr diff $PR_NUMBER
```

**If `$ARGUMENTS` is a branch name**:
```bash
git diff main...$BRANCH --stat
git diff main...$BRANCH --name-only
```

**If `$ARGUMENTS` is a commit range** (contains `..`):
```bash
git diff $RANGE --stat
git diff $RANGE --name-only
```

**Default** (no arguments — current branch vs main):
```bash
CURRENT_BRANCH=$(git branch --show-current)
git diff main...HEAD --stat
git diff main...HEAD --name-only
git log main..HEAD --oneline
```

### Collect Scope Summary

```bash
CHANGED_FILES=$(git diff main...HEAD --name-only)
FILES_COUNT=$(git diff main...HEAD --name-only | wc -l)
ADDITIONS=$(git diff main...HEAD --stat | tail -1)
git diff main...HEAD --name-only | sed 's/.*\.//' | sort | uniq -c | sort -rn
```

### No Changes Found

If the diff is empty:
```
No changes detected between [base] and [head]. Nothing to review.
```
Exit.

## 2. Gather Context

Read all changed files fully to build a complete picture.

```bash
git diff main...HEAD --name-only
```

For each changed file, read it completely.

Identify:
- **Nature of changes**: New feature, bug fix, refactor, config change, dependency update, migration, etc.
- **Config/infra changes**: CI/CD files, Dockerfiles, env configs, terraform, etc.
- **Dependency changes**: package.json, requirements.txt, Gemfile, go.mod, etc.
- **Migration files**: Database migrations, schema changes
- **Test files**: New or modified test files

Build a context summary:

```
CONTEXT_SUMMARY:
- Branch: {branch_name}
- Base: {base_ref}
- Files changed: {count}
- Lines: +{added} / -{removed}
- Nature: {feature|bugfix|refactor|...}
- Languages: {list}
- Changed files:
  - path/to/file1.ts (modified)
  - path/to/file2.ts (added)
  - ...
```

## 3. Determine Review Dimensions

Based on the context gathered in step 2, decide which review dimensions are relevant. **Do not spawn agents for dimensions that don't apply.**

### Dimension Selection Guide

| Dimension | Spawn When |
|-----------|------------|
| **Code Quality & Logic** | Always — any code change needs this |
| **Security** | Auth files, API endpoints, user input handling, crypto, env/config, dependency changes, data storage |
| **Performance & Scalability** | DB queries, API endpoints, data fetching, loops over collections, UI rendering, large data processing |
| **Error Handling & Resilience** | External calls (API, DB, third-party), async operations, network code |
| **Testing & Coverage Gaps** | New source files, new functions/endpoints, logic branch changes |
| **Database & Migrations** | Migration files, schema changes, ORM model changes, raw SQL |
| **API Contract & Compatibility** | API route changes, response shape changes, GraphQL schema, OpenAPI spec |
| **Infrastructure & Deployment** | CI/CD files, Dockerfiles, terraform/IaC, env configs |
| **Dependency Audit** | package.json, requirements.txt, go.mod, or any lock file changes |
| **Accessibility** | UI component changes, HTML templates, CSS/styling, form elements |

You may spawn additional dimensions not listed here if warranted.

### Selection Rules

1. Analyze the changed files from step 2
2. Match them against the dimension table above
3. Select all dimensions that have at least one matching file/pattern
4. **Code Quality & Logic** is always included as a baseline

## 4. Create Team

```
TeamCreate(
  team_name: "review-{branch_or_pr}",
  description: "Adversarial pre-production review for {branch_or_pr}"
)
```

## 5. Spawn Reviewer Teammates

Spawn one teammate per selected dimension. Each receives the same review prompt structure as `/wf-pre-prod-review` PLUS cross-examination instructions.

**IMPORTANT**: All teammate spawns should happen in a SINGLE response for maximum parallelism.

### Teammate Prompt Template

For each dimension, spawn:

```
Task(
  subagent_type: "general-purpose",
  team_name: "review-{branch_or_pr}",
  name: "{dimension_slug}",
  mode: "plan",
  prompt: "You are a {dimension_name} reviewer performing a pre-production audit.

  ## Your Focus: {dimension_name}

  Review the following changed files for {dimension_focus}.

  ### Changed Files
  {CHANGED_FILES_LIST}

  ### Context
  {CONTEXT_SUMMARY}

  ### What to Look For
  {DIMENSION_SPECIFIC_CHECKLIST}

  ### How to Work
  1. Read each relevant changed file
  2. {DIMENSION_SPECIFIC_INSTRUCTIONS}
  3. Document findings with file:line references

  ### Output Format
  For each finding:
  - **Severity**: CRITICAL / WARNING / INFO
  - **File**: path/to/file.ts:42
  - **Issue**: Clear description
  - **Why it matters**: Impact if not fixed

  End with your verdict: PASS / CONCERNS / FAIL

  ---

  ## Team Communication Protocol

  You are a persistent reviewer teammate in an adversarial review team.

  **Phase 1 (Initial Review):**
  - Complete your review independently
  - Update your task via TaskUpdate with your findings in the description
  - Set metadata: {\"verdict\": \"PASS|CONCERNS|FAIL\", \"phase\": \"initial\"}

  **Phase 2 (Cross-Examination):**
  After Phase 1, you will receive a broadcast with findings from ALL other reviewers. Your job:
  1. Challenge findings you disagree with — especially false positives or inflated severity
  2. Flag cross-cutting concerns: issues in other dimensions that relate to YOUR area
  3. If another reviewer's finding changes your assessment, update your verdict
  4. Send DMs to specific reviewers to debate contentious findings
  5. Update your task with final post-debate verdict via TaskUpdate:
     metadata: {\"verdict\": \"PASS|CONCERNS|FAIL\", \"phase\": \"final\", \"disputes\": \"...\", \"cross_cutting\": \"...\"}

  **Examples of good cross-examination:**
  - Security reviewer flags 'sensitive data in logs' → Performance reviewer recognizes it as intentional debug logging → challenges severity
  - DB reviewer flags migration adding column → flags cross-cutting impact on API contract dimension
  - Code quality reviewer flags 'dead code' → another reviewer who saw feature flag config disputes it

  Wait for task assignment before starting."
)
```

### Dimension-Specific Prompts

Use the SAME dimension-specific content as `/wf-pre-prod-review` Section 4 (Code Quality, Security, Performance, Error Handling, Testing, Database, API Contract, Infrastructure, Dependency Audit, Accessibility). The only additions are the Team Communication Protocol section appended to each.

## 6. Phase 1 — Independent Review

Create a review task for each dimension:

```
TaskCreate(subject: "Review: Code Quality", description: "Initial independent review of code quality dimension")
TaskCreate(subject: "Review: Security", description: "Initial independent review of security dimension")
TaskCreate(subject: "Review: Performance", description: "Initial independent review of performance dimension")
# ... for each selected dimension
```

All tasks have NO blockers — they run in parallel.

Assign each task to its corresponding teammate:
```
TaskUpdate(taskId: "{id}", owner: "{dimension_slug}")
```

### Wait for Phase 1 Completion

Monitor TaskList until all Phase 1 review tasks are completed:

```
TaskList()
```

Check each task's metadata for `"phase": "initial"` verdict.

```markdown
## Phase 1 Complete: Independent Reviews

| Dimension | Verdict | Findings |
|-----------|---------|----------|
| Code Quality | PASS | 0 critical, 2 warnings |
| Security | CONCERNS | 1 critical, 1 warning |
| Performance | PASS | 0 critical, 1 warning |

Proceeding to cross-examination...
```

### If `--no-debate` Flag

Skip Phase 2 entirely. Jump to Section 8 (Synthesis & Report) using Phase 1 results.

```markdown
## Skipping Cross-Examination (--no-debate)

Using Phase 1 independent review results for final report.
```

## 7. Phase 2 — Cross-Examination

### Collect All Phase 1 Findings

Read each reviewer's task description/output to compile a consolidated findings document:

```
CONSOLIDATED_FINDINGS:

## Code Quality Findings (verdict: PASS)
- WARNING: src/api/handler.ts:42 - Unused variable in error path
- WARNING: src/utils/format.ts:18 - Redundant null check

## Security Findings (verdict: CONCERNS)
- CRITICAL: src/auth/login.ts:67 - Password logged in debug mode
- WARNING: src/api/handler.ts:55 - Missing rate limiting on public endpoint

## Performance Findings (verdict: PASS)
- WARNING: src/db/queries.ts:23 - N+1 query pattern in user listing
```

### Broadcast Findings to All Teammates

```
SendMessage(
  type: "broadcast",
  content: "Phase 2: Cross-Examination

All initial reviews are complete. Below are the consolidated findings from every dimension. Your task:

1. Review findings from OTHER dimensions (not your own)
2. Challenge any findings you believe are false positives or have incorrect severity
3. Flag cross-cutting concerns where another dimension's finding impacts YOUR area
4. Send DMs to specific reviewers to debate contentious findings
5. Update your verdict if persuaded by cross-examination

{CONSOLIDATED_FINDINGS}

When done, update your task with final verdict and any disputes/cross-cutting concerns.",
  summary: "Phase 2: Cross-examine all review findings"
)
```

### Create Cross-Examination Tasks

```
TaskCreate(subject: "Cross-examine: Code Quality", description: "Review other dimensions' findings, challenge false positives, flag cross-cutting concerns")
TaskCreate(subject: "Cross-examine: Security", description: "...")
TaskCreate(subject: "Cross-examine: Performance", description: "...")
# ... for each dimension
```

Assign to respective teammates:
```
TaskUpdate(taskId: "{id}", owner: "{dimension_slug}")
```

### Wait for Phase 2 Completion

Monitor TaskList until all cross-examination tasks complete.

Each reviewer should update their task metadata with:
- `verdict`: Final post-debate verdict (may differ from Phase 1)
- `phase`: "final"
- `disputes`: Findings they challenged (with reasoning)
- `cross_cutting`: Cross-dimensional concerns they identified

### Track Debates

If reviewers DM each other during cross-examination, those messages flow naturally via SendMessage. The lead monitors for:
- **Verdict changes**: A reviewer updating from CONCERNS to PASS (or vice versa) after debate
- **Unresolved disputes**: Two reviewers disagree and neither changes their position
- **Cross-cutting discoveries**: Issues that span multiple dimensions

```markdown
## Phase 2 Complete: Cross-Examination Results

### Verdict Changes
| Dimension | Phase 1 | Phase 2 | Reason |
|-----------|---------|---------|--------|
| Security | CONCERNS | PASS | Performance reviewer confirmed debug logging is gated by env flag |

### Active Disputes
| Finding | Challenger | Original | Status |
|---------|-----------|----------|--------|
| N+1 query (perf) | Code Quality | Performance | Unresolved — Code Quality says it's bounded, Performance disagrees |

### Cross-Cutting Concerns
| Found By | Affects | Issue |
|----------|---------|-------|
| Database | API Contract | New column in migration requires API response update |
```

## 8. Synthesis & Report

### Collect Final Verdicts

After cross-examination (or after Phase 1 if `--no-debate`):

1. **Parse each reviewer's final output** for findings and verdict
2. **Aggregate by severity**:
   - Collect all CRITICAL findings
   - Collect all WARNING findings
   - Collect all INFO findings
3. **Deduplicate**: If multiple agents flag the same file:line, merge into one finding
4. **Separate disputed findings**: Findings where reviewers disagreed go in their own section
5. **Determine overall verdict**:
   - Any agent returned FAIL → overall is **NOT READY**
   - Any agent returned CONCERNS (none FAIL) → overall is **NEEDS ATTENTION**
   - All agents returned PASS → overall is **READY FOR PRODUCTION**

### Production Readiness Report

```markdown
## Pre-Production Audit Report (Adversarial)

**Branch**: {branch_name}
**Base**: {base_ref}
**Files Changed**: {count}
**Lines Changed**: +{added} / -{removed}
**Dimensions Reviewed**: {count}
**Review Mode**: Adversarial (with cross-examination)
**Review Date**: {date}

---

### Critical Issues (Must Fix)
- [ ] file:line - [issue description] (found by: [dimension])

### Warnings (Should Fix)
- [ ] file:line - [issue description] (found by: [dimension])

### Informational
- file:line - [note] (found by: [dimension])

---

### Disputed Findings

These findings were challenged during cross-examination:

| Finding | Dimension | Severity | Challenged By | Outcome |
|---------|-----------|----------|---------------|---------|
| Password in debug log | Security | CRITICAL | Performance | **Resolved**: Gated by NODE_ENV, downgraded to INFO |
| N+1 query pattern | Performance | WARNING | Code Quality | **Unresolved**: Disagree on data size bounds |

*Unresolved disputes should be reviewed by the team manually.*

---

### Cross-Cutting Concerns

Issues that span multiple review dimensions:

| Issue | Found By | Also Affects | Description |
|-------|----------|-------------|-------------|
| New DB column | Database | API Contract | Migration adds `status` column but API response doesn't include it |
| Feature flag dead code | Code Quality | Security | Code appears dead but is gated by unreleased feature flag |

---

### Agent Verdicts

| Dimension | Phase 1 | Phase 2 (Final) | Findings | Changed? |
|-----------|---------|-----------------|----------|----------|
| Code Quality | PASS | PASS | 0 critical, 2 warnings | No |
| Security | CONCERNS | PASS | 0 critical, 1 warning | Yes ↓ |
| Performance | PASS | PASS | 0 critical, 1 warning | No |

(Only dimensions that were spawned appear in this table)

---

### Overall Verdict

**{READY FOR PRODUCTION | NEEDS ATTENTION | NOT READY}**

### Recommended Actions
1. [action item with file reference]
2. [action item with file reference]

### What Cross-Examination Caught
{Summary of findings that were corrected, disputed, or discovered through inter-reviewer debate — this section highlights the value of adversarial review over independent review}
```

## 9. Cleanup

### Shutdown Teammates

```
SendMessage(type: "shutdown_request", recipient: "code-quality", content: "Review complete. Shutting down.")
SendMessage(type: "shutdown_request", recipient: "security", content: "Review complete. Shutting down.")
SendMessage(type: "shutdown_request", recipient: "performance", content: "Review complete. Shutting down.")
# ... for each spawned dimension
```

Wait for confirmations, then:

```
TeamDelete()
```

## Error Handling

### No Changes Found
```
No changes detected between [base] and [head]. Nothing to review.
```

### Cannot Determine Scope
```
Could not determine review scope from: "$ARGUMENTS"

Please specify:
- PR number: `/wf-team-review 123`
- Branch: `/wf-team-review feature/my-branch`
- Commit range: `/wf-team-review abc123..def456`
- Or run from your feature branch with no arguments to diff against main.
```

### Agent Teams Not Supported

If TeamCreate or SendMessage tools are not available:
```markdown
Agent Teams tools not available in this environment.

Falling back to standard review:
```bash
/wf-pre-prod-review {original_arguments}
```
```

### Reviewer Failure

If any reviewer fails to complete Phase 1:
```
Reviewer [{dimension}] did not complete Phase 1.

Continuing cross-examination with remaining reviewers.
Partial results from completed agents shown below.
```

If any reviewer fails to complete Phase 2:
```
Reviewer [{dimension}] did not complete cross-examination.

Using their Phase 1 verdict as final.
```

### Team Cleanup on Error

Always clean up, even on failure:
```
# Shut down any active teammates
SendMessage(type: "shutdown_request", recipient: "{each_teammate}", content: "Review aborted. Cleaning up.")

# Delete the team
TeamDelete()
```

## Tips

1. **Cross-Examination Value**: The adversarial phase catches false positives and cross-cutting issues that independent reviews miss
2. **Time Cost**: Cross-examination adds ~30% more time but produces significantly better findings
3. **Skip Debate**: Use `--no-debate` when you want Agent Teams parallelism without cross-examination overhead
4. **Fallback**: `/wf-pre-prod-review` remains as a stable fallback for independent reviews
5. **Dimension Count**: More dimensions = more cross-examination value, but also more token cost
6. **Dispute Resolution**: Unresolved disputes in the report signal areas that need human judgment
