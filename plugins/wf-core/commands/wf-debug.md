---
description: Deep investigation for complex issues
allowed-tools: Read, Edit, Bash, Grep, Glob, Task
argument-hint: <problem description>
---

# Debug

Deep investigation mode for complex or unclear issues.

## Arguments
- `$ARGUMENTS` - Description of the problem or unexpected behavior

## 1. Understand the Problem

Parse `$ARGUMENTS` to identify:
- What's the symptom?
- When does it occur?
- Any error messages?
- Expected vs actual behavior

## 2. Gather Evidence

Collect relevant information:

**Logs**:
```bash
# Check recent logs if applicable
tail -100 /var/log/app.log 2>/dev/null || echo "No log file"
```

**Error Messages**:
- Exact error text
- Stack traces
- Error codes

**Recent Changes**:
```bash
git log --oneline -10
git diff HEAD~5..HEAD --stat
```

## 3. Form Hypotheses

Based on evidence, list possible causes:
1. [Hypothesis 1] - [why it might be this]
2. [Hypothesis 2] - [why it might be this]
3. [Hypothesis 3] - [why it might be this]

## 4. Investigate Each Hypothesis

For each hypothesis:
- What would confirm/refute it?
- What code to examine?
- What tests to run?

Search for relevant code:
```bash
grep -r "<keyword>" --include="*.ts" --include="*.py"
```

Read and trace execution flow.

## 5. Add Debugging (if needed)

Temporarily add logging or debugging:
- Console logs
- Debug breakpoints
- Test assertions

## 6. Identify Root Cause

Once found:
- Document the actual cause
- Explain why it causes the symptom
- Identify contributing factors

## 7. Propose Solution

Options (choose appropriate):
1. Quick fix: [description]
2. Proper fix: [description]
3. Workaround: [if needed temporarily]

## 8. Report Findings

```
## Debug Report

**Problem**: [description]
**Symptom**: [what user sees]

**Investigation**:
- Checked: [what was examined]
- Found: [key discoveries]

**Root Cause**:
[Detailed explanation]

**Contributing Factors**:
- [Factor 1]
- [Factor 2]

**Solution**:
[Recommended fix]

**Files Affected**:
- file.tsx:42 - [issue location]

Ready to `/wf-fix-bug` or implement the solution.
```
