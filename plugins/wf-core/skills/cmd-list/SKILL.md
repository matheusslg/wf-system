---
description: List all workflow commands with their descriptions
allowed-tools: Bash, Read
---

# List Commands

## Context
- Commands directory: `!ls commands/*.md 2>/dev/null | wc -l` commands found

## Task
List all commands with descriptions:
```bash
for f in commands/*.md; do
  name=$(basename "$f" .md)
  desc=$(grep -m1 "^description:" "$f" | cut -d: -f2- | xargs)
  echo "$name: $desc"
done
```

Show command count by category:
```bash
echo ""
echo "Categories:"
echo "- Session: $(ls commands/wf-*session*.md 2>/dev/null | wc -l | xargs)"
echo "- Development: $(ls commands/wf-{implement,fix,improve,refactor,test,debug}.md 2>/dev/null | wc -l | xargs)"
echo "- Tickets: $(ls commands/wf-{breakdown,delegate,ticket,pick,create}*.md 2>/dev/null | wc -l | xargs)"
echo "- Setup: $(ls commands/wf-{init,generate,design}*.md 2>/dev/null | wc -l | xargs)"
```
