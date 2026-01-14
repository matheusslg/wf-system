---
description: Evaluate and respond to PR review comments (CodeRabbitAI, reviewers)
allowed-tools: Read, Edit, Write, Bash, Grep, Glob, Task
argument-hint: "<PR number(s) or 'all' for current branch PRs>"
---

# PR Comments Handler

Fetch, evaluate, and respond to PR review comments. Automatically determines which comments should be fixed and which should be declined with an explanation.

## Arguments
- `$ARGUMENTS` - PR number(s), comma-separated, or "all" for PRs on current branch

## Flags
- `--fix` - Automatically implement valid fixes after evaluation
- `--dry-run` - Show what would be done without making changes
- `--repo <owner/repo>` - Specify repository (defaults to current)

## 0. Setup

Get repository info:
```bash
# Get current repo from git remote
gh repo view --json owner,name -q '"\(.owner.login)/\(.name)"'
```

Parse arguments:
- If number(s): Use those PR numbers
- If "all": Find PRs for current branch
- If empty: Find PRs for current branch

```bash
# Get PRs for current branch
BRANCH=$(git branch --show-current)
gh pr list --head "$BRANCH" --json number -q '.[].number'
```

## 1. Fetch PR Comments

For each PR number, fetch review comments:

```bash
# Get all review comments (including CodeRabbitAI)
gh api repos/{owner}/{repo}/pulls/{pr_number}/comments --paginate
```

Also get general PR review threads:
```bash
# Get review threads with their comments
gh pr view {pr_number} --json reviews,reviewDecision -q '.reviews'
```

### Parse Comment Structure

Each comment contains:
- `id` - Comment ID (for replies)
- `user.login` - Who made the comment (e.g., "coderabbitai[bot]")
- `body` - The comment text
- `path` - File path
- `line` / `original_line` - Line number
- `diff_hunk` - Code context
- `in_reply_to_id` - If this is a reply to another comment

**Filter out**:
- Already resolved comments
- Comments that have replies indicating resolution
- Your own replies

## 2. Categorize Comments

Group comments by:
- **Pending**: No reply, needs evaluation
- **Resolved**: Has reply or marked resolved
- **Skipped**: General comments, not actionable

For pending comments, extract:
```markdown
| PR | File | Lines | Issue | Source |
|----|------|-------|-------|--------|
| #410 | AuthWrapper.tsx | 108-122 | Missing defensive handling | coderabbitai |
```

## 3. Evaluate Each Comment

For each pending comment, analyze:

### Read the File Context

```bash
# Get the current file content
cat {file_path}
```

### Evaluation Criteria

| Criteria | Should Fix | Won't Fix |
|----------|------------|-----------|
| Valid bug/issue | Yes | - |
| Security concern | Yes | - |
| Improves code quality | Yes | - |
| Style preference only | - | Yes |
| Over-engineering | - | Yes |
| Doesn't apply to our use case | - | Yes |
| Already handled elsewhere | - | Yes |
| Would break existing behavior | - | Yes |
| Suggestion is incorrect | - | Yes |

### For Each Comment, Determine

```markdown
**Comment**: {comment_body}
**File**: {path}:{lines}
**Code Context**:
```{language}
{diff_hunk}
```

**Analysis**:
- Is this a valid concern? {yes/no}
- Does the suggestion improve the code? {yes/no}
- Is it applicable to our codebase/patterns? {yes/no}
- Would implementing it have side effects? {yes/no}

**Verdict**: {Should fix / Won't fix}
**Reason**: {explanation}
```

## 4. Display Summary Table

Show all evaluated comments:

```
## PR Comments Summary

| PR | File | Issue | Verdict |
|----|------|-------|---------|
| #410 (app) | AuthWrapper.tsx:108-122 | Missing defensive handling | ✅ Should fix |
| #266 (api) | Migration.ts | Add CHECK constraint | ❌ Won't fix |
| #266 (api) | auth.controller.ts:104-110 | Use ApiError instead | ✅ Should fix |

**Summary**: 3 should fix, 1 won't fix

Do you want me to:
1. Implement the 3 valid fixes
2. Reply to the "won't fix" comment with explanation
3. Both
```

## 5. Reply to "Won't Fix" Comments

For each comment marked "Won't fix", post a reply explaining why:

```bash
# Reply to a PR review comment using gh CLI
gh api repos/{owner}/{repo}/pulls/{pr_number}/comments \
  --method POST \
  -f body="Thanks for the suggestion!

{reason_explanation}

{additional_context_if_needed}

Marking this as won't fix for now." \
  -F in_reply_to={comment_id}
```

### Example Replies

**Over-engineering**:
```
Thanks for the suggestion!

While adding a CHECK constraint would add an extra layer of validation, we're already validating this at the application layer in the service before it reaches the database. Adding database-level constraints would duplicate this logic and make future schema changes more complex.

Our validation in `{service_file}:{line}` already ensures this invariant.

Marking this as won't fix for now.
```

**Style preference**:
```
Thanks for the suggestion!

This is a valid style preference, but we're following our existing codebase conventions where {explanation}. To maintain consistency across the codebase, we'll keep the current approach.

Marking this as won't fix for now.
```

**Doesn't apply**:
```
Thanks for the suggestion!

This doesn't apply to our use case because {explanation}. The current implementation handles {specific_scenario} which is our primary concern.

Marking this as won't fix for now.
```

## 6. Implement Valid Fixes (if --fix or user confirms)

For each "Should fix" comment:

### 6.1 Read Full File
```bash
cat {file_path}
```

### 6.2 Understand the Fix
Parse the comment suggestion and determine:
- What needs to change
- Where in the file
- Any dependencies

### 6.3 Apply the Fix
Use Edit tool to make the change.

### 6.4 Verify the Fix
```bash
# Run relevant tests if identifiable
npm test -- --testPathPattern="{related_test}" 2>/dev/null || true

# Or run type check
npx tsc --noEmit 2>/dev/null || true
```

### 6.5 Reply to Comment (optional)
```bash
gh api repos/{owner}/{repo}/pulls/{pr_number}/comments \
  --method POST \
  -f body="Fixed in the latest commit. Thanks for catching this!" \
  -F in_reply_to={comment_id}
```

## 7. Final Report

```markdown
## PR Comments Processed

### Fixed (X comments)
| PR | File | Issue | Status |
|----|------|-------|--------|
| #410 | AuthWrapper.tsx:108-122 | Missing defensive handling | ✅ Fixed |
| #266 | auth.controller.ts:104-110 | Use ApiError instead | ✅ Fixed |

### Won't Fix (X comments)
| PR | File | Issue | Reply |
|----|------|-------|-------|
| #266 | Migration.ts | Add CHECK constraint | ✅ Replied |

### Summary
- **Evaluated**: {total} comments
- **Fixed**: {fixed_count}
- **Won't fix**: {wont_fix_count} (all replied)
- **Skipped**: {skipped_count} (already resolved)

### Next Steps
If fixes were made:
```bash
git add -A
git commit -m "fix: address PR review comments"
git push
```
```

## 8. Error Handling

### No Comments Found
```
No pending review comments found on PR #{number}.

All comments have been addressed or there are no actionable items.
```

### API Rate Limit
```
GitHub API rate limit reached. Please wait a few minutes and try again.

To check your rate limit:
gh api rate_limit
```

### Permission Denied
```
Cannot reply to comments on this PR.

Please ensure you have write access to the repository.
```

## Related Commands
- `/wf-review` - Manual code review
- `/wf-commit` - Commit after fixes
- `/wf-test` - Run tests after fixes
