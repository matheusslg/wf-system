#!/usr/bin/env bash
# Entry point: runs the orchestrator test suite.
# Usage: tests/orchestrator/run-tests.sh

set -eu

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

exec python3 -m unittest discover tests/orchestrator -v
