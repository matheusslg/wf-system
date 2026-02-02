---
description: Multi-agent pre-production audit to validate code is production-ready
allowed-tools: Read, Bash, Grep, Glob, Task
argument-hint: "[PR number, branch, or commit range]"
---

# Pre-Production Review

Multi-agent audit to validate implementation is production-ready before merge. Spawns 5 parallel review agents, each focused on a specific quality dimension.

**This is READ-ONLY. No code is modified.**

## Arguments
- `$ARGUMENTS` - Optional PR number, branch name, or commit range (defaults to current branch vs main)

## 0. Load Configuration

```bash
cat .claude/workflow.json 2>/dev/null || echo "{}"
```

Extract relevant fields if present (e.g., `ticketing.platform`, branch naming conventions).

## 1. Determine Review Scope

Parse `$ARGUMENTS` to determine the diff source.

**If `$ARGUMENTS` is a PR number** (e.g., `123`, `#123`):
```bash
gh pr view $PR_NUMBER --json headRefName,baseRefName,changedFiles,additions,deletions
gh pr diff $PR_NUMBER
```

**If `$ARGUMENTS` is a branch name**:
```bash
git diff main...$BRANCH --stat
git diff main...$BRANCH --name-only
```

**If `$ARGUMENTS` is a commit range** (contains `..`):
```bash
git diff $RANGE --stat
git diff $RANGE --name-only
```

**Default** (no arguments — current branch vs main):
```bash
CURRENT_BRANCH=$(git branch --show-current)
git diff main...HEAD --stat
git diff main...HEAD --name-only
git log main..HEAD --oneline
```

### Collect Scope Summary

```bash
# Changed files list
CHANGED_FILES=$(git diff main...HEAD --name-only)

# Stats
FILES_COUNT=$(git diff main...HEAD --name-only | wc -l)
ADDITIONS=$(git diff main...HEAD --stat | tail -1)

# Languages/frameworks (from file extensions)
git diff main...HEAD --name-only | sed 's/.*\.//' | sort | uniq -c | sort -rn
```

### No Changes Found

If the diff is empty:
```
No changes detected between [base] and [head]. Nothing to review.
```
Exit.

### Cannot Determine Scope

If `$ARGUMENTS` doesn't match any pattern and default branch detection fails:
```
Could not determine review scope.

Please specify one of:
- PR number: `/wf-pre-prod-review 123`
- Branch name: `/wf-pre-prod-review feature/my-branch`
- Commit range: `/wf-pre-prod-review abc123..def456`
```
Exit.

## 2. Gather Context

Read all changed files fully to build a complete picture:

```bash
# List changed files
git diff main...HEAD --name-only
```

For each changed file, read it completely.

Identify:
- **Nature of changes**: New feature, bug fix, refactor, config change, dependency update, migration, etc.
- **Config/infra changes**: CI/CD files, Dockerfiles, env configs, terraform, etc.
- **Dependency changes**: package.json, requirements.txt, Gemfile, go.mod, etc.
- **Migration files**: Database migrations, schema changes
- **Test files**: New or modified test files

Build a context summary to pass to each agent:

```
CONTEXT_SUMMARY:
- Branch: {branch_name}
- Base: {base_ref}
- Files changed: {count}
- Lines: +{added} / -{removed}
- Nature: {feature|bugfix|refactor|...}
- Languages: {list}
- Changed files:
  - path/to/file1.ts (modified)
  - path/to/file2.ts (added)
  - ...
```

## 3. Spawn Parallel Review Agents

Spawn **5 agents in parallel** using the Task tool. Each agent receives the full list of changed files and instructions to READ and analyze their specific dimension.

**IMPORTANT**: All 5 Task() calls must be made in a SINGLE response to run in parallel.

---

### Agent 1: Code Quality & Logic

```
Task(
  subagent_type: "general-purpose",
  prompt: "You are a code quality reviewer performing a pre-production audit.

## Your Focus: Code Quality & Logic

Review the following changed files for correctness and code quality issues.

### Changed Files
{CHANGED_FILES_LIST}

### What to Look For
- Logic errors and bugs
- Edge cases not handled (null, undefined, empty arrays, zero values)
- Off-by-one errors
- Race conditions or timing issues
- Incorrect boolean logic or inverted conditions
- Dead code or unreachable branches
- Type mismatches or unsafe casts
- Copy-paste errors
- Incorrect variable scope or shadowing
- Missing break/return statements

### How to Work
1. Read each changed file
2. Trace logic paths, especially branching and loops
3. Check function inputs/outputs for consistency
4. Look for assumptions that may not hold

### Output Format
For each finding:
- **Severity**: CRITICAL / WARNING / INFO
- **File**: path/to/file.ts:42
- **Issue**: Clear description of the problem
- **Why it matters**: Impact if not fixed

End with your verdict: PASS / CONCERNS / FAIL

PASS = No critical issues, code logic is sound
CONCERNS = Warnings found that should be reviewed
FAIL = Critical logic errors that will cause bugs in production",
  description: "Pre-prod audit: Code Quality & Logic"
)
```

---

### Agent 2: Security

```
Task(
  subagent_type: "general-purpose",
  prompt: "You are a security reviewer performing a pre-production audit.

## Your Focus: Security

Review the following changed files for security vulnerabilities.

### Changed Files
{CHANGED_FILES_LIST}

### What to Look For
- Hardcoded secrets, API keys, tokens, passwords
- SQL injection (string concatenation in queries)
- XSS vulnerabilities (unescaped user input in HTML/templates)
- Command injection (user input in shell commands)
- Path traversal (user input in file paths)
- Auth/authz gaps (missing permission checks, broken access control)
- Sensitive data exposure in logs, errors, or responses
- Insecure cryptographic practices (weak hashing, no salt)
- CSRF vulnerabilities
- Insecure deserialization
- Missing input validation or sanitization
- Overly permissive CORS configuration
- Secrets in client-side code or bundles

### How to Work
1. Read each changed file
2. Trace user input from entry point to usage
3. Check for auth/authz on new endpoints or routes
4. Look for data that should not be exposed
5. Check dependency changes for known vulnerabilities

### Output Format
For each finding:
- **Severity**: CRITICAL / WARNING / INFO
- **File**: path/to/file.ts:42
- **Issue**: Clear description of the vulnerability
- **Risk**: What an attacker could exploit

End with your verdict: PASS / CONCERNS / FAIL

PASS = No security issues found
CONCERNS = Minor issues or hardening recommendations
FAIL = Exploitable vulnerabilities that must be fixed before production",
  description: "Pre-prod audit: Security"
)
```

---

### Agent 3: Performance & Scalability

```
Task(
  subagent_type: "general-purpose",
  prompt: "You are a performance reviewer performing a pre-production audit.

## Your Focus: Performance & Scalability

Review the following changed files for performance issues.

### Changed Files
{CHANGED_FILES_LIST}

### What to Look For
- N+1 query patterns (queries inside loops)
- Missing database indexes for new queries
- Unbounded loops or recursion
- Memory leaks (event listeners not cleaned up, growing caches, unclosed resources)
- Large payloads without pagination
- Missing pagination on list endpoints
- Expensive computations in hot paths (render loops, request handlers)
- Synchronous blocking operations where async is needed
- Missing caching for repeated expensive operations
- Unnecessary re-renders (React) or recomputations
- Large bundle imports (importing entire libraries for one function)
- Missing debounce/throttle on frequent events
- Unoptimized images or assets
- Missing loading states or streaming for large data

### How to Work
1. Read each changed file
2. Identify data access patterns
3. Check for operations that scale poorly with data size
4. Look for resource cleanup in lifecycle hooks
5. Check import sizes and bundle impact

### Output Format
For each finding:
- **Severity**: CRITICAL / WARNING / INFO
- **File**: path/to/file.ts:42
- **Issue**: Clear description of the performance problem
- **Impact**: How this degrades at scale

End with your verdict: PASS / CONCERNS / FAIL

PASS = No significant performance issues
CONCERNS = Potential bottlenecks under load
FAIL = Will cause outages or severe degradation in production",
  description: "Pre-prod audit: Performance & Scalability"
)
```

---

### Agent 4: Error Handling & Resilience

```
Task(
  subagent_type: "general-purpose",
  prompt: "You are a resilience reviewer performing a pre-production audit.

## Your Focus: Error Handling & Resilience

Review the following changed files for error handling completeness.

### Changed Files
{CHANGED_FILES_LIST}

### What to Look For
- Unhandled promise rejections (missing .catch() or try/catch on await)
- Missing try/catch around external calls (API, DB, file system)
- Silent failures (empty catch blocks, swallowed errors)
- Missing fallbacks for external service failures
- Incomplete error messages (missing context for debugging)
- Missing timeout configuration on HTTP/network calls
- Missing retry logic for transient failures (network, rate limits)
- Ungraceful shutdown handling
- Missing validation before operations that can throw
- Error states not propagated to the UI or caller
- Missing circuit breaker patterns for critical dependencies
- Logging errors without enough context (stack trace, request ID)

### How to Work
1. Read each changed file
2. Identify all external calls (API, DB, third-party services)
3. Check each one for error handling
4. Trace error propagation from origin to user/caller
5. Check for graceful degradation paths

### Output Format
For each finding:
- **Severity**: CRITICAL / WARNING / INFO
- **File**: path/to/file.ts:42
- **Issue**: Clear description of the resilience gap
- **Scenario**: What happens when this fails in production

End with your verdict: PASS / CONCERNS / FAIL

PASS = Error handling is comprehensive
CONCERNS = Some gaps that should be addressed
FAIL = Critical paths will crash or hang silently in production",
  description: "Pre-prod audit: Error Handling & Resilience"
)
```

---

### Agent 5: Testing & Coverage Gaps

```
Task(
  subagent_type: "general-purpose",
  prompt: "You are a test coverage reviewer performing a pre-production audit.

## Your Focus: Testing & Coverage Gaps

Review the following changed files for testing completeness.

### Changed Files
{CHANGED_FILES_LIST}

### What to Look For
- New code files without corresponding test files
- New functions/methods without test cases
- Untested edge cases (null inputs, empty collections, boundary values)
- Assertions that dont actually verify behavior (testing implementation, not outcomes)
- Mocked-away critical paths (mocking the thing you should be testing)
- Missing integration tests for new API endpoints
- Missing error path tests (only happy path tested)
- Flaky test patterns (timing-dependent, order-dependent)
- Test descriptions that dont match what they test
- Missing test setup/teardown (leaking state between tests)
- Snapshot tests that are too broad or meaningless
- Hardcoded test data that hides edge cases

### How to Work
1. Read each changed source file
2. Identify new functions, classes, endpoints, and logic branches
3. Find corresponding test files (search for *.test.*, *.spec.*, __tests__/)
4. Check if tests cover the changed code paths
5. Evaluate test quality (do assertions actually verify the right thing?)

### Output Format
For each finding:
- **Severity**: CRITICAL / WARNING / INFO
- **File**: path/to/file.ts:42
- **Issue**: Clear description of the coverage gap
- **Suggestion**: What test should be added

End with your verdict: PASS / CONCERNS / FAIL

PASS = Tests adequately cover the changes
CONCERNS = Some gaps but core paths are tested
FAIL = Critical paths are untested and could break undetected",
  description: "Pre-prod audit: Testing & Coverage Gaps"
)
```

## 4. Collect & Consolidate Results

After all 5 agents complete:

1. **Parse each agent's output** for findings and verdict
2. **Aggregate by severity**:
   - Collect all CRITICAL findings
   - Collect all WARNING findings
   - Collect all INFO findings
3. **Deduplicate**: If multiple agents flag the same file:line, merge into one finding and note which agents found it
4. **Determine overall verdict**:
   - Any agent returned FAIL → overall is **NOT READY**
   - Any agent returned CONCERNS (none FAIL) → overall is **NEEDS ATTENTION**
   - All agents returned PASS → overall is **READY FOR PRODUCTION**

## 5. Production Readiness Report

Output the final report:

```
## Pre-Production Audit Report

**Branch**: [branch name]
**Base**: [base ref, e.g., main]
**Files Changed**: [count]
**Lines Changed**: +[added] / -[removed]
**Review Date**: [date]

### Critical Issues (Must Fix)
- [ ] file:line - [issue description] (found by: [agent dimension])
- [ ] file:line - [issue description] (found by: [agent dimension])

### Warnings (Should Fix)
- [ ] file:line - [issue description] (found by: [agent dimension])
- [ ] file:line - [issue description] (found by: [agent dimension])

### Informational
- file:line - [note] (found by: [agent dimension])

### Agent Verdicts
| Dimension | Verdict | Findings |
|-----------|---------|----------|
| Code Quality & Logic | PASS/CONCERNS/FAIL | X critical, Y warnings |
| Security | PASS/CONCERNS/FAIL | X critical, Y warnings |
| Performance & Scalability | PASS/CONCERNS/FAIL | X critical, Y warnings |
| Error Handling & Resilience | PASS/CONCERNS/FAIL | X critical, Y warnings |
| Testing & Coverage Gaps | PASS/CONCERNS/FAIL | X critical, Y warnings |

### Overall Verdict
READY FOR PRODUCTION / NEEDS ATTENTION / NOT READY

### Recommended Actions
1. [action item with file reference]
2. [action item with file reference]
```

## Error Handling

### No Changes Found
```
No changes detected between [base] and [head]. Nothing to review.
```

### Cannot Determine Scope
```
Could not determine review scope from: "$ARGUMENTS"

Please specify:
- PR number: `/wf-pre-prod-review 123`
- Branch: `/wf-pre-prod-review feature/my-branch`
- Commit range: `/wf-pre-prod-review abc123..def456`
- Or run from your feature branch with no arguments to diff against main.
```

### Agent Failure
If any agent fails to return results:
```
Agent [{dimension}] did not complete successfully.

Partial results from {N}/5 agents are shown below.
Re-run to retry, or review the missing dimension manually.
```

Include partial results from agents that did complete.
