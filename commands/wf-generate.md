---
description: Generate agents and skills based on tech stack
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
argument-hint: "--from-prd | --from-code | --ask"
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

## 2. Check Existing Agents and Skills

```bash
ls .claude/agents/*.md 2>/dev/null | wc -l
ls -d .claude/skills/*/ 2>/dev/null | wc -l
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
rm -rf .claude/skills/*/ 2>/dev/null
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

Generate agents using role-based templates from `templates/agents/`.

### Determine Project Roles

Based on detected tech stack, determine which roles the project needs:

| Has This | Needs Role |
|----------|------------|
| Next.js, React, Vue, Angular, Svelte | UI Developer |
| NestJS, Express, FastAPI, Django, Rails, Go, Rust | Backend Developer |
| React Native, Flutter, Swift, Kotlin | Mobile Developer (use generic for now) |
| Both frontend AND backend | Choose: Fullstack OR separate UI + Backend |
| Any project | Reviewer (always) |

**Detection logic**:
```bash
# Check for frontend
HAS_UI=$(cat package.json 2>/dev/null | grep -E '"next"|"react"|"vue"|"@angular"|"svelte"' | head -1)

# Check for backend
HAS_BACKEND=$(cat package.json 2>/dev/null | grep -E '"@nestjs"|"express"|"fastify"' | head -1)
# Also check Python/Go/Rust
HAS_BACKEND_PY=$(ls requirements.txt pyproject.toml 2>/dev/null | head -1)
HAS_BACKEND_GO=$(ls go.mod 2>/dev/null)
HAS_BACKEND_RUST=$(ls Cargo.toml 2>/dev/null)
```

### Template Selection

Based on roles detected, select templates:

| Project Type | Templates to Use |
|--------------|------------------|
| Frontend only | `ui-developer.md` + `reviewer.md` |
| Backend only | `backend-developer.md` + `reviewer.md` |
| Both (small team) | `fullstack-developer.md` + `reviewer.md` |
| Both (larger team) | `ui-developer.md` + `backend-developer.md` + `reviewer.md` |
| Unknown/Other | `generic-developer.md` + `reviewer.md` |

**Ask user if both frontend and backend**:
- Option A: Single fullstack agent (simpler)
- Option B: Separate UI + backend agents (more specialized)

### Check for Templates

First, check if templates exist:

```bash
# Check wf-system installation
WF_TEMPLATES="${HOME}/wf-system/templates/agents"
ls "$WF_TEMPLATES"/*.md 2>/dev/null | wc -l
```

If templates don't exist, fall back to generic agent creation (legacy behavior).

### Generate Agents from Templates

For each selected template:

1. Read the template file
2. Replace `{{project}}` with the actual project name (from workflow.json)
3. Write to `.claude/agents/`

**Example**:
```bash
PROJECT_NAME=$(cat .claude/workflow.json | grep '"project"' | cut -d'"' -f4)

# For UI Developer
if [ -n "$HAS_UI" ]; then
  sed "s/{{project}}/$PROJECT_NAME/g" "$WF_TEMPLATES/ui-developer.md" > ".claude/agents/${PROJECT_NAME}-ui.md"
fi

# For Backend Developer
if [ -n "$HAS_BACKEND" ] || [ -n "$HAS_BACKEND_PY" ]; then
  sed "s/{{project}}/$PROJECT_NAME/g" "$WF_TEMPLATES/backend-developer.md" > ".claude/agents/${PROJECT_NAME}-backend.md"
fi

# Reviewer (always)
sed "s/{{project}}/$PROJECT_NAME/g" "$WF_TEMPLATES/reviewer.md" > ".claude/agents/${PROJECT_NAME}-reviewer.md"
```

### Templates Include Skills

**Important**: The templates already have appropriate skills pre-assigned:

| Template | Skills Included |
|----------|-----------------|
| `ui-developer.md` | `visual-verify` (for visual verification) |
| `fullstack-developer.md` | `visual-verify` (for visual verification) |
| `backend-developer.md` | (none - no UI work) |
| `reviewer.md` | (none - read-only agent) |
| `generic-developer.md` | (none - basic development) |

Skills are defined in the template's YAML frontmatter:
```yaml
skills: visual-verify
```

### Design Context for UI Agents

Check if design is configured in workflow.json:

```bash
cat .claude/workflow.json 2>/dev/null | grep -A 10 '"design"'
```

**If design is configured**, append to UI/fullstack agent:

```markdown
## Design Resources

### Figma
{If configured: "File: {figma_url} - Use mcp__figma__get_design_context for implementation details"}

### Design System
Using **{design.system}** component library.
- Components location: {design.systemConfig.componentsDir}
- Theme config: {design.systemConfig.themeFile}
```

### Create Directory

```bash
mkdir -p .claude/agents
```

### Fallback: No Templates Found

If wf-system templates not found, use legacy inline generation (kept for backward compatibility) with simplified structure.

## 8. Generate Stack-Specific Skills

Create Agent Skills in `.claude/skills/` based on detected stack. Agent Skills are automatically discovered and used by Claude when relevant.

```bash
mkdir -p .claude/skills
```

### Skills Structure

Each skill is a **directory** containing `SKILL.md` and optional supporting files:

```
.claude/skills/
├── nest-test/
│   └── SKILL.md
├── docker-up/
│   └── SKILL.md
└── db-status/
    └── SKILL.md
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

1. **Description** - Clear description so Claude knows when to use this skill
2. **Context section** - Use inline command syntax to gather relevant info when skill loads
3. **Task section** - Clear instructions with bash commands
4. **Error guidance** - Tell Claude what to do if something fails

**SYNTAX NOTE**: In templates below, `[[command]]` is a placeholder. When generating actual skill files, replace `[[command]]` with the inline execution syntax: exclamation mark followed by command in backticks.

**STRUCTURE**: Each skill goes in `.claude/skills/{skill-name}/SKILL.md`

**Examples of adapting to other stacks:**
- Vue detected? → Create `skills/vue-build/SKILL.md`, `skills/vue-lint/SKILL.md`
- MongoDB detected? → Create `skills/mongo-status/SKILL.md`, `skills/mongo-dump/SKILL.md`
- Rails detected? → Create `skills/rails-generate/SKILL.md`, `skills/rails-test/SKILL.md`
- Go detected? → Create `skills/go-build/SKILL.md`, `skills/go-test/SKILL.md`
- Rust detected? → Create `skills/cargo-build/SKILL.md`, `skills/cargo-test/SKILL.md`

Follow the same structure for any technology. The examples below show the pattern:

#### Pulumi / Infrastructure

**File: `.claude/skills/pulumi-preview/SKILL.md`**
```markdown
---
description: Preview Pulumi infrastructure changes
allowed-tools: Bash, Read
argument-hint: [stack-name]
---

# Pulumi Preview

## Context
- Current stack: [[pulumi stack --show-name 2>/dev/null || echo "no stack selected"]]
- Available stacks: [[pulumi stack ls 2>/dev/null | head -10]]

## Task
Preview infrastructure changes without applying:
\`\`\`bash
pulumi preview --stack ${1:-dev} --diff
\`\`\`

Review the changes and explain what will be created, updated, or destroyed.
```

**File: `.claude/skills/pulumi-up/SKILL.md`**
```markdown
---
description: Apply Pulumi infrastructure changes
allowed-tools: Bash, Read, AskUserQuestion
argument-hint: [stack-name]
---

# Pulumi Up

## Context
- Current stack: [[pulumi stack --show-name 2>/dev/null || echo "no stack selected"]]

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

**File: `.claude/skills/tf-plan/SKILL.md`**
```markdown
---
description: Plan Terraform infrastructure changes
allowed-tools: Bash, Read
argument-hint: [workspace]
---

# Terraform Plan

## Context
- Current workspace: [[terraform workspace show 2>/dev/null || echo "default"]]
- Available workspaces: [[terraform workspace list 2>/dev/null]]

## Task
\`\`\`bash
terraform workspace select ${1:-dev} 2>/dev/null || true
terraform plan -out=tfplan
\`\`\`

Explain the planned changes clearly.
```

**File: `.claude/skills/tf-apply/SKILL.md`**
```markdown
---
description: Apply Terraform changes
allowed-tools: Bash, Read, AskUserQuestion
---

# Terraform Apply

## Context
- Current workspace: [[terraform workspace show 2>/dev/null]]
- Plan file exists: [[ls -la tfplan 2>/dev/null || echo "No tfplan file found"]]

## Task
**IMPORTANT**: Review plan output and confirm with user before applying.

\`\`\`bash
terraform apply tfplan
\`\`\`
```

#### NestJS / Backend

**File: `.claude/skills/nest-generate/SKILL.md`**
```markdown
---
description: Generate NestJS resources (module, controller, service)
allowed-tools: Bash, Read
argument-hint: <type> <name>
---

# NestJS Generate

## Context
- Available types: module, controller, service, resource, guard, pipe, interceptor, middleware, filter
- Existing modules: [[ls -d src/*/ 2>/dev/null | head -10]]

## Task
Generate NestJS resource:
\`\`\`bash
npx nest generate $1 $2
\`\`\`

After generation, show the created files.
```

**File: `.claude/skills/nest-test/SKILL.md`**
```markdown
---
description: Run NestJS tests with coverage
allowed-tools: Bash, Read
argument-hint: [test-pattern]
---

# NestJS Tests

## Context
- Test scripts: [[cat package.json | grep -E '"test' | head -5]]
- Test files: [[find src -name "*.spec.ts" | wc -l]] spec files found

## Task
Run tests:
\`\`\`bash
npm run test -- ${1:---coverage}
\`\`\`

If tests fail, analyze the failures and suggest fixes.
```

**File: `.claude/skills/nest-migrate/SKILL.md`**
```markdown
---
description: Run database migrations (MikroORM/TypeORM)
allowed-tools: Bash, Read, AskUserQuestion
argument-hint: [migration-name]
---

# Database Migration

## Context
- Pending migrations: [[npx mikro-orm migration:pending 2>/dev/null || echo "Check migration status manually"]]
- Recent migrations: [[ls -lt src/migrations/*.ts 2>/dev/null | head -5]]

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

**File: `.claude/skills/next-build/SKILL.md`**
```markdown
---
description: Build Next.js for production
allowed-tools: Bash, Read
---

# Next.js Build

## Context
- Node version: [[node -v]]
- Build scripts: [[cat package.json | grep -E '"build' | head -3]]
- Last build: [[ls -la .next 2>/dev/null | head -3 || echo "No previous build"]]

## Task
\`\`\`bash
npm run build
\`\`\`

If build fails, analyze errors and suggest fixes.
```

**File: `.claude/skills/next-lint/SKILL.md`**
```markdown
---
description: Run Next.js linting and type checking
allowed-tools: Bash, Read
---

# Next.js Lint & Type Check

## Context
- ESLint config: [[ls .eslintrc* eslint.config.* 2>/dev/null | head -1 || echo "No ESLint config found"]]
- TypeScript config: [[ls tsconfig.json 2>/dev/null || echo "No tsconfig.json"]]

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

**File: `.claude/skills/next-test/SKILL.md`**
```markdown
---
description: Run frontend tests (Vitest/Jest)
allowed-tools: Bash, Read
argument-hint: [test-pattern]
---

# Frontend Tests

## Context
- Test framework: [[cat package.json | grep -E '"vitest"|"jest"' | head -1]]
- Test files: [[find . -name "*.test.ts" -o -name "*.test.tsx" -o -name "*.spec.ts" 2>/dev/null | wc -l]] test files

## Task
\`\`\`bash
npm run test -- $1
\`\`\`

If tests fail, analyze and suggest fixes.
```

#### Docker

**File: `.claude/skills/docker-up/SKILL.md`**
```markdown
---
description: Start Docker Compose services
allowed-tools: Bash, Read
argument-hint: [service-name]
---

# Docker Compose Up

## Context
- Compose file: [[ls docker-compose*.yml 2>/dev/null | head -1]]
- Services defined: [[docker compose config --services 2>/dev/null]]
- Running containers: [[docker compose ps 2>/dev/null]]

## Task
\`\`\`bash
docker compose up -d $1
docker compose ps
\`\`\`

Check logs if any service fails to start.
```

**File: `.claude/skills/docker-logs/SKILL.md`**
```markdown
---
description: View Docker container logs
allowed-tools: Bash, Read
argument-hint: <container-name>
---

# Docker Logs

## Context
- Running services: [[docker compose ps 2>/dev/null | tail -10]]

## Task
\`\`\`bash
docker compose logs -f --tail=100 $1
\`\`\`
```

**File: `.claude/skills/docker-down/SKILL.md`**
```markdown
---
description: Stop and remove Docker containers
allowed-tools: Bash, AskUserQuestion
---

# Docker Compose Down

## Context
- Running containers: [[docker compose ps 2>/dev/null]]

## Task
**Confirm with user before stopping services.**

\`\`\`bash
docker compose down
\`\`\`
```

#### Python / FastAPI / Django

**File: `.claude/skills/py-test/SKILL.md`**
```markdown
---
description: Run pytest with coverage
allowed-tools: Bash, Read
argument-hint: [test-path]
---

# Python Tests

## Context
- Python version: [[python --version 2>/dev/null || python3 --version]]
- Pytest config: [[ls pytest.ini pyproject.toml setup.cfg 2>/dev/null | head -1]]
- Test files: [[find . -name "test_*.py" -o -name "*_test.py" 2>/dev/null | wc -l]] test files

## Task
\`\`\`bash
pytest ${1:-.} -v --cov --cov-report=term-missing
\`\`\`

Analyze failures and suggest fixes.
```

**File: `.claude/skills/py-lint/SKILL.md`**
```markdown
---
description: Run Python linting (ruff/flake8/mypy)
allowed-tools: Bash, Read
---

# Python Lint

## Context
- Linter config: [[ls ruff.toml .flake8 mypy.ini pyproject.toml 2>/dev/null | head -3]]

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

**File: `.claude/skills/db-status/SKILL.md`**
```markdown
---
description: Check database connection and status
allowed-tools: Bash, Read
---

# Database Status

## Context
- Docker DB containers: [[docker compose ps 2>/dev/null | grep -E 'postgres|mysql|mongo' || echo "No DB containers found"]]
- Environment DB config: [[grep -E 'DATABASE|DB_' .env 2>/dev/null | head -5 || echo "Check .env for DB config"]]

## Task
Check database connectivity:
\`\`\`bash
# For PostgreSQL:
psql -h localhost -U postgres -c "SELECT version();" 2>/dev/null || echo "PostgreSQL not accessible"

# For MySQL:
# mysql -h localhost -u root -e "SELECT VERSION();" 2>/dev/null || echo "MySQL not accessible"
\`\`\`
```

**File: `.claude/skills/db-dump/SKILL.md`**
```markdown
---
description: Dump database to file
allowed-tools: Bash, AskUserQuestion
argument-hint: <database-name> <output-file>
---

# Database Dump

## Context
- Available databases: [[psql -h localhost -U postgres -c "\\l" 2>/dev/null | head -10 || echo "Cannot list databases"]]

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

**File: `.claude/skills/gh-pr/SKILL.md`**
```markdown
---
description: Create GitHub Pull Request
allowed-tools: Bash, Read
argument-hint: [base-branch]
---

# Create Pull Request

## Context
- Current branch: [[git branch --show-current]]
- Base branch: [[git remote show origin 2>/dev/null | grep "HEAD branch" | cut -d: -f2 | xargs]]
- Unpushed commits: [[git log @{u}.. --oneline 2>/dev/null || echo "Branch not pushed yet"]]
- Changed files: [[git diff --stat @{u}.. 2>/dev/null | tail -5]]

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

**File: `.claude/skills/gh-issues/SKILL.md`**
```markdown
---
description: List and manage GitHub issues
allowed-tools: Bash, Read
argument-hint: [label]
---

# GitHub Issues

## Context
- Repository: [[gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "Not a GitHub repo"]]
- Open issues count: [[gh issue list --state open --json number -q 'length' 2>/dev/null || echo "?"]]

## Task
List open issues:
\`\`\`bash
gh issue list --state open ${1:+--label "$1"} --limit 20
\`\`\`
```

**File: `.claude/skills/gh-pr-status/SKILL.md`**
```markdown
---
description: Check PR status and reviews
allowed-tools: Bash, Read
argument-hint: [pr-number]
---

# PR Status

## Context
- Current branch PRs: [[gh pr list --head $(git branch --show-current) 2>/dev/null]]

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

**File: `.claude/skills/deps-check/SKILL.md`**
```markdown
---
description: Check for outdated dependencies
allowed-tools: Bash, Read
---

# Dependency Check

## Context
- Package manager: [[ls package-lock.json yarn.lock pnpm-lock.yaml requirements.txt Pipfile.lock 2>/dev/null | head -1]]

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

**File: `.claude/skills/env-check/SKILL.md`**
```markdown
---
description: Verify environment setup
allowed-tools: Bash, Read
---

# Environment Check

## Context
- Node: [[node -v 2>/dev/null || echo "Not installed"]]
- npm: [[npm -v 2>/dev/null || echo "Not installed"]]
- Python: [[python3 --version 2>/dev/null || echo "Not installed"]]
- Docker: [[docker --version 2>/dev/null || echo "Not installed"]]
- Git: [[git --version]]

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

## 9. Update Agents with Generated Skills

After generating skills, circle back to update agent files with appropriate skills.

### List Generated Skills

```bash
ls -d .claude/skills/*/ 2>/dev/null | xargs -I {} basename {}
```

### Map Skills to Agent Roles

Determine which skills apply to which agent type:

| Agent Role | Skills to Assign |
|------------|------------------|
| UI/Frontend (`*-ui`, `*-frontend`) | `visual-verify`, `next-*`, `react-*`, `vue-*` |
| Backend (`*-backend`, `*-api`) | `nest-*`, `express-*`, `fastapi-*`, `django-*`, `db-*` |
| Fullstack (`*-fullstack`) | All UI skills + all backend skills |
| QA/Test (`*-qa`, `*-test`) | `*-test`, `*-lint`, `*-e2e` |
| Infra (`*-infra`, `*-devops`) | `docker-*`, `pulumi-*`, `tf-*` |
| Reviewer (`*-reviewer`) | None (read-only agent) |
| Generic (`*-dev`) | `gh-pr`, `gh-issues`, `deps-check`, `env-check` |

### Update Agent Files

For each agent in `.claude/agents/`:

1. Read the agent file
2. Determine which generated skills match the agent's role
3. Update the YAML frontmatter `skills` field

**Example**:
```bash
# If agent is project-ui.md and we generated: visual-verify, next-build, next-lint
# Update the frontmatter:

---
name: project-ui
description: UI developer for project...
tools: Read, Edit, Write, Bash, Grep, Glob
skills: visual-verify, next-build, next-lint
model: opus
---
```

**IMPORTANT**: All sub-agents should use `model: opus` for best reasoning capabilities.

### Skill Assignment Logic

```bash
# For each agent file
for agent in .claude/agents/*.md; do
  agent_name=$(basename "$agent" .md)

  # Determine role from filename
  if [[ "$agent_name" == *"-ui"* ]] || [[ "$agent_name" == *"-frontend"* ]]; then
    # Assign UI-related skills
    skills="visual-verify"
    [ -d ".claude/skills/next-build" ] && skills="$skills, next-build"
    [ -d ".claude/skills/next-lint" ] && skills="$skills, next-lint"
  elif [[ "$agent_name" == *"-backend"* ]] || [[ "$agent_name" == *"-api"* ]]; then
    # Assign backend-related skills
    skills=""
    [ -d ".claude/skills/nest-test" ] && skills="nest-test"
    [ -d ".claude/skills/db-status" ] && skills="${skills:+$skills, }db-status"
  elif [[ "$agent_name" == *"-fullstack"* ]]; then
    # Assign both UI and backend skills
    skills="visual-verify"
    # ... add all relevant skills
  fi

  # Update agent file with skills
  # (Use Edit tool to update the YAML frontmatter)
done
```

### Always Include These Skills

Some skills should be available to most development agents:

| Skill | Assign To |
|-------|-----------|
| `visual-verify` | Any agent with UI responsibilities |
| `gh-pr` | All development agents |
| `gh-issues` | All development agents |
| `deps-check` | All development agents |

### Verify Updates

After updating, verify agents have skills:
```bash
grep -l "^skills:" .claude/agents/*.md
```

---

## 10. Report Results

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
- `.claude/skills/nest-generate/SKILL.md` - Generate NestJS resources
- `.claude/skills/docker-up/SKILL.md` - Start Docker services
- `.claude/skills/gh-pr/SKILL.md` - Create GitHub PR

**Next Steps**:
1. Review generated agents in `.claude/agents/`
2. Review generated skills in `.claude/skills/`
3. Customize as needed
4. Run `/wf-start-session` to begin working

**Recommended**: `/wf-start-session` or `/wf-pick-issue` to start development.
```

## 11. Suggest Workflow

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
