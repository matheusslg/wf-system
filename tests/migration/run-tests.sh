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

test_migrate_v1_11_1_project() {
  local tmp
  tmp=$(mktemp -d)
  trap "rm -rf $tmp" RETURN

  cp -a "$FIXTURES/v1.11.1-project-install/project" "$tmp/proj"

  HOME="$tmp" bash "$HELPER" --no-backup --yes --project "$tmp/proj" >/dev/null 2>&1 || {
    echo "  FAIL: migrate-to-plugin.sh --project exited non-zero"
    _TESTS_FAILED=$((_TESTS_FAILED + 1))
    return 1
  }

  assert_file_absent "$tmp/proj/.claude/commands/wf-implement.md"
  assert_file_absent "$tmp/proj/.claude/commands/wf-fix-bug.md"
  assert_file_absent "$tmp/proj/.claude/commands/wf-commit.md"
}

run_test "migrate v1.11.1 project" test_migrate_v1_11_1_project

test_dry_run_no_mutation() {
  local tmp
  tmp=$(mktemp -d)
  trap "rm -rf $tmp" RETURN

  cp -a "$FIXTURES/v1.11.1-fresh-install/.claude" "$tmp/"

  local before_count
  before_count=$(find "$tmp/.claude" -type f | wc -l)

  HOME="$tmp" bash "$HELPER" --dry-run --yes >/dev/null 2>&1

  local after_count
  after_count=$(find "$tmp/.claude" -type f | wc -l)

  if [[ "$before_count" -eq "$after_count" ]]; then
    echo "  pass: dry-run mutated no files ($before_count → $after_count)"
    _TESTS_PASSED=$((_TESTS_PASSED + 1))
  else
    echo "  FAIL: dry-run mutated files ($before_count → $after_count)"
    _TESTS_FAILED=$((_TESTS_FAILED + 1))
  fi
}

run_test "dry-run no mutation" test_dry_run_no_mutation

test_idempotent() {
  local tmp
  tmp=$(mktemp -d)
  trap "rm -rf $tmp" RETURN

  cp -a "$FIXTURES/v1.11.1-fresh-install/.claude" "$tmp/"

  HOME="$tmp" bash "$HELPER" --no-backup --yes >/dev/null 2>&1
  # Second run
  if HOME="$tmp" bash "$HELPER" --no-backup --yes >/dev/null 2>&1; then
    echo "  pass: second run exits 0 (idempotent)"
    _TESTS_PASSED=$((_TESTS_PASSED + 1))
  else
    echo "  FAIL: second run exited non-zero (not idempotent)"
    _TESTS_FAILED=$((_TESTS_FAILED + 1))
  fi
}

run_test "idempotency" test_idempotent

test_user_hook_preserved() {
  local tmp
  tmp=$(mktemp -d)
  trap "rm -rf $tmp" RETURN

  cp -a "$FIXTURES/v1.11.1-user-hook/.claude" "$tmp/"

  HOME="$tmp" bash "$HELPER" --no-backup --yes >/dev/null 2>&1

  assert_settings_no_wf_hook "$tmp/.claude/settings.json"
  assert_settings_contains "$tmp/.claude/settings.json" "user-defined hook"
}

run_test "user hook preserved" test_user_hook_preserved

test_migrate_v1_5_0_no_brain() {
  local tmp
  tmp=$(mktemp -d)
  trap "rm -rf $tmp" RETURN

  cp -a "$FIXTURES/v1.5.0-fresh-install/.claude" "$tmp/"

  HOME="$tmp" bash "$HELPER" --no-backup --yes >/dev/null 2>&1 || {
    echo "  FAIL: migrate-to-plugin.sh exited non-zero on v1.5.0 fixture"
    _TESTS_FAILED=$((_TESTS_FAILED + 1))
    return 1
  }

  assert_file_absent "$tmp/.claude/hooks/wf-orchestrator.py"
  assert_file_absent "$tmp/.claude/hooks/.wf-version"
  assert_settings_no_wf_hook "$tmp/.claude/settings.json"
}

test_migrate_v1_0_0_minimal() {
  local tmp
  tmp=$(mktemp -d)
  trap "rm -rf $tmp" RETURN

  cp -a "$FIXTURES/v1.0.0-fresh-install/.claude" "$tmp/"

  HOME="$tmp" bash "$HELPER" --no-backup --yes >/dev/null 2>&1 || {
    echo "  FAIL: migrate-to-plugin.sh exited non-zero on v1.0.0 fixture"
    _TESTS_FAILED=$((_TESTS_FAILED + 1))
    return 1
  }

  assert_file_absent "$tmp/.claude/hooks/wf-orchestrator.py"
  assert_file_absent "$tmp/.claude/commands/wf-init.md"
  assert_settings_no_wf_hook "$tmp/.claude/settings.json"
}

run_test "migrate v1.5.0 (no brain)" test_migrate_v1_5_0_no_brain
run_test "migrate v1.0.0 (minimal)" test_migrate_v1_0_0_minimal

test_never_installed_noop() {
  local tmp
  tmp=$(mktemp -d)
  trap "rm -rf $tmp" RETURN

  cp -a "$FIXTURES/never-installed/.claude" "$tmp/"
  local before
  before=$(find "$tmp/.claude" -type f | wc -l)

  HOME="$tmp" bash "$HELPER" --no-backup --yes >/dev/null 2>&1 || {
    echo "  FAIL: helper exited non-zero on never-installed fixture"
    _TESTS_FAILED=$((_TESTS_FAILED + 1))
    return 1
  }

  local after
  after=$(find "$tmp/.claude" -type f | wc -l)

  if [[ "$before" -eq "$after" ]]; then
    echo "  pass: never-installed fixture untouched"
    _TESTS_PASSED=$((_TESTS_PASSED + 1))
  else
    echo "  FAIL: helper mutated a never-installed fixture"
    _TESTS_FAILED=$((_TESTS_FAILED + 1))
  fi
}

run_test "never-installed no-op" test_never_installed_noop

print_summary
