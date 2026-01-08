# Command Reference

## Session Management

### `/wf-start-session`
Start a development session with context loading.

**Actions:**
- Reads progress.md for previous session state
- Verifies environment (git status, dependencies)
- Runs init script if defined in workflow.json
- Shows open issues summary

### `/wf-end-session`
End session and save progress.

**Actions:**
- Updates progress.md with current state
- Archives old sessions
- Commits changes with summary
- Verifies clean git state

### `/wf-overview`
Quick status overview of current work state.

**Shows:**
- Progress file state
- Git status
- Open issues count
- Recent commits

---

## Development

### `/wf-implement [description]`
Build a new feature from description.

**Process:**
1. Loads context from progress.md
2. Checks existing patterns in codebase
3. Implements feature with tests
4. Can delegate to configured agents

### `/wf-fix-bug [issue-number|description]`
Debug and fix issues.

**Process:**
1. Reproduce the issue
2. Root cause analysis
3. Implement fix
4. Add regression test
5. Update documentation if needed

### `/wf-test [filter]`
Run tests and fix any failures.

**Auto-detects:**
- Node.js: `npm test`, `yarn test`, `pnpm test`
- Python: `pytest`, `unittest`
- Rust: `cargo test`

### `/wf-refactor [description]`
Restructure code without changing behavior.

**Safeguards:**
1. Runs tests before changes
2. Makes incremental changes
3. Confirms no functional regressions
4. Runs tests after each step

### `/wf-improve [description]`
Enhance existing code or feature quality.

### `/wf-debug [description]`
Deep investigation for complex issues.

**Features:**
- Evidence gathering
- Hypothesis formation
- Root cause analysis
- Solution validation

---

## Issue Management

### `/wf-pick-issue`
Select next issue to work on based on priority.

**Considers:**
- Labels (priority, type)
- Project context
- Dependencies

### `/wf-create-ticket [description]`
Create a GitHub Issue or Jira ticket from user story.

**Generates:**
- Well-structured title
- Acceptance criteria
- Labels
- Assignee

---

## Ticket Breakdown

### `/wf-breakdown [ticket]`
Break Jira/GitHub issue into sub-tasks.

**Process:**
1. Analyzes requirements
2. Fetches Figma designs if linked
3. Breaks into atomic tasks
4. Creates GitHub Issues for each
5. Assigns to appropriate agents

### `/wf-delegate [issue-number]`
Execute a sub-task with its assigned agent.

**Features:**
- Dependency checking
- Validation against acceptance criteria
- Progress tracking

### `/wf-ticket-status [parent-issue]`
Check implementation progress for a tracked ticket.

**Shows:**
- Task completion status
- Blocker detection
- Progress visualization

---

## Code Review

### `/wf-review [pr-number|recent]`
Review recent code changes or a specific PR.

**Checklist:**
- Correctness
- Code quality
- Best practices
- Test coverage
- Documentation

### `/wf-commit`
Create a conventional commit with proper formatting.

**Auto-detects:**
- Type (feat, fix, refactor, etc.)
- Scope from changed files
- Breaking changes

---

## Document Processing

### `/wf-create-prd [project-name]`
Create a PRD from scratch with guided questions.

**Options:**
- **PRD Scope**: Full PRD (complete) or Minimal (task-extraction only)
- **Guidance Level**: Heavy (10-15 questions) or Light (3-4 questions)

**Process:**
1. Checks for existing PRD.md (offers overwrite/append/cancel)
2. Asks scope and guidance preferences
3. Interactive Q&A based on choices
4. Generates structured PRD.md

**Output:** PRD.md compatible with `/wf-parse-prd`

### `/wf-parse-prd [file-path]`
Parse existing PRD and create parent issues.

**Process:**
1. Locates and reads PRD file
2. Extracts parent tasks from roadmap
3. Shows extracted tasks for confirmation
4. Creates GitHub Issues for approved tasks

**Next Step:** Use `/wf-breakdown #N` to break parent issues into sub-tasks

**Typical Workflows:**

```
# Starting fresh (PRD-first):
/wf-init → /wf-create-prd → /wf-parse-prd → /wf-generate → /wf-start-session

# Existing codebase:
/wf-init → /wf-generate → /wf-start-session
```

**Note**: `/wf-parse-prd` requires `workflow.json` for GitHub integration.

---

## Project Setup

### `/wf-init`
Bootstrap minimal workflow structure for a project.

**Creates:**
- `.claude/workflow.json` (generic template)
- `progress.md` (session tracking)
- `standards.md` (generic conventions)
- `.claude/agents/` directory (empty)
- `.claude/session-archive/` directory (empty)

**Does NOT create:**
- Agents (use `/wf-generate`)
- Skills (use `/wf-generate`)
- Stack-specific configurations

**Options:**
- Optionally configures GitHub owner/repo
- Optionally commits initial files

### `/wf-generate [--from-prd | --from-code | --ask]`
Generate agents and skills based on tech stack.

**Prerequisites:** Run `/wf-init` first.

**Stack Detection Sources:**
1. **PRD.md** - Reads "Technical Considerations" section
2. **Code detection** - Analyzes package.json, requirements.txt, etc.
3. **User input** - Ask user directly if neither available

**Modes:**
- `--from-prd` - Force read from PRD.md
- `--from-code` - Force detect from existing code
- `--ask` - Ask user to specify stack
- (default) - Auto-detect: try PRD first, then code, then ask

**Actions:**
1. Detects/reads tech stack
2. Updates `workflow.json` with scopes and agents config
3. Updates `standards.md` with stack-specific conventions
4. Creates agents in `.claude/agents/`
5. Creates skills in `.claude/skills/`

**If re-running with existing agents:**
- Asks user: Merge (keep existing + add new) or Replace (delete all, start fresh)
