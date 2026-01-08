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

**IMPORTANT**: The templates below are **EXAMPLES**, not a strict list. Create skills for ANY detected technology using the same pattern:

1. **Context section** - Use `!`command`` to gather relevant info when skill loads
2. **Task section** - Clear instructions with bash commands
3. **Error guidance** - Tell Claude what to do if something fails

**Examples of adapting to other stacks:**
- Vue detected? → Create `vue-build.md`, `vue-lint.md`, `vue-test.md`
- MongoDB detected? → Create `mongo-status.md`, `mongo-dump.md`
- Rails detected? → Create `rails-generate.md`, `rails-test.md`, `rails-migrate.md`
- Go detected? → Create `go-build.md`, `go-test.md`, `go-lint.md`
- Rust detected? → Create `cargo-build.md`, `cargo-test.md`, `cargo-clippy.md`

Follow the same structure for any technology. The examples below show the pattern:

#### Pulumi / Infrastructure

**File: `.claude/commands/pulumi-preview.md`**
```markdown
---
description: Preview Pulumi infrastructure changes
allowed-tools: Bash, Read
argument-hint: [stack-name]
---

# Pulumi Preview

## Context
- Current stack: !`pulumi stack --show-name 2>/dev/null || echo "no stack selected"`
- Available stacks: !`pulumi stack ls 2>/dev/null | head -10`

## Task
Preview infrastructure changes without applying:
\`\`\`bash
pulumi preview --stack ${1:-dev} --diff
\`\`\`

Review the changes and explain what will be created, updated, or destroyed.
```

**File: `.claude/commands/pulumi-up.md`**
```markdown
---
description: Apply Pulumi infrastructure changes
allowed-tools: Bash, Read, AskUserQuestion
argument-hint: [stack-name]
---

# Pulumi Up

## Context
- Current stack: !`pulumi stack --show-name 2>/dev/null || echo "no stack selected"`

## Task
**IMPORTANT**: Always run preview first and get user confirmation before applying.

1. First, show preview:
\`\`\`bash
pulumi preview --stack ${1:-dev}
\`\`\`

2. Ask user to confirm the changes

3. If confirmed, apply:
\`\`\`bash
pulumi up --stack ${1:-dev} --yes
\`\`\`
```

#### Terraform / Infrastructure

**File: `.claude/commands/tf-plan.md`**
```markdown
---
description: Plan Terraform infrastructure changes
allowed-tools: Bash, Read
argument-hint: [workspace]
---

# Terraform Plan

## Context
- Current workspace: !`terraform workspace show 2>/dev/null || echo "default"`
- Available workspaces: !`terraform workspace list 2>/dev/null`

## Task
\`\`\`bash
terraform workspace select ${1:-dev} 2>/dev/null || true
terraform plan -out=tfplan
\`\`\`

Explain the planned changes clearly.
```

**File: `.claude/commands/tf-apply.md`**
```markdown
---
description: Apply Terraform changes
allowed-tools: Bash, Read, AskUserQuestion
---

# Terraform Apply

## Context
- Current workspace: !`terraform workspace show 2>/dev/null`
- Plan file exists: !`ls -la tfplan 2>/dev/null || echo "No tfplan file found"`

## Task
**IMPORTANT**: Review plan output and confirm with user before applying.

\`\`\`bash
terraform apply tfplan
\`\`\`
```

#### NestJS / Backend

**File: `.claude/commands/nest-generate.md`**
```markdown
---
description: Generate NestJS resources (module, controller, service)
allowed-tools: Bash, Read
argument-hint: <type> <name>
---

# NestJS Generate

## Context
- Available types: module, controller, service, resource, guard, pipe, interceptor, middleware, filter
- Existing modules: !`ls -d src/*/ 2>/dev/null | head -10`

## Task
Generate NestJS resource:
\`\`\`bash
npx nest generate $1 $2
\`\`\`

After generation, show the created files.
```

**File: `.claude/commands/nest-test.md`**
```markdown
---
description: Run NestJS tests with coverage
allowed-tools: Bash, Read
argument-hint: [test-pattern]
---

# NestJS Tests

## Context
- Test scripts: !`cat package.json | grep -E '"test' | head -5`
- Test files: !`find src -name "*.spec.ts" | wc -l` spec files found

## Task
Run tests:
\`\`\`bash
npm run test -- ${1:---coverage}
\`\`\`

If tests fail, analyze the failures and suggest fixes.
```

**File: `.claude/commands/nest-migrate.md`**
```markdown
---
description: Run database migrations (MikroORM/TypeORM)
allowed-tools: Bash, Read, AskUserQuestion
argument-hint: [migration-name]
---

# Database Migration

## Context
- Pending migrations: !`npx mikro-orm migration:pending 2>/dev/null || echo "Check migration status manually"`
- Recent migrations: !`ls -lt src/migrations/*.ts 2>/dev/null | head -5`

## Task
1. Create migration (if name provided):
\`\`\`bash
npx mikro-orm migration:create --name $1
\`\`\`

2. Run pending migrations:
\`\`\`bash
npx mikro-orm migration:up
\`\`\`

**WARNING**: Always backup database before running migrations in production.
```

#### Next.js / Frontend

**File: `.claude/commands/next-build.md`**
```markdown
---
description: Build Next.js for production
allowed-tools: Bash, Read
---

# Next.js Build

## Context
- Node version: !`node -v`
- Build scripts: !`cat package.json | grep -E '"build' | head -3`
- Last build: !`ls -la .next 2>/dev/null | head -3 || echo "No previous build"`

## Task
\`\`\`bash
npm run build
\`\`\`

If build fails, analyze errors and suggest fixes.
```

**File: `.claude/commands/next-lint.md`**
```markdown
---
description: Run Next.js linting and type checking
allowed-tools: Bash, Read
---

# Next.js Lint & Type Check

## Context
- ESLint config: !`ls .eslintrc* eslint.config.* 2>/dev/null | head -1 || echo "No ESLint config found"`
- TypeScript config: !`ls tsconfig.json 2>/dev/null || echo "No tsconfig.json"`

## Task
Run linting:
\`\`\`bash
npm run lint
\`\`\`

Run type check:
\`\`\`bash
npx tsc --noEmit
\`\`\`

Fix any issues found or explain how to fix them.
```

**File: `.claude/commands/next-test.md`**
```markdown
---
description: Run frontend tests (Vitest/Jest)
allowed-tools: Bash, Read
argument-hint: [test-pattern]
---

# Frontend Tests

## Context
- Test framework: !`cat package.json | grep -E '"vitest"|"jest"' | head -1`
- Test files: !`find . -name "*.test.ts" -o -name "*.test.tsx" -o -name "*.spec.ts" 2>/dev/null | wc -l` test files

## Task
\`\`\`bash
npm run test -- $1
\`\`\`

If tests fail, analyze and suggest fixes.
```

#### Docker

**File: `.claude/commands/docker-up.md`**
```markdown
---
description: Start Docker Compose services
allowed-tools: Bash, Read
argument-hint: [service-name]
---

# Docker Compose Up

## Context
- Compose file: !`ls docker-compose*.yml 2>/dev/null | head -1`
- Services defined: !`docker compose config --services 2>/dev/null`
- Running containers: !`docker compose ps 2>/dev/null`

## Task
\`\`\`bash
docker compose up -d $1
docker compose ps
\`\`\`

Check logs if any service fails to start.
```

**File: `.claude/commands/docker-logs.md`**
```markdown
---
description: View Docker container logs
allowed-tools: Bash, Read
argument-hint: <container-name>
---

# Docker Logs

## Context
- Running services: !`docker compose ps 2>/dev/null | tail -10`

## Task
\`\`\`bash
docker compose logs -f --tail=100 $1
\`\`\`
```

**File: `.claude/commands/docker-down.md`**
```markdown
---
description: Stop and remove Docker containers
allowed-tools: Bash, AskUserQuestion
---

# Docker Compose Down

## Context
- Running containers: !`docker compose ps 2>/dev/null`

## Task
**Confirm with user before stopping services.**

\`\`\`bash
docker compose down
\`\`\`
```

#### Python / FastAPI / Django

**File: `.claude/commands/py-test.md`**
```markdown
---
description: Run pytest with coverage
allowed-tools: Bash, Read
argument-hint: [test-path]
---

# Python Tests

## Context
- Python version: !`python --version 2>/dev/null || python3 --version`
- Pytest config: !`ls pytest.ini pyproject.toml setup.cfg 2>/dev/null | head -1`
- Test files: !`find . -name "test_*.py" -o -name "*_test.py" 2>/dev/null | wc -l` test files

## Task
\`\`\`bash
pytest ${1:-.} -v --cov --cov-report=term-missing
\`\`\`

Analyze failures and suggest fixes.
```

**File: `.claude/commands/py-lint.md`**
```markdown
---
description: Run Python linting (ruff/flake8/mypy)
allowed-tools: Bash, Read
---

# Python Lint

## Context
- Linter config: !`ls ruff.toml .flake8 mypy.ini pyproject.toml 2>/dev/null | head -3`

## Task
Run linting:
\`\`\`bash
ruff check . || flake8 .
\`\`\`

Run type check:
\`\`\`bash
mypy . || true
\`\`\`

Fix issues or explain how to fix them.
```

#### Database

**File: `.claude/commands/db-status.md`**
```markdown
---
description: Check database connection and status
allowed-tools: Bash, Read
---

# Database Status

## Context
- Docker DB containers: !`docker compose ps 2>/dev/null | grep -E 'postgres|mysql|mongo' || echo "No DB containers found"`
- Environment DB config: !`grep -E 'DATABASE|DB_' .env 2>/dev/null | head -5 || echo "Check .env for DB config"`

## Task
Check database connectivity:
\`\`\`bash
# For PostgreSQL:
psql -h localhost -U postgres -c "SELECT version();" 2>/dev/null || echo "PostgreSQL not accessible"

# For MySQL:
# mysql -h localhost -u root -e "SELECT VERSION();" 2>/dev/null || echo "MySQL not accessible"
\`\`\`
```

**File: `.claude/commands/db-dump.md`**
```markdown
---
description: Dump database to file
allowed-tools: Bash, AskUserQuestion
argument-hint: <database-name> <output-file>
---

# Database Dump

## Context
- Available databases: !`psql -h localhost -U postgres -c "\\l" 2>/dev/null | head -10 || echo "Cannot list databases"`

## Task
**Confirm database name and output file with user.**

\`\`\`bash
pg_dump -h localhost -U postgres $1 > $2
\`\`\`

Verify dump was created:
\`\`\`bash
ls -lh $2
\`\`\`
```

#### Git / GitHub

**File: `.claude/commands/gh-pr.md`**
```markdown
---
description: Create GitHub Pull Request
allowed-tools: Bash, Read
argument-hint: [base-branch]
---

# Create Pull Request

## Context
- Current branch: !`git branch --show-current`
- Base branch: !`git remote show origin 2>/dev/null | grep "HEAD branch" | cut -d: -f2 | xargs`
- Unpushed commits: !`git log @{u}.. --oneline 2>/dev/null || echo "Branch not pushed yet"`
- Changed files: !`git diff --stat @{u}.. 2>/dev/null | tail -5`

## Task
1. Push current branch if needed:
\`\`\`bash
git push -u origin $(git branch --show-current)
\`\`\`

2. Create PR:
\`\`\`bash
gh pr create --base ${1:-main} --fill
\`\`\`
```

**File: `.claude/commands/gh-issues.md`**
```markdown
---
description: List and manage GitHub issues
allowed-tools: Bash, Read
argument-hint: [label]
---

# GitHub Issues

## Context
- Repository: !`gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "Not a GitHub repo"`
- Open issues count: !`gh issue list --state open --json number -q 'length' 2>/dev/null || echo "?"`

## Task
List open issues:
\`\`\`bash
gh issue list --state open ${1:+--label "$1"} --limit 20
\`\`\`
```

**File: `.claude/commands/gh-pr-status.md`**
```markdown
---
description: Check PR status and reviews
allowed-tools: Bash, Read
argument-hint: [pr-number]
---

# PR Status

## Context
- Current branch PRs: !`gh pr list --head $(git branch --show-current) 2>/dev/null`

## Task
Show PR details:
\`\`\`bash
gh pr view ${1:-$(git branch --show-current)} --comments
\`\`\`

Check CI status:
\`\`\`bash
gh pr checks ${1:-$(git branch --show-current)}
\`\`\`
```

#### General Utilities

**File: `.claude/commands/deps-check.md`**
```markdown
---
description: Check for outdated dependencies
allowed-tools: Bash, Read
---

# Dependency Check

## Context
- Package manager: !`ls package-lock.json yarn.lock pnpm-lock.yaml requirements.txt Pipfile.lock 2>/dev/null | head -1`

## Task
Check outdated packages:

For Node.js:
\`\`\`bash
npm outdated || yarn outdated || pnpm outdated
\`\`\`

For Python:
\`\`\`bash
pip list --outdated 2>/dev/null || echo "Run: pip install pip-review"
\`\`\`

Summarize which packages need updates and any security concerns.
```

**File: `.claude/commands/env-check.md`**
```markdown
---
description: Verify environment setup
allowed-tools: Bash, Read
---

# Environment Check

## Context
- Node: !`node -v 2>/dev/null || echo "Not installed"`
- npm: !`npm -v 2>/dev/null || echo "Not installed"`
- Python: !`python3 --version 2>/dev/null || echo "Not installed"`
- Docker: !`docker --version 2>/dev/null || echo "Not installed"`
- Git: !`git --version`

## Task
Check environment variables:
\`\`\`bash
# Check if .env exists
ls -la .env .env.local .env.development 2>/dev/null || echo "No .env files found"

# Check for required env vars (customize as needed)
echo "DATABASE_URL: ${DATABASE_URL:-(not set)}"
echo "API_KEY: ${API_KEY:+(set)}"
\`\`\`

Verify all dependencies are installed:
\`\`\`bash
# Node projects
[ -f package.json ] && npm ls --depth=0 2>/dev/null | head -20

# Python projects
[ -f requirements.txt ] && pip check 2>/dev/null || true
\`\`\`
```

### Skill Generation Logic

**This table shows examples - generate skills for ANY detected technology:**

| Detected | Example Skills |
|----------|----------------|
| Pulumi | pulumi-preview, pulumi-up |
| Terraform | tf-plan, tf-apply |
| NestJS | nest-generate, nest-test, nest-migrate |
| Next.js | next-build, next-lint, next-test |
| Vue | vue-build, vue-lint, vue-test |
| Angular | ng-build, ng-test, ng-lint |
| React (CRA/Vite) | react-build, react-test |
| Express | express-test |
| FastAPI | fastapi-test, fastapi-run |
| Django | django-test, django-migrate, django-shell |
| Rails | rails-generate, rails-test, rails-migrate |
| Go | go-build, go-test, go-lint |
| Rust | cargo-build, cargo-test, cargo-clippy |
| Docker | docker-up, docker-logs, docker-down |
| Python (any) | py-test, py-lint |
| PostgreSQL | db-status, db-dump |
| MongoDB | mongo-status, mongo-dump |
| MySQL | mysql-status, mysql-dump |
| Redis | redis-cli |
| Git/GitHub | gh-pr, gh-issues, gh-pr-status |
| Any project | deps-check, env-check |

**Pattern for any new technology:**
```
[tech]-build    → Build/compile
[tech]-test     → Run tests
[tech]-lint     → Linting/formatting
[tech]-migrate  → Database migrations (if applicable)
[tech]-generate → Scaffolding (if applicable)
[tech]-status   → Health/status check (for services)
```

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
