---
description: Build a new feature from description
allowed-tools: Read, Edit, Write, Bash, Grep, Glob, Task
argument-hint: <feature description>
---

# Implement

Build a new feature from scratch based on user description.

## Arguments
- `$ARGUMENTS` - Description of feature (e.g., "Add dark mode toggle", "Create export button")

## 0. Load Configuration

Check for workflow configuration:
```bash
cat .claude/workflow.json 2>/dev/null || echo "{}"
```

Extract:
- `progressFile`: for context on current state
- `agents`: for delegation if configured

## 1. Gather Context

Read the progress log to understand current state:
```bash
cat progress.md 2>/dev/null | head -100 || cat claude-progress.md 2>/dev/null | head -100
```

Parse the feature request from `$ARGUMENTS` to identify:
- What to build
- User-facing behavior
- Technical requirements

## 2. Check Existing Patterns

Search for similar patterns in the codebase:
```bash
# Find similar components/features
grep -r "<similar-keyword>" --include="*.ts" --include="*.tsx" --include="*.py" --include="*.js"
```

Understand:
- How similar features are implemented
- Code conventions to follow
- Where new code should live

## 3. Identify Scope

Based on the feature, determine which area(s) are affected:
- **Frontend/UI**: Components, pages, styling
- **Backend/API**: Endpoints, services, database
- **Infrastructure**: Cloud resources, deployment
- **Full-stack**: Multiple areas

## 4. Delegate to Agent (if configured)

If `agents` are defined in `.claude/workflow.json`:

```
Task: Implement - [feature name]
Agent: [agents.backend or agents.frontend from config]

Context:
- Feature description: [from $ARGUMENTS]
- Similar patterns: [examples found in codebase]
- Code conventions: [from standards.md if exists]
- Session context: [from progress file]

Instructions:
1. Design the implementation approach
2. Create necessary files/components
3. Implement the feature
4. Add appropriate tests
5. Update any related code
6. Report what was created
```

If no agents configured, implement directly.

## 5. Implementation Steps

1. **Design**: Plan the approach before coding
2. **Create**: Build necessary files and components
3. **Integrate**: Connect with existing code
4. **Test**: Write tests for the new feature
5. **Document**: Add comments/docs as needed

## 6. Update Progress Log

After implementation is complete, note in progress file:
```markdown
### Implementation: <feature name> (<date>)
- **Feature**: <description>
- **Approach**: <how it was built>
- **Files Created**: [list]
- **Files Modified**: [list]
- **Tests Added**: [list]
```

## 7. Report Results

Summarize for the user:

```
## Implementation Complete

**Feature**: [name]
**Description**: [what it does]

**Approach**: [how it was built]

**Files Created**:
- path/to/file1.tsx - [description]
- path/to/file2.py - [description]

**Files Modified**:
- path/to/existing.tsx - [what changed]

**Tests Added**:
- test_feature.py / Feature.test.tsx

**Usage**: [how to use the new feature]
```

Ready to `/wf-commit` or continue with more changes.
