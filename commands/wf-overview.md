---
description: Quick overview of current work state
allowed-tools: Read, Bash, Grep
---

# Overview

Get a quick status overview of the project and current work.

## 1. Project Info

```bash
# Project name from directory
basename $(pwd)

# Check if git repo
git remote -v 2>/dev/null | head -1
```

## 2. Progress State

```bash
# Read progress file summary
head -50 progress.md 2>/dev/null || head -50 claude-progress.md 2>/dev/null || echo "No progress file"
```

## 3. Git Status

```bash
# Current branch and status
git branch --show-current
git status --short

# Recent commits
git log --oneline -5
```

## 4. Open Issues (if GitHub)

```bash
# Count and list top issues
gh issue list --state open --limit 5 2>/dev/null || echo "No GitHub CLI"
```

## 5. Report

```
## Project Overview

**Project**: [name]
**Branch**: [current branch]
**Status**: [clean/dirty]

**Last Session**:
- Date: [from progress]
- Focus: [what was done]

**In Progress**:
- [Current work items]

**Next Up**:
- [Suggested next steps]

**Open Issues**: [count]
- #X: [top issue]
- #Y: [second issue]

**Git State**:
- [uncommitted changes if any]
- Last commit: [message]
```
