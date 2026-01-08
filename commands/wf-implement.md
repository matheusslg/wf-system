---
description: Build a new feature from description
allowed-tools: Read, Edit, Write, Bash, Grep, Glob, Task
argument-hint: <feature description or issue number>
---

# Implement

Build a new feature by delegating to the appropriate sub-agent.

## Arguments
- `$ARGUMENTS` - Feature description or GitHub issue number (e.g., "#42" or "Add dark mode toggle")

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

## 1. Understand the Feature

### If Issue Number (starts with # or is a number)

```
mcp__github__get_issue(
  owner: github.owner,
  repo: github.repo,
  issue_number: {parsed_number}
)
```

Extract:
- `title` - Feature title
- `body` - Feature description, acceptance criteria
- `labels` - May indicate area (frontend, backend, api, etc.)

### If Description

Parse the description to understand:
- What to build
- User-facing behavior
- Technical requirements
- Keywords indicating area

## 2. Gather Context

Read progress for current state:
```bash
cat progress.md 2>/dev/null | head -100
```

Search for similar patterns:
```bash
grep -r "<similar-keyword>" --include="*.ts" --include="*.tsx" --include="*.py" | head -20
```

## 3. Determine Responsible Agent

Check available agents:
```bash
ls .claude/agents/*.md 2>/dev/null
```

### Auto-Detection Logic

| Indicator | Likely Agent |
|-----------|--------------|
| Labels: `frontend`, `ui`, `component` | `*-frontend` |
| Labels: `backend`, `api`, `server` | `*-backend` |
| Keywords: React, component, UI, page, form | `*-frontend` |
| Keywords: API, endpoint, database, service | `*-backend` |
| Feature: "add button", "create form" | `*-frontend` |
| Feature: "add endpoint", "create API" | `*-backend` |

### If Full-Stack Feature

If feature spans multiple areas, break it down:
1. Backend agent implements API/data layer first
2. Frontend agent implements UI after

Or ask user which part to start with.

### If Cannot Determine

Ask user to specify agent or describe the area.

## 4. Prepare Feature Context

```markdown
## Feature Implementation Assignment

### Feature Details
**Source**: {issue_number or "User request"}
**Title**: {title or feature description}
**Description**: {full description}

### Acceptance Criteria
{from issue body or derived from description}

### Similar Patterns Found
{examples from codebase search}

### Your Mission
1. **Design** - Plan the implementation approach
2. **Create** - Build necessary files/components
3. **Integrate** - Connect with existing code
4. **Test** - Write tests for the new feature
5. **Document** - Add comments/docs as needed

### Guidelines
- Follow existing patterns in the codebase
- Keep implementation focused on the feature
- Write tests that cover key functionality
- Consider edge cases

### When Complete, Report
1. Approach taken
2. Files created
3. Files modified
4. Tests added
5. Usage instructions
```

## 5. Spawn Developer Agent

```
Task(
  subagent_type: "{determined_agent}",
  prompt: "{prepared_feature_context}",
  description: "Implement: {short_title}"
)
```

Capture agent response:
- Files created/modified
- Approach taken
- Tests added
- Usage instructions

## 6. Pipeline: Code Review (if Reviewer exists)

Check for reviewer agent:
```bash
ls .claude/agents/*reviewer*.md .claude/agents/*review*.md 2>/dev/null
```

**If reviewer exists** (and not `--skip-pipeline`):

```markdown
## Implementation Complete - Review Required

**Workflow Pipeline**: Developer ✓ → **Reviewer** → QA → Close

Starting code review...
```

Spawn reviewer:
```
Task(
  subagent_type: "{project}-reviewer",
  prompt: "Review the implementation for: {feature_title}

  **Feature**: {description}
  **Approach**: {from_developer_response}
  **Files Created**: {files_list}
  **Files Modified**: {files_list}

  **Review checklist**:
  - [ ] Meets acceptance criteria
  - [ ] Code follows project standards
  - [ ] No security issues
  - [ ] Tests are adequate
  - [ ] No unnecessary complexity
  - [ ] Integrates well with existing code

  **Your response MUST end with one of**:
  - `APPROVED` - Implementation is correct and complete
  - `CHANGES_REQUESTED` - Issues found (list them)

  **IMPORTANT**: You do NOT fix code. You only review.",
  description: "Review implementation: {short_title}"
)
```

### If CHANGES_REQUESTED

Loop back to developer agent:
```
Task(
  subagent_type: "{determined_agent}",
  prompt: "Fix the review issues for feature: {feature_title}

  **Review Feedback**:
  {reviewer_issues}

  Fix each issue and report what you changed.",
  description: "Fix review issues: {short_title}"
)
```

Then re-run reviewer.

## 7. Pipeline: QA Validation (if QA exists)

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
  prompt: "QA validation for feature: {feature_title}

  **Feature**: {description}
  **Implementation**: {summary}
  **Files Changed**: {files_list}

  **QA checklist**:
  - [ ] Run all tests: `npm run test`
  - [ ] Feature works as described
  - [ ] Edge cases handled
  - [ ] No regressions
  - [ ] Acceptance criteria met

  **Your response MUST end with one of**:
  - `PASSED` - Feature works correctly
  - `FAILED` - Issues found (list them)

  **IMPORTANT**: You do NOT fix code. You only test.",
  description: "QA feature: {short_title}"
)
```

### If FAILED

Loop back to developer agent:
```
Task(
  subagent_type: "{determined_agent}",
  prompt: "Fix the QA issues for feature: {feature_title}

  **QA Feedback**:
  {qa_issues}

  Fix each issue and report what you changed.",
  description: "Fix QA issues: {short_title}"
)
```

Then re-run QA.

## 8. Update GitHub Issue (if applicable)

If feature was from a GitHub issue:

```
mcp__github__add_issue_comment(
  owner: github.owner,
  repo: github.repo,
  issue_number: {number},
  body: "## Feature Implemented

**Approach**: {approach}

**Files Created**:
{files_created_list}

**Files Modified**:
{files_modified_list}

**Tests Added**: {test_files}

**Pipeline**: Developer ✓ → Reviewer ✓ → QA ✓

---
*Implemented via `/wf-implement`*"
)
```

## 9. Update Progress

Add to progress.md:

```markdown
### Implementation: {title} ({date})
- **Feature**: {description}
- **Agent**: `{agent_name}`
- **Approach**: {how it was built}
- **Files Created**: {list}
- **Files Modified**: {list}
- **Tests Added**: {list}
- **Pipeline**: Developer ✓ → Reviewer ✓ → QA ✓
```

## 10. Report Results

```markdown
## Feature Implemented

**Feature**: {title}
**Agent**: `{agent_name}`

### Approach
{how it was built}

### Files Created
| File | Purpose |
|------|---------|
| `path/to/new.tsx` | {description} |

### Files Modified
| File | Change |
|------|--------|
| `path/to/existing.ts` | {what changed} |

### Tests Added
- `path/to/test.spec.ts` - {what it tests}

### Pipeline
- Developer: ✓ Implemented
- Reviewer: ✓ Approved
- QA: ✓ Validated

### Usage
{how to use the new feature}

### Next Steps
**Commit the implementation**:
```bash
/wf-commit
```

Suggested message: `feat({scope}): {short description}`
```

---

## Error Handling

### No Agents Available

```markdown
Error: No agents found in `.claude/agents/`

Run `/wf-generate` first to create agents for your project.
```

### Full-Stack Feature

```markdown
This feature spans multiple areas (frontend + backend).

**Options**:
1. Start with backend: `/wf-implement "{feature}" --agent myproject-backend`
2. Start with frontend: `/wf-implement "{feature}" --agent myproject-frontend`
3. Let me break it down into separate tasks

Which would you prefer?
```

## Related Commands
- `/wf-fix-bug` - Fix bugs with agent delegation
- `/wf-delegate` - Execute sub-tasks
- `/wf-commit` - Commit the implementation
- `/wf-test` - Run tests after implementation
