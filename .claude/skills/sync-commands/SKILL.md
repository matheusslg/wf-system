---
description: Sync commands from repo to global ~/.claude/commands/
allowed-tools: Bash, Read, AskUserQuestion
---

# Sync Commands

## Context
- Repo commands: `!ls commands/*.md 2>/dev/null | wc -l | xargs` files
- Global commands: `!ls ~/.claude/commands/wf-*.md 2>/dev/null | wc -l | xargs` files
- Install type: `![ -L ~/.claude/commands/wf-init.md ] && echo "symlink" || echo "copy"`

## Task

**If using symlinks** (recommended):
Commands auto-sync. Just verify symlinks are correct:
```bash
ls -la ~/.claude/commands/wf-*.md | head -5
```

**If using copies**, sync manually:
```bash
# Show what would change
diff -q commands/ ~/.claude/commands/ 2>/dev/null | grep "wf-" || echo "No differences"
```

**To re-sync (copy mode)**:
```bash
cp commands/*.md ~/.claude/commands/
echo "Synced $(ls commands/*.md | wc -l | xargs) commands"
```

**IMPORTANT**: After syncing, restart Claude Code to pick up changes.
