---
description: Create GitHub Pull Request for wf-system
allowed-tools: Bash, Read
argument-hint: [base-branch]
---

# Create Pull Request

## Context
- Current branch: `!git branch --show-current`
- Base branch: `!git remote show origin 2>/dev/null | grep "HEAD branch" | cut -d: -f2 | xargs`
- Unpushed commits: `!git log @{u}.. --oneline 2>/dev/null || echo "Branch not pushed yet"`
- Changed files: `!git diff --stat @{u}.. 2>/dev/null | tail -5`

## Task
1. Push current branch if needed:
```bash
git push -u origin $(git branch --show-current)
```

2. Create PR:
```bash
gh pr create --base ${1:-main} --fill
```
