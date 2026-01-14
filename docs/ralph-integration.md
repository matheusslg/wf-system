# Ralph Integration with wf-system

> Research conducted: 2026-01-14 (Session 7)

## Overview

Ralph is an external bash loop that repeatedly invokes Claude Code to process tasks. wf-system is an internal loop using hooks and commands within Claude Code. This document analyzes how they can work together.

---

## Architecture Comparison

| Aspect | Ralph | wf-system |
|--------|-------|-----------|
| **Loop location** | External (bash script) | Internal (stop hook + `--until-done`) |
| **Context handling** | Fresh each iteration | Single session until 75%, then compact |
| **Memory** | Git commits + task file | `progress.md` + git |
| **Task queue** | `tasks.md` (file) | GitHub Issues |
| **Test gate** | Bash checks `$?` | QA agent in pipeline |
| **Session boundary** | Each Claude invocation | `/wf-end-session` + `/compact` |

---

## How Ralph Works

```bash
#!/bin/bash
# Simplified Ralph loop
while true; do
  # 1. Read next task from task file
  TASK=$(head -1 tasks.md)

  # 2. Run Claude Code with the task
  claude --print "$TASK" --allowedTools "Bash,Read,Write,Edit"

  # 3. Check if tests pass
  npm test

  # 4. If pass, commit and remove task
  if [ $? -eq 0 ]; then
    git add -A && git commit -m "Completed: $TASK"
    sed -i '1d' tasks.md  # Remove completed task
  fi

  # 5. Loop continues
done
```

**Key characteristics:**
- External loop (bash controls the cycle)
- Fresh Claude context each iteration
- Git as memory between iterations
- Task file as the queue
- Tests as the gate

---

## Integration Options

### Option A: Ralph as Outer Loop, wf-system as Inner Logic

```bash
# ralph.sh
while true; do
  # Start Claude with wf-system context
  claude --print "/wf-delegate --until-done"

  # After Claude exits (context full or tasks done)
  sleep 5

  # Check if more tasks exist
  if [ ! -s .claude/tasks-remaining.md ]; then
    break
  fi
done
```

**Pros**: Best of both worlds - Ralph handles restarts, wf-system handles task management
**Cons**: Need coordination mechanism to know when to restart

### Option B: Pure Ralph (Replace wf-system loop)

Strip wf-system down to just:
- Task definitions (agents, standards)
- Single-task execution
- No internal loop

**Pros**: Simpler, aligns with Ralph philosophy
**Cons**: Lose Developer→Reviewer→QA pipeline per task

### Option C: Pure wf-system (No Ralph)

Current approach - rely on `/wf-end-session` + `/compact` to handle context limits.

**Pros**: Already works, no external script needed
**Cons**: Context limits still problematic, can't run truly unattended overnight

---

## Blockers and Required Changes

### 1. Context Management Conflict

| Issue | Details |
|-------|---------|
| **Problem** | wf-system tries to manage context internally (75% warning), Ralph expects fresh context each run |
| **Impact** | Running wf-system under Ralph would trigger context warnings that don't make sense |
| **Solution** | Add `--external-loop` flag that disables context warnings |

**Change needed in `wf-orchestrator.py`**:
```python
# Check for external loop mode (Ralph)
external_loop = os.environ.get("WF_EXTERNAL_LOOP", "false") == "true"
if external_loop:
    # Skip context warnings - Ralph handles restarts
    return None
```

### 2. Task Source Mismatch

| Issue | Details |
|-------|---------|
| **Problem** | Ralph uses `tasks.md` file, wf-system uses GitHub Issues |
| **Impact** | Different sources of truth for what to work on |
| **Solution** | Create sync or standardize on one |

**Options**:
- A) Ralph reads from GitHub Issues (use `gh` CLI) - **Recommended**
- B) wf-system reads from `tasks.md` (new mode)
- C) Bidirectional sync (complex)

### 3. Pipeline Incompatibility

| Issue | Details |
|-------|---------|
| **Problem** | Ralph expects: implement → test → commit. wf-system expects: Developer → Reviewer → QA |
| **Impact** | Pipeline would need to complete in ONE Claude session before Ralph restarts |
| **Solution** | Track pipeline state in git |

**Change needed**:
- Add `.claude/pipeline-state.json` that persists across Ralph restarts
- Ralph checks state before starting: "Is there a pending review for task X?"

### 4. Stop Hook vs Ralph Loop

| Issue | Details |
|-------|---------|
| **Problem** | wf-system's stop hook plays sounds and asks for input in `--until-done` mode |
| **Impact** | Would block Ralph's unattended execution |
| **Solution** | Add `--unattended` flag |

**Change needed in `wf-orchestrator.py`**:
```python
def handle_stop(self) -> int:
    # Check for unattended mode
    if os.environ.get("WF_UNATTENDED", "false") == "true":
        return 2  # Always continue
    # ... existing interactive logic
```

---

## Recommended Implementation Path

### Phase 1: Compatibility Mode
1. Add `WF_EXTERNAL_LOOP=true` env var to disable context warnings
2. Add `WF_UNATTENDED=true` env var to skip interactive prompts
3. Create `ralph-wf.sh` wrapper script

### Phase 2: Task Sync
1. Modify Ralph to use `gh issue list --label sub-task --state open`
2. Or create `/wf-export-tasks` command that writes GitHub Issues to `tasks.md`

### Phase 3: Pipeline Persistence
1. Add `.claude/pipeline-state.json` for cross-session state
2. Modify `/wf-delegate` to resume pipeline on restart

---

## Minimal Ralph + wf-system Script

```bash
#!/bin/bash
# ralph-wf.sh - Ralph-style loop using wf-system

export WF_EXTERNAL_LOOP=true
export WF_UNATTENDED=true

cd /path/to/project

while true; do
  echo "$(date): Starting Claude session"

  # Run wf-system to pick and execute next task
  claude --print "/wf-pick-issue && /wf-delegate --until-done" 2>&1 | tee -a ralph.log

  EXIT_CODE=$?
  echo "$(date): Claude exited with code $EXIT_CODE"

  # Check if any open tasks remain
  OPEN_TASKS=$(gh issue list --label sub-task --state open --json number | jq length)

  if [ "$OPEN_TASKS" -eq 0 ]; then
    echo "All tasks complete!"
    break
  fi

  # Brief pause before restart
  sleep 10
done
```

---

## Files to Modify for Full Integration

| File | Change |
|------|--------|
| `hooks/wf-orchestrator.py` | Add `WF_EXTERNAL_LOOP` and `WF_UNATTENDED` env vars |
| `commands/wf-delegate.md` | Handle pipeline state persistence |
| New: `scripts/ralph-wf.sh` | External loop script |
| New: `.claude/pipeline-state.json` | Cross-session pipeline tracking |

---

## Trade-offs

| Aspect | Ralph Approach | wf-system Approach |
|--------|---------------|-------------------|
| Token usage | Higher (no cache) | Lower (cache reuse) |
| Reliability | Higher (fresh start) | Lower (context corruption risk) |
| Speed | Slower (re-reads files) | Faster (cached context) |
| Complexity | Simpler | More complex |
| Overnight runs | Yes | Risky |

---

## SXRX-1054: Automate DEV Process

### Acceptance Criteria
1. When ticket moves to "prototype" status → trigger agent → build feature → deploy to ephemeral env → comment URL on Jira
2. Automatically address GitHub security issues

### SXRX Ephemeral Environment Architecture

```
Workspace: "ticket-1054"
├── API:      api-ticket-1054.sxrxprotocols.com
└── Frontend: app-ticket-1054.sxrxprotocols.com
```

**How it works:**
1. Add workspace to `.tf_workspaces` → terraform creates infra
2. Remove from `.tf_workspaces` → cleanup workflow destroys it

### Feasibility Assessment

| Component | Status | Notes |
|-----------|--------|-------|
| Ephemeral env infra | ✅ Already exists | Terraform workspaces + dedicated AWS account |
| Create env | ✅ Easy | Add workspace name to `.tf_workspaces`, push |
| Get URL | ✅ Predictable | `app-{workspace}.sxrxprotocols.com` |
| Destroy env | ✅ Automatic | Cleanup workflow handles it |
| Comment on Jira | ✅ Easy | Jira API |

### Implementation Estimate

| Task | Effort |
|------|--------|
| Jira webhook setup | 2h |
| GitHub workflow for prototype | 4h |
| wf-system Ralph compatibility flags | 2h |
| Testing | 4h |
| **Total** | **~12 hours** |

---

## References

- Article: "Claude Code + Ralph: How I Built an AI That Ships Production Code While I Sleep" (Medium, paywalled)
- SXRX IaC: `~/Documents/Gnarlysoft New/sxrx/sxrx-iac`
- Jira ticket: SXRX-1054
