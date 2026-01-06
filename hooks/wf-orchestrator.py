#!/usr/bin/env python3
"""
WF Orchestrator - Global Workflow Hook for Claude Code
=======================================================
Handles:
1. SessionStart simulation (first PostToolUse detection)
2. Context monitoring with /wf-end-session trigger at 75%
3. Stop hook with autonomy mode support (interactive checkpoint)
4. Workflow routing (Jira vs GitHub)

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

CONTEXT_LIMIT = 200_000
PRE_COMPACT_THRESHOLD = 75  # Trigger /wf-end-session
WARNING_THRESHOLD = 85      # Show warning
STATE_DIR = Path(os.path.expanduser("~/.claude/hooks/.wf-state"))
STATE_MAX_AGE_DAYS = 7      # Cleanup old state files


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
        # Jira: has techLead.jiraProject
        if config.get("techLead", {}).get("jiraProject"):
            return "jira"
        # GitHub: has github.owner or ticketing.platform == "github"
        if config.get("github", {}).get("owner"):
            return "github"
        if config.get("ticketing", {}).get("platform") == "github":
            return "github"
        return "unknown"

    # -------------------------------------------------------------------------
    # Context Monitoring
    # -------------------------------------------------------------------------

    def _get_context_usage(self) -> Tuple[int, float]:
        """Calculate token usage from transcript JSONL."""
        if not self.transcript_path or not os.path.exists(self.transcript_path):
            return 0, 0.0

        total_tokens = 0
        try:
            with open(self.transcript_path, 'r') as f:
                for line in f:
                    if not line.strip():
                        continue
                    try:
                        entry = json.loads(line)
                        usage = entry.get("usage", {})
                        total_tokens += usage.get("input_tokens", 0)
                        total_tokens += usage.get("output_tokens", 0)
                        total_tokens += usage.get("cache_creation_input_tokens", 0)
                    except json.JSONDecodeError:
                        continue
        except (IOError, FileNotFoundError):
            pass

        pct = (total_tokens / CONTEXT_LIMIT) * 100 if CONTEXT_LIMIT > 0 else 0
        return total_tokens, pct

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
    # Session Start Handling
    # -------------------------------------------------------------------------

    def handle_first_run(self) -> Optional[Dict]:
        """Handle first PostToolUse as session start simulation."""
        if self.state["first_run_handled"]:
            return None

        self.state["first_run_handled"] = True
        workflow = self._get_workflow_config()

        if workflow is None:
            # No workflow.json - prompt to initialize
            self._save_state()
            return {
                "hookSpecificOutput": {
                    "hookEventName": "PostToolUse",
                    "additionalContext": (
                        "SESSION START: No workflow configuration detected in this project.\n"
                        "Would you like to initialize the Claude workflow system?\n"
                        "Run `/wf-init-project` to set up progress tracking, standards, and agents.\n"
                        "Or continue without workflow management."
                    )
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
        jira_project = workflow.get("techLead", {}).get("jiraProject", "PROJECT")
        project_name = workflow.get("project", workflow.get("projectName", "Unknown"))

        return {
            "hookSpecificOutput": {
                "hookEventName": "PostToolUse",
                "additionalContext": (
                    f"SESSION START - Jira Workflow Detected\n"
                    f"Project: {project_name}\n"
                    f"Jira Project: {jira_project}\n\n"
                    f"Would you like to work on a Jira ticket?\n"
                    f"- Provide a ticket number (e.g., `{jira_project}-123`) to break it down with `/wf-tech-lead`\n"
                    f"- Or describe what you'd like to work on\n"
                    f"- Or run `/wf-start-session` for full context load"
                )
            }
        }

    def _handle_github_session_start(self, workflow: Dict) -> Dict:
        """GitHub workflow session start with WIP detection."""
        wip = self._check_progress_wip(workflow)
        github = workflow.get("github", {})
        owner = github.get("owner", "")
        repo = github.get("repo", "")
        repo_display = f"{owner}/{repo}" if owner and repo else "Unknown"

        if wip:
            return {
                "hookSpecificOutput": {
                    "hookEventName": "PostToolUse",
                    "additionalContext": (
                        f"SESSION START - Work In Progress Detected\n"
                        f"Repository: {repo_display}\n\n"
                        f"WIP: {wip}\n\n"
                        f"Recommended: Run `/wf-tech-lead-delegate` to continue with the assigned sub-task, "
                        f"or `/wf-start-session` for full context."
                    )
                }
            }
        else:
            return {
                "hookSpecificOutput": {
                    "hookEventName": "PostToolUse",
                    "additionalContext": (
                        f"SESSION START - GitHub Workflow\n"
                        f"Repository: {repo_display}\n\n"
                        f"No work in progress detected.\n"
                        f"Recommended: Run `/wf-pick-issue` to select the next task, "
                        f"or `/wf-start-session` for full context."
                    )
                }
            }

    # -------------------------------------------------------------------------
    # Context Check
    # -------------------------------------------------------------------------

    def handle_context_check(self) -> Optional[Dict]:
        """Check context usage and trigger /wf-end-session if needed."""
        tokens, pct = self._get_context_usage()

        if pct >= PRE_COMPACT_THRESHOLD and not self.state["pre_compact_ran"]:
            self.state["pre_compact_ran"] = True
            self._save_state()

            return {
                "hookSpecificOutput": {
                    "hookEventName": "PostToolUse",
                    "additionalContext": (
                        f"CRITICAL - CONTEXT AT {pct:.0f}%\n"
                        f"Tokens: {tokens:,}/{CONTEXT_LIMIT:,}\n\n"
                        f"YOU MUST run `/wf-end-session` NOW to:\n"
                        f"1. Save your progress to progress.md\n"
                        f"2. Commit current work\n"
                        f"3. Archive session state\n\n"
                        f"After /wf-end-session completes, run /compact to summarize."
                    )
                }
            }
        elif pct >= WARNING_THRESHOLD:
            return {
                "hookSpecificOutput": {
                    "hookEventName": "PostToolUse",
                    "additionalContext": (
                        f"WARNING: Context at {pct:.0f}% ({tokens:,} tokens). "
                        f"Consider running /wf-end-session and /compact soon."
                    )
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

        workflow = self._get_workflow_config()

        if not workflow:
            return 0  # No workflow - allow stop

        autonomy = workflow.get("autonomy", {})
        if not autonomy.get("enabled", False):
            return 0  # Autonomy disabled - allow stop

        # Autonomy enabled - interactive checkpoint
        tokens, pct = self._get_context_usage()

        # Play notification sound
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
