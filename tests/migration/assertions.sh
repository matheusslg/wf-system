#!/usr/bin/env bash
# Shared assertions for migration helper tests.
# All assertions print a PASS/FAIL line and increment counters in the caller.

set -u

_TESTS_PASSED=${_TESTS_PASSED:-0}
_TESTS_FAILED=${_TESTS_FAILED:-0}

assert_file_absent() {
  local path="$1"
  local desc="${2:-}"
  if [[ -e "$path" ]]; then
    echo "  FAIL: expected $path to be absent ${desc:+($desc)}"
    _TESTS_FAILED=$((_TESTS_FAILED + 1))
    return 1
  else
    echo "  pass: $path absent ${desc:+($desc)}"
    _TESTS_PASSED=$((_TESTS_PASSED + 1))
    return 0
  fi
}

assert_file_present() {
  local path="$1"
  local desc="${2:-}"
  if [[ -e "$path" ]]; then
    echo "  pass: $path present ${desc:+($desc)}"
    _TESTS_PASSED=$((_TESTS_PASSED + 1))
    return 0
  else
    echo "  FAIL: expected $path to exist ${desc:+($desc)}"
    _TESTS_FAILED=$((_TESTS_FAILED + 1))
    return 1
  fi
}

assert_settings_no_wf_hook() {
  local settings_path="$1"
  if [[ ! -f "$settings_path" ]]; then
    echo "  pass: $settings_path absent (nothing to check)"
    _TESTS_PASSED=$((_TESTS_PASSED + 1))
    return 0
  fi
  if grep -q "wf-orchestrator" "$settings_path"; then
    echo "  FAIL: $settings_path still contains wf-orchestrator reference"
    _TESTS_FAILED=$((_TESTS_FAILED + 1))
    return 1
  else
    echo "  pass: $settings_path contains no wf-orchestrator references"
    _TESTS_PASSED=$((_TESTS_PASSED + 1))
    return 0
  fi
}

assert_settings_contains() {
  local settings_path="$1"
  local pattern="$2"
  if grep -q "$pattern" "$settings_path"; then
    echo "  pass: $settings_path contains '$pattern'"
    _TESTS_PASSED=$((_TESTS_PASSED + 1))
    return 0
  else
    echo "  FAIL: $settings_path missing '$pattern'"
    _TESTS_FAILED=$((_TESTS_FAILED + 1))
    return 1
  fi
}

print_summary() {
  echo ""
  echo "=========================="
  echo "Tests passed: $_TESTS_PASSED"
  echo "Tests failed: $_TESTS_FAILED"
  echo "=========================="
  [[ $_TESTS_FAILED -eq 0 ]]
}
