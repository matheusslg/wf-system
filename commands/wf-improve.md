---
description: Enhance existing code or feature quality
allowed-tools: Read, Edit, Write, Bash, Grep, Glob, Task
argument-hint: <improvement description>
---

# Improve

Enhance an existing feature or code area.

## Arguments
- `$ARGUMENTS` - What to improve (e.g., "error messages in auth", "loading states")

## 0. Load Configuration

```bash
cat .claude/workflow.json 2>/dev/null || echo "{}"
```

## 1. Understand Current State

Locate the code to improve:
```bash
grep -r "<keywords>" --include="*.ts" --include="*.tsx" --include="*.py"
```

Read the current implementation to understand:
- How it works now
- What could be better
- Why it needs improvement

## 2. Define Improvement

Based on `$ARGUMENTS`, clarify:
- What specific improvement is needed
- What "better" looks like
- Success criteria

## 3. Plan Changes

Identify:
- Files to modify
- Scope of changes
- Potential side effects
- Tests to update

## 4. Implement Improvement

Make changes incrementally:
- Improve one aspect at a time
- Maintain existing functionality
- Follow existing patterns

## 5. Update Tests

If behavior changes:
- Update affected tests
- Add new tests for improved behavior

## 6. Verify

Run tests to ensure nothing broke:
```bash
# Run relevant tests
```

## 7. Report Results

```
## Improvement Complete

**Area**: [what was improved]
**Before**: [previous state]
**After**: [new state]

**Changes**:
- file.tsx: [improvement details]

**Tests Updated**: [list if any]

Ready to `/wf-commit` with message like: "improve(scope): [description]"
```
