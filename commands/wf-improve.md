---
description: Enhance existing code or feature quality
allowed-tools: Read, Bash, Grep, Glob, Task
argument-hint: <improvement description>
note: "Edit and Write are INTENTIONALLY excluded - orchestrator must delegate, not implement"
---

# Improve

Enhance existing code or features by delegating to the appropriate sub-agent.

## ⛔ CRITICAL: ORCHESTRATOR BOUNDARIES

**YOU ARE THE ORCHESTRATOR, NOT THE IMPLEMENTER.**

Your ONLY allowed actions in this command:
- **READ** files, issues, and configuration (for context gathering)
- **SPAWN** sub-agents via `Task()` tool
- **REPORT** results back to the user

**YOU MUST NOT:**
- Edit or Write any source code files
- Run implementation commands directly
- Make any changes to the codebase yourself

**ALL implementation happens INSIDE the spawned sub-agent.**

## Arguments
- `$ARGUMENTS` - What to improve (e.g., "error messages in auth", "loading states", "API response times")

## Flags
- `--agent <name>` - Specify agent to use (skip auto-detection)
- `--skip-pipeline` - Skip Reviewer/QA pipeline (not recommended)

## 0. Load Configuration

```bash
cat .claude/workflow.json 2>/dev/null || echo "{}"
```

Extract:
- `github.owner`, `github.repo` - For issue management
- `agents` - Available agents for delegation

## 1. Understand the Improvement

Parse the description to understand:
- What area needs improvement
- What "better" looks like
- Success criteria

## 2. Locate Current Implementation

Search for related code:
```bash
grep -r "<keywords>" --include="*.ts" --include="*.tsx" --include="*.py" | head -30
```

Read affected files to understand:
- How it works now
- What could be better
- Scope of changes

## 3. Determine Responsible Agent

Check available agents:
```bash
ls .claude/agents/*.md 2>/dev/null
```

### Auto-Detection Logic

| Improvement Area | Likely Agent |
|-----------------|--------------|
| UI/UX, components, styling | `*-frontend` |
| API performance, database | `*-backend` |
| Error handling in API | `*-backend` |
| Error handling in UI | `*-frontend` |
| Loading states, spinners | `*-frontend` |
| Response times, caching | `*-backend` |

### If Cannot Determine

Ask user to specify which area to improve.

## 4. Prepare Improvement Context

```markdown
## Code Improvement Assignment

### Improvement Details
**Area**: {what to improve}
**Description**: {full description}

### Current State
**Files involved**:
{files found in search}

**Current behavior**:
{summary of how it works now}

### Success Criteria
- {what "better" looks like}
- {measurable improvements if applicable}

### Your Mission
1. **Analyze** - Understand current implementation
2. **Plan** - Identify specific improvements
3. **Implement** - Make changes incrementally
4. **Test** - Update/add tests as needed
5. **Verify** - Ensure nothing broke

### Guidelines
- Improve incrementally, not all at once
- Maintain existing functionality
- Follow existing patterns
- Don't introduce scope creep
- Focus on the specific improvement requested

### When Complete, Report
1. What was improved
2. Before vs after comparison
3. Files modified
4. Tests updated/added
5. How to verify the improvement
```

## 5. Spawn Developer Agent

```
Task(
  subagent_type: "{determined_agent}",
  prompt: "{prepared_improvement_context}",
  description: "Improve: {short_description}"
)
```

Capture agent response:
- What was improved
- Before/after comparison
- Files modified
- Tests updated

## 6. Pipeline: Code Review (if Reviewer exists)

Check for reviewer agent:
```bash
ls .claude/agents/*reviewer*.md .claude/agents/*review*.md 2>/dev/null
```

**If reviewer exists** (and not `--skip-pipeline`):

```markdown
## Improvement Complete - Review Required

**Workflow Pipeline**: Developer ✓ → **Reviewer** → QA → Close

Starting code review...
```

Spawn reviewer:
```
Task(
  subagent_type: "{project}-reviewer",
  prompt: "Review the improvement for: {improvement_area}

  **Improvement**: {description}
  **Before**: {previous_state}
  **After**: {new_state}
  **Files Modified**: {files_list}

  **Review checklist**:
  - [ ] Improvement is effective
  - [ ] No functionality broken
  - [ ] Code follows project standards
  - [ ] No unnecessary changes
  - [ ] Tests updated appropriately

  **Your response MUST end with one of**:
  - `APPROVED` - Improvement is correct
  - `CHANGES_REQUESTED` - Issues found (list them)

  **IMPORTANT**: You do NOT fix code. You only review.",
  description: "Review improvement: {short_description}"
)
```

### If CHANGES_REQUESTED

Loop back to developer agent:
```
Task(
  subagent_type: "{determined_agent}",
  prompt: "Fix the review issues for improvement: {improvement_area}

  **Review Feedback**:
  {reviewer_issues}

  Fix each issue and report what you changed.",
  description: "Fix review issues: {short_description}"
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
  prompt: "QA validation for improvement: {improvement_area}

  **Improvement**: {description}
  **Changes Made**: {summary}
  **Files Modified**: {files_list}

  **QA checklist**:
  - [ ] Run all tests: `npm run test`
  - [ ] Improvement works as expected
  - [ ] No regressions
  - [ ] Edge cases still handled

  **Your response MUST end with one of**:
  - `PASSED` - Improvement works correctly
  - `FAILED` - Issues found (list them)

  **IMPORTANT**: You do NOT fix code. You only test.",
  description: "QA improvement: {short_description}"
)
```

### If FAILED

Loop back to developer agent:
```
Task(
  subagent_type: "{determined_agent}",
  prompt: "Fix the QA issues for improvement: {improvement_area}

  **QA Feedback**:
  {qa_issues}

  Fix each issue and report what you changed.",
  description: "Fix QA issues: {short_description}"
)
```

Then re-run QA.

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
### Improvement: {area} ({date})
- **Area**: {what was improved}
- **Agent**: `{agent_name}`
- **Before**: {previous state}
- **After**: {new state}
- **Files Modified**: {list}
- **Pipeline**: Developer ✓ → Reviewer ✓ → QA ✓
```

## 9. Report Results

```markdown
## Improvement Complete

**Area**: {what was improved}
**Agent**: `{agent_name}`

### Before
{previous state}

### After
{new state}

### Changes Made
| File | Change |
|------|--------|
| `path/to/file.ts` | {what changed} |

### Tests Updated
- `path/to/test.spec.ts` - {what changed}

### Pipeline
- Developer: ✓ Implemented
- Reviewer: ✓ Approved
- QA: ✓ Validated

### How to Verify
{instructions to see the improvement}

### Next Steps
**Commit the improvement**:
```bash
/wf-commit
```

Suggested message: `improve({scope}): {short description}`
```

---

## Error Handling

### No Agents Available

```markdown
Error: No agents found in `.claude/agents/`

Run `/wf-generate` first to create agents for your project.
```

### Cannot Find Code to Improve

```markdown
Could not locate code related to: {improvement_area}

**Please provide more context**:
- Specific file paths
- Function/component names
- More detailed description
```

## Related Commands
- `/wf-fix-bug` - Fix bugs with agent delegation
- `/wf-implement` - Implement new features
- `/wf-refactor` - Restructure code safely
- `/wf-commit` - Commit the improvement
