---
description: Create a well-formatted conventional commit
allowed-tools: Bash, Read, Grep
argument-hint: "<commit message>"
---

# Commit

Create a well-formatted conventional commit with proper message.

## Arguments
- `$ARGUMENTS` - Optional commit message (if not provided, will auto-generate)

## 0. Load Configuration

Check for workflow configuration:
```bash
cat .claude/workflow.json 2>/dev/null || echo "{}"
```

Extract `scopes` if defined, otherwise auto-detect from directory structure.

## 1. Check Current State

Review what's changed:
```bash
git status
git diff --stat
```

## 2. Analyze Changes

If no message provided in `$ARGUMENTS`, analyze the changes to determine:
- Commit type (feat, fix, refactor, docs, test, chore, style)
- Scope (from config or auto-detected)
- Description of what changed

Read the diff to understand:
```bash
git diff
git diff --cached
```

## 3. Determine Commit Type

Based on the changes:
- **feat**: New feature or functionality
- **fix**: Bug fix
- **refactor**: Code restructuring without behavior change
- **docs**: Documentation only
- **test**: Adding/updating tests
- **chore**: Maintenance, dependencies, build
- **style**: Code style/formatting
- **perf**: Performance improvement

## 4. Determine Scope

From `.claude/workflow.json` scopes, or auto-detect:
- Files in `backend/`, `api/`, `server/` → scope: backend
- Files in `frontend/`, `web/`, `client/`, `src/` → scope: frontend
- Files in `infra/`, `terraform/`, `pulumi/` → scope: infra
- Files in `mobile/`, `ios/`, `android/` → scope: mobile
- Files in `docs/` → scope: docs
- Multiple areas → use most significant or omit scope

## 5. Generate or Use Message

If `$ARGUMENTS` provided:
- Use it as the commit description
- Determine type and scope from changes

If no `$ARGUMENTS`:
- Auto-generate based on analysis
- Keep title concise (50 chars max)

## 6. Stage Changes

Stage appropriate files:
```bash
git add -A
```

Or if selective staging needed:
```bash
git add <specific-files>
```

## 7. Create Commit

Format: `type(scope): description`

```bash
git commit -m "$(cat <<'EOF'
type(scope): description

Optional body with more details.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

## 8. Report Results

Show the commit:
```bash
git log -1 --oneline
git show --stat HEAD
```

Output:
```
## Commit Created

**Commit**: [hash]
**Message**: type(scope): description

**Files Changed**:
- file1.tsx (added/modified/deleted)
- file2.py (added/modified/deleted)

**Lines**: +X -Y
```
