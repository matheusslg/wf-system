---
description: End a development session - update progress file, commit, verify clean state
allowed-tools: Read, Edit, Bash
---

# Session Wrap-up

Execute the end-of-session protocol.

## 0. Load Configuration

Check for workflow configuration:
```bash
cat .claude/workflow.json 2>/dev/null || echo "{}"
```

Extract `progressFile` (defaults to "progress.md", also check "claude-progress.md").

## 1. Gather Session Summary

Review the conversation to understand:
- What issues/features were worked on
- What was completed
- What's still in progress
- Any blockers encountered
- Decisions made

## 2. Update Progress File

Find and edit the progress file:
```bash
ls progress.md 2>/dev/null || ls claude-progress.md 2>/dev/null
```

Add a new session entry:

```markdown
### Session N (YYYY-MM-DD)
**Focus**: [What was worked on]
**Completed**:
- [x] Item 1
- [x] Item 2
**In Progress**:
- [ ] Incomplete item
**Blockers**: None / Description
**Decisions**: Any architectural or design decisions made
**Next**: What the next session should focus on
```

Also update:
- **Current Status** section (phase, last updated date)
- **In Progress** section
- **Next Session Should** section

## 3. Archive Old Sessions (if needed)

Check the progress file size to prevent it from growing too large:
```bash
wc -l progress.md 2>/dev/null || wc -l claude-progress.md 2>/dev/null
```

**If the file exceeds 500 lines**, archive older sessions:

1. Keep only the **last 5 sessions** in the main progress file
2. Move older sessions to `.claude/session-archive/sessions-{range}.md`
3. Update the "Session Archive" section reference

**Archive procedure:**
```bash
# Create archive directory if needed
mkdir -p .claude/session-archive

# Find line number where 6th session starts (to cut there)
grep -n "^### Session" progress.md | head -6 | tail -1

# Extract older sessions to archive (adjust line numbers)
# sed -n '{START},{END}p' progress.md >> .claude/session-archive/sessions-{N}-{M}.md

# Rebuild progress file keeping only recent sessions + footer sections
```

**Target file size**: Keep progress file under 400 lines for reliable AI reading.

## 4. Check for Uncommitted Changes

```bash
git status
```

If there are uncommitted changes:
- Ask user if they should be committed
- Or stash them for next session
- Or discard if experimental

## 5. Verify Clean State

Ensure the project is in a good state:
```bash
# Check for uncommitted critical files
git status --porcelain

# Optionally run tests if code was changed
# (ask user if they want to run tests)
```

## 6. Commit Progress

If progress file was updated:
```bash
git add progress.md .claude/session-archive/  # or claude-progress.md
git commit -m "docs: update session progress"
```

Optionally push:
```bash
git push
```

## 7. Final Report

Summarize the session:

```
## Session Complete

**Duration**: [approximate]
**Focus**: [main topic]

**Accomplished**:
- [List of completed items]

**Commits Made**:
- [hash]: [message]

**Left for Next Session**:
- [Incomplete work]
- [Suggested next steps]

**Repository State**: Clean / Has uncommitted changes

Progress file updated. Ready to close.
```
