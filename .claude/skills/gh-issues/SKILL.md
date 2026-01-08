---
description: List and manage GitHub issues for wf-system
allowed-tools: Bash, Read
argument-hint: [label]
---

# GitHub Issues

## Context
- Repository: `!gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "matheusslg/wf-system"`
- Open issues count: `!gh issue list --state open --json number -q 'length' 2>/dev/null || echo "?"`

## Task
List open issues:
```bash
gh issue list --state open ${1:+--label "$1"} --limit 20
```

To view a specific issue:
```bash
gh issue view <number>
```
