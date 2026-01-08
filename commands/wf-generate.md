---
description: Generate agents and skills based on tech stack
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
argument-hint: [--from-prd | --from-code | --ask]
---

# Generate Workflow Agents & Skills

Generate project-specific agents and skills based on the detected or specified tech stack. This command UPDATES existing workflow files created by `/wf-init`.

## Prerequisites

- Run `/wf-init` first to create the base workflow files
- Optionally run `/wf-create-prd` to define tech stack in PRD

## Arguments

- `$ARGUMENTS` - Optional mode flag:
  - `--from-prd` - Force read tech stack from PRD.md
  - `--from-code` - Force detect from existing code
  - `--ask` - Ask user to specify stack directly
  - (empty) - Auto-detect: try PRD first, then code, then ask

## 1. Check Prerequisites

Verify workflow files exist:

```bash
ls .claude/workflow.json 2>/dev/null || echo "NO_WORKFLOW"
ls progress.md 2>/dev/null || echo "NO_PROGRESS"
ls standards.md 2>/dev/null || echo "NO_STANDARDS"
```

**If workflow.json doesn't exist**:
- Display error: "Workflow not initialized. Run `/wf-init` first."
- Exit without changes

## 2. Check Existing Agents

```bash
ls .claude/agents/*.md 2>/dev/null | wc -l
ls .claude/commands/*.md 2>/dev/null | wc -l
```

**If agents or skills already exist**, ask user:

| Option | Behavior |
|--------|----------|
| **Merge** | Keep existing agents/skills, only add new ones |
| **Replace** | Delete all existing agents/skills, generate fresh |
| **Cancel** | Exit without changes |

If "Replace" selected:
```bash
rm -f .claude/agents/*.md 2>/dev/null
# Note: Don't delete commands that aren't stack-specific (e.g., keep wf-* commands)
```

## 3. Determine Tech Stack Source

Based on `$ARGUMENTS` or auto-detect:

### Mode: --from-prd

Read PRD.md for tech stack:
```bash
cat PRD.md 2>/dev/null | head -100
```

Look for `## Tech Stack` section (created by `/wf-create-prd`):
- Frontend (React, Next.js, Vue, etc.)
- Backend (NestJS, Express, FastAPI, Django, etc.)
- Database (PostgreSQL, MongoDB, MySQL, etc.)
- Infrastructure (AWS, Docker, Kubernetes, etc.)

Fallback sections if "Tech Stack" not found:
- "Technical Considerations"
- "Technologies"
- "Architecture"

Extract all mentioned technologies.

### Mode: --from-code

Detect from project files:

```bash
# Check for package managers and frameworks
cat package.json 2>/dev/null | head -50
cat requirements.txt 2>/dev/null
cat pyproject.toml 2>/dev/null | head -30
cat Cargo.toml 2>/dev/null | head -20
cat go.mod 2>/dev/null | head -10
cat Gemfile 2>/dev/null | head -20
ls Pulumi.yaml 2>/dev/null
ls *.tf 2>/dev/null | head -5
ls docker-compose.yml docker-compose.yaml 2>/dev/null
```

Detection mapping:
- **Node/TypeScript**: package.json, tsconfig.json
- **Python**: requirements.txt, pyproject.toml, setup.py
- **Rust**: Cargo.toml
- **Go**: go.mod
- **Ruby**: Gemfile

Framework detection from dependencies:
- **Backend**: NestJS, Express, FastAPI, Django, Flask, Rails, Gin
- **Frontend**: Next.js, React, Vue, Angular, Svelte
- **Mobile**: React Native, Flutter, Swift, Kotlin
- **Testing**: Jest, Vitest, pytest, Playwright
- **Database**: PostgreSQL, MySQL, MongoDB (check ORMs: MikroORM, TypeORM, Prisma, SQLAlchemy)
- **Infrastructure**: Terraform, Pulumi, CloudFormation

### Mode: --ask (or fallback)

If no PRD and no detectable code, ask user:

**"What's your tech stack?"**

Options:
- **Backend**: NestJS, Express, FastAPI, Django, Flask, Rails, Go, Rust
- **Frontend**: Next.js, React, Vue, Angular, Svelte
- **Mobile**: React Native, Flutter, iOS (Swift), Android (Kotlin)
- **Database**: PostgreSQL, MySQL, MongoDB, SQLite
- **Infrastructure**: Terraform, Pulumi, AWS CDK, Docker
- **Other**: Let me type it

### Auto Mode (default)

1. Check if PRD.md exists and has tech stack info → use it
2. Else detect from code → use detected stack
3. Else ask user → use provided stack

## 4. Confirm Stack with User

Present detected/read stack for confirmation:

```
## Detected Tech Stack

**Backend**: NestJS, MikroORM, PostgreSQL
**Frontend**: Next.js, React, TanStack Query
**Testing**: Jest, Vitest
**Infrastructure**: Docker

Is this correct? [Yes / Edit / Cancel]
```

If "Edit" selected, ask user to specify corrections.

## 5. Update workflow.json

Read current workflow.json:
```bash
cat .claude/workflow.json
```

**Update with detected stack**:
- Add `scopes` based on detected areas (backend, frontend, mobile, infra)
- Add `agents` configuration mapping
- Ask user about init_script if not set

Example updates:
```json
{
  "scopes": ["backend", "frontend", "infra"],
  "agents": {
    "backend": ".claude/agents/project-backend.md",
    "frontend": ".claude/agents/project-frontend.md",
    "infra": ".claude/agents/project-infra.md",
    "reviewer": ".claude/agents/project-reviewer.md"
  }
}
```

If GitHub owner/repo is empty, ask user to provide it.

## 6. Update standards.md

Read current standards.md:
```bash
cat standards.md
```

**Replace placeholder sections** with stack-specific conventions:

### Code Style (by stack)

**TypeScript/Node**:
```markdown
## Code Style
- Use TypeScript strict mode
- Prefer `const` over `let`
- Use async/await over callbacks
- Export types from dedicated files
```

**Python**:
```markdown
## Code Style
- Follow PEP 8
- Use type hints
- Prefer f-strings for formatting
- Use dataclasses or Pydantic for data models
```

### Testing (by framework)

**Jest/Vitest**:
```markdown
## Testing
- Co-locate tests with source: `*.spec.ts` or `*.test.ts`
- Use `describe/it` blocks
- Mock external dependencies
- Aim for >80% coverage
```

**pytest**:
```markdown
## Testing
- Tests in `tests/` directory
- Use fixtures for setup
- Use `pytest.mark.parametrize` for variations
- Run with `pytest -v --cov`
```

## 7. Generate Project Agents

Create agents in `.claude/agents/` based on detected stack.

### Agent Template Structure

```markdown
---
name: [project]-[role]
description: [Role description]. Use for [specific tasks].
tools: Read, Edit, Write, Bash, Grep, Glob
model: opus
---

# [Project] [Role] Agent

You are a senior [role] specializing in [technologies] for [project name].

## Session Protocol (MANDATORY)

Before doing ANY work:
1. Read `progress.md` - understand current state
2. Read `standards.md` - know code conventions
3. [Run init script if defined]
4. Check your assigned issue: `gh issue view <number>`

## Your Responsibilities

### Primary Focus
- [Main directories and tasks]

### Secondary Focus
- [Supporting tasks]

## Code Standards

[Stack-specific code examples]

## Working Pattern

1. **Pick ONE issue** at a time
2. **Create feature branch**: `git checkout -b feature/ISSUE-<n>-description`
3. **Implement** following project patterns
4. **Write tests**
5. **Run tests**: [test command]
6. **Commit**: `git commit -m "type(scope): description"`
7. **Update progress**: Edit `progress.md`

## Do NOT

- Work on multiple issues at once
- Skip writing tests
- Modify code outside your scope (delegate to other agents)
- Declare victory without running tests

## Key Files

| Location | Purpose |
|----------|---------|
| [path] | [description] |

## Commands

```bash
[Stack-specific commands]
```

## Before Ending Session

1. Update `progress.md` with what you did
2. Commit progress file
3. Ensure tests pass
4. Leave no uncommitted critical changes
```

### Agents by Stack

| Detected Stack | Agent to Create |
|----------------|-----------------|
| NestJS/Express/FastAPI/Django | `backend` - API endpoints, services, database |
| Next.js/React/Vue/Angular | `frontend` - Components, hooks, state |
| React Native/Flutter | `mobile` - Mobile screens, navigation |
| Terraform/Pulumi | `infra` - Cloud resources, IaC |
| Jest/Vitest/pytest | `qa` - Tests, coverage, quality |
| Any project | `reviewer` - Code review (READ-ONLY: tools: Read, Grep, Glob) |

Create directory if needed:
```bash
mkdir -p .claude/agents
```

## 8. Generate Stack-Specific Skills

Create utility skills in `.claude/commands/` based on detected stack.

```bash
mkdir -p .claude/commands
```

### Skills by Stack

Generate skills based on detected technologies:

| Detected | Skills to Generate |
|----------|-------------------|
| Pulumi in dependencies or Pulumi.yaml | pulumi-preview, pulumi-up, pulumi-logs |
| Terraform or .tf files | tf-plan, tf-apply, tf-output |
| @nestjs/core in package.json | nest-generate, nest-test, nest-e2e |
| next in package.json | next-dev, next-build, next-lint |
| docker-compose.yml or Dockerfile | docker-up, docker-logs, docker-down |
| pytest or requirements.txt with Python | py-test, py-lint |
| PostgreSQL/MySQL detected | db-connect, db-dump |
| Git repo detected | gh-pr, gh-issues |

### Ask User Which Skills

Present recommended skills and let user choose:

**Options**:
1. Generate all recommended skills
2. Let me choose which skills
3. Skip skill generation

### Skill Templates

#### Pulumi / Infrastructure
```markdown
# .claude/commands/pulumi-preview.md
---
description: Preview Pulumi infrastructure changes
allowed-tools: Bash, Read
argument-hint: [stack-name]
---
Preview infrastructure changes without applying:
\`\`\`bash
pulumi preview --stack ${1:-dev} --diff
\`\`\`

# .claude/commands/pulumi-up.md
---
description: Apply Pulumi infrastructure changes
allowed-tools: Bash, Read, AskUserQuestion
argument-hint: [stack-name]
---
**IMPORTANT**: Always run preview first and confirm with user before applying.
\`\`\`bash
pulumi up --stack ${1:-dev} --yes
\`\`\`
```

#### Terraform / Infrastructure
```markdown
# .claude/commands/tf-plan.md
---
description: Plan Terraform infrastructure changes
allowed-tools: Bash, Read
argument-hint: [workspace]
---
\`\`\`bash
terraform workspace select ${1:-dev} 2>/dev/null || true
terraform plan -out=tfplan
\`\`\`

# .claude/commands/tf-apply.md
---
description: Apply Terraform changes
allowed-tools: Bash, Read, AskUserQuestion
---
**IMPORTANT**: Review plan output and confirm with user before applying.
\`\`\`bash
terraform apply tfplan
\`\`\`
```

#### NestJS / Backend
```markdown
# .claude/commands/nest-generate.md
---
description: Generate NestJS resources (module, controller, service)
allowed-tools: Bash, Read
argument-hint: <type> <name>
---
Generate NestJS resources. Types: module, controller, service, resource, guard, pipe, interceptor
\`\`\`bash
npx nest generate $1 $2
\`\`\`

# .claude/commands/nest-test.md
---
description: Run NestJS tests with coverage
allowed-tools: Bash, Read
argument-hint: [test-pattern]
---
\`\`\`bash
npm run test -- ${1:---coverage}
\`\`\`

# .claude/commands/nest-migrate.md
---
description: Run database migrations (MikroORM/TypeORM)
allowed-tools: Bash, Read
argument-hint: [migration-name]
---
\`\`\`bash
npx mikro-orm migration:create --name $1
npx mikro-orm migration:up
\`\`\`
```

#### Next.js / Frontend
```markdown
# .claude/commands/next-build.md
---
description: Build Next.js for production
allowed-tools: Bash, Read
---
\`\`\`bash
npm run build
\`\`\`

# .claude/commands/next-lint.md
---
description: Run Next.js linting and type checking
allowed-tools: Bash, Read
---
\`\`\`bash
npm run lint
npx tsc --noEmit
\`\`\`

# .claude/commands/next-test.md
---
description: Run frontend tests (Vitest/Jest)
allowed-tools: Bash, Read
argument-hint: [test-pattern]
---
\`\`\`bash
npm run test -- $1
\`\`\`
```

#### Docker
```markdown
# .claude/commands/docker-up.md
---
description: Start Docker Compose services
allowed-tools: Bash, Read
argument-hint: [service-name]
---
\`\`\`bash
docker compose up -d $1
docker compose ps
\`\`\`

# .claude/commands/docker-logs.md
---
description: View Docker container logs
allowed-tools: Bash, Read
argument-hint: <container-name>
---
\`\`\`bash
docker compose logs -f --tail=100 $1
\`\`\`

# .claude/commands/docker-down.md
---
description: Stop and remove Docker containers
allowed-tools: Bash
---
\`\`\`bash
docker compose down
\`\`\`
```

#### Python / FastAPI / Django
```markdown
# .claude/commands/py-test.md
---
description: Run pytest with coverage
allowed-tools: Bash, Read
argument-hint: [test-path]
---
\`\`\`bash
pytest ${1:-.} -v --cov --cov-report=term-missing
\`\`\`

# .claude/commands/py-lint.md
---
description: Run Python linting (ruff/flake8/mypy)
allowed-tools: Bash, Read
---
\`\`\`bash
ruff check . || flake8 .
mypy . || true
\`\`\`
```

#### Database
```markdown
# .claude/commands/db-connect.md
---
description: Connect to database CLI
allowed-tools: Bash, Read
argument-hint: [database-name]
---
\`\`\`bash
psql -h localhost -U postgres ${1:-app}
\`\`\`

# .claude/commands/db-dump.md
---
description: Dump database to file
allowed-tools: Bash
argument-hint: <database-name> <output-file>
---
\`\`\`bash
pg_dump -h localhost -U postgres $1 > $2
\`\`\`
```

#### Git / GitHub
```markdown
# .claude/commands/gh-pr.md
---
description: Create GitHub Pull Request
allowed-tools: Bash, Read
argument-hint: [base-branch]
---
\`\`\`bash
gh pr create --base ${1:-main} --fill
\`\`\`

# .claude/commands/gh-issues.md
---
description: List open GitHub issues
allowed-tools: Bash, Read
argument-hint: [label]
---
\`\`\`bash
gh issue list --state open ${1:+--label "$1"}
\`\`\`
```

### Skill Generation Logic

When generating skills, follow this mapping:

| Detected | Skills to Generate |
|----------|-------------------|
| `pulumi` in dependencies or Pulumi.yaml exists | pulumi-preview, pulumi-up |
| `terraform` or .tf files exist | tf-plan, tf-apply |
| `@nestjs/core` in package.json | nest-generate, nest-test, nest-migrate |
| `next` in package.json | next-build, next-lint, next-test |
| `docker-compose.yml` or Dockerfile exists | docker-up, docker-logs, docker-down |
| `pytest` or `requirements.txt` exists | py-test, py-lint |
| PostgreSQL/MySQL detected | db-connect, db-dump |
| Git repo detected | gh-pr, gh-issues |

## 9. Report Results

Summarize what was generated:

```
## Workflow Generated

**Tech Stack Detected**:
- Backend: NestJS, MikroORM
- Frontend: Next.js
- Infrastructure: Docker

**Files Updated**:
- `.claude/workflow.json` - Added scopes and agents config
- `standards.md` - Added stack-specific conventions

**Agents Created**:
- `.claude/agents/project-backend.md` - Backend development
- `.claude/agents/project-frontend.md` - Frontend development
- `.claude/agents/project-reviewer.md` - Code review (read-only)

**Skills Created**:
- `.claude/commands/nest-generate.md` - Generate NestJS resources
- `.claude/commands/docker-up.md` - Start Docker services
- `.claude/commands/gh-pr.md` - Create GitHub PR

**Next Steps**:
1. Review generated agents in `.claude/agents/`
2. Review generated skills in `.claude/commands/`
3. Customize as needed
4. Run `/wf-start-session` to begin working

**Recommended**: `/wf-start-session` or `/wf-pick-issue` to start development.
```

## 10. Suggest Workflow

Based on project state, suggest next command:

- If PRD.md exists but no GitHub issues → `/wf-parse-prd`
- If GitHub issues exist → `/wf-pick-issue`
- Otherwise → `/wf-start-session`

---

## Error Handling

### No workflow.json
```
Error: Workflow not initialized.

Run `/wf-init` first to create the base workflow files.
```

### Can't detect stack
If auto-mode can't find PRD or code:
- Fall back to `--ask` mode
- Prompt user to specify their planned stack

### Write permission errors
If can't create files:
- Check directory permissions
- Suggest running with appropriate permissions
