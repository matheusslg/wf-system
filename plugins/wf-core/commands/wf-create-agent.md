---
description: Create a custom agent with specified expertise, skills, and tools
allowed-tools: Read, Write, Edit, Bash, AskUserQuestion
argument-hint: [agent-description]
---

# Create Custom Agent

Create a specialized agent with custom expertise, tools, and skills. Agents are autonomous specialists that can be delegated tasks via `/wf-delegate` or other workflow commands.

## Arguments

- `$ARGUMENTS` - Optional description of what this agent should specialize in:
  - Example: "database expert who manages migrations and optimizes queries"
  - Example: "security specialist for code reviews and vulnerability scanning"
  - Example: "documentation writer"
  - If empty, will ask interactively

## 1. Check Prerequisites

Verify workflow is initialized:

```bash
ls .claude/workflow.json 2>/dev/null || echo "NO_WORKFLOW"
```

**If workflow.json doesn't exist**:
- Display error: "Workflow not initialized. Run `/wf-init` first."
- Exit without changes

Get project name:
```bash
cat .claude/workflow.json 2>/dev/null | grep '"project"' | cut -d'"' -f4
```

Store as `PROJECT_NAME`.

## 2. Gather Agent Information

### If Arguments Provided

Parse `$ARGUMENTS` to understand the agent's purpose:
- What domain/specialty
- What tasks it should handle
- Any specific technologies mentioned

### If No Arguments

Use AskUserQuestion to gather information:

**Question 1: Agent Purpose**
```
header: "Specialty"
question: "What should this agent specialize in?"
options:
  - label: "Domain Expert"
    description: "Deep expertise in a specific area (security, performance, accessibility)"
  - label: "Technology Specialist"
    description: "Expert in specific tech stack (Kubernetes, GraphQL, ML/AI)"
  - label: "Role-Based"
    description: "Specific role (Tech Lead, DevOps, QA Engineer)"
  - label: "Task-Focused"
    description: "Handles specific tasks (Documentation, Code Review, Testing)"
```

**Question 2: Detailed Description**

Based on selection, ask for specifics:
```
header: "Details"
question: "Describe this agent's expertise in more detail:"
```

Let user type their description.

## 3. Determine Agent Configuration

Based on the gathered information, determine:

### Agent Name

Generate a slug-friendly name:
- Convert description to lowercase
- Replace spaces with hyphens
- Remove special characters
- Prefix with project name

Example: "security specialist" → `{project}-security`

**Ask user to confirm or customize the name**:
```
header: "Name"
question: "What should this agent be named?"
options:
  - label: "{project}-{suggested-slug}"
    description: "Auto-generated from description"
  - label: "Custom name"
    description: "I'll specify a different name"
```

### Tool Selection

Based on the agent's purpose, recommend appropriate tools:

| Agent Type | Recommended Tools |
|------------|-------------------|
| Read-only (reviewer, auditor) | `Read, Grep, Glob` |
| Documentation | `Read, Write, Grep, Glob` |
| Development | `Read, Edit, Write, Bash, Grep, Glob` |
| DevOps/Infra | `Read, Edit, Write, Bash, Grep, Glob` |
| Testing/QA | `Read, Bash, Grep, Glob` |

**Ask user to confirm tools**:
```
header: "Tools"
question: "Which tools should this agent have access to?"
multiSelect: true
options:
  - label: "Full Development (Recommended)"
    description: "Read, Edit, Write, Bash, Grep, Glob - can modify code"
  - label: "Read-Only"
    description: "Read, Grep, Glob - can only read and search"
  - label: "Documentation"
    description: "Read, Write, Grep, Glob - can read and create docs"
  - label: "Custom"
    description: "I'll specify exactly which tools"
```

If "Custom" selected, ask for specific tools.

### Model Selection

```
header: "Model"
question: "Which model should power this agent?"
options:
  - label: "Opus (Recommended)"
    description: "Best reasoning, handles complex tasks"
  - label: "Sonnet"
    description: "Faster, good for simpler tasks"
```

## 4. Define Agent Responsibilities

Ask user to define what this agent should do:

```
header: "Tasks"
question: "What are this agent's main responsibilities? (Select all that apply)"
multiSelect: true
options:
  - label: "Implement features"
    description: "Write code to add new functionality"
  - label: "Fix bugs"
    description: "Debug and resolve issues"
  - label: "Review code"
    description: "Review PRs and provide feedback"
  - label: "Write tests"
    description: "Create unit/integration/e2e tests"
  - label: "Write documentation"
    description: "Create and maintain docs"
  - label: "Optimize performance"
    description: "Improve speed and efficiency"
  - label: "Security analysis"
    description: "Find and fix vulnerabilities"
  - label: "Infrastructure tasks"
    description: "Manage deployments, CI/CD, configs"
```

Allow custom responsibilities via "Other" option.

## 5. Ask About Skills

Skills are reusable capabilities that agents can invoke.

```
header: "Skills"
question: "Should this agent have custom skills?"
options:
  - label: "Yes, create new skills"
    description: "I'll define specific skills for this agent"
  - label: "Use existing skills"
    description: "Link to skills already in .claude/skills/"
  - label: "No skills needed"
    description: "Agent will work without predefined skills"
```

### If Creating New Skills

For each skill, gather:

1. **Skill name** (slug format): e.g., `security-scan`, `db-optimize`
2. **Description**: What the skill does
3. **Commands**: Bash commands the skill runs
4. **Tools needed**: Usually `Bash, Read`

**Skill Template**:
```markdown
---
description: {skill_description}
allowed-tools: Bash, Read
argument-hint: {optional_args}
---

# {Skill Name}

## Context
- Relevant info: `!{context_command}`

## Task
{instructions}

\`\`\`bash
{main_command}
\`\`\`

{guidance_on_results}
```

Write each skill to `.claude/skills/{skill-name}/SKILL.md`.

### If Using Existing Skills

List available skills:
```bash
ls -d .claude/skills/*/ 2>/dev/null | xargs -I {} basename {}
```

Let user select which skills to link.

## 6. Generate Agent File

Create the agent definition in `.claude/agents/{agent-name}.md`:

```markdown
---
name: {agent-name}
description: {one-line description for discovery}
tools: {selected-tools}
skills: {comma-separated skills if any}
model: {selected-model}
---

# {Agent Name} Agent

You are a {specialty} specialist for the {project} project.

## Session Protocol (MANDATORY)

Before doing ANY work:
1. Read `progress.md` - understand current state
2. Read `standards.md` - know code conventions
3. Check your assigned issue: `gh issue view <number>`

## Your Expertise

{detailed description of what this agent specializes in}

## Your Responsibilities

{list of responsibilities from step 4}

## Working Pattern

1. **Understand** - Read the issue/task thoroughly
2. **Plan** - Think through the approach before coding
3. **Implement** - Make changes following project patterns
4. **Verify** - Test your changes work correctly
5. **Document** - Update progress.md with what you did
6. **Report** - Summarize what was done

## Do NOT

- Work on tasks outside your specialty (delegate to other agents)
- Skip verification steps
- Leave work in a broken state
- Ignore existing code patterns

## Key Commands

{relevant commands for this agent's domain}

## Before Ending Session

1. Verify your changes work
2. Update `progress.md` with what you did
3. Commit progress file
4. Leave no uncommitted critical changes
```

## 7. Update workflow.json

Read current workflow.json:
```bash
cat .claude/workflow.json
```

Add the new agent to the `agents` mapping:

```json
{
  "agents": {
    "existing-role": ".claude/agents/project-existing.md",
    "{new-agent-role}": ".claude/agents/{agent-name}.md"
  }
}
```

Use Edit tool to update the file.

## 8. Create Agent Directory (if skills created)

Ensure skills directory exists:
```bash
mkdir -p .claude/skills
```

Write any new skills created in step 5.

## 9. Report Results

```markdown
## Agent Created Successfully

**Agent**: `{agent-name}`
**Location**: `.claude/agents/{agent-name}.md`

### Configuration
| Property | Value |
|----------|-------|
| Name | {agent-name} |
| Specialty | {specialty} |
| Tools | {tools} |
| Model | {model} |
| Skills | {skills or "None"} |

### Responsibilities
{list of responsibilities}

### Files Created
- `.claude/agents/{agent-name}.md` - Agent definition
{if skills created}
- `.claude/skills/{skill-name}/SKILL.md` - {skill description}
{end if}

### Files Updated
- `.claude/workflow.json` - Added agent mapping

### How to Use

**Delegate tasks directly**:
```
/wf-delegate --agent {agent-name} "task description"
```

**Reference in issues**:
Add `agent: {agent-name}` to issue labels or body.

**Invoke from other commands**:
Commands like `/wf-implement`, `/wf-improve` will auto-select this agent when tasks match its specialty.

### Next Steps
- Review the generated agent file and customize if needed
- Test the agent with a simple task: `/wf-delegate --agent {agent-name} "test task"`
- Add more skills later with `/wf-create-agent --add-skill {agent-name}`
```

---

## Examples

### Security Specialist

```
/wf-create-agent security specialist for vulnerability scanning and secure code practices
```

Creates:
- Agent: `project-security`
- Tools: `Read, Bash, Grep, Glob` (read-only + bash for scanners)
- Skills: `security-scan`, `dependency-audit`

### Database Expert

```
/wf-create-agent database administrator for migrations, query optimization, and schema design
```

Creates:
- Agent: `project-dba`
- Tools: `Read, Edit, Write, Bash, Grep, Glob`
- Skills: `db-migrate`, `db-analyze`, `db-backup`

### Documentation Writer

```
/wf-create-agent technical writer for API docs and user guides
```

Creates:
- Agent: `project-docs`
- Tools: `Read, Write, Grep, Glob` (no bash/edit needed)
- Skills: `api-doc-gen`, `readme-update`

---

## Error Handling

### No workflow.json

```
Error: Workflow not initialized.

Run `/wf-init` first to create the base workflow files.
```

### Agent Already Exists

```
Warning: Agent "{name}" already exists at .claude/agents/{name}.md

Options:
1. Overwrite - Replace existing agent
2. Rename - Use a different name
3. Cancel - Keep existing agent
```

### Invalid Agent Name

If name contains invalid characters:
```
Error: Agent name must be lowercase alphanumeric with hyphens only.

Suggested: {sanitized-name}
```

---

## Related Commands

- `/wf-generate` - Auto-generate agents from tech stack
- `/wf-delegate` - Delegate tasks to agents
- `/wf-implement` - Implement features (auto-selects agent)
- `/wf-init` - Initialize workflow (prerequisite)
