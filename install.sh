#!/bin/bash
# Claude Workflow System Installer
# https://github.com/cavallini/wf-system

set -e

CLAUDE_DIR="$HOME/.claude"
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "========================================"
echo "  Claude Workflow System Installer"
echo "========================================"
echo

# Create directories
echo "[1/4] Creating directories..."
mkdir -p "$CLAUDE_DIR/commands"
mkdir -p "$CLAUDE_DIR/hooks"
mkdir -p "$CLAUDE_DIR/hooks/.wf-state"

# Symlink commands
echo "[2/4] Installing workflow commands..."
count=0
for cmd in "$REPO_DIR/commands/"wf-*.md; do
  if [ -f "$cmd" ]; then
    ln -sf "$cmd" "$CLAUDE_DIR/commands/$(basename "$cmd")"
    count=$((count + 1))
  fi
done
echo "       Installed $count commands"

# Symlink hook
echo "[3/4] Installing orchestrator hook..."
ln -sf "$REPO_DIR/hooks/wf-orchestrator.py" "$CLAUDE_DIR/hooks/wf-orchestrator.py"

# Merge settings.json
echo "[4/4] Configuring settings..."
SETTINGS="$CLAUDE_DIR/settings.json"

if [ -f "$SETTINGS" ]; then
  # Backup existing settings
  cp "$SETTINGS" "$SETTINGS.bak.$(date +%Y%m%d%H%M%S)"

  # Check if jq is available for JSON merging
  if command -v jq &> /dev/null; then
    # Deep merge hooks into existing settings
    jq -s '
      def deepmerge(a; b):
        a as $a | b as $b |
        if ($a | type) == "object" and ($b | type) == "object" then
          ($a | keys) + ($b | keys) | unique | map({(.): deepmerge($a[.]; $b[.])}) | add
        elif ($b | type) == "null" then $a
        else $b
        end;
      deepmerge(.[0]; .[1])
    ' "$SETTINGS" "$REPO_DIR/templates/settings-hooks.json" > "$SETTINGS.tmp"
    mv "$SETTINGS.tmp" "$SETTINGS"
    echo "       Merged hooks into existing settings"
  else
    echo ""
    echo "  WARNING: jq not installed."
    echo "  Please manually add the following to $SETTINGS:"
    echo ""
    cat "$REPO_DIR/templates/settings-hooks.json"
    echo ""
  fi
else
  # No existing settings, just copy the template
  cp "$REPO_DIR/templates/settings-hooks.json" "$SETTINGS"
  echo "       Created new settings file"
fi

echo
echo "========================================"
echo "  Installation complete!"
echo "========================================"
echo
echo "Next steps:"
echo "  1. Restart Claude Code for changes to take effect"
echo "  2. Run /wf-init-project in your project to set up workflow"
echo
echo "Available commands: /wf-<tab> to see all"
