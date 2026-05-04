"""Tests for the wf-orchestrator context monitor.

Covers:
  - JSONL token math (input + cache_creation + cache_read)
  - Window self-calibration (env / workflow.json / observed-max tier inference / default)
  - Threshold ordering (warning fires first, even at high pct)
  - Auto-reset when usage drops post-/compact
  - Disable + malformed input handling

The script under test (`wf-orchestrator.py`) has a hyphen in its filename so
it can't be imported via `import wf-orchestrator`. Loaded explicitly via
`importlib.util` and aliased as `wf_orchestrator` in `sys.modules`.
"""

import importlib.util
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path


_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
_SCRIPT_PATH = _REPO_ROOT / "plugins/wf-core/scripts/wf-orchestrator.py"

_spec = importlib.util.spec_from_file_location("wf_orchestrator", _SCRIPT_PATH)
assert _spec is not None and _spec.loader is not None, f"failed to load {_SCRIPT_PATH}"
wo = importlib.util.module_from_spec(_spec)
sys.modules["wf_orchestrator"] = wo
_spec.loader.exec_module(wo)


# Env vars the context monitor reads — clear them per-test so the
# environment of whoever's running the suite doesn't leak in.
_CONTEXT_ENV_VARS = (
    "WF_CONTEXT_LIMIT",
    "WF_CONTEXT_WARNING_THRESHOLD",
    "WF_CONTEXT_CRITICAL_THRESHOLD",
    "WF_DISABLE_CONTEXT_CHECK",
    "WF_EXTERNAL_LOOP",
)


def _usage_entry(
    *,
    input_tokens: int = 0,
    cache_creation_input_tokens: int = 0,
    cache_read_input_tokens: int = 0,
) -> dict:
    """Synthesise one transcript line carrying a `message.usage` block."""
    return {
        "type": "assistant",
        "message": {
            "usage": {
                "input_tokens": input_tokens,
                "cache_creation_input_tokens": cache_creation_input_tokens,
                "cache_read_input_tokens": cache_read_input_tokens,
            },
        },
    }


class ContextMonitorTestBase(unittest.TestCase):
    """Shared scaffolding: temp state dir, env hygiene, transcript helpers."""

    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        self.tmp = Path(self._tmpdir.name)

        # Override the module-level state dir so tests don't leak into
        # ~/.wf-state, and so each test starts with a clean slate.
        self._orig_state_dir = wo.STATE_DIR
        wo.STATE_DIR = self.tmp / "state"

        # Clean every env var the monitor reads. Restore in tearDown.
        self._saved_env: dict = {}
        for key in _CONTEXT_ENV_VARS:
            self._saved_env[key] = os.environ.pop(key, None)

    def tearDown(self):
        wo.STATE_DIR = self._orig_state_dir
        for key, val in self._saved_env.items():
            if val is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = val
        self._tmpdir.cleanup()

    def _write_transcript(self, entries) -> str:
        """Write a list of dicts as JSONL, return the path string."""
        path = self.tmp / "transcript.jsonl"
        with open(path, "w") as f:
            for e in entries:
                f.write(json.dumps(e) + "\n")
        return str(path)

    def _make_orch(
        self,
        *,
        transcript_path: str = "",
        cwd: str = "",
        session_id: str = "test-session",
    ):
        return wo.WFOrchestrator({
            "session_id": session_id,
            "transcript_path": transcript_path,
            "cwd": cwd or str(self.tmp),
        })


class TestUsageMath(ContextMonitorTestBase):
    """`_get_context_usage` should sum the three usage fields correctly."""

    def test_empty_transcript_returns_zero(self):
        orch = self._make_orch(transcript_path="")
        tokens, pct, limit = orch._get_context_usage()
        self.assertEqual(tokens, 0)
        self.assertEqual(pct, 0.0)
        self.assertEqual(limit, 200_000)

    def test_missing_transcript_file_returns_zero(self):
        orch = self._make_orch(transcript_path=str(self.tmp / "nope.jsonl"))
        tokens, pct, limit = orch._get_context_usage()
        self.assertEqual(tokens, 0)
        self.assertEqual(pct, 0.0)

    def test_single_entry_tokens(self):
        path = self._write_transcript([_usage_entry(input_tokens=50_000)])
        orch = self._make_orch(transcript_path=path)
        tokens, pct, _ = orch._get_context_usage()
        self.assertEqual(tokens, 50_000)
        self.assertAlmostEqual(pct, 25.0, places=2)

    def test_cache_fields_all_sum(self):
        # 1k input + 9k cache_creation + 40k cache_read = 50k total
        path = self._write_transcript([
            _usage_entry(
                input_tokens=1_000,
                cache_creation_input_tokens=9_000,
                cache_read_input_tokens=40_000,
            ),
        ])
        orch = self._make_orch(transcript_path=path)
        tokens, _, _ = orch._get_context_usage()
        self.assertEqual(tokens, 50_000)

    def test_latest_entry_wins(self):
        path = self._write_transcript([
            _usage_entry(input_tokens=10_000),
            _usage_entry(input_tokens=30_000),
            _usage_entry(input_tokens=20_000),
        ])
        orch = self._make_orch(transcript_path=path)
        tokens, _, _ = orch._get_context_usage()
        self.assertEqual(tokens, 20_000)

    def test_malformed_jsonl_lines_skipped(self):
        # Mix valid + malformed lines; the malformed ones must not crash
        # the walk, and the valid usage must still register.
        path = self.tmp / "transcript.jsonl"
        with open(path, "w") as f:
            f.write("not json at all\n")
            f.write(json.dumps({"random": "shape"}) + "\n")
            f.write(json.dumps(_usage_entry(input_tokens=12_345)) + "\n")
            f.write("{partial-write...\n")
        orch = self._make_orch(transcript_path=str(path))
        tokens, _, _ = orch._get_context_usage()
        self.assertEqual(tokens, 12_345)

    def test_zero_usage_entries_dont_replace_real_data(self):
        # Some Claude Code transcript shapes carry usage:{} or all-zeros
        # entries between real ones. Make sure they don't reset the
        # latest non-zero value.
        path = self._write_transcript([
            _usage_entry(input_tokens=20_000),
            _usage_entry(),  # zeros
            {"type": "user", "message": {"role": "user"}},
        ])
        orch = self._make_orch(transcript_path=path)
        tokens, _, _ = orch._get_context_usage()
        self.assertEqual(tokens, 20_000)


class TestWindowResolution(ContextMonitorTestBase):
    """`_resolve_context_window` priority order."""

    def test_default_when_observed_small(self):
        orch = self._make_orch()
        self.assertEqual(orch._resolve_context_window(observed_max=50_000), 200_000)
        self.assertEqual(orch._resolve_context_window(observed_max=200_000), 200_000)

    def test_observed_above_200k_promotes_to_1m(self):
        orch = self._make_orch()
        self.assertEqual(orch._resolve_context_window(observed_max=600_000), 1_000_000)

    def test_observed_above_1m_promotes_to_2m(self):
        orch = self._make_orch()
        self.assertEqual(orch._resolve_context_window(observed_max=1_500_000), 2_000_000)

    def test_observed_above_2m_caps_at_top_tier(self):
        orch = self._make_orch()
        # Beyond the largest known tier — fall through to the cap rather
        # than crash. Future Anthropic releases would extend STANDARD_TIERS.
        self.assertEqual(orch._resolve_context_window(observed_max=3_000_000), 2_000_000)

    def test_env_var_overrides_observed(self):
        os.environ["WF_CONTEXT_LIMIT"] = "500000"
        orch = self._make_orch()
        # Without env, this would self-calibrate to 1M.
        self.assertEqual(orch._resolve_context_window(observed_max=600_000), 500_000)

    def test_env_var_invalid_falls_through(self):
        os.environ["WF_CONTEXT_LIMIT"] = "not-a-number"
        orch = self._make_orch()
        # Falls through to default since observed is small.
        self.assertEqual(orch._resolve_context_window(observed_max=50_000), 200_000)

    def test_workflow_json_overrides_observed(self):
        # workflow.json with contextLimit pinned to 750K. Observed is 600K
        # which would self-calibrate to 1M; the per-project pin wins.
        wf = {"contextLimit": 750_000, "github": {"owner": "x", "repo": "y"}}
        wf_path = self.tmp / "workflow.json"
        wf_path.write_text(json.dumps(wf))
        orch = self._make_orch(cwd=str(self.tmp))
        self.assertEqual(orch._resolve_context_window(observed_max=600_000), 750_000)

    def test_env_beats_workflow_json(self):
        os.environ["WF_CONTEXT_LIMIT"] = "888888"
        wf = {"contextLimit": 750_000}
        (self.tmp / "workflow.json").write_text(json.dumps(wf))
        orch = self._make_orch(cwd=str(self.tmp))
        self.assertEqual(orch._resolve_context_window(observed_max=600_000), 888_888)


class TestThresholdOrdering(ContextMonitorTestBase):
    """Warning must fire first, even when observed pct is past critical."""

    def test_pietro_regression_warning_fires_at_80_pct(self):
        # Sonnet 4.6-style session: 800K observed in a 1M window = 80%.
        # Old logic would fire CRITICAL on the first tick because the
        # broken hardcoded 200K window inflated this to 400% and skipped
        # the warning. With self-calibration + warning-first ordering,
        # the user gets the 75% heads-up.
        path = self._write_transcript([_usage_entry(input_tokens=800_000)])
        orch = self._make_orch(transcript_path=path)
        out = orch.handle_context_check()
        self.assertIsNotNone(out)
        msg = out["systemMessage"]
        self.assertIn("80%", msg)
        self.assertNotIn("CRITICAL", msg)
        # Window resolved to 1M via self-calibration (no env / config).
        self.assertTrue(orch.state["warning_shown"])
        self.assertFalse(orch.state["pre_compact_ran"])

    def test_sequential_warning_then_critical(self):
        # Force a 200K window so the math is predictable.
        os.environ["WF_CONTEXT_LIMIT"] = "200000"
        path = self._write_transcript([_usage_entry(input_tokens=160_000)])  # 80%
        orch = self._make_orch(transcript_path=path)

        first = orch.handle_context_check()
        self.assertIsNotNone(first)
        self.assertIn("Context at 80%", first["systemMessage"])
        self.assertTrue(orch.state["warning_shown"])
        self.assertFalse(orch.state["pre_compact_ran"])

        # Same session, same orch — second tick crosses 90%.
        new_path = self._write_transcript([_usage_entry(input_tokens=185_000)])  # 92.5%
        orch.transcript_path = new_path
        second = orch.handle_context_check()
        self.assertIsNotNone(second)
        self.assertIn("CRITICAL", second["systemMessage"])
        self.assertTrue(orch.state["pre_compact_ran"])

    def test_under_threshold_no_output(self):
        os.environ["WF_CONTEXT_LIMIT"] = "200000"
        path = self._write_transcript([_usage_entry(input_tokens=50_000)])  # 25%
        orch = self._make_orch(transcript_path=path)
        self.assertIsNone(orch.handle_context_check())
        self.assertFalse(orch.state["warning_shown"])

    def test_warning_shown_only_once(self):
        os.environ["WF_CONTEXT_LIMIT"] = "200000"
        path = self._write_transcript([_usage_entry(input_tokens=160_000)])  # 80%
        orch = self._make_orch(transcript_path=path)
        first = orch.handle_context_check()
        self.assertIsNotNone(first)
        # Second invocation at the same level should NOT re-emit the warning.
        second = orch.handle_context_check()
        self.assertIsNone(second)


class TestStateAutoReset(ContextMonitorTestBase):
    """After /compact drops usage, warning/critical flags should clear."""

    def test_drops_below_floor_resets_flags(self):
        os.environ["WF_CONTEXT_LIMIT"] = "200000"

        # Pretend a previous tick had already fired both flags.
        orch = self._make_orch()
        orch.state["warning_shown"] = True
        orch.state["pre_compact_ran"] = True
        orch._save_state()

        # Now the transcript shows only 40% usage (post-/compact).
        path = self._write_transcript([_usage_entry(input_tokens=80_000)])  # 40%
        orch.transcript_path = path

        result = orch.handle_context_check()
        # No new warning should fire (still under threshold), but the
        # flags must reset so the next expansion gets a fresh signal.
        self.assertIsNone(result)
        self.assertFalse(orch.state["warning_shown"])
        self.assertFalse(orch.state["pre_compact_ran"])

    def test_reset_then_warn_again_on_next_expansion(self):
        os.environ["WF_CONTEXT_LIMIT"] = "200000"

        orch = self._make_orch()
        orch.state["warning_shown"] = True
        orch.state["pre_compact_ran"] = False
        orch._save_state()

        # Below floor → reset.
        low = self._write_transcript([_usage_entry(input_tokens=80_000)])
        orch.transcript_path = low
        orch.handle_context_check()
        self.assertFalse(orch.state["warning_shown"])

        # Now climb back into warning territory — should re-emit.
        high = self._write_transcript([_usage_entry(input_tokens=160_000)])
        orch.transcript_path = high
        out = orch.handle_context_check()
        self.assertIsNotNone(out)
        self.assertIn("Context at 80%", out["systemMessage"])

    def test_floor_buffer_prevents_oscillation(self):
        # Warning threshold 75 → reset floor 67.5%. Usage at 70% should
        # NOT reset the flag (still in the buffer zone).
        os.environ["WF_CONTEXT_LIMIT"] = "200000"
        orch = self._make_orch()
        orch.state["warning_shown"] = True
        orch._save_state()

        path = self._write_transcript([_usage_entry(input_tokens=140_000)])  # 70%
        orch.transcript_path = path
        orch.handle_context_check()
        # 70% < 75% (no warning re-fire), but >= 67.5% (no reset).
        self.assertTrue(orch.state["warning_shown"])


class TestDisableFlag(ContextMonitorTestBase):
    """`WF_DISABLE_CONTEXT_CHECK=true` short-circuits the monitor."""

    def test_disable_short_circuits(self):
        os.environ["WF_DISABLE_CONTEXT_CHECK"] = "true"
        # Even with usage way past critical, the disable flag wins.
        path = self._write_transcript([_usage_entry(input_tokens=190_000)])
        orch = self._make_orch(transcript_path=path)
        self.assertIsNone(orch.handle_context_check())

    def test_external_loop_short_circuits(self):
        os.environ["WF_EXTERNAL_LOOP"] = "true"
        path = self._write_transcript([_usage_entry(input_tokens=190_000)])
        orch = self._make_orch(transcript_path=path)
        self.assertIsNone(orch.handle_context_check())

    def test_workflow_json_disable_short_circuits(self):
        # Per-project opt-out via workflow.json — no env-var gymnastics.
        # Even at 95% of a 200K window, contextMonitor.enabled=false wins.
        os.environ["WF_CONTEXT_LIMIT"] = "200000"
        wf = {
            "contextMonitor": {"enabled": False},
            "github": {"owner": "x", "repo": "y"},
        }
        (self.tmp / "workflow.json").write_text(json.dumps(wf))
        path = self._write_transcript([_usage_entry(input_tokens=190_000)])  # 95%
        orch = self._make_orch(transcript_path=path, cwd=str(self.tmp))
        self.assertIsNone(orch.handle_context_check())
        # State must not have been mutated either — opt-out is a clean no-op.
        self.assertFalse(orch.state["warning_shown"])
        self.assertFalse(orch.state["pre_compact_ran"])


if __name__ == "__main__":
    unittest.main()
