---
description: Debug and fix issues based on user description
allowed-tools: Read, Edit, Write, Bash, Grep, Glob, Task
argument-hint: <bug description or issue number>
---

# Fix Bug

Debug and fix an issue by delegating to the appropriate sub-agent.

## Arguments
- `$ARGUMENTS` - Bug description or GitHub issue number (e.g., "#42" or "login fails on mobile")

## Flags
- `--agent <name>` - Specify agent to use (skip auto-detection)
- `--skip-pipeline` - Skip Reviewer/QA pipeline (not recommended)

## 0. Load Configuration

```bash
cat .claude/workflow.json 2>/dev/null || echo "{}"
```

Extract:
- `github.owner`, `github.repo` - For issue fetching
- `agents` - Available agents for delegation

## 1. Understand the Bug

### If Issue Number (starts with # or is a number)

```
mcp__github__get_issue(
  owner: github.owner,
  repo: github.repo,
  issue_number: {parsed_number}
)
```

Extract:
- `title` - Bug title
- `body` - Bug description, steps to reproduce
- `labels` - May indicate area (frontend, backend, api, etc.)

### If Description

Parse the description to understand:
- What's broken?
- Expected vs actual behavior
- Keywords indicating area (UI, API, database, auth, etc.)

## 2. Determine Responsible Agent

Check available agents:
```bash
ls .claude/agents/*.md 2>/dev/null
```

### Auto-Detection Logic

| Indicator | Likely Agent |
|-----------|--------------|
| Labels: `frontend`, `ui`, `component` | `*-frontend` |
| Labels: `backend`, `api`, `server` | `*-backend` |
| Labels: `database`, `db`, `migration` | `*-backend` |
| Keywords: React, CSS, component, UI | `*-frontend` |
| Keywords: API, endpoint, server, database | `*-backend` |
| File paths in description: `src/components/` | `*-frontend` |
| File paths in description: `src/api/`, `src/server/` | `*-backend` |

### If `--agent` Flag Provided

Use the specified agent directly:
```bash
# e.g., --agent myproject-backend
```

### If Cannot Determine

Ask user:
```markdown
**Which agent should handle this bug?**

Available agents:
- `myproject-frontend` - React/Next.js components
- `myproject-backend` - API and server logic

Select an agent or describe the affected area.
```

## 3. Prepare Bug Context

Build context for the agent:

```markdown
## Bug Fix Assignment

### Bug Details
**Source**: {issue_number or "User reported"}
**Title**: {title or first line of description}
**Description**: {full description}

### Steps to Reproduce
{if available from issue body}

### Expected Behavior
{if available}

### Actual Behavior
{if available}

### Your Mission
1. **Locate** - Find the code causing this bug
2. **Understand** - Identify the root cause
3. **Fix** - Implement minimal fix for the root cause
4. **Test** - Add regression test that would have caught this
5. **Verify** - Ensure fix works and doesn't break other things

### Guidelines
- Fix the root cause, not symptoms
- Avoid scope creep - only fix THIS bug
- Add a test that reproduces the bug (should fail before fix, pass after)
- Run existing tests to ensure no regressions

### When Complete, Report
1. Root cause explanation
2. Files modified
3. Test added
4. Verification results (tests pass)
```

## 4. Spawn Developer Agent

```
Task(
  subagent_type: "{determined_agent}",
  prompt: "{prepared_bug_context}",
  description: "Fix bug: {short_title}"
)
```

Capture agent response:
- Files changed
- Root cause found
- Fix implemented
- Test added

## 5. Pipeline: Code Review (if Reviewer exists)

Check for reviewer agent:
```bash
ls .claude/agents/*reviewer*.md .claude/agents/*review*.md 2>/dev/null
```

**If reviewer exists** (and not `--skip-pipeline`):

```markdown
## Bug Fix Complete - Review Required

**Workflow Pipeline**: Developer ✓ → **Reviewer** → QA → Close

Starting code review...
```

Spawn reviewer:
```
Task(
  subagent_type: "{project}-reviewer",
  prompt: "Review the bug fix for: {bug_title}

  **Bug**: {description}
  **Root Cause**: {from_developer_response}
  **Files Changed**: {files_list}

  **Review checklist**:
  - [ ] Fix addresses root cause, not just symptoms
  - [ ] No new bugs introduced
  - [ ] Code follows project standards
  - [ ] Test adequately covers the bug scenario
  - [ ] No security issues

  **Your response MUST end with one of**:
  - `APPROVED` - Fix is correct and complete
  - `CHANGES_REQUESTED` - Issues found (list them)

  **IMPORTANT**: You do NOT fix code. You only review.",
  description: "Review bug fix: {short_title}"
)
```

### If CHANGES_REQUESTED

Loop back to developer agent (same as /wf-delegate):
```
Task(
  subagent_type: "{determined_agent}",
  prompt: "Fix the review issues for bug: {bug_title}

  **Review Feedback**:
  {reviewer_issues}

  Fix each issue and report what you changed.",
  description: "Fix review issues for bug: {short_title}"
)
```

Then re-run reviewer.

## 6. Pipeline: QA Validation (if QA exists)

Check for QA agent:
```bash
ls .claude/agents/*qa*.md .claude/agents/*test*.md 2>/dev/null
```

**If QA exists** (and not `--skip-pipeline`):

```markdown
## Review Approved - QA Required

**Workflow Pipeline**: Developer ✓ → Reviewer ✓ → **QA** → Close

Starting QA validation...
```

Spawn QA:
```
Task(
  subagent_type: "{project}-qa",
  prompt: "QA validation for bug fix: {bug_title}

  **Bug**: {description}
  **Fix Applied**: {fix_summary}
  **Files Changed**: {files_list}

  **QA checklist**:
  - [ ] Run all tests: `npm run test`
  - [ ] Bug is actually fixed
  - [ ] No regressions in related functionality
  - [ ] Edge cases considered

  **Your response MUST end with one of**:
  - `PASSED` - Bug is fixed, tests pass
  - `FAILED` - Issues found (list them)

  **IMPORTANT**: You do NOT fix code. You only test.",
  description: "QA bug fix: {short_title}"
)
```

### If FAILED

Loop back to developer agent:
```
Task(
  subagent_type: "{determined_agent}",
  prompt: "Fix the QA issues for bug: {bug_title}

  **QA Feedback**:
  {qa_issues}

  Fix each issue and report what you changed.",
  description: "Fix QA issues for bug: {short_title}"
)
```

Then re-run QA.

## 7. Update GitHub Issue (if applicable)

If bug was from a GitHub issue:

```
mcp__github__add_issue_comment(
  owner: github.owner,
  repo: github.repo,
  issue_number: {number},
  body: "## Bug Fixed

**Root Cause**: {root_cause}

**Fix**: {fix_summary}

**Files Changed**:
{files_list}

**Test Added**: {test_file}

**Pipeline**: Developer ✓ → Reviewer ✓ → QA ✓

---
*Fixed via `/wf-fix-bug`*"
)
```

## 8. Update Progress

**First, check if archiving is needed:**
```bash
wc -l progress.md 2>/dev/null || echo "0"
```

If file exceeds **450 lines**, run the archive procedure before adding:
1. Keep only last 5 sessions in main file
2. Move older entries to `.claude/session-archive/`
3. See `/wf-end-session` section 3 for full procedure

**Then add to progress.md:**

```markdown
### Bug Fix: {title} ({date})
- **Issue**: {#number or description}
- **Agent**: `{agent_name}`
- **Root Cause**: {explanation}
- **Fix**: {summary}
- **Test Added**: {test_file}
- **Pipeline**: Developer ✓ → Reviewer ✓ → QA ✓
```

## 9. Report Results

```markdown
## Bug Fixed

**Issue**: {#number or description}
**Agent**: `{agent_name}`

### Root Cause
{explanation}

### Changes Made
| File | Change |
|------|--------|
| `path/to/file.ts` | {what changed} |

### Test Added
- `path/to/test.spec.ts` - {what it tests}

### Pipeline
- Developer: ✓ Implemented fix
- Reviewer: ✓ Approved
- QA: ✓ Validated

### Next Steps
**Commit the fix**:
```bash
/wf-commit
```

Suggested message: `fix({scope}): {short description}`
```

---

## Error Handling

### No Agents Available

```markdown
Error: No agents found in `.claude/agents/`

Run `/wf-generate` first to create agents for your project.
```

### Cannot Determine Agent

```markdown
Could not auto-detect which agent should handle this bug.

**Please specify**:
```bash
/wf-fix-bug "#42" --agent myproject-backend
```

**Or describe the area**:
- "frontend" - UI/component issues
- "backend" - API/server issues
```

### Agent Failed

```markdown
## Agent Encountered Error

**Agent**: `{agent_name}`
**Error**: {error}

**Options**:
1. Retry: `/wf-fix-bug {args}`
2. Try different agent: `/wf-fix-bug {args} --agent {other}`
3. Debug manually: `/wf-debug "{bug description}"`
```

## Related Commands
- `/wf-debug` - Deep investigation for complex issues
- `/wf-delegate` - Execute sub-tasks with agents
- `/wf-commit` - Commit the fix
- `/wf-test` - Run tests after fix
