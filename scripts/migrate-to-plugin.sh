#!/usr/bin/env bash
# migrate-to-plugin.sh — one-shot helper for v1.x install.sh users moving to v2.0.
# See docs/superpowers/specs/2026-04-07-wf-system-plugin-migration-design.md §5.

set -eu

DRY_RUN=0
DO_BACKUP=1
PROJECT_PATH=""
INCLUDE_GLOBAL=0
ASSUME_YES=0

usage() {
  cat <<EOF
Usage: migrate-to-plugin.sh [OPTIONS]

Options:
  --dry-run             Print what would be done without making any changes
  --no-backup           Skip backup (NOT recommended)
  --project PATH        Migrate a project-local install at PATH
  --include-global      Used with --project: also migrate global install
  --yes                 Skip interactive confirmation (for tests/CI)
  -h, --help            Show this help

Examples:
  migrate-to-plugin.sh                      # migrate global install
  migrate-to-plugin.sh --dry-run            # preview changes
  migrate-to-plugin.sh --project ~/my-app   # migrate one project install
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --no-backup) DO_BACKUP=0; shift ;;
    --project) PROJECT_PATH="$2"; shift 2 ;;
    --include-global) INCLUDE_GLOBAL=1; shift ;;
    --yes) ASSUME_YES=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 2 ;;
  esac
done

CLAUDE_DIR="$HOME/.claude"

# ------------------------------------------------------------------
# Phase 0: detection guard
# ------------------------------------------------------------------
detect_install() {
  if [[ -f "$CLAUDE_DIR/hooks/.wf-version" ]]; then
    return 0
  fi
  if [[ -f "$CLAUDE_DIR/hooks/wf-orchestrator.py" ]]; then
    return 0
  fi
  return 1
}

if [[ -z "$PROJECT_PATH" ]] || [[ $INCLUDE_GLOBAL -eq 1 ]]; then
  if ! detect_install; then
    echo "[1/5] No wf-system global installation detected."
    echo "      Nothing to do."
    exit 0
  fi
fi

echo "[1/5] Detecting wf-system installation..."
if [[ -f "$CLAUDE_DIR/hooks/.wf-version" ]]; then
  VERSION=$(cat "$CLAUDE_DIR/hooks/.wf-version" 2>/dev/null || echo unknown)
  MODE=$(cat "$CLAUDE_DIR/hooks/.wf-install-mode" 2>/dev/null || echo unknown)
  echo "      Found global install (v$VERSION, mode: $MODE)"
else
  echo "      Found legacy global install (no version metadata)"
fi

# ------------------------------------------------------------------
# Phase 1: backup
# ------------------------------------------------------------------
BACKUP_DIR=""
if [[ $DO_BACKUP -eq 1 ]]; then
  TS=$(date -u +%Y-%m-%dT%H-%M-%SZ)
  BACKUP_DIR="$CLAUDE_DIR/wf-system-backup-$TS"
  echo "[2/5] Creating backup at $BACKUP_DIR..."

  if [[ $DRY_RUN -eq 0 ]]; then
    mkdir -p "$BACKUP_DIR"
    [[ -f "$CLAUDE_DIR/settings.json" ]] && cp "$CLAUDE_DIR/settings.json" "$BACKUP_DIR/settings.json"
    [[ -d "$CLAUDE_DIR/hooks" ]] && cp -rL "$CLAUDE_DIR/hooks" "$BACKUP_DIR/hooks" 2>/dev/null || true
    if [[ -d "$CLAUDE_DIR/scripts" ]]; then
      mkdir -p "$BACKUP_DIR/scripts"
      [[ -e "$CLAUDE_DIR/scripts/wf-brain.js" ]] && cp -L "$CLAUDE_DIR/scripts/wf-brain.js" "$BACKUP_DIR/scripts/" 2>/dev/null || true
      [[ -e "$CLAUDE_DIR/scripts/wf-brain" ]] && cp -rL "$CLAUDE_DIR/scripts/wf-brain" "$BACKUP_DIR/scripts/" 2>/dev/null || true
    fi
    if [[ -d "$CLAUDE_DIR/mcp-servers/wf-brain" ]]; then
      mkdir -p "$BACKUP_DIR/mcp-servers"
      cp -rL "$CLAUDE_DIR/mcp-servers/wf-brain" "$BACKUP_DIR/mcp-servers/" 2>/dev/null || true
    fi
  fi
  echo "      Backed up (see $BACKUP_DIR)"
else
  echo "[2/5] Skipping backup (--no-backup)"
fi

# ------------------------------------------------------------------
# Phase 2: remove wf-system files (stubbed in Task 20 — implemented next)
# ------------------------------------------------------------------
echo "[3/5] Removing wf-system files from $CLAUDE_DIR..."
# ... implemented in Task 20

# ------------------------------------------------------------------
# Phase 3: prune settings.json (stubbed in Task 21 — implemented next)
# ------------------------------------------------------------------
echo "[4/5] Pruning wf-system hooks from $CLAUDE_DIR/settings.json..."
# ... implemented in Task 21

echo "[5/5] Migration complete."
if [[ -n "$BACKUP_DIR" ]]; then
  echo ""
  echo "Backup: $BACKUP_DIR"
fi
echo ""
echo "Next steps:"
echo "  1. Open Claude Code"
echo "  2. Run: /plugin marketplace add matheusslg/wf-system"
echo "  3. Run: /plugin install wf-core@wf-system"
