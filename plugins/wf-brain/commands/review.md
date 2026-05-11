---
description: Review pending knowledge entries and approve/reject them into the brain.
allowed-tools: AskUserQuestion
---

# Brain Review

Walk through the pending knowledge queue interactively. For each entry, the human chooses Approve / Reject / Skip / Approve-all-remaining; approvals copy the row into the searchable `entries` table, rejections mark it discarded, skips leave it in the queue for next time.

The queue feeds from `brain_propose` calls (typically made by sub-agents during long-running pipelines). This command is the human gate that keeps sub-agent output from polluting the searchable brain.

---

## 1. Fetch the pending queue

Call the `brain_pending_list` MCP tool. The default limit is 50; this command processes **at most the first 20 entries** to avoid runaway interactive loops on huge backlogs.

If the tool returns an `error` payload (most likely "No brain.db found..."), surface it and stop. The user probably needs to run `/wf-brain:init` first.

If the result is an empty array, report:

> No pending entries to review. The brain is fully approved (or `brain_propose` hasn't been called yet).

…and stop.

---

## 2. Iterate (capped at 20)

For each pending entry in the first 20:

### 2a. Display the entry

Format one block per entry:

```
[#<id>] [<category>] [<tags>]
<content>
proposed by <source> at <created_at>
```

(`tags` may be empty — omit the brackets if so. `source` may be empty — fall back to `agent:unknown`.)

### 2b. Ask the user

Use `AskUserQuestion` (single-select) with the four options:

- **Approve** — move into `entries` (searchable)
- **Reject** — discard the entry
- **Skip** — leave it in the queue for later
- **Approve all remaining** — auto-approve every entry still ahead of us in this loop

### 2c. Act on the answer

- **Approve:** call `brain_pending_approve` with the entry's `id`. Track in the running tally.
- **Reject:** call `brain_pending_reject` with the entry's `id`. Track in the running tally.
- **Skip:** no MCP call. Track in the running tally.
- **Approve all remaining:** call `brain_pending_approve` for the current entry, then for every subsequent entry within the 20-item window — without asking again. Track each in the tally.

If any individual MCP call returns an `error` payload, note it inline (`[#42] approve failed: <error>`) and continue with the next entry. Do not abort the whole review on one bad row.

---

## 3. Report final tally

After the loop (or early exit on empty queue), emit one summary line:

> Approved {A}, Rejected {R}, Skipped {S} of {N} processed (out of {total} pending).

If the original queue had **more than 20** entries, also note:

> {total - 20} entries still pending — re-run `/wf-brain:review` to continue.

---

## Notes

- This command **only** touches the `pending` table via the three MCP tools. It never writes to `entries` directly — `brain_pending_approve` performs the atomic copy + status flip inside the lib's transaction.
- Skipping an entry leaves its `status='pending'` row untouched, so it reappears on the next `/wf-brain:review` run. To remove a skipped entry permanently, run `/wf-brain:review` again and choose Reject.
- The 20-entry cap is a UX safeguard, not a database constraint — you can re-run as many times as needed for large backlogs.
