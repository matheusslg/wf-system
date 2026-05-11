#!/usr/bin/env bash
# Thin wrapper for the wf-brain MCP server's CLI surface.
#
# Why this exists: in v1.x, callers ran `node ~/.claude/scripts/wf-brain.js`
# directly. In v2.x, brain ships as an MCP server at
# `~/.claude/mcp-servers/wf-brain/index.js`, and that server is also an
# optional plugin that may not be installed at all. Sprinkling
# `if [[ -f ... ]]; then ... else echo "...not found..."` across 8 call
# sites produced misleading "not found at <v1 path>" warnings on perfectly
# healthy v2 installs (the v1 path simply doesn't exist anymore).
#
# Exit codes:
#   127 — brain not installed; callers should fall through silently.
#   *   — whatever `node <brain> "$@"` returns.
#
# Callers that want soft-failure UX should chain `|| true` (no diagnostic)
# or `2>/dev/null || handle_missing` (diagnostic on stderr suppressed).

set -eu

BRAIN_PATH="$HOME/.claude/mcp-servers/wf-brain/index.js"

if [[ ! -f "$BRAIN_PATH" ]]; then
  exit 127
fi

exec node "$BRAIN_PATH" "$@"
