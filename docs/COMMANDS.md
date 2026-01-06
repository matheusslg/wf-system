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

## Tech Lead Mode

### `/wf-tech-lead [ticket]`
Analyze Jira/GitHub issue and break into sub-tasks.

**Process:**
1. Analyzes requirements
2. Fetches Figma designs if linked
3. Breaks into atomic tasks
4. Creates GitHub Issues for each
5. Assigns to appropriate agents

### `/wf-tech-lead-delegate [issue-number]`
Execute a GitHub issue sub-task with its assigned agent.

**Features:**
- Dependency checking
- Validation against acceptance criteria
- Progress tracking

### `/wf-tech-lead-status [parent-issue]`
Check implementation progress for Tech Lead tracked feature.

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

### `/wf-read-prd [file|url] [action]`
Parse Product Requirements Document.

**Actions:**
- `summary`: High-level overview
- `tasks`: Extract actionable tasks
- `issues`: Create issues from tasks
- `context`: Generate implementation context

---

## Project Setup

### `/wf-init-project`
Bootstrap workflow system for a project.

**Creates:**
- `.claude/workflow.json`
- `progress.md`
- `standards.md`
- Agent definitions
- Stack-specific skills
