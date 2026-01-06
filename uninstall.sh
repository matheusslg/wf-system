#!/bin/bash
# Claude Workflow System Uninstaller
# https://github.com/cavallini/wf-system

set -e

CLAUDE_DIR="$HOME/.claude"

echo "========================================"
echo "  Claude Workflow System Uninstaller"
echo "========================================"
echo

# Confirm uninstall
read -p "This will remove all wf-* commands and hooks. Continue? [y/N] " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo "Cancelled."
  exit 0
fi

# Remove commands
echo "[1/3] Removing workflow commands..."
count=0
for cmd in "$CLAUDE_DIR/commands/"wf-*.md; do
  if [ -L "$cmd" ] || [ -f "$cmd" ]; then
    rm -f "$cmd"
    count=$((count + 1))
  fi
done
echo "       Removed $count commands"

# Remove hook
echo "[2/3] Removing orchestrator hook..."
rm -f "$CLAUDE_DIR/hooks/wf-orchestrator.py"

# Clean up state directory
echo "[3/3] Cleaning up state files..."
rm -rf "$CLAUDE_DIR/hooks/.wf-state"

echo
echo "========================================"
echo "  Uninstallation complete!"
echo "========================================"
echo
echo "NOTE: The hooks configuration in ~/.claude/settings.json was NOT removed."
echo "You may want to manually remove the 'hooks' section if no longer needed."
echo
echo "Restart Claude Code for changes to take effect."
