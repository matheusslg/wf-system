#!/bin/bash
# Claude Workflow System Installer
# https://github.com/matheusslg/wf-system

set -e

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "========================================"
echo "  Claude Workflow System Installer"
echo "========================================"
echo

# Ask installation mode
echo "Where do you want to install the workflow commands?"
echo
echo "  [1] Global (all projects)  → ~/.claude/commands/"
echo "  [2] Project (current dir)  → ./.claude/commands/"
echo
read -p "Select [1/2] (default: 1): " INSTALL_MODE

case "$INSTALL_MODE" in
  2)
    INSTALL_TYPE="project"
    TARGET_DIR="$(pwd)/.claude"
    echo
    echo "Installing to: $TARGET_DIR"
    ;;
  *)
    INSTALL_TYPE="global"
    TARGET_DIR="$HOME/.claude"
    echo
    echo "Installing globally to: $TARGET_DIR"
    ;;
esac

# Create directories
echo
echo "[1/5] Creating directories..."
mkdir -p "$TARGET_DIR/commands"

if [ "$INSTALL_TYPE" = "global" ]; then
  mkdir -p "$TARGET_DIR/hooks"
  mkdir -p "$TARGET_DIR/hooks/.wf-state"
  mkdir -p "$TARGET_DIR/scripts"
  mkdir -p "$TARGET_DIR/mcp-servers/wf-brain"
fi

# Store repo directory for later use
WF_REPO_DIR="$REPO_DIR"

# Install commands
echo "[2/5] Installing workflow commands..."
count=0

# Ask symlink vs copy for global install
if [ "$INSTALL_TYPE" = "global" ]; then
  echo
  echo "  How should commands be installed?"
  echo "    [1] Symlink (auto-updates with git pull)"
  echo "    [2] Copy    (standalone, no dependency on repo)"
  echo
  read -p "  Select [1/2] (default: 1): " LINK_MODE
  echo
fi

for cmd in "$REPO_DIR/commands/"wf-*.md; do
  if [ -f "$cmd" ] || [ -L "$cmd" ]; then
    target="$TARGET_DIR/commands/$(basename "$cmd")"

    # Skip if source and target resolve to the same path
    if [ "$(realpath "$cmd" 2>/dev/null)" = "$(realpath "$target" 2>/dev/null)" ]; then
      count=$((count + 1))
      continue
    fi

    if [ "$INSTALL_TYPE" = "global" ] && [ "$LINK_MODE" != "2" ]; then
      ln -sf "$cmd" "$target"
    else
      cp "$cmd" "$target"
    fi
    count=$((count + 1))
  fi
done
echo "       Installed $count commands"

# Install hook (global only)
if [ "$INSTALL_TYPE" = "global" ]; then
  echo "[3/5] Installing orchestrator hook..."

  SRC="$REPO_DIR/hooks/wf-orchestrator.py"
  DST="$TARGET_DIR/hooks/wf-orchestrator.py"
  if [ "$(realpath "$SRC" 2>/dev/null)" = "$(realpath "$DST" 2>/dev/null)" ]; then
    echo "       Hook already in place (same path)"
  elif [ "$LINK_MODE" != "2" ]; then
    ln -sf "$SRC" "$DST"
  else
    cp "$SRC" "$DST"
  fi

  # Install brain scripts
  echo "[4/5] Installing brain scripts..."

  # wf-brain.js entry point
  SRC="$REPO_DIR/scripts/wf-brain.js"
  DST="$TARGET_DIR/scripts/wf-brain.js"
  if [ -f "$SRC" ]; then
    if [ "$(realpath "$SRC" 2>/dev/null)" = "$(realpath "$DST" 2>/dev/null)" ]; then
      echo "       Brain CLI already in place"
    elif [ "$LINK_MODE" != "2" ]; then
      ln -sf "$SRC" "$DST"
    else
      cp "$SRC" "$DST"
    fi

    # wf-brain/ module directory
    if [ -d "$REPO_DIR/scripts/wf-brain" ]; then
      if [ "$LINK_MODE" != "2" ]; then
        ln -sfn "$REPO_DIR/scripts/wf-brain" "$TARGET_DIR/scripts/wf-brain"
      else
        rm -rf "$TARGET_DIR/scripts/wf-brain"
        cp -r "$REPO_DIR/scripts/wf-brain" "$TARGET_DIR/scripts/wf-brain"
      fi
    fi

    # MCP server
    for f in index.js package.json; do
      SRC="$REPO_DIR/.claude/mcp-servers/wf-brain/$f"
      DST="$TARGET_DIR/mcp-servers/wf-brain/$f"
      if [ -f "$SRC" ]; then
        if [ "$(realpath "$SRC" 2>/dev/null)" = "$(realpath "$DST" 2>/dev/null)" ]; then
          :
        elif [ "$LINK_MODE" != "2" ]; then
          ln -sf "$SRC" "$DST"
        else
          cp "$SRC" "$DST"
        fi
      fi
    done
    echo "       Brain scripts + MCP server installed"
  else
    echo "       Brain scripts not found (skipping)"
  fi

  # Write version metadata
  echo "       Writing version metadata..."

  # Write installed version
  if [ -f "$REPO_DIR/VERSION" ]; then
    cp "$REPO_DIR/VERSION" "$TARGET_DIR/hooks/.wf-version"
  else
    echo "1.0.0" > "$TARGET_DIR/hooks/.wf-version"
  fi

  # Write install mode
  if [ "$LINK_MODE" != "2" ]; then
    echo "symlink" > "$TARGET_DIR/hooks/.wf-install-mode"
  else
    echo "copy" > "$TARGET_DIR/hooks/.wf-install-mode"
  fi

  # Write source path
  echo "$REPO_DIR" > "$TARGET_DIR/hooks/.wf-source"

  # Initialize last check timestamp
  touch "$TARGET_DIR/hooks/.wf-last-check"

  # Clear any existing update notification
  rm -f "$TARGET_DIR/hooks/.wf-update-available"

  # Merge settings.json
  echo "[5/5] Configuring settings..."
  SETTINGS="$TARGET_DIR/settings.json"

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
else
  echo "[3/5] Skipping hook (project-level install)"
  echo "[4/5] Skipping brain scripts (project-level install)"
  echo "[5/5] Skipping global settings (project-level install)"
  echo
  echo "  Note: Orchestrator hook is only available with global install."
  echo "  Commands will work, but auto-context monitoring won't be active."
fi

echo
echo "========================================"
echo "  Installation complete!"
echo "========================================"
echo

if [ "$INSTALL_TYPE" = "global" ]; then
  echo "Installed: Commands + Orchestrator Hook"
  echo
  echo "Next steps:"
  echo "  1. Restart Claude Code for changes to take effect"
  echo "  2. Run /wf-init-project in your project to set up workflow"
else
  echo "Installed: Commands only (project-level)"
  echo "Location:  $TARGET_DIR/commands/"
  echo
  echo "Next steps:"
  echo "  1. Run /wf-init-project to set up workflow.json"
  echo "  2. (Optional) Run global install for orchestrator hook"
fi

echo
echo "Available commands: /wf-<tab> to see all"
