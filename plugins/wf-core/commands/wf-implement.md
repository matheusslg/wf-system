---
description: Build a new feature from description
allowed-tools: Read, Bash, Grep, Glob, Task
argument-hint: <feature description or issue number>
---

# Implement

This command shares its orchestration logic with `/wf-fix-bug` and `/wf-improve`.
The pipeline lives in the `wf-dev-pipeline` skill.

**Read** `${CLAUDE_PLUGIN_ROOT}/skills/wf-dev-pipeline/SKILL.md` and **follow its
instructions exactly**, applying the rules for `mode=feature`.

**User arguments:** $ARGUMENTS
