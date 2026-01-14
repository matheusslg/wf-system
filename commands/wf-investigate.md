---
description: Explore codebase to understand how things work
allowed-tools: Read, Grep, Glob, Task, Bash
argument-hint: "<question or --deep topic>"
---

# Investigate

Proactive codebase exploration for understanding and planning.

**Use this when**: You need to understand how something works, not fix something broken.
**Use `/wf-debug` when**: Something is broken and needs fixing.

## Arguments
- `$ARGUMENTS` - Question to answer OR `--deep <topic>` for architectural analysis

## 0. Parse Mode

```
IF $ARGUMENTS contains "--deep":
  MODE = "deep"
  TOPIC = extract text after "--deep"
ELSE:
  MODE = "quick"
  QUESTION = $ARGUMENTS
```

---

## Quick Mode (Default)

Answer a specific question about the codebase.

### 1. Identify Keywords

Extract key terms from `$QUESTION`:
- Technical terms (auth, api, database, etc.)
- Feature names
- File/function names if mentioned

### 2. Search Codebase

Find relevant files:
```bash
# Search for keywords in code
grep -r "<keyword>" --include="*.ts" --include="*.tsx" --include="*.py" --include="*.js" -l

# Find files by name pattern
find . -name "*<keyword>*" -type f | grep -v node_modules | grep -v .git
```

### 3. Read and Trace

For each relevant file:
- Read the file
- Identify entry points, exports, main functions
- Trace execution flow if applicable

### 4. Answer the Question

Provide a clear answer with:
- Direct answer to the question
- File references with line numbers: `src/auth/login.ts:42`
- Code snippets if helpful (keep short)

### 5. Suggest Related Areas (Optional)

If relevant:
- "You might also want to look at..."
- "Related functionality in..."

**Output format**:
```
## Answer: [Question]

[Clear, direct answer]

**Key Files**:
- `path/to/file.ts:42` - [what it does]
- `path/to/other.ts:15` - [what it does]

**Related**: [optional suggestions]
```

---

## Deep Mode (`--deep`)

Full architectural analysis of a system or feature.

### 1. Identify System Boundaries

From `$TOPIC`, determine:
- What system/feature to analyze
- Reasonable scope boundaries

### 2. Find All Related Files

Search comprehensively:
```bash
# Find all files related to topic
grep -r "<topic>" --include="*.ts" --include="*.tsx" --include="*.py" --include="*.js" -l

# Check directory structure
find . -type d -name "*<topic>*" | grep -v node_modules
```

### 3. Map Entry Points

Identify how the system is accessed:
- API endpoints
- UI components
- CLI commands
- Event handlers
- Exports

### 4. Trace Data Flow

Document how data moves through the system:
1. Where does input come from?
2. How is it processed?
3. Where is it stored/sent?

### 5. Document Patterns

Identify patterns used:
- State management approach
- Error handling patterns
- Testing patterns
- Dependency injection
- etc.

### 6. Identify Key Files

List the most important files and their responsibilities.

### 7. Output Report

```markdown
## Investigation: [Topic]

### Overview
[1-2 sentence summary of what this system does]

### Entry Points
- `path/file.ts:42` - [description]
- `path/api.ts:15` - [description]

### Data Flow
1. [Step 1: where input comes from]
2. [Step 2: how it's processed]
3. [Step 3: where output goes]

### Patterns Used
- **[Pattern Name]**: [where/how it's used]
- **[Pattern Name]**: [where/how it's used]

### Key Files
| File | Responsibility |
|------|----------------|
| `path/file1.ts` | [description] |
| `path/file2.ts` | [description] |

### Dependencies
- External: [libraries used]
- Internal: [other systems this depends on]

### Gotchas / Notes
- [Important consideration 1]
- [Important consideration 2]

### Where to Add New Functionality
- To add [X], modify `path/file.ts`
- To extend [Y], create new file in `path/dir/`
```

---

## Examples

**Quick mode**:
```
/wf-investigate "how does user authentication work"
/wf-investigate "where are API routes defined"
/wf-investigate "what state management does this use"
```

**Deep mode**:
```
/wf-investigate --deep authentication
/wf-investigate --deep "payment processing"
/wf-investigate --deep "api layer"
```
