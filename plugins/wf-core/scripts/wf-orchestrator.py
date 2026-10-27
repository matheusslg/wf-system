#!/usr/bin/env python3
"""
WF Orchestrator - Global Workflow Hook for Claude Code
=======================================================
Handles:
1. SessionStart simulation (first PostToolUse detection)
2. Stop hook with autonomy mode support (interactive checkpoint)
3. Workflow routing (Jira vs GitHub)

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
from typing import Optional, Dict, Any

# =============================================================================
# CONFIGURATION
# =============================================================================

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
                "Run `/wf-core:wf-init` to set up progress tracking, standards, and agents."
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
                f"Run `/wf-core:wf-end-session` to archive old sessions."
            )

        msg = f"[WF] Jira: {project_name} ({jira_project}) - Run /wf-core:wf-start-session or provide ticket"
        full_context = (
            f"SESSION START - Jira Workflow Detected\n"
            f"Project: {project_name}\n"
            f"Jira Project: {jira_project}\n\n"
            f"Would you like to work on a Jira ticket?\n"
            f"- Provide a ticket number (e.g., `{jira_project}-123`) to break it down with `/wf-core:wf-breakdown`\n"
            f"- Or describe what you'd like to work on\n"
            f"- Or run `/wf-core:wf-start-session` for full context load{progress_warning}"
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
                f"Run `/wf-core:wf-end-session` to archive old sessions."
            )

        if wip:
            msg = f"[WF] {repo_display} - WIP: {wip[:50]}{'...' if len(wip) > 50 else ''}"
            full_context = (
                f"SESSION START - Work In Progress Detected\n"
                f"Repository: {repo_display}\n\n"
                f"WIP: {wip}\n\n"
                f"Recommended: Run `/wf-core:wf-delegate` to continue with the assigned sub-task, "
                f"or `/wf-core:wf-start-session` for full context.{progress_warning}"
            )
            return {
                "systemMessage": msg,
                "hookSpecificOutput": {
                    "hookEventName": "PostToolUse",
                    "additionalContext": full_context
                }
            }
        else:
            msg = f"[WF] {repo_display} - No WIP. Run /wf-core:wf-start-session or /wf-core:wf-pick-issue"
            full_context = (
                f"SESSION START - GitHub Workflow\n"
                f"Repository: {repo_display}\n\n"
                f"No work in progress detected.\n"
                f"Recommended: Run `/wf-core:wf-pick-issue` to select the next task, "
                f"or `/wf-core:wf-start-session` for full context.{progress_warning}"
            )
            return {
                "systemMessage": msg,
                "hookSpecificOutput": {
                    "hookEventName": "PostToolUse",
                    "additionalContext": full_context
                }
            }

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
        return self.handle_first_run()


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
