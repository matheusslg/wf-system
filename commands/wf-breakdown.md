---
description: Break down Jira ticket or GitHub issue into sub-tasks with agent assignments
allowed-tools: Read, Bash, Grep, Glob, Task, AskUserQuestion
argument-hint: <Jira ticket, GitHub issue number, or URL>
---

# Issue Breakdown

Transform Jira tickets or GitHub issues into actionable GitHub sub-task Issues with clear implementation plans and agent assignments. Acts as the bridge between product requirements and engineering execution.

**Behavior by source**:
- **Jira ticket**: Creates a new GitHub parent issue, then creates sub-task issues linked to it
- **GitHub issue**: Uses the existing issue as the parent, creates sub-task issues linked to it (no duplicate parent created)

## Arguments
- `$ARGUMENTS` - Issue identifier (Jira or GitHub)
  - **Jira**: `PROJECT-1023`, `1023`, `https://yoursite.atlassian.net/browse/PROJECT-1023`
  - **GitHub**: `#42`, `42`, `https://github.com/owner/repo/issues/42`

## 0. Load Configuration

Check for workflow configuration:
```bash
cat .claude/workflow.json 2>/dev/null || echo "{}"
```

Extract Breakdown settings:
- `breakdown.jiraProject`: Jira project key prefix (e.g., "SXRX")
- `breakdown.jiraCloudId`: Atlassian cloud ID or site URL
- `breakdown.githubOwner`: GitHub repository owner
- `breakdown.githubRepo`: GitHub repository name
- `breakdown.defaultLabels`: Default labels for issues
- `agents`: Available agents for delegation

If `breakdown` config is missing, ask user for:
- Jira project key
- GitHub owner/repo

## 1. Parse Input

Parse `$ARGUMENTS` to determine source type and extract identifier:

### Detect Source Type

**GitHub Issue patterns**:
- `#42` or `42` - Issue number (uses config repo)
- `https://github.com/owner/repo/issues/42` - Full GitHub URL
- `owner/repo#42` - Owner/repo with issue number

**Jira Ticket patterns**:
- `SXRX-1023` - Full ticket key
- `https://yoursite.atlassian.net/browse/SXRX-1023` - Full Jira URL
- Plain number like `1023` with Jira project in config

**Detection logic**:
1. If starts with `#` or matches `owner/repo#N` → GitHub
2. If contains `github.com` → GitHub
3. If contains `atlassian.net` or matches `PROJECT-N` → Jira
4. If plain number → Check if GitHub issue exists first, fallback to Jira with project prefix

**Extract**:
- `sourceType`: `"github"` or `"jira"`
- For GitHub: `owner`, `repo`, `issueNumber`
- For Jira: `projectKey`, `ticketNumber`

**Flags**:
- `--dry-run` - Plan only, don't create GitHub issues
- `--skip-figma` - Skip Figma design analysis

## 2. Fetch Issue Details

Based on `sourceType` from step 1, fetch from appropriate source.

### 2a. If GitHub Issue

Use GitHub MCP to retrieve issue details:

```
mcp__github__get_issue(
  owner: "{owner}",
  repo: "{repo}",
  issue_number: {issueNumber}
)
```

**Extract from response**:
- `title` - Issue title → `summary`
- `body` - Full description (may contain markdown, Figma links) → `description`
- `labels` - Existing labels
- `state` - open/closed
- `user.login` - Who created the issue → `reporter`
- Parse acceptance criteria from body if present

**Map to common format**:
- `issueType`: Detect from labels (feature, bug, task) or default to "Task"
- `priority`: Detect from labels (priority-high, priority-low) or default to "Medium"
- `reference`: `#{issueNumber}` or full URL
- `referenceUrl`: `https://github.com/{owner}/{repo}/issues/{issueNumber}`

**If issue not found**:
```markdown
Error: Could not find GitHub issue #{issueNumber}

Possible causes:
1. Issue doesn't exist
2. Repository is private (check GitHub MCP auth)
3. Owner/repo mismatch

Verify issue exists at: https://github.com/{owner}/{repo}/issues/{issueNumber}
```

### 2b. If Jira Ticket

Use Atlassian MCP to retrieve ticket details:

```
mcp__atlassian__getJiraIssue(
  cloudId: breakdown.jiraCloudId,
  issueIdOrKey: "{PROJECT}-{number}"
)
```

**Extract from response**:
- `summary` - Ticket title
- `description` - Full requirements (may contain markdown, Figma links)
- `fields.issuetype.name` - Issue type (Feature, Bug, Task, Story)
- `fields.priority.name` - Priority level
- `fields.labels` - Existing labels
- `fields.acceptance_criteria` or parse from description
- `fields.reporter` - Who created the ticket

**Map to common format**:
- `issueType`: From `fields.issuetype.name`
- `priority`: From `fields.priority.name`
- `reference`: `{PROJECT}-{number}`
- `referenceUrl`: `https://{cloudId}/browse/{PROJECT}-{number}`

**If ticket not found**:
```markdown
Error: Could not find Jira ticket {PROJECT}-{number}

Possible causes:
1. Ticket doesn't exist
2. Permission denied (check Atlassian MCP auth)
3. Cloud ID mismatch

Verify ticket exists at: https://{cloudId}/browse/{PROJECT}-{number}
```

## 3. Detect Figma Links

### 3a. Check workflow.json for Figma config

First, check if project has Figma configured via `/wf-design-setup`:

```bash
cat .claude/workflow.json 2>/dev/null | grep -A 10 '"figma"'
```

**If design.figma exists in workflow.json**:
- Use `fileKey` from config as default reference
- Use `keyFrames` for quick component lookups
- This provides project-wide design context

### 3b. Scan ticket for specific Figma URLs

Scan ticket description for Figma URLs:

**Patterns to match**:
- `https://figma.com/design/{fileKey}/{fileName}?node-id={nodeId}`
- `https://figma.com/file/{fileKey}`
- `https://www.figma.com/design/{fileKey}`
- `https://figma.com/proto/{fileKey}`

**Extract from each URL**:
- `fileKey` - The file identifier (alphanumeric after /design/ or /file/)
- `nodeId` - Node ID from query param (format: `123-456` or `123:456`)

### Priority

1. **Ticket-specific Figma links** - Use these first (most relevant to the task)
2. **workflow.json Figma config** - Use as fallback for general design context

**If no Figma links found and no workflow.json config**:
- Note in plan: "No design references found"
- Continue without design context

## 4. Fetch Design Context (if Figma detected)

For each Figma URL found, use Figma MCP:

```
mcp__figma__get_design_context(
  fileKey: "{extracted_fileKey}",
  nodeId: "{extracted_nodeId}",
  clientLanguages: "typescript",
  clientFrameworks: "react,nestjs"
)
```

**Also get screenshot for reference**:
```
mcp__figma__get_screenshot(
  fileKey: "{extracted_fileKey}",
  nodeId: "{extracted_nodeId}"
)
```

**Extract from design context**:
- Component structure and hierarchy
- Color variables and design tokens
- Typography specifications
- Interactive states
- Code Connect mappings (if available)

**If Figma access fails**:
```markdown
Warning: Could not access Figma design at {url}

Continuing without design context.
Reason: {error_message}

To fix: Verify Figma MCP authentication and file permissions.
```

## 5. Analyze Codebase

Based on ticket content, identify affected areas:

```bash
# Search for similar patterns
grep -r "<relevant_keyword>" --include="*.ts" --include="*.tsx" -l | head -20

# Check existing structure
ls -la sxrx-api/src/modules/ 2>/dev/null
ls -la sxrx-app/src/ 2>/dev/null
```

**Determine scope**:
- **Backend needed?** - API endpoints, services, database changes
- **Frontend needed?** - Components, pages, hooks
- **Infrastructure needed?** - Terraform, AWS resources
- **Mobile needed?** - Capacitor plugins, native code
- **Tests needed?** - Unit tests, E2E tests

## 6. Break Into Sub-Tasks

Create atomic, assignable sub-tasks:

### Task Sizing
- **S (Small)**: < 2 hours, single file change
- **M (Medium)**: 2-4 hours, multiple files, one concern
- **L (Large)**: 4-8 hours, multiple concerns (consider splitting)

### Agent Assignment

| Task Type | Agent | Trigger |
|-----------|-------|---------|
| Controllers, services, entities, DTOs | `sxrx-backend` | NestJS/MikroORM work |
| Components, pages, hooks, services | `sxrx-frontend` | React/Next.js work |
| Unit tests, E2E tests, coverage | `sxrx-qa` | Test creation |
| Terraform, AWS, CI/CD | `sxrx-infra` | Infrastructure changes |
| iOS, Android, Capacitor plugins | `sxrx-capacitor` | Mobile platform |
| Cross-cutting code review | `sxrx-fullstack-reviewer` | PR validation |

### Dependency Ordering
Typical order:
1. Database migrations (if needed)
2. Backend entities/DTOs
3. Backend services
4. Backend controllers/endpoints
5. Frontend services (API clients)
6. Frontend hooks (data fetching)
7. Frontend components
8. Frontend pages (composition)
9. Tests (unit + integration)
10. Mobile sync (if applicable)

### If New Agent Needed
If task requires expertise outside existing agents:
```markdown
## New Agent Recommendation

**Proposed Agent**: `{project}-{specialty}`
**Justification**: {why existing agents insufficient}
**Responsibilities**: {what it would handle}

*User approval required to create new agent*
```

## 7. Present Plan for Approval

**CRITICAL**: Do NOT create GitHub issues until explicit user approval.

Present the plan:

```markdown
# Implementation Plan: {reference}

## Source Issue
**Title**: {summary}
**Source**: {sourceType} - [{reference}]({referenceUrl})
**Type**: {issueType}
**Priority**: {priority}

## Design Context
{figma_analysis_or_"No design references found"}

## Codebase Analysis
**Affected Areas**:
- Backend: {yes/no} - {details}
- Frontend: {yes/no} - {details}
- Infrastructure: {yes/no} - {details}
- Mobile: {yes/no} - {details}

## Sub-Tasks

### 1. {sub_task_title}
- **Agent**: `{agent_name}`
- **Size**: S/M/L
- **Dependencies**: None / Sub-task #N
- **Description**: {what_to_do}
- **Files to modify**:
  - `path/to/file.ts` - {instruction}
- **Acceptance Criteria**:
  - [ ] {criterion_1}
  - [ ] {criterion_2}

### 2. {sub_task_title}
[Continue for all sub-tasks...]

## Execution Order
1. Sub-task 1 (no dependencies)
2. Sub-task 2 (depends on 1)
3. Sub-task 3 (depends on 1)
4. Sub-task 4 (depends on 2, 3)

---

**Ready to create GitHub issues?**
- `yes` / `approve` - Create all issues
- `no` / `cancel` - Abort
- `modify N` - Edit sub-task N
- `add` - Add new sub-task
- `remove N` - Remove sub-task N
```

## 8. Handle User Response

**Valid approval signals**:
- `yes`, `approve`, `proceed`, `create`, `go ahead`

**Valid rejection signals**:
- `no`, `cancel`, `stop`, `abort`

**Modification signals**:
- `modify 2` - Re-prompt for sub-task 2 details
- `add` - Ask for new sub-task details
- `remove 3` - Remove sub-task 3 from plan

**If `--dry-run` flag was set**:
```markdown
## Dry Run Complete

Plan has been generated but no GitHub issues were created.
Remove `--dry-run` flag to create issues.
```

## 9. Create GitHub Issues (After Approval)

### Check for Existing Sub-Tasks
```
mcp__github__search_issues(
  query: "[{reference}] label:sub-task",
  owner: breakdown.githubOwner,
  repo: breakdown.githubRepo
)
```

If sub-tasks already exist for this reference, warn user and ask to continue or abort.

### 9a. If Source is GitHub Issue (Use as Parent)

The source GitHub issue becomes the parent - no new parent issue is created.

**Update the existing issue** to add tech-lead labels and tracking:
```
mcp__github__update_issue(
  owner: breakdown.githubOwner,
  repo: breakdown.githubRepo,
  issue_number: {sourceIssueNumber},
  labels: [...existing_labels, "tracked", "breakdown"]
)
```

**Append implementation plan to issue body**:
```
mcp__github__update_issue(
  owner: breakdown.githubOwner,
  repo: breakdown.githubRepo,
  issue_number: {sourceIssueNumber},
  body: "{original_body}\n\n{implementation_plan_section}"
)
```

**Implementation Plan Section to Append**:
```markdown
---

## Implementation Plan (Task Breakdown)

{high_level_approach}

### Design Context
{figma_analysis_or_none}

### Sub-Tasks
<!-- Will be updated with child issue links -->

---
*Breakdown generated by breakdown via `/wf-breakdown`*
```

Set `parent_issue_number` = `sourceIssueNumber` for child issue creation.

### 9b. If Source is Jira Ticket (Create New Parent)

Create a new GitHub parent issue to track the Jira work:

```
mcp__github__create_issue(
  owner: breakdown.githubOwner,
  repo: breakdown.githubRepo,
  title: "[{reference}] {summary}",
  body: "{parent_issue_body}",
  labels: ["feature", "tracked", "breakdown"]
)
```

**Parent Issue Body Template**:
```markdown
## Overview
{description}

## Source Reference
- **Source**: Jira
- **Ticket**: [{reference}]({referenceUrl})
- **Type**: {issueType}
- **Priority**: {priority}
- **Reporter**: {reporter}

## Design Context
{figma_analysis_or_none}

## Implementation Plan
{high_level_approach}

## Sub-Tasks
<!-- Will be updated with child issue links -->

## Acceptance Criteria
{from_source_issue}

---
*Generated by breakdown via `/wf-breakdown`*
```

### Create Child Issues
For each sub-task:
```
mcp__github__create_issue(
  owner: breakdown.githubOwner,
  repo: breakdown.githubRepo,
  title: "[{reference}] Sub-task: {sub_task_title}",
  body: "{child_issue_body}",
  labels: ["sub-task", "agent:{agent_name}"]
)
```

**Child Issue Body Template**:
```markdown
## Task
{detailed_task_description}

## Assigned Agent
**`{agent_name}`** - Use this agent to implement this task.

```bash
# Pick up this task
gh issue view {this_issue_number}
```

## Parent Issue
Part of #{parent_issue_number} ([{reference}]({referenceUrl}))

## Design Context (for UI tasks)
{Include this section for frontend/UI tasks}

### Figma Reference
- Link: {figma_url_if_available}
- Node ID: {node_id_if_available}

### Design System
- Component library: {from workflow.json design.system}
- Style guide: {from workflow.json design.styleGuide}

### Visual Requirements
{extracted_from_figma_or_ticket}

## Implementation Details

### Files to Create/Modify
- `{path/to/file.ts}` - {specific_instructions}

### Technical Approach
{pseudocode_or_detailed_steps}

### Patterns to Follow
- Reference: `{path/to/similar/file.ts}`
- Pattern: {description}

### Dependencies
- Depends on: #{other_issue_number} (if any)
- Blocks: #{blocked_issue_number} (if any)

## Acceptance Criteria
- [ ] {criterion_1}
- [ ] {criterion_2}
- [ ] Matches Figma design (if applicable)
- [ ] Tests pass
- [ ] TypeScript validates: `npx tsc --noEmit`

## Validation Commands
```bash
cd sxrx-{api|app}
npx tsc --noEmit
npm run lint
npm run test
```

---
*Generated by breakdown via `/wf-breakdown`*
```

### Update Parent with Child Links
After creating all children, update parent issue body:
```
mcp__github__update_issue(
  owner: breakdown.githubOwner,
  repo: breakdown.githubRepo,
  issue_number: parent_issue_number,
  body: "{updated_body_with_child_links}"
)
```

Add to Sub-Tasks section:
```markdown
## Sub-Tasks
- [ ] #{child_1} - {title} (`{agent}`)
- [ ] #{child_2} - {title} (`{agent}`)
- [ ] #{child_3} - {title} (`{agent}`)
```

## 10. Report Results

### If Source was GitHub Issue:
```markdown
## Sub-Tasks Created for #{parent_number}

### Parent Issue (Updated)
- **#{parent_number}**: {summary}
- URL: https://github.com/{owner}/{repo}/issues/{parent_number}
- Labels added: `tracked`, `tech-lead`
- Implementation plan appended to issue body

### Sub-Tasks Created
| # | Title | Agent | Dependencies |
|---|-------|-------|--------------|
| #{child_1} | {title} | `{agent}` | None |
| #{child_2} | {title} | `{agent}` | #{child_1} |
| #{child_3} | {title} | `{agent}` | #{child_1} |

## Next Steps
1. Backend agent picks up #{first_backend_issue}
2. Frontend waits for backend completion
3. QA validates after implementation

## Commands
```bash
# View parent issue
gh issue view {parent_number}

# Check progress
/wf-ticket-status #{parent_number}

# Execute a sub-task
/wf-delegate {child_number}
```
```

### If Source was Jira Ticket:
```markdown
## Issues Created Successfully

### Parent Issue (New)
- **#{parent_number}**: [{reference}] {summary}
- URL: https://github.com/{owner}/{repo}/issues/{parent_number}

### Sub-Tasks Created
| # | Title | Agent | Dependencies |
|---|-------|-------|--------------|
| #{child_1} | {title} | `{agent}` | None |
| #{child_2} | {title} | `{agent}` | #{child_1} |
| #{child_3} | {title} | `{agent}` | #{child_1} |

## Next Steps
1. Backend agent picks up #{first_backend_issue}
2. Frontend waits for backend completion
3. QA validates after implementation

## Commands
```bash
# View parent issue
gh issue view {parent_number}

# Check progress
/wf-ticket-status {reference}

# Execute a sub-task
/wf-delegate {child_number}
```

## Jira Link
Don't forget to link this work back to Jira:
[{reference}]({referenceUrl})
```

## Error Handling

### GitHub MCP Not Available
```markdown
Error: GitHub MCP not available

The breakdown command requires the GitHub MCP server for creating issues.
Check that `github` is enabled in your Claude settings.
```

### Jira MCP Not Available (when using Jira source)
```markdown
Error: Atlassian MCP not available

When using Jira tickets as source, the Atlassian MCP server is required.
Check that `mcp-atlassian` is enabled in your Claude settings.

Alternatively, use a GitHub issue as source instead:
/wf-breakdown #42
```

### Missing Configuration
```markdown
Error: breakdown configuration not found

Add the following to `.claude/workflow.json`:

```json
{
  "breakdown": {
    "jiraProject": "YOUR_PROJECT",
    "jiraCloudId": "your-site.atlassian.net",
    "githubOwner": "your-org",
    "githubRepo": "your-repo",
    "defaultLabels": ["breakdown", "tracked"]
  }
}
```

Note: `jiraProject` and `jiraCloudId` are only needed if using Jira tickets.
For GitHub-only workflow, only `githubOwner` and `githubRepo` are required.

Then run `/wf-breakdown` again.
```

## Tips

1. **Complex Features**: Keep sub-tasks between 3-7 per feature
2. **Cross-Cutting**: Create separate backend and frontend issues
3. **Testing**: Always include QA sub-task for non-trivial features
4. **Dependencies**: Clearly mark which issues block others
5. **Mobile**: Include capacitor sub-task if UI changes affect mobile
6. **Dry Run First**: Use `--dry-run` to preview before creating issues
7. **GitHub-only Workflow**: Use `#42` or issue URLs if you don't use Jira
8. **Issue Detection**: Plain numbers will try GitHub first, then Jira

## Examples

```bash
# From Jira ticket
/wf-breakdown SXRX-1023
/wf-breakdown https://gnarlysoft.atlassian.net/browse/SXRX-1023

# From GitHub issue
/wf-breakdown #42
/wf-breakdown 42
/wf-breakdown https://github.com/owner/repo/issues/42

# With flags
/wf-breakdown #42 --dry-run
/wf-breakdown SXRX-1023 --skip-figma
```

## Related Commands
- `/wf-ticket-status` - Check implementation progress
- `/wf-delegate` - Execute a specific sub-task with its agent
- `/wf-implement` - Implement a feature directly (without source issue)
- `/wf-commit` - Create conventional commit after implementation
