---
description: Restructure code without changing behavior
allowed-tools: Read, Edit, Write, Bash, Grep, Glob, Task
argument-hint: <refactoring target>
---

# Refactor

Restructure code to improve quality without changing external behavior.

## Arguments
- `$ARGUMENTS` - What to refactor (e.g., "auth service", "user hooks")

## 0. Load Configuration

```bash
cat .claude/workflow.json 2>/dev/null || echo "{}"
```

## 1. Understand Current Code

Locate the code to refactor:
```bash
grep -r "<keywords>" --include="*.ts" --include="*.tsx" --include="*.py"
```

Read and understand:
- Current structure
- Dependencies
- How it's used elsewhere

## 2. Identify Issues

What needs improvement:
- Code duplication?
- Poor naming?
- Complex logic that could be simplified?
- Missing abstractions?
- Tight coupling?

## 3. Plan Refactoring

Define the target state:
- New structure
- Better names
- Cleaner interfaces

Identify risks:
- What could break?
- What tests exist?

## 4. Verify Tests Exist

Before refactoring, ensure tests cover the behavior:
```bash
# Find related tests
grep -r "test.*<component>" --include="*.test.ts" --include="*_test.py"
```

If tests are missing, consider adding them first.

## 5. Refactor Incrementally

Make small, safe changes:
1. Rename → verify tests pass
2. Extract → verify tests pass
3. Simplify → verify tests pass

Keep commits small and focused.

## 6. Verify Behavior Unchanged

Run all relevant tests:
```bash
# Run tests
```

If possible, verify manually that behavior is identical.

## 7. Report Results

```
## Refactoring Complete

**Target**: [what was refactored]
**Changes**:
- Extracted [X] into [Y]
- Renamed [A] to [B]
- Simplified [logic]

**Files Modified**:
- file1.tsx
- file2.tsx

**Tests**: All passing, behavior unchanged

Ready to `/wf-commit` with message like: "refactor(scope): [description]"
```
