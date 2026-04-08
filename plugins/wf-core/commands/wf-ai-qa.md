---
description: AI-driven exploratory testing that simulates real users navigating the app with natural language scenarios, discovering UX gaps, bugs, and missing features
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Task
argument-hint: "[test-file | pages | flows | all]"
---

# AI-Driven QA Testing

Orchestrate QA testing by reading scenario files from `__ai__/tests/`, driving `agent-browser` to navigate the app, and producing structured reports. Supports two modes:

- **Exploratory** — vague scenarios, AI figures out how to accomplish tasks and reports findings
- **Structured** — specific test cases with steps and expected results, AI executes and verifies each one

## §0. Load Configuration

Read `__ai__/config.md` from the project root. Extract:
- **Base URL** (e.g., `http://localhost:3000`)
- **Auth credentials** (email + password) — there may be multiple credential sets for different roles
- **Global instructions** (everything under "Global Instructions" — injected into every scenario as behavioral context)

Check agent-browser is installed:
```bash
which agent-browser
```

If not installed, show:
> **agent-browser not found.** Install it with:
> ```
> npm i -g agent-browser && agent-browser install
> ```

And exit.

## §1. Discover Tests

List available test files:
```bash
ls __ai__/tests/pages/    # Page-specific tests
ls __ai__/tests/flows/    # Multi-page flow tests
```

If `$ARGUMENTS` is provided, use it directly:
- A specific file path (e.g., `pages/protocols.md` or `flows/create-protocol.md`)
- A folder name (`pages` or `flows`)
- `all` to run everything

If no arguments, present the list and ask the user to pick.

## §2. Detect Test Mode

After reading the selected test file, detect the mode:

- **Structured mode**: File contains `## Test Cases` sections with tables that have columns: `#`, `Test Case`, `Steps`, `Expected Result`
- **Exploratory mode**: File contains `## Scenarios` sections with freeform text descriptions
- **API Checks**: File contains `## API Checks` section with endpoint tables — extract auth token and verify endpoints

A single file can mix all modes (e.g., structured test cases + API checks + exploratory scenarios).

## §3. Execute Tests

### 3a. Setup

Create output directories:
```bash
mkdir -p __ai__/reports/$(date +%Y-%m-%d)
mkdir -p __ai__/recordings/$(date +%Y-%m-%d)
```

### 3b. Start Recording

```bash
agent-browser record start __ai__/recordings/$(date +%Y-%m-%d)/<scenario-slug>.webm
```

### 3c. Login

Unless the scenario explicitly says otherwise, open the base URL and login:
```bash
agent-browser open {baseUrl}
agent-browser wait --load networkidle
agent-browser snapshot -i
```

Find the login fields from the snapshot and authenticate using the credentials from config. If the test file specifies a role or credential set, use the matching one from config.

### 3d. Handle Prerequisites

If the test file has a `## Prerequisites` section, verify each prerequisite before running test cases. If a prerequisite cannot be met, mark the entire file as **BLOCKED** and explain why.

### 3e. Execute — Structured Mode

For each test case row in the table:

1. Read the **Steps** column and execute each step literally using agent-browser
2. Take a screenshot after executing the steps
3. Compare the actual result against the **Expected Result** column
4. Mark the test case as:
   - **PASS** — actual result matches expected result
   - **FAIL** — actual result does not match expected result (describe the discrepancy)
   - **BLOCKED** — could not execute the steps (explain why)
5. If a test case involves mobile/native behavior that agent-browser cannot test, mark it as **SKIP** with reason "Requires mobile device"
6. Move to the next test case — do NOT stop on failure

### 3f. Execute — API Checks

If the test file contains `## API Checks` with an endpoint table:

1. Extract the auth bearer token following the instructions in `__ai__/config.md` (network requests, localStorage, or cookies)
2. For each endpoint in the table, execute the request with curl using the extracted token
3. Compare the HTTP status code, response body, or content-type against the expected result
4. Mark each check as PASS / FAIL

### 3g. Execute — Exploratory Mode

Read the scenario text as your mission. Apply the global instructions from config.md throughout:

- **Act as a real user** — no dev tools, no source code, no inspecting elements
- **Navigate exploratively** — try to accomplish the scenario goal by interacting with the UI
- **Take screenshots** at key moments: `agent-browser screenshot __ai__/reports/$(date +%Y-%m-%d)/<step>.png`
- **Try edge cases** mentioned in the scenario (empty fields, special characters, long text)
- **If stuck** for more than 30 seconds on a step, mark it as a **blocker** and move on
- **Note everything**: bugs, UX gaps, slow loading, missing feedback, confusing labels

### 3h. Stop Recording

```bash
agent-browser record stop
```

### 3i. Write Report

Write findings to `__ai__/reports/YYYY-MM-DD/<scenario-slug>.md`.

**For structured tests, use this format:**

```markdown
# Report: <Test File Name>
- Date: YYYY-MM-DD
- Video: ../recordings/YYYY-MM-DD/<scenario-slug>.webm
- File: tests/<type>/<filename>.md

## Results

| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| A1 | Download Report button visibility | PASS | Button found in header dropdown |
| A2 | Button hidden — no assignment | PASS | Button correctly absent |
| A3 | Successful PDF download | FAIL | Filename is "undefined.pdf" instead of expected format |
| A4 | Mobile PDF download | SKIP | Requires mobile device |

## Summary
- Total: 8
- Pass: 5
- Fail: 2
- Skip: 1
- Blocked: 0

## Failures Detail
### A3 — Successful PDF download
- **Expected**: PDF downloads with filename {protocolName}-{patientName}-report.pdf
- **Actual**: Filename is "undefined.pdf"
- **Screenshot**: [a3-download.png](./a3-download.png)

## Screenshots
- [a1-button-visible.png](./a1-button-visible.png)
- [a3-download.png](./a3-download.png)
```

**For exploratory tests, use this format:**

```markdown
# Report: <Scenario Name>
- Date: YYYY-MM-DD
- Video: ../recordings/YYYY-MM-DD/<scenario-slug>.webm
- File: tests/<type>/<filename>.md
- Status: PASS | PARTIAL | FAIL | BLOCKED

## Steps Taken
1. Step description
2. Step description
...

## Findings
- **Bug**: Description of the bug
- **UX Gap**: Description of UX issue
- **Suggestion**: Improvement suggestion
- **Blocker**: Something that prevented progress

## Screenshots
- [step-N.png](./step-N.png)
```

## §4. Cleanup

Always close the browser session when done:
```bash
agent-browser close
```

## §5. Summary

After all tests complete, print a summary.

**For structured tests:**
```
## <Test File Name>
| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| A1 | Button visibility | PASS | |
| A2 | Button hidden | PASS | |
| A3 | PDF download | FAIL | Wrong filename |

Result: 5/8 passed, 2 failed, 1 skipped
```

**For exploratory tests:**
```
| Scenario                  | Status  | Findings |
|---------------------------|---------|----------|
| pages/protocols - Browse  | PASS    | 1 UX gap |
| flows/create-protocol     | PARTIAL | 1 bug    |
```

## Status Definitions

- **PASS**: Test case passed or scenario completed successfully
- **FAIL**: Actual result does not match expected result, or scenario could not be completed
- **PARTIAL**: (Exploratory only) Scenario partially completed, some issues found
- **BLOCKED**: Could not execute — prerequisite not met or environment issue
- **SKIP**: Test case cannot be executed in this environment (e.g., requires mobile device)

## Error Handling

| Error | Action |
|-------|--------|
| `agent-browser` not installed | Show install instructions and exit |
| Dev server not running | Warn: "Dev server not responding at {URL}. Start it and retry." |
| `__ai__/config.md` missing | Warn: "No config found. Create `__ai__/config.md` first." |
| `__ai__/tests/` empty | Warn: "No test files found. Add scenarios to `__ai__/tests/pages/` or `__ai__/tests/flows/`." |
| Prerequisite not met | Mark affected test cases as BLOCKED, continue with others |
| Test step stuck | Mark as BLOCKED, take screenshot, move to next test case |
