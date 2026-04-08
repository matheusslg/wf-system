#!/usr/bin/env bash
# Entry point: runs all migration helper tests.
# Usage: tests/migration/run-tests.sh

set -u

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FIXTURES="$REPO_ROOT/tests/migration/fixtures"
HELPER="$REPO_ROOT/scripts/migrate-to-plugin.sh"

# shellcheck source=/dev/null
source "$REPO_ROOT/tests/migration/assertions.sh"

run_test() {
  local name="$1"
  shift
  echo ""
  echo "-- $name"
  "$@"
}

# Tests are appended here as each one is written (see Tasks 17-26).

test_migrate_v1_11_1_global() {
  local tmp
  tmp=$(mktemp -d)
  trap "rm -rf $tmp" RETURN

  cp -a "$FIXTURES/v1.11.1-fresh-install/.claude" "$tmp/"

  HOME="$tmp" bash "$HELPER" --no-backup --yes >/dev/null 2>&1 || {
    echo "  FAIL: migrate-to-plugin.sh exited non-zero"
    _TESTS_FAILED=$((_TESTS_FAILED + 1))
    return 1
  }

  assert_file_absent "$tmp/.claude/hooks/wf-orchestrator.py" "hook removed"
  assert_file_absent "$tmp/.claude/hooks/.wf-version" "version file removed"
  assert_file_absent "$tmp/.claude/hooks/.wf-source" "source file removed"
  assert_file_absent "$tmp/.claude/hooks/.wf-install-mode" "mode file removed"
  assert_file_absent "$tmp/.claude/hooks/.wf-last-check" "last-check removed"
  assert_file_absent "$tmp/.claude/hooks/.wf-state" "state dir removed"
  assert_file_absent "$tmp/.claude/scripts/wf-brain.js" "brain cli removed"
  assert_file_absent "$tmp/.claude/scripts/wf-brain" "brain module removed"
  assert_file_absent "$tmp/.claude/mcp-servers/wf-brain" "brain mcp removed"
  assert_file_absent "$tmp/.claude/commands/wf-implement.md" "wf-implement cmd removed"
  assert_file_absent "$tmp/.claude/commands/wf-match-figma.md" "wf-match-figma cmd removed"
  assert_settings_no_wf_hook "$tmp/.claude/settings.json"
}

run_test "migrate v1.11.1 global" test_migrate_v1_11_1_global

print_summary
