---
description: Bootstrap a new project with the Claude workflow system
allowed-tools: Read, Write, Bash, Glob, Grep, AskUserQuestion
argument-hint: [project-name]
---

# Initialize Project Workflow

Set up the Claude workflow system for this project with workflow-aware agents.

## Arguments
- `$ARGUMENTS` - Optional project name (defaults to directory name)

## 1. Check Current State

Verify we're in a project directory:
```bash
pwd
ls -la
```

Check if workflow already exists:
```bash
ls -la .claude/ 2>/dev/null || echo "No .claude directory"
ls progress.md 2>/dev/null || ls claude-progress.md 2>/dev/null || echo "No progress file"
ls .claude/agents/*.md 2>/dev/null || echo "No agents"
```

### If Workflow Already Exists

If `.claude/workflow.json` or `progress.md` already exists, **ask the user**:

**Options**:
1. **Add/Update Agents Only** - Keep existing workflow files, just generate new agents (won't overwrite existing agents)
2. **Overwrite All** - Replace all workflow files and agents (WARNING: loses existing progress)
3. **Cancel** - Exit without changes

If user chooses "Add/Update Agents Only":
- Skip to Step 2 (Detect Tech Stack)
- Skip Steps 3-6 (don't touch workflow.json, progress.md, standards.md)
- Proceed to Step 7 (Generate Agents) - only create agents that don't already exist

If user chooses "Overwrite All":
- Warn user that progress.md history will be lost
- Proceed with full initialization

If user chooses "Cancel":
- Exit with message: "Workflow initialization cancelled. Existing files preserved."

## 2. Detect Tech Stack

Analyze the project to detect frameworks and tools:

```bash
# Check for package managers and frameworks
cat package.json 2>/dev/null | head -50
cat requirements.txt 2>/dev/null
cat pyproject.toml 2>/dev/null | head -30
cat Cargo.toml 2>/dev/null | head -20
cat go.mod 2>/dev/null | head -10
cat Gemfile 2>/dev/null | head -20
```

Look for indicators:
- **Node/TypeScript**: package.json, tsconfig.json
- **Python**: requirements.txt, pyproject.toml, setup.py
- **Rust**: Cargo.toml
- **Go**: go.mod
- **Ruby**: Gemfile

Detect frameworks from dependencies:
- **Backend**: NestJS, Express, FastAPI, Django, Flask, Rails, Gin
- **Frontend**: Next.js, React, Vue, Angular, Svelte
- **Mobile**: React Native, Flutter, Swift, Kotlin
- **Testing**: Jest, Vitest, pytest, Playwright
- **Database**: PostgreSQL, MySQL, MongoDB (check ORMs: MikroORM, TypeORM, Prisma, SQLAlchemy)
- **Infrastructure**: Terraform, Pulumi, CloudFormation

## 3. Create .claude Directory

If not exists:
```bash
mkdir -p .claude
mkdir -p .claude/agents
mkdir -p .claude/session-archive
```

## 4. Create Workflow Configuration

Create `.claude/workflow.json` with project settings.

**Ask user about scopes** (based on detected stack):
- What are the main areas/scopes of this project? (e.g., backend, frontend, mobile, infra)
- Is there an init script to verify the environment?

## 5. Create Progress File

Create `progress.md` in project root:

```markdown
# Project Progress

> This file tracks progress across sessions. Update before ending each session.
> **Keep this file under 400 lines** - archive old sessions to `.claude/session-archive/`

## Current Status
**Phase**: Setup
**Last Updated**: [TODAY'S DATE]

---

### Session 1 ([TODAY'S DATE])
**Focus**: Project initialization
**Completed**:
- Created workflow configuration
- Set up progress tracking
**Next**: Begin development

---

## Session Archive

> When this file exceeds 500 lines, move older sessions to `.claude/session-archive/sessions-{N}-{M}.md`
> Keep only the last 5 sessions in this file for AI readability.

## In Progress
- None

## Next Session Should
- [ ] Set up development environment
- [ ] Define initial tasks

## Decisions Made
- [Record architectural decisions here]

## Notes
- [Project-specific notes]
```

## 6. Create Standards File

Create `standards.md` with detected stack conventions:

```markdown
# Code Standards

## General
- Follow existing patterns in the codebase
- Write tests for new functionality
- Keep functions focused and small

## Commits
- Use conventional commits: type(scope): description
- Types: feat, fix, refactor, docs, test, chore, style

## Code Style
- [Stack-specific guidelines based on detection]

## Testing
- [Testing framework-specific guidelines]
```

## 7. Generate Project Agents (CRITICAL)

**Ask user**: "Do you want to create workflow-aware agents for this project?"

If yes, generate agents based on detected stack. Each agent MUST include:

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

### Standard Agents to Generate

Based on detected stack, offer to create:

| Detected Stack | Suggested Agents |
|---------------|------------------|
| NestJS/Express | `backend` - API endpoints, services, database |
| Next.js/React | `frontend` - Components, hooks, state |
| React Native/Flutter | `mobile` - Mobile screens, navigation |
| Terraform/Pulumi | `infra` - Cloud resources, IaC |
| Jest/Vitest/pytest | `qa` - Tests, coverage, quality |
| Any | `reviewer` - Code review (READ-ONLY: tools: Read, Grep, Glob) |

### Agent Customization

For each agent, customize:
- **Key Files**: Based on actual project structure
- **Commands**: Based on detected package manager and test framework
- **Code Standards**: Based on detected linting/formatting tools
- **Responsibilities**: Based on project structure

## 8. Generate Stack-Specific Skills (CRITICAL)

Based on the detected tech stack, generate utility skills in `.claude/commands/` that agents can use.

```bash
mkdir -p .claude/commands
```

### Skills by Stack

Generate skills based on what was detected in Step 2:

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

# .claude/commands/pulumi-logs.md
---
description: View Pulumi stack logs and outputs
allowed-tools: Bash, Read
argument-hint: [stack-name]
---
\`\`\`bash
pulumi stack output --stack ${1:-dev} --json
pulumi stack history --stack ${1:-dev} | head -20
\`\`\`

# .claude/commands/pulumi-destroy.md
---
description: Destroy Pulumi stack (DANGEROUS)
allowed-tools: Bash, AskUserQuestion
argument-hint: [stack-name]
---
**WARNING**: This destroys all resources. Always confirm with user first.
\`\`\`bash
pulumi destroy --stack ${1:-dev} --yes
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

# .claude/commands/tf-output.md
---
description: Show Terraform outputs
allowed-tools: Bash, Read
---
\`\`\`bash
terraform output -json
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

# .claude/commands/nest-e2e.md
---
description: Run NestJS e2e tests
allowed-tools: Bash, Read
argument-hint: [test-pattern]
---
\`\`\`bash
npm run test:e2e -- $1
\`\`\`

# .claude/commands/nest-migrate.md
---
description: Run database migrations (MikroORM/TypeORM)
allowed-tools: Bash, Read
argument-hint: [migration-name]
---
\`\`\`bash
# For MikroORM:
npx mikro-orm migration:create --name $1
npx mikro-orm migration:up

# For TypeORM:
# npm run typeorm migration:generate -- -n $1
# npm run typeorm migration:run
\`\`\`
```

#### Next.js / Frontend
```markdown
# .claude/commands/next-dev.md
---
description: Start Next.js development server
allowed-tools: Bash
---
\`\`\`bash
npm run dev
\`\`\`

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
# .claude/commands/docker-build.md
---
description: Build Docker image
allowed-tools: Bash, Read
argument-hint: [image-name] [dockerfile]
---
\`\`\`bash
docker build -t ${1:-app} -f ${2:-Dockerfile} .
\`\`\`

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

# .claude/commands/docker-shell.md
---
description: Open shell in Docker container
allowed-tools: Bash
argument-hint: <container-name>
---
\`\`\`bash
docker compose exec $1 /bin/sh
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

# .claude/commands/py-migrate.md
---
description: Run database migrations (Alembic/Django)
allowed-tools: Bash, Read
argument-hint: [migration-message]
---
\`\`\`bash
# Alembic:
alembic revision --autogenerate -m "$1"
alembic upgrade head

# Django:
# python manage.py makemigrations
# python manage.py migrate
\`\`\`

# .claude/commands/py-shell.md
---
description: Open Python/Django shell
allowed-tools: Bash
---
\`\`\`bash
python -c "import IPython; IPython.embed()" || python
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
# PostgreSQL:
psql -h localhost -U postgres ${1:-app}

# MySQL:
# mysql -h localhost -u root -p ${1:-app}
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

# .claude/commands/db-restore.md
---
description: Restore database from dump
allowed-tools: Bash, AskUserQuestion
argument-hint: <database-name> <dump-file>
---
**WARNING**: This will overwrite existing data. Confirm with user first.
\`\`\`bash
psql -h localhost -U postgres $1 < $2
\`\`\`
```

#### AWS
```markdown
# .claude/commands/aws-logs.md
---
description: Tail AWS CloudWatch logs
allowed-tools: Bash, Read
argument-hint: <log-group>
---
\`\`\`bash
aws logs tail $1 --follow --since 1h
\`\`\`

# .claude/commands/aws-deploy.md
---
description: Deploy to AWS (ECS/Lambda)
allowed-tools: Bash, Read, AskUserQuestion
argument-hint: [service-name]
---
**IMPORTANT**: Confirm deployment target with user first.
\`\`\`bash
# ECS:
aws ecs update-service --cluster prod --service $1 --force-new-deployment

# Lambda:
# aws lambda update-function-code --function-name $1 --zip-file fileb://function.zip
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
| `pulumi` in dependencies or Pulumi.yaml exists | pulumi-preview, pulumi-up, pulumi-logs, pulumi-destroy |
| `terraform` or .tf files exist | tf-plan, tf-apply, tf-output |
| `@nestjs/core` in package.json | nest-generate, nest-test, nest-e2e, nest-migrate |
| `next` in package.json | next-dev, next-build, next-lint, next-test |
| `docker-compose.yml` or Dockerfile exists | docker-build, docker-up, docker-logs, docker-shell, docker-down |
| `pytest` or `requirements.txt` exists | py-test, py-lint, py-migrate, py-shell |
| `fastapi` or `django` in requirements | py-test, py-lint, py-migrate |
| PostgreSQL/MySQL detected (in docker-compose or env) | db-connect, db-dump, db-restore |
| AWS SDK detected or .aws exists | aws-logs, aws-deploy |
| Git repo detected | gh-pr, gh-issues |

### Ask User Which Skills to Generate

After detecting the stack, present the user with:

**Detected technologies**: [list]

**Recommended skills to generate**:
- [ ] Infrastructure: pulumi-preview, pulumi-up, pulumi-logs
- [ ] Backend: nest-generate, nest-test, nest-migrate
- [ ] Frontend: next-build, next-lint, next-test
- [ ] Docker: docker-up, docker-logs, docker-shell
- [ ] Database: db-connect, db-dump
- [ ] GitHub: gh-pr, gh-issues

**Options**:
1. Generate all recommended skills
2. Let me choose which skills to generate
3. Skip skill generation

## 9. Git Integration (Optional)

Ask user if they want to:
- Add progress.md to .gitignore (for private progress)
- Or commit it (for shared progress)

If committing:
```bash
git add .claude/ progress.md standards.md
git commit -m "chore: initialize claude workflow system"
```

Note: `.claude/session-archive/` is created but will be empty initially.

## 10. Report Results

Summarize what was created:

```
## Workflow Initialized

**Project**: [name]
**Detected Stack**: [list of detected technologies]

**Files Created**:
- `.claude/workflow.json` - Workflow configuration
- `progress.md` - Session progress tracking
- `standards.md` - Code standards

**Agents Created**:
- `.claude/agents/[project]-backend.md` - Backend development
- `.claude/agents/[project]-frontend.md` - Frontend development
- `.claude/agents/[project]-reviewer.md` - Code review (read-only)
- [etc.]

**Skills Created**:
- `.claude/commands/pulumi-preview.md` - Preview infrastructure changes
- `.claude/commands/nest-generate.md` - Generate NestJS resources
- `.claude/commands/docker-up.md` - Start Docker services
- [etc. based on detected stack]

**Agent Features**:
- All agents read progress.md before starting work
- All agents update progress.md after completing work
- All agents follow standards.md conventions
- Specialized agents delegate to each other (no scope creep)
- Agents can use generated skills for common tasks

**Next Steps**:
1. Review generated agents in `.claude/agents/`
2. Review generated skills in `.claude/commands/`
3. Customize as needed
4. Run `/wf-start-session` to begin working

**Available Commands**:
- `/wf-start-session` - Begin a development session
- `/wf-end-session` - Wrap up and update progress
- `/wf-implement <feature>` - Build a new feature
- `/wf-fix-bug <issue>` - Debug and fix an issue
- `/wf-commit [message]` - Create a conventional commit
- `/wf-review` - Review code changes
- `/wf-test` - Run and fix tests
- [Plus generated stack-specific skills]
```

## Example: NestJS + Next.js Stack

For a project like SXRX with NestJS backend + Next.js frontend:

**Detected**:
- Backend: NestJS, MikroORM, PostgreSQL
- Frontend: Next.js (static export), React, TanStack Query
- Testing: Jest (API), Vitest (App)
- Infra: Terraform

**Agents to generate**:
1. `sxrx-backend.md` - NestJS modules, controllers, services, MikroORM entities
2. `sxrx-frontend.md` - React components, hooks, TanStack Query
3. `sxrx-qa.md` - Jest tests, Vitest tests, coverage
4. `sxrx-infra.md` - Terraform resources
5. `sxrx-reviewer.md` - Full-stack code review (read-only)

## Example: FastAPI + React Stack

**Agents to generate**:
1. `project-backend.md` - FastAPI routes, Pydantic schemas, SQLAlchemy
2. `project-frontend.md` - React components, hooks, state
3. `project-qa.md` - pytest, Vitest
4. `project-reviewer.md` - Code review (read-only)
