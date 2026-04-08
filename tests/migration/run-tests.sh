#!/usr/bin/env bash
# Entry point: runs all migration helper tests.
# Usage: tests/migration/run-tests.sh

set -eu

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

print_summary
