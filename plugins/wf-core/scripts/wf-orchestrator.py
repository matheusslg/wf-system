#!/usr/bin/env python3
"""
WF Orchestrator - Global Workflow Hook for Claude Code
=======================================================
Handles:
1. SessionStart simulation (first PostToolUse detection)
2. Context monitoring: warning at 75%, /wf-end-session trigger at 90% (configurable)
3. Stop hook with autonomy mode support (interactive checkpoint)
4. Workflow routing (Jira vs GitHub)

Context monitoring reads token usage straight from the transcript JSONL —
no subprocess `claude -p -r /context` extraction (recursive, brittle, format
drifts). The window size auto-calibrates from observed peak usage against
standard Anthropic tiers (200K / 1M / 2M); override via the `WF_CONTEXT_LIMIT`
env var or a `contextLimit` field in `workflow.json` for per-project pinning.

Usage:
  PostToolUse: python3 wf-orchestrator.py
  Stop:        python3 wf-orchestrator.py --mode=stop
"""

import sys
import json
import os
import subprocess
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Tuple

# =============================================================================
# CONFIGURATION
# =============================================================================

# Conservative default when no override applies and observed usage hasn't yet
# tripped self-calibration past the 200K mark. Resolved per-call via
# `_resolve_context_window`, never read directly by the hook output paths.
DEFAULT_CONTEXT_LIMIT = 200_000

# Standard Anthropic context-window tiers, ascending. When observed peak
# usage exceeds the previous tier we infer the next-up — handles new models
# and extended-context variants without a model-name maintenance dict.
# Update this tuple if Anthropic ships a new tier (one-line data change,
# not a code change).
STANDARD_TIERS: Tuple[int, ...] = (200_000, 1_000_000, 2_000_000)

# Default thresholds (can be overridden via env vars below)
DEFAULT_WARNING_THRESHOLD = 75   # Friendly heads-up
DEFAULT_CRITICAL_THRESHOLD = 90  # Trigger /wf-end-session
# State dir lives outside the plugin so it survives reinstalls/updates.
STATE_DIR = Path(os.path.expanduser("~/.wf-state"))
STATE_MAX_AGE_DAYS = 7      # Cleanup old state files
PROGRESS_LINE_LIMIT = 450   # Warn if progress.md exceeds this

# Plugin self-locates via the Claude Code plugin env var.
_PLUGIN_ROOT = os.environ.get("CLAUDE_PLUGIN_ROOT")
if _PLUGIN_ROOT:
    PLUGIN_ROOT = Path(_PLUGIN_ROOT)
else:
    # Fallback so the script is still runnable outside a plugin context (e.g., tests).
    PLUGIN_ROOT = Path(__file__).resolve().parent.parent


class WFOrchestrator:
    """Main orchestrator class for workflow hooks."""

    def __init__(self, hook_input: Dict[str, Any]):
        self.hook_input = hook_input
        self.session_id = hook_input.get("session_id", "unknown")
        self.transcript_path = hook_input.get("transcript_path")
        self.cwd = hook_input.get("cwd", os.getcwd())
        self.stop_hook_active = hook_input.get("stop_hook_active", False)
        self.state = self._load_state()
        self._cleanup_old_states()

    # -------------------------------------------------------------------------
    # State Management
    # -------------------------------------------------------------------------

    def _load_state(self) -> Dict[str, Any]:
        """Load session state from disk."""
        STATE_DIR.mkdir(parents=True, exist_ok=True)
        state_file = STATE_DIR / f"{self.session_id}.json"
        if state_file.exists():
            try:
                return json.loads(state_file.read_text())
            except (json.JSONDecodeError, IOError):
                pass
        return {
            "first_run_handled": False,
            "pre_compact_ran": False,
            "warning_shown": False,
            "workflow_detected": None,
            "session_start": datetime.now().isoformat()
        }

    def _save_state(self):
        """Save session state to disk."""
        state_file = STATE_DIR / f"{self.session_id}.json"
        state_file.write_text(json.dumps(self.state, indent=2))

    def _cleanup_old_states(self):
        """Remove state files older than STATE_MAX_AGE_DAYS."""
        try:
            cutoff = datetime.now() - timedelta(days=STATE_MAX_AGE_DAYS)
            for state_file in STATE_DIR.glob("*.json"):
                if state_file.stat().st_mtime < cutoff.timestamp():
                    state_file.unlink()
        except Exception:
            pass  # Ignore cleanup errors

    # -------------------------------------------------------------------------
    # Workflow Detection
    # -------------------------------------------------------------------------

    def _get_workflow_config(self) -> Optional[Dict[str, Any]]:
        """Find and parse workflow.json in current project."""
        # Try multiple locations
        search_paths = [
            Path(self.cwd) / ".claude" / "workflow.json",
            Path(self.cwd) / "workflow.json",
        ]

        # Also check parent directories (up to 3 levels)
        current = Path(self.cwd)
        for _ in range(3):
            parent = current.parent
            if parent == current:
                break
            search_paths.append(parent / ".claude" / "workflow.json")
            current = parent

        for path in search_paths:
            if path.exists():
                try:
                    return json.loads(path.read_text())
                except (json.JSONDecodeError, IOError):
                    pass
        return None

    def _detect_workflow_type(self, config: Dict[str, Any]) -> str:
        """Detect if Jira or GitHub workflow."""
        # Jira: has breakdown.jiraProject
        if config.get("breakdown", {}).get("jiraProject"):
            return "jira"
        # GitHub: has github.owner
        if config.get("github", {}).get("owner"):
            return "github"
        return "unknown"

    # -------------------------------------------------------------------------
    # Context Monitoring
    # -------------------------------------------------------------------------

    def _resolve_context_window(self, observed_max: int) -> int:
        """Resolve the active context-window size in tokens.

        Resolution order (first match wins):

        1. `WF_CONTEXT_LIMIT` env var when set + parseable as a positive int.
           Hard escape hatch — overrides everything else.
        2. `contextLimit` field in the project's `workflow.json` if present
           and a positive int. Per-project pin without env-var gymnastics.
        3. Self-calibration: when `observed_max` exceeds 200K we know the
           session is on an extended-context tier; pick the smallest
           `STANDARD_TIERS` entry that is >= observed_max. Falls through
           to the largest tier when observed exceeds even that.
        4. Default 200K — conservative, matches the standard tier most
           sessions still ship with.

        The function takes only `observed_max` by design — Claude Code's
        on-disk transcript / stats-cache do NOT expose the active window
        anywhere reliable, and a model-name dict would need updating on
        every release. Self-calibration handles new models for free.
        """
        env = os.environ.get("WF_CONTEXT_LIMIT")
        if env:
            try:
                n = int(env)
                if n > 0:
                    return n
            except ValueError:
                pass

        config = self._get_workflow_config()
        if config:
            cl = config.get("contextLimit")
            if isinstance(cl, int) and cl > 0:
                return cl

        if observed_max > 200_000:
            for tier in STANDARD_TIERS:
                if tier >= observed_max:
                    return tier
            return STANDARD_TIERS[-1]

        return DEFAULT_CONTEXT_LIMIT

    def _get_context_usage(self) -> Tuple[int, float, int]:
        """Read token usage from the transcript JSONL.

        Walks the transcript and finds the LAST entry carrying
        `message.usage`. The running context occupancy at that turn is:

            input_tokens + cache_creation_input_tokens + cache_read_input_tokens

        Per Anthropic's API docs that sum is "tokens the model received
        this turn" — equivalent to the model's context occupancy at that
        turn (system prompt + tools + history + new input + cache). The
        previous implementation missed `cache_creation_input_tokens`
        entirely.

        Also tracks the running max across the whole transcript so the
        window resolver can self-calibrate even mid-conversation when
        the latest turn happens to be small.

        Returns `(latest, percent, resolved_window)`. Empty/missing
        transcript → `(0, 0.0, default_window)`.
        """
        if not self.transcript_path or not os.path.exists(self.transcript_path):
            window = self._resolve_context_window(observed_max=0)
            return 0, 0.0, window

        latest_context = 0
        observed_max = 0
        try:
            with open(self.transcript_path, "r") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        entry = json.loads(line)
                    except json.JSONDecodeError:
                        # Malformed line — skip; partial-write tail is the
                        # common case here, not a hard failure.
                        continue
                    usage = entry.get("message", {}).get("usage")
                    if not isinstance(usage, dict):
                        continue
                    total = (
                        int(usage.get("input_tokens", 0) or 0)
                        + int(usage.get("cache_creation_input_tokens", 0) or 0)
                        + int(usage.get("cache_read_input_tokens", 0) or 0)
                    )
                    if total <= 0:
                        continue
                    latest_context = total
                    if total > observed_max:
                        observed_max = total
        except (IOError, FileNotFoundError):
            pass

        window = self._resolve_context_window(observed_max=observed_max)
        pct = (latest_context / window) * 100 if window > 0 else 0.0
        return latest_context, pct, window

    # -------------------------------------------------------------------------
    # Progress Detection
    # -------------------------------------------------------------------------

    def _get_progress_file_path(self, config: Optional[Dict[str, Any]]) -> Optional[Path]:
        """Find progress file path."""
        progress_names = ["progress.md", "claude-progress.md"]

        # Check config for custom name
        if config:
            custom_name = config.get("progressFile")
            if custom_name:
                progress_names.insert(0, custom_name)

        for name in progress_names:
            path = Path(self.cwd) / name
            if path.exists():
                return path
        return None

    def _check_progress_size(self, config: Optional[Dict[str, Any]]) -> Optional[int]:
        """Check progress.md line count. Returns line count if over limit, None otherwise."""
        progress_path = self._get_progress_file_path(config)
        if not progress_path:
            return None

        try:
            line_count = len(progress_path.read_text().splitlines())
            if line_count > PROGRESS_LINE_LIMIT:
                return line_count
        except (IOError, FileNotFoundError):
            pass
        return None

    def _check_progress_wip(self, config: Optional[Dict[str, Any]]) -> Optional[str]:
        """Check progress.md for work in progress."""
        progress_path = self._get_progress_file_path(config)
        if not progress_path:
            return None

        try:
            content = progress_path.read_text()

            # Look for "In Progress" or "Current Task" sections
            markers = ["## In Progress", "## Current Task", "### In Progress", "**In Progress**"]
            for marker in markers:
                if marker in content:
                    # Extract the section
                    section = content.split(marker)[1].split("##")[0]
                    for line in section.split("\n"):
                        line = line.strip()
                        if line.startswith("- ") and "None" not in line and "N/A" not in line:
                            return line[2:]  # Return first WIP item

            # Also check for issue references like "Working on #123"
            import re
            match = re.search(r'Working on [#\w-]+\d+', content)
            if match:
                return match.group(0)

        except (IOError, FileNotFoundError):
            pass
        return None

    # -------------------------------------------------------------------------
    # Brain Integration
    # -------------------------------------------------------------------------

    def _brain_search(self, keywords: str, limit: int = 5) -> Optional[str]:
        """Search the brain for relevant knowledge."""
        if not keywords or not keywords.strip():
            return None
        try:
            cli_path = Path.home() / ".claude" / "scripts" / "wf-brain.js"

            if not cli_path.exists():
                return None

            result = subprocess.run(
                ["node", str(cli_path), "search", keywords, "--limit", str(limit)],
                capture_output=True, text=True, timeout=10, cwd=self.cwd
            )
            if result.returncode != 0:
                return None

            entries = json.loads(result.stdout.strip())
            if not entries or not isinstance(entries, list):
                return None

            lines = ["Brain Context (auto-retrieved):"]
            for entry in entries:
                cat = entry.get("category", "")
                content = entry.get("content", "")
                match_pct = entry.get("matchPercent", "")
                lines.append(f"- [{cat}] ({match_pct}% match) {content}")

            return "\n".join(lines)
        except (subprocess.TimeoutExpired, FileNotFoundError, json.JSONDecodeError, Exception):
            return None

    # -------------------------------------------------------------------------
    # Session Start Handling
    # -------------------------------------------------------------------------

    def handle_first_run(self) -> Optional[Dict]:
        """Handle first PostToolUse as session start simulation."""
        if self.state["first_run_handled"]:
            return None

        # Skip session prompts in external loop mode (Ralph provides instructions)
        if os.environ.get("WF_EXTERNAL_LOOP", "false") == "true":
            self.state["first_run_handled"] = True
            self._save_state()
            return None

        self.state["first_run_handled"] = True
        workflow = self._get_workflow_config()

        if workflow is None:
            # No workflow.json - prompt to initialize
            self._save_state()
            msg = (
                "SESSION START: No workflow configuration detected.\n"
                "Run `/wf-init` to set up progress tracking, standards, and agents."
            )
            return {
                "systemMessage": msg,
                "hookSpecificOutput": {
                    "hookEventName": "PostToolUse",
                    "additionalContext": msg
                }
            }

        # Workflow exists - detect type and route
        wf_type = self._detect_workflow_type(workflow)
        self.state["workflow_detected"] = wf_type
        self._save_state()

        if wf_type == "jira":
            return self._handle_jira_session_start(workflow)
        elif wf_type == "github":
            return self._handle_github_session_start(workflow)
        else:
            return None

    def _handle_jira_session_start(self, workflow: Dict) -> Dict:
        """Jira workflow session start prompt."""
        jira_project = workflow.get("breakdown", {}).get("jiraProject", "PROJECT")
        project_name = workflow.get("project", workflow.get("projectName", "Unknown"))
        progress_lines = self._check_progress_size(workflow)

        # Build progress warning if needed
        progress_warning = ""
        if progress_lines:
            progress_warning = (
                f"\n\n⚠️ WARNING: progress.md has {progress_lines} lines (limit: {PROGRESS_LINE_LIMIT}). "
                f"Run `/wf-end-session` to archive old sessions."
            )

        # Brain integration
        brain_context = ""
        brain_search = self._brain_search(project_name)
        if brain_search:
            brain_context = f"\n\n{brain_search}"



        msg = f"[WF] Jira: {project_name} ({jira_project}) - Run /wf-start-session or provide ticket"
        full_context = (
            f"SESSION START - Jira Workflow Detected\n"
            f"Project: {project_name}\n"
            f"Jira Project: {jira_project}\n\n"
            f"Would you like to work on a Jira ticket?\n"
            f"- Provide a ticket number (e.g., `{jira_project}-123`) to break it down with `/wf-breakdown`\n"
            f"- Or describe what you'd like to work on\n"
            f"- Or run `/wf-start-session` for full context load{progress_warning}"
            f"{brain_context}"
        )
        return {
            "systemMessage": msg,
            "hookSpecificOutput": {
                "hookEventName": "PostToolUse",
                "additionalContext": full_context
            }
        }

    def _handle_github_session_start(self, workflow: Dict) -> Dict:
        """GitHub workflow session start with WIP detection."""
        wip = self._check_progress_wip(workflow)
        progress_lines = self._check_progress_size(workflow)
        github = workflow.get("github", {})
        owner = github.get("owner", "")
        repo = github.get("repo", "")
        repo_display = f"{owner}/{repo}" if owner and repo else "Unknown"

        # Build progress warning if needed
        progress_warning = ""
        if progress_lines:
            progress_warning = (
                f"\n\n⚠️ WARNING: progress.md has {progress_lines} lines (limit: {PROGRESS_LINE_LIMIT}). "
                f"Run `/wf-end-session` to archive old sessions."
            )

        # Brain integration — inject relevant knowledge
        brain_context = ""
        if wip:
            brain_search = self._brain_search(wip)
            if brain_search:
                brain_context = f"\n\n{brain_search}"



        if wip:
            msg = f"[WF] {repo_display} - WIP: {wip[:50]}{'...' if len(wip) > 50 else ''}"
            full_context = (
                f"SESSION START - Work In Progress Detected\n"
                f"Repository: {repo_display}\n\n"
                f"WIP: {wip}\n\n"
                f"Recommended: Run `/wf-delegate` to continue with the assigned sub-task, "
                f"or `/wf-start-session` for full context.{progress_warning}"
                f"{brain_context}"
            )
            return {
                "systemMessage": msg,
                "hookSpecificOutput": {
                    "hookEventName": "PostToolUse",
                    "additionalContext": full_context
                }
            }
        else:
            msg = f"[WF] {repo_display} - No WIP. Run /wf-start-session or /wf-pick-issue"
            full_context = (
                f"SESSION START - GitHub Workflow\n"
                f"Repository: {repo_display}\n\n"
                f"No work in progress detected.\n"
                f"Recommended: Run `/wf-pick-issue` to select the next task, "
                f"or `/wf-start-session` for full context.{progress_warning}"
                f"{brain_context}"
            )
            return {
                "systemMessage": msg,
                "hookSpecificOutput": {
                    "hookEventName": "PostToolUse",
                    "additionalContext": full_context
                }
            }

    # -------------------------------------------------------------------------
    # Context Check
    # -------------------------------------------------------------------------

    def _resolve_threshold(self, env_var: str, default: int) -> int:
        """Read an int threshold from env var, falling back to default if unset/invalid."""
        raw = os.environ.get(env_var)
        if raw is None:
            return default
        try:
            value = int(raw)
            if 1 <= value <= 100:
                return value
        except ValueError:
            pass
        return default

    def handle_context_check(self) -> Optional[Dict]:
        """Check context usage and emit tiered warning/critical messages."""
        # Skip if session-handoff.py handles context monitoring
        if os.environ.get("WF_DISABLE_CONTEXT_CHECK", "false") == "true":
            return None
        # Skip context warnings in external loop mode (Ralph handles restarts)
        if os.environ.get("WF_EXTERNAL_LOOP", "false") == "true":
            return None

        warning_threshold = self._resolve_threshold(
            "WF_CONTEXT_WARNING_THRESHOLD", DEFAULT_WARNING_THRESHOLD
        )
        critical_threshold = self._resolve_threshold(
            "WF_CONTEXT_CRITICAL_THRESHOLD", DEFAULT_CRITICAL_THRESHOLD
        )

        tokens, pct, limit = self._get_context_usage()

        # Auto-reset state when usage drops well below the warning floor.
        # After a /compact the running token count drops; on the next
        # tick the warning/critical flags should clear so a fresh
        # expansion gets a fresh warning. The 0.9 buffer prevents
        # oscillation when usage hovers near the threshold.
        reset_floor = warning_threshold * 0.9
        if pct < reset_floor and (
            self.state.get("warning_shown", False)
            or self.state.get("pre_compact_ran", False)
        ):
            self.state["warning_shown"] = False
            self.state["pre_compact_ran"] = False
            self._save_state()

        # Warning takes priority on the FIRST crossing — even if the
        # session resumes already past critical, the user gets the
        # 75% heads-up before the 90% lockdown. Earlier ordering
        # (`critical` first) caused inflated readings to skip the
        # warning entirely, which was Pietro's reported symptom.
        if pct >= warning_threshold and not self.state.get("warning_shown", False):
            self.state["warning_shown"] = True
            self._save_state()

            msg = f"[WF] Context at {pct:.0f}% — consider wrapping up this task soon."
            full_context = (
                f"⚠️ Context usage: {pct:.0f}%\n"
                f"Tokens: {tokens:,}/{limit:,}\n\n"
                f"You're past the comfortable working zone. Consider:\n"
                f"- Finishing the current task before starting a new one\n"
                f"- Running /wf-end-session when you reach a natural stopping point\n\n"
                f"Critical threshold is {critical_threshold}% — I'll remind you again then."
            )
            return {
                "systemMessage": msg,
                "hookSpecificOutput": {
                    "hookEventName": "PostToolUse",
                    "additionalContext": full_context
                }
            }
        elif pct >= critical_threshold and not self.state["pre_compact_ran"]:
            self.state["pre_compact_ran"] = True
            self._save_state()

            msg = f"[WF] ⛔ CRITICAL: Context at {pct:.0f}% - MUST CALL SKILL /wf-end-session NOW"
            full_context = (
                f"⛔ CONTEXT LIMIT CRITICAL - {pct:.0f}%\n"
                f"Tokens: {tokens:,}/{limit:,}\n\n"
                f"INVOKE THE SKILL: Use the Skill tool with skill='wf-end-session'\n"
                f"DO NOT manually update progress.md - the skill handles everything.\n\n"
                f"The /wf-end-session skill will:\n"
                f"1. Save progress to progress.md\n"
                f"2. Commit current work\n"
                f"3. Archive session state\n\n"
                f"After /wf-end-session completes, run /compact to summarize."
            )
            return {
                "systemMessage": msg,
                "hookSpecificOutput": {
                    "hookEventName": "PostToolUse",
                    "additionalContext": full_context
                }
            }

        return None

    # -------------------------------------------------------------------------
    # Stop Hook (Autonomy Mode)
    # -------------------------------------------------------------------------

    def handle_stop(self) -> int:
        """
        Handle Stop hook - returns exit code.
        Exit 0 = allow stop
        Exit 2 = block stop (continue working)
        """
        # Prevent infinite loops
        if self.stop_hook_active:
            return 0

        # Unattended mode (Ralph) - always continue without prompting
        if os.environ.get("WF_UNATTENDED", "false") == "true":
            return 2

        workflow = self._get_workflow_config()

        if not workflow:
            return 0  # No workflow - allow stop

        autonomy = workflow.get("autonomy", {})
        if not autonomy.get("enabled", False):
            return 0  # Autonomy disabled - allow stop

        # Autonomy enabled - interactive checkpoint
        tokens, pct, _limit = self._get_context_usage()

        # Play notification sound (macOS only; silent on Linux/Windows)
        if sys.platform == "darwin":
            try:
                subprocess.Popen(
                    ["afplay", "/System/Library/Sounds/Glass.aiff"],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )
            except Exception:
                pass

        print("\n" + "=" * 50)
        print("  CHECKPOINT: Task completed")
        print("=" * 50)

        if pct > 40:
            level = "CRITICAL" if pct >= 80 else "WARNING" if pct >= 60 else "INFO"
            print(f"\n[{level}] Context: {pct:.0f}% used ({tokens:,} tokens)")

        print("\nOptions:")
        print("  [Enter] or 'c' = Continue to next task")
        print("  's' or 'stop'  = Stop here")
        print("  'r' or 'review'= Show progress")
        print()

        try:
            response = input("> ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            return 0

        if response in ("", "c", "continue", "go", "y", "yes"):
            # Block stop - continue working
            print("User approved. Continue with next sub-task in the queue.", file=sys.stderr)
            return 2
        elif response in ("r", "review", "status"):
            # Show progress then ask again
            progress_path = self._get_progress_file_path(workflow)
            if progress_path and progress_path.exists():
                print("\n--- Progress ---")
                content = progress_path.read_text()
                # Show first ~80 lines
                lines = content.split("\n")[:80]
                print("\n".join(lines))
                if len(content.split("\n")) > 80:
                    print("\n... (truncated)")
                print("---\n")

            try:
                response2 = input("Continue? [Enter=yes, s=stop] > ").strip().lower()
            except (EOFError, KeyboardInterrupt):
                return 0

            if response2 in ("s", "stop", "n", "no"):
                return 0
            else:
                print("Continuing with next task.", file=sys.stderr)
                return 2
        else:
            # Unknown - stop to be safe
            print("Stopping.")
            return 0

    # -------------------------------------------------------------------------
    # Main Entry Points
    # -------------------------------------------------------------------------

    def run_post_tool_use(self) -> Optional[Dict]:
        """Main PostToolUse handler."""
        # First run handling (session start simulation)
        first_run_output = self.handle_first_run()
        if first_run_output:
            return first_run_output

        # Context monitoring
        context_output = self.handle_context_check()
        if context_output:
            return context_output

        return None


def main():
    # Parse arguments
    mode = "post_tool_use"
    for arg in sys.argv[1:]:
        if arg == "--mode=stop":
            mode = "stop"

    # Read hook input from stdin
    try:
        hook_input = json.loads(sys.stdin.read())
    except (json.JSONDecodeError, ValueError):
        hook_input = {}

    orchestrator = WFOrchestrator(hook_input)

    if mode == "stop":
        exit_code = orchestrator.handle_stop()
        sys.exit(exit_code)
    else:
        output = orchestrator.run_post_tool_use()
        if output:
            print(json.dumps(output))
        sys.exit(0)


if __name__ == "__main__":
    main()
