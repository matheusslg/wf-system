# Command Reference

## Session Management

### `/wf-start-session`
Start a development session with context loading.

**Actions:**
- Checks MCP availability (GitHub, Figma if configured)
- Reads progress.md for previous session state
- Verifies environment (git status, dependencies)
- Runs init script if defined in workflow.json
- Shows open issues summary
- Reports MCP status in session summary

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

### `/wf-investigate [question|--deep topic]`
Explore codebase to understand how things work.

**Use this when** you need to understand something, not fix something broken (use `/wf-debug` for that).

**Modes:**
- **Quick** (default): Answer a specific question about the codebase with file references
- **Deep** (`--deep`): Full architectural analysis of a system or feature

**Quick mode features:**
- Keyword extraction and targeted search
- File reading and execution flow tracing
- Direct answers with `file:line` references

**Deep mode features:**
- System boundary identification
- Entry point mapping
- Data flow tracing
- Pattern documentation
- Dependency analysis

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

### `/wf-delegate [issue-number] [flags]`
Execute a sub-task with its assigned agent.

**Flags:**
- `--list` - List available sub-tasks
- `--until-done` - Autonomous mode: process ALL sub-tasks without intervention
- `--force` - Override dependency checks

**Features:**
- Automatic pipeline enforcement (Developer → Reviewer → QA)
- Dependency checking
- Validation against acceptance criteria
- Progress tracking

**Autonomous Mode** (`--until-done`):
- Processes all open sub-tasks automatically
- Respects task dependencies (processes in correct order)
- Enforces review/QA pipeline for each task
- Stops on critical errors, can be resumed

### `/wf-team-delegate [issue-number] [flags]`
Execute sub-tasks using Agent Teams for persistent pipeline delegation.

**When to use this vs `/wf-delegate`:**
- Use `/wf-team-delegate` when tasks require review/QA feedback loops (teammates keep context)
- Use `/wf-team-delegate --until-done` for multi-task pipelines (parallel developer teammates)
- Use `/wf-delegate` as a stable fallback if Agent Teams misbehaves

**Flags:**
- `--list` - List available sub-tasks
- `--until-done` - Autonomous mode: process ALL sub-tasks using persistent teammates
- `--force` - Override dependency checks

**Features:**
- Persistent teammates retain context across retries (no re-discovery overhead)
- Direct DMs between reviewer/QA and developer for feedback loops
- Parallel developer teammates for independent tasks (up to `maxDeveloperTeammates`)
- Automatic pipeline enforcement (Developer → Reviewer → QA)
- Retry tracking with escalation after 3 failures
- Automatic team cleanup on completion or error

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

### `/wf-pre-prod-review [PR|branch|commit-range]`
Multi-agent pre-production audit to validate code is production-ready.

**This is READ-ONLY. No code is modified.**

**Process:**
1. Determines review scope (PR, branch, or commit range)
2. Reads all changed files and gathers context
3. Selects relevant review dimensions based on what changed
4. Spawns parallel independent review agents per dimension
5. Consolidates findings into a production readiness report

**Review dimensions** (spawned only when relevant):
- Code Quality & Logic (always)
- Security
- Performance & Scalability
- Error Handling & Resilience
- Testing & Coverage Gaps
- Database & Migrations
- API Contract & Compatibility
- Infrastructure & Deployment
- Dependency Audit
- Accessibility

**Verdicts:** READY FOR PRODUCTION / NEEDS ATTENTION / NOT READY

### `/wf-team-review [PR|branch|commit-range] [--no-debate]`
Adversarial multi-agent pre-production review with cross-examination.

**This is READ-ONLY. No code is modified.**

Goes beyond `/wf-pre-prod-review` by adding a cross-examination phase where reviewers challenge each other's findings.

**Phases:**
1. **Independent Review** — Each dimension reviews in parallel (same as `/wf-pre-prod-review`)
2. **Cross-Examination** — Reviewers challenge false positives, flag cross-cutting concerns, and debate contentious findings via direct DMs

**Flags:**
- `--no-debate` - Skip cross-examination (behaves like `/wf-pre-prod-review` with Agent Teams)

**Report includes:**
- Disputed findings with resolution status
- Cross-cutting concerns spanning multiple dimensions
- Verdict changes between Phase 1 and Phase 2

### `/wf-pr-comments [PR-number|all]`
Evaluate, fix, and respond to PR review comments.

**Process:**
1. Fetches pending review comments (CodeRabbitAI, human reviewers)
2. Evaluates each comment (should fix vs won't fix)
3. Spawns sub-agents to implement valid fixes
4. Replies to won't-fix comments with explanations
5. Replies to fixed comments confirming the change

**Flags:**
- `--evaluate-only` - Show evaluation without implementing fixes
- `--no-replies` - Implement fixes but don't reply to comments
- `--repo <owner/repo>` - Specify repository

### `/wf-qa-plan [ticket]`
Generate a structured QA test plan from a ticket and post it as a comment.

**This command reads code and tickets — it does NOT modify source code.**

**Process:**
1. Fetches ticket details (Jira or GitHub)
2. Identifies the implementation branch/PR
3. Spawns parallel analysis agents per changed area (backend, frontend, mobile, infra)
4. Consolidates findings into a structured test plan
5. Posts the test plan as a comment on the ticket

**Test plan includes:**
- Prerequisites (environment, accounts, test data)
- Functional test cases grouped by area and user role
- Step-by-step instructions with expected results
- Edge cases and regression tests

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

**MCP Prerequisites Check:**
- Checks for GitHub MCP (recommended for issue management)
- Lists optional MCPs (Figma, Context7)
- Allows continuing without MCPs (limited functionality)

**Creates:**
- `.claude/workflow.json` (generic template)
- `progress.md` (session tracking)
- `standards.md` (generic conventions)
- `.claude/agents/` directory (empty)
- `.claude/skills/` directory (empty)
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

### `/wf-create-agent [description]`
Create a custom agent with specified expertise, skills, and tools.

**Process:**
1. Gathers agent information (interactively or from arguments)
2. Determines agent name, tools, model, and responsibilities
3. Optionally creates custom skills for the agent
4. Generates agent file in `.claude/agents/`
5. Updates `workflow.json` with agent mapping

**Examples:**
```
/wf-create-agent security specialist for vulnerability scanning
/wf-create-agent database administrator for migrations and queries
/wf-create-agent technical writer for API docs
```

### `/wf-update`
Check for and apply wf-system updates.

**Process:**
1. Checks installed version vs latest remote version
2. Displays changelog for new version
3. Asks user to confirm update
4. Applies update (git pull for symlink, reinstall for copy)
5. Syncs project scripts if needed (e.g., jira-cli.sh)

### `/wf-design-setup`
Configure detailed design resources for the project.

**Prerequisites:** Run `/wf-init` first.

**MCP Check:**
- Checks for Figma MCP before Figma configuration
- If Figma MCP not available: offers to continue with design system only, or cancel to install first

**Configures:**
- **Figma integration** - File keys, node IDs, key frames (requires Figma MCP)
- **Design system** - Shadcn, MUI, Tailwind, custom, etc.
- **Style guide** - Creates `docs/STYLE_GUIDE.md` or links existing
- **Design tokens** - Extracts from Figma or creates manually

**Updates:**
- `workflow.json` - Adds `design` section
- `standards.md` - Adds design standards
- Optionally creates design-related skills

**When to use:**
- After `/wf-create-prd` to configure design details
- When adding Figma designs to an existing project
- To update design system configuration

**Typical workflow:**
```
/wf-create-prd → /wf-design-setup → /wf-generate → /wf-start-session
```
