---
description: Review pending brain knowledge entries — approve, reject, or edit proposed knowledge
allowed-tools: Read, Bash, AskUserQuestion
---

# Brain Review

Interactive review of pending knowledge entries proposed by sub-agents and session extraction.

## 1. Check Brain Availability

```bash
node scripts/wf-brain.js stats
```

If error: "No brain.db found. Run `/wf-init` or `node scripts/wf-brain.js init` first."

## 2. Get Pending Entries

```bash
node scripts/wf-brain.js review
```

Parse the JSON output. If empty array:
> No pending entries. Brain is up to date.

Exit.

## 3. Interactive Review Loop

Present entries one at a time:

```
Brain Review — {N} pending entries

[1/{N}] {category} — proposed by {proposed_by} ({created_at})
  "{content}"
  Tags: {tags}

  (a)pprove  (r)eject  (e)dit  (s)kip  (q)uit
```

Use AskUserQuestion to get the user's choice for each entry.

### Actions

**approve**: Run `node scripts/wf-brain.js review --approve {id}`. Confirm: "Approved — added to brain as entry #{entryId}"

**reject**: Run `node scripts/wf-brain.js review --reject {id}`. Confirm: "Rejected."

**edit**: Ask user for updated content (pre-fill current). Then approve with modified content:
1. `node scripts/wf-brain.js review --approve {id}`
2. `node scripts/wf-brain.js edit {entryId} --content "{updated}"`

**skip**: Move to next entry.

**quit**: Exit review loop.

## 4. Summary

After processing all entries (or quit):

```
Brain Review Complete

Approved: {N}
Rejected: {N}
Skipped: {N}

Brain stats: {totalEntries} entries, {totalPending} still pending
```
