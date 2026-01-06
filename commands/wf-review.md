---
description: Review recent code changes or a specific PR
allowed-tools: Read, Bash, Grep, Glob
argument-hint: [optional: PR number or branch]
---

# Review

Review code changes for quality, correctness, and best practices.

## Arguments
- `$ARGUMENTS` - Optional PR number or branch name (defaults to current branch vs main)

## 1. Determine What to Review

If `$ARGUMENTS` is a PR number:
```bash
gh pr view $ARGUMENTS
gh pr diff $ARGUMENTS
```

If `$ARGUMENTS` is a branch:
```bash
git diff main...$ARGUMENTS
```

Otherwise, review current branch changes:
```bash
git diff main...HEAD
git log main..HEAD --oneline
```

## 2. Get Full Context

List changed files:
```bash
git diff main...HEAD --name-only
```

Read each changed file fully to understand context.

## 3. Review Checklist

For each change, evaluate:

**Correctness**
- Does the code do what it's supposed to?
- Are there edge cases not handled?
- Any potential bugs?

**Code Quality**
- Is the code readable?
- Are names clear and descriptive?
- Is there unnecessary complexity?
- Any code duplication?

**Best Practices**
- Following project conventions?
- Proper error handling?
- Security considerations?
- Performance implications?

**Testing**
- Are there tests for new code?
- Do tests cover edge cases?

**Documentation**
- Are complex parts explained?
- Any API changes documented?

## 4. Provide Feedback

Structure feedback as:

**Positive Observations**:
- What's done well

**Suggestions** (categorized):
- **Critical**: Must fix before merge
- **Important**: Should address
- **Minor**: Nice to have

For each suggestion:
- File and line reference
- What the issue is
- Suggested improvement

## 5. Report

```
## Code Review

**Scope**: [branch/PR being reviewed]
**Commits**: [number of commits]
**Files Changed**: [count]

### Summary
[Brief overall assessment]

### Positive Observations
- [Good patterns, clean code, etc.]

### Suggestions

**Critical**:
- [ ] file.tsx:42 - [issue and suggestion]

**Important**:
- [ ] file.py:100 - [issue and suggestion]

**Minor**:
- [ ] file.tsx:15 - [issue and suggestion]

### Verdict
[Ready to merge / Needs changes / Major rework needed]
```
