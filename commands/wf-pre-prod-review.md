---
description: Multi-agent pre-production audit to validate code is production-ready
allowed-tools: Read, Bash, Grep, Glob, Task
argument-hint: "[PR number, branch, or commit range]"
---

# Pre-Production Review

Multi-agent audit to validate implementation is production-ready before merge. Analyzes the changes first, then spawns as many parallel review agents as needed — each focused on a relevant quality dimension.

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

## 3. Determine Review Dimensions

Based on the context gathered in step 2, decide which review dimensions are relevant. **Do not spawn agents for dimensions that don't apply to the changes.**

### Dimension Selection Guide

| Dimension | Spawn When |
|-----------|------------|
| **Code Quality & Logic** | Always — any code change needs this |
| **Security** | Auth files, API endpoints, user input handling, crypto, env/config, dependency changes, data storage |
| **Performance & Scalability** | DB queries, API endpoints, data fetching, loops over collections, UI components rendering lists, large data processing |
| **Error Handling & Resilience** | External calls (API, DB, third-party), async operations, network code, event-driven logic |
| **Testing & Coverage Gaps** | New source files, new functions/endpoints, logic branch changes |
| **Database & Migrations** | Migration files, schema changes, ORM model changes, raw SQL |
| **API Contract & Compatibility** | API route changes, response shape changes, GraphQL schema, OpenAPI spec |
| **Infrastructure & Deployment** | CI/CD files, Dockerfiles, terraform/IaC, env configs, deployment scripts |
| **Dependency Audit** | package.json, requirements.txt, go.mod, Gemfile, pom.xml, or any lock file changes |
| **Accessibility** | UI component changes, HTML templates, CSS/styling, form elements |

You may also spawn **additional dimensions not listed here** if the changes warrant it (e.g., internationalization, compliance, data privacy). Use your judgment.

### Selection Rules

1. Analyze the changed files from step 2
2. Match them against the dimension table above
3. Select all dimensions that have at least one matching file/pattern
4. **Code Quality & Logic** is always included as a baseline

## 4. Spawn Parallel Review Agents

Spawn agents for **each selected dimension** in parallel using the Task tool.

**IMPORTANT**: All Task() calls must be made in a SINGLE response to run in parallel.

Each agent receives the full list of changed files and instructions to READ and analyze their specific dimension. Below is the prompt catalog for each dimension.

---

### Code Quality & Logic

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

### Security

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

### Performance & Scalability

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

### Error Handling & Resilience

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

### Testing & Coverage Gaps

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

### Database & Migrations

```
Task(
  subagent_type: "general-purpose",
  prompt: "You are a database reviewer performing a pre-production audit.

## Your Focus: Database & Migrations

Review the following changed files for database safety issues.

### Changed Files
{CHANGED_FILES_LIST}

### What to Look For
- Migrations that are not reversible (no down/rollback)
- Destructive operations without data backup (DROP TABLE, DROP COLUMN)
- Long-running locks (ALTER TABLE on large tables without concurrency strategy)
- Missing indexes for new queries or foreign keys
- Schema changes that break existing queries
- Raw SQL with string interpolation (injection risk)
- Missing NOT NULL constraints or default values
- ORM model changes not reflected in migrations
- Data migrations mixed with schema migrations
- Missing transaction wrapping for multi-step migrations

### How to Work
1. Read each migration and schema file
2. Check for reversibility and safety
3. Cross-reference ORM models with migration files
4. Look for queries that would break with the schema change

### Output Format
For each finding:
- **Severity**: CRITICAL / WARNING / INFO
- **File**: path/to/migration.ts:42
- **Issue**: Clear description of the database risk
- **Impact**: What happens if this runs in production

End with your verdict: PASS / CONCERNS / FAIL

PASS = Migrations are safe and reversible
CONCERNS = Some risks that should be reviewed with DBA
FAIL = Will cause data loss or extended downtime in production",
  description: "Pre-prod audit: Database & Migrations"
)
```

---

### API Contract & Compatibility

```
Task(
  subagent_type: "general-purpose",
  prompt: "You are an API contract reviewer performing a pre-production audit.

## Your Focus: API Contract & Compatibility

Review the following changed files for breaking API changes.

### Changed Files
{CHANGED_FILES_LIST}

### What to Look For
- Removed or renamed API endpoints
- Changed response shapes (removed fields, type changes)
- Changed request parameter names or types
- Removed or changed enum values
- Changed HTTP methods or status codes
- Missing API versioning for breaking changes
- Changed authentication requirements
- Changed rate limits or payload size limits
- GraphQL schema breaking changes (removed fields, changed types)
- OpenAPI/Swagger spec out of sync with implementation

### How to Work
1. Read each API route/controller/handler file
2. Compare response shapes before and after
3. Check for removed or renamed fields
4. Look for changes that would break existing clients

### Output Format
For each finding:
- **Severity**: CRITICAL / WARNING / INFO
- **File**: path/to/route.ts:42
- **Issue**: Clear description of the contract change
- **Breaking**: Yes/No — would existing clients break?

End with your verdict: PASS / CONCERNS / FAIL

PASS = No breaking changes to API contracts
CONCERNS = Changes that might affect some clients
FAIL = Breaking changes that will crash existing consumers",
  description: "Pre-prod audit: API Contract & Compatibility"
)
```

---

### Infrastructure & Deployment

```
Task(
  subagent_type: "general-purpose",
  prompt: "You are an infrastructure reviewer performing a pre-production audit.

## Your Focus: Infrastructure & Deployment

Review the following changed files for deployment safety.

### Changed Files
{CHANGED_FILES_LIST}

### What to Look For
- CI/CD pipeline changes that skip tests or checks
- Dockerfile changes that increase attack surface or break builds
- Environment variable changes without documentation
- New required env vars missing from deployment configs
- Terraform/IaC changes without plan review
- Missing health checks or readiness probes
- Changed ports, domains, or networking configs
- Missing rollback strategy for infrastructure changes
- Secrets or credentials in config files
- Resource limits removed or significantly increased

### How to Work
1. Read each infra/config/deployment file
2. Check for missing env vars in deployment templates
3. Verify CI/CD changes don't skip safety checks
4. Look for changes that could cause deployment failures

### Output Format
For each finding:
- **Severity**: CRITICAL / WARNING / INFO
- **File**: path/to/config.yml:42
- **Issue**: Clear description of the deployment risk
- **Scenario**: What fails during or after deployment

End with your verdict: PASS / CONCERNS / FAIL

PASS = Deployment configs are safe and complete
CONCERNS = Some configs should be double-checked
FAIL = Deployment will fail or expose the system",
  description: "Pre-prod audit: Infrastructure & Deployment"
)
```

---

### Dependency Audit

```
Task(
  subagent_type: "general-purpose",
  prompt: "You are a dependency reviewer performing a pre-production audit.

## Your Focus: Dependency Audit

Review the following changed files for dependency risks.

### Changed Files
{CHANGED_FILES_LIST}

### What to Look For
- Major version bumps that may include breaking changes
- New dependencies with low adoption or maintenance
- Removed dependencies still imported in code
- Duplicate dependencies (different packages doing the same thing)
- Dependencies with known security vulnerabilities
- Pinned versions vs ranges (stability vs updates)
- Dev dependencies accidentally added to production
- Large dependencies that significantly increase bundle size
- Dependencies with restrictive licenses
- Lock file conflicts or inconsistencies

### How to Work
1. Read the dependency manifest changes (package.json, requirements.txt, etc.)
2. Read the lock file changes if present
3. Cross-reference with imports in changed source files
4. Check for unused or missing dependencies

### Output Format
For each finding:
- **Severity**: CRITICAL / WARNING / INFO
- **File**: package.json:42
- **Issue**: Clear description of the dependency risk
- **Action**: What should be done

End with your verdict: PASS / CONCERNS / FAIL

PASS = Dependencies are safe and well-managed
CONCERNS = Some dependency choices should be reviewed
FAIL = Vulnerable or broken dependencies that block release",
  description: "Pre-prod audit: Dependency Audit"
)
```

---

### Accessibility

```
Task(
  subagent_type: "general-purpose",
  prompt: "You are an accessibility reviewer performing a pre-production audit.

## Your Focus: Accessibility

Review the following changed files for accessibility compliance.

### Changed Files
{CHANGED_FILES_LIST}

### What to Look For
- Missing alt text on images
- Form inputs without labels or aria-label
- Interactive elements not keyboard accessible
- Missing ARIA roles or attributes on dynamic content
- Color contrast issues (text on background)
- Focus management missing on modals, dialogs, or route changes
- Missing skip navigation links
- Non-semantic HTML (div soup instead of proper elements)
- Missing lang attribute changes for i18n
- Touch targets too small (< 44x44px)
- Animations without reduced-motion support
- Error messages not announced to screen readers

### How to Work
1. Read each UI component and template file
2. Check for semantic HTML usage
3. Verify interactive elements have proper labeling
4. Look for focus management on dynamic content

### Output Format
For each finding:
- **Severity**: CRITICAL / WARNING / INFO
- **File**: path/to/component.tsx:42
- **Issue**: Clear description of the accessibility gap
- **WCAG**: Relevant guideline (e.g., WCAG 2.1 Level A/AA)

End with your verdict: PASS / CONCERNS / FAIL

PASS = UI changes meet accessibility standards
CONCERNS = Some gaps that may affect certain users
FAIL = Significant barriers that block users with disabilities",
  description: "Pre-prod audit: Accessibility"
)
```

---

### Custom Dimensions

If the changes suggest a dimension not covered above (e.g., internationalization, data privacy, compliance), spawn an additional agent with a focused prompt following the same output format:
- Severity: CRITICAL / WARNING / INFO
- File references
- Verdict: PASS / CONCERNS / FAIL

## 5. Collect & Consolidate Results

After all spawned agents complete:

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

## 6. Production Readiness Report

Output the final report:

```
## Pre-Production Audit Report

**Branch**: [branch name]
**Base**: [base ref, e.g., main]
**Files Changed**: [count]
**Lines Changed**: +[added] / -[removed]
**Dimensions Reviewed**: [count]
**Review Date**: [date]

### Critical Issues (Must Fix)
- [ ] file:line - [issue description] (found by: [dimension])

### Warnings (Should Fix)
- [ ] file:line - [issue description] (found by: [dimension])

### Informational
- file:line - [note] (found by: [dimension])

### Agent Verdicts
| Dimension | Verdict | Findings |
|-----------|---------|----------|
| [dimension name] | PASS/CONCERNS/FAIL | X critical, Y warnings |
| ... | ... | ... |

(Only dimensions that were spawned appear in this table)

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

Partial results from the remaining agents are shown below.
Re-run to retry, or review the missing dimension manually.
```

Include partial results from agents that did complete.
