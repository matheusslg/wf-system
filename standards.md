# Code Standards

> This file contains coding standards for the wf-system project.

## General

- Follow existing patterns in the codebase
- Keep commands focused and single-purpose
- Document non-obvious decisions
- Prefer explicit over implicit

## Commits

Use conventional commits: `type(scope): description`

**Types**:
- `feat`: New feature (new command, new skill)
- `fix`: Bug fix
- `refactor`: Code restructuring
- `docs`: Documentation only
- `chore`: Build, config, installer changes

**Scopes**: `commands`, `hooks`, `docs`, `installer`

**Examples**:
```
feat(commands): add wf-generate command
fix(hooks): handle missing workflow.json
docs: update README with new commands
chore(installer): add symlink verification
```

## Code Style

### Markdown Commands (commands/*.md)

- Use YAML frontmatter with `description`, `allowed-tools`, `argument-hint`
- Structure with numbered sections (## 1. Section Name)
- Include error handling section at end
- Use fenced code blocks with language hints
- Use tables for option/flag documentation

### Shell Scripts (*.sh)

- Use `#!/bin/bash` shebang
- Add `set -e` for error handling
- Quote all variables: `"$VAR"` not `$VAR`
- Use `[[ ]]` for conditionals, not `[ ]`
- Add comments for non-obvious logic

### Python Hooks (hooks/*.py)

- Use `#!/usr/bin/env python3` shebang
- Add module docstring explaining purpose
- Type hints for function parameters
- Use `pathlib.Path` for file operations
- Handle errors gracefully with try/except

## Testing

### Commands

Test commands manually by running them in a test project:
```bash
# Create test project
mkdir /tmp/test-project && cd /tmp/test-project
git init

# Test command
/wf-init
/wf-generate
```

### Hooks

Test hooks by simulating Claude Code environment:
```bash
# Set required env vars
export CLAUDE_CONTEXT_LENGTH=50000
export CLAUDE_CONTEXT_LIMIT=200000

# Run hook
python3 hooks/wf-orchestrator.py
```

## File Organization

```
wf-system/
├── commands/           # Workflow commands (*.md)
│   ├── wf-init.md
│   ├── wf-generate.md
│   └── ...
├── hooks/              # Claude Code hooks (*.py)
│   └── wf-orchestrator.py
├── templates/          # Example/template files
│   ├── workflow.json.example
│   └── progress.md.example
├── docs/               # Documentation
│   └── COMMANDS.md
├── install.sh          # Installer script
├── uninstall.sh        # Uninstaller script
└── README.md           # Project README
```

## Command Structure

Each command should follow this pattern:

```markdown
---
description: Brief description
allowed-tools: Read, Edit, Write, Bash, Grep, Glob
argument-hint: <required> [optional]
---

# Command Name

Brief explanation.

## Arguments
- `$ARGUMENTS` - What arguments this command accepts

## 1. First Step
...

## Error Handling
### Error Case 1
...
```
