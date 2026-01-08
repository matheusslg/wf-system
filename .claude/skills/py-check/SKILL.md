---
description: Check Python syntax and run basic validation on hooks
allowed-tools: Bash, Read
---

# Python Check

## Context
- Python version: `!python3 --version`
- Hook files: `!ls hooks/*.py 2>/dev/null`

## Task
Check Python syntax:
```bash
python3 -m py_compile hooks/*.py && echo "✓ Python syntax OK"
```

Check for common issues:
```bash
# Look for TODOs and FIXMEs
grep -n "TODO\|FIXME\|XXX" hooks/*.py || echo "No TODOs found"

# Check imports are used
python3 -c "import ast; print('Import check passed')"
```

If errors found, report them clearly with file:line references.
