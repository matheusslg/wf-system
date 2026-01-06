---
description: Start a development session - reads progress, verifies environment, shows open issues
allowed-tools: Read, Bash, Grep
---

# Session Startup

Execute the environment-as-memory startup protocol.

## 0. Load Configuration

Check for workflow configuration:
```bash
cat .claude/workflow.json 2>/dev/null || echo "{}"
```

Extract settings (defaults if not present):
- `progressFile`: defaults to "progress.md" (also check "claude-progress.md")
- `standardsFile`: defaults to "standards.md"
- `initScript`: optional environment verification script

## 1. Read Progress Log

First, check file size to ensure it's readable:
```bash
wc -l progress.md 2>/dev/null || wc -l claude-progress.md 2>/dev/null || echo "0"
```

**If file exceeds 500 lines**, warn user and suggest running archive cleanup.

Find and read the progress file:
```bash
cat progress.md 2>/dev/null || cat claude-progress.md 2>/dev/null || echo "No progress file found"
```

Understand:
- What was done in previous sessions (last 5 sessions kept in main file)
- What's currently in progress
- Any blockers or decisions made
- What this session should focus on

> **Note**: Historical sessions are archived in `.claude/session-archive/` if deeper context is needed.

## 2. Read Standards (if exists)

```bash
cat standards.md 2>/dev/null || echo "No standards file"
```

Refresh on code conventions if the file exists.

## 3. Verify Environment (if init script defined)

If `initScript` is defined in workflow.json:
```bash
./scripts/init.sh  # or whatever is configured
```

Otherwise, check basic environment:
```bash
# Check if git repo
git status 2>/dev/null | head -5

# Check for package managers
ls package.json 2>/dev/null && echo "Node project"
ls requirements.txt 2>/dev/null && echo "Python project"
ls Cargo.toml 2>/dev/null && echo "Rust project"
ls go.mod 2>/dev/null && echo "Go project"
```

## 4. Check Open Issues (if GitHub)

If this is a GitHub repo:
```bash
gh issue list --state open --limit 15 2>/dev/null || echo "No GitHub CLI or not a GitHub repo"
```

## 5. Git Status

Check current repository state:
```bash
git status
git log --oneline -5
```

## Report

After gathering this information, provide a summary:

```
## Session Started

**Project**: [directory name]
**Last Updated**: [from progress file]

**Previous Session**:
- [Summary of what was done]

**In Progress**:
- [Any incomplete work]

**Suggested Next Steps**:
1. [Based on progress file and open issues]
2. [Priority items]

**Environment Status**: [OK/Issues found]

**Open Issues** (if GitHub):
- #N: Issue title
```

Ready to work. Use `/wf-pick-issue` to select a task or describe what you'd like to work on.
