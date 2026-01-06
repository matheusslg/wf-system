---
description: Run tests and fix any failures
allowed-tools: Read, Edit, Bash, Grep, Glob
argument-hint: [optional: specific test or area]
---

# Test

Run tests and fix any failures.

## Arguments
- `$ARGUMENTS` - Optional specific test file, area, or test name

## 0. Detect Project Type

```bash
# Check for test frameworks
ls package.json 2>/dev/null && echo "Node project"
ls pytest.ini 2>/dev/null || ls pyproject.toml 2>/dev/null && echo "Python project"
ls Cargo.toml 2>/dev/null && echo "Rust project"
```

## 1. Run Tests

Based on project type:

**Node/JavaScript/TypeScript**:
```bash
npm test
# or
npm run test
# or with specific file
npm test -- $ARGUMENTS
```

**Python**:
```bash
pytest
# or with specific path
pytest $ARGUMENTS
```

**Rust**:
```bash
cargo test
# or specific test
cargo test $ARGUMENTS
```

## 2. Analyze Failures

If tests fail:
- Read the failure output
- Identify which tests failed
- Understand the expected vs actual behavior

## 3. Investigate Root Cause

For each failing test:
- Read the test code
- Read the code being tested
- Determine if it's:
  - A code bug (fix the code)
  - An outdated test (update the test)
  - A test environment issue (fix setup)

## 4. Fix Issues

Make minimal changes to fix:
- If code bug: fix the implementation
- If test outdated: update test expectations
- If setup issue: fix test configuration

## 5. Re-run Tests

Verify all tests pass:
```bash
# Run full test suite
```

## 6. Report Results

```
## Test Results

**Command**: [test command run]
**Result**: All passing / X failures

**Failures Fixed** (if any):
- test_name: [what was wrong, how fixed]

**Coverage** (if available): X%

Ready to `/wf-commit` if changes were made.
```
