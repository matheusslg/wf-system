---
description: Fix a bug from description or issue
allowed-tools: Read, Bash, Grep, Glob, Task
argument-hint: <bug description or issue number>
---

# Fix Bug

This command shares its orchestration logic with `/wf-implement` and `/wf-improve`.
The pipeline lives in the `wf-dev-pipeline` skill.

**Read** `${CLAUDE_PLUGIN_ROOT}/skills/wf-dev-pipeline/SKILL.md` and **follow its
instructions exactly**, applying the rules for `mode=bug`.

**User arguments:** $ARGUMENTS
