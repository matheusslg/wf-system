---
description: Debug and fix issues based on user description
allowed-tools: Read, Edit, Write, Bash, Grep, Glob, Task
argument-hint: <bug description or issue number>
---

# Fix Bug

Debug and fix an issue based on description or issue number.

## Arguments
- `$ARGUMENTS` - Bug description or GitHub issue number (e.g., "#42" or "login fails on mobile")

## 0. Load Configuration

```bash
cat .claude/workflow.json 2>/dev/null || echo "{}"
```

## 1. Understand the Bug

If `$ARGUMENTS` is an issue number (starts with #):
```bash
gh issue view [number]
```

Otherwise, parse the description to understand:
- What's broken?
- Expected behavior
- Actual behavior
- Steps to reproduce (if known)

## 2. Locate the Problem

Search for related code:
```bash
grep -r "<keywords>" --include="*.ts" --include="*.tsx" --include="*.py"
```

Read potentially affected files to understand the flow.

## 3. Reproduce (if possible)

If there's a test environment or the issue can be reproduced:
- Try to reproduce the bug
- Verify the current behavior

## 4. Identify Root Cause

Analyze the code flow:
- Trace the execution path
- Look for edge cases
- Check error handling
- Review recent changes in the area

## 5. Implement Fix

Make the minimal change needed to fix the issue:
- Fix the root cause, not symptoms
- Avoid scope creep
- Consider edge cases

## 6. Add Test

Write a test that:
- Would have caught the bug
- Verifies the fix works
- Prevents regression

## 7. Verify Fix

Run relevant tests:
```bash
# Run tests in affected area
# Verify the bug is fixed
```

## 8. Update Progress

Note in progress file:
```markdown
### Bug Fix: [description] (<date>)
- **Issue**: [description or #number]
- **Root Cause**: [what caused it]
- **Fix**: [what was changed]
- **Test Added**: [test file/function]
```

## 9. Report Results

```
## Bug Fixed

**Issue**: [description or #number]
**Root Cause**: [explanation]

**Changes Made**:
- file.tsx: [what changed]

**Test Added**: test_file.py

**Verification**: Tests pass / Manually verified

Ready to `/wf-commit` with message like: "fix(scope): resolve [issue description]"
```
