---
description: Run browser-based E2E tests or interactive test scenarios
allowed-tools: Read, Bash, Grep, Glob, Task
argument-hint: "<URL or test file> [--scenario 'description']"
---

# Browser E2E Testing

Run E2E tests using existing frameworks or interactive browser testing with agent-browser.

## §0. Load Configuration

Read `.claude/workflow.json` for browser config:
```json
{
  "browser": {
    "baseUrl": "http://localhost:3000",
    "authState": null,
    "viewport": { "width": 1280, "height": 720 }
  }
}
```

Check agent-browser is installed:
```bash
which agent-browser
```

If not installed, show:
> **agent-browser not found.** Install it with:
> ```
> npm i -g agent-browser
> ```
> See: https://github.com/vercel-labs/agent-browser

And exit.

## §1. Detect Test Mode

Parse `$ARGUMENTS`:

- **URL pattern** (`http://`, `https://`, `localhost`): → **Ad-hoc mode** (§3)
- **File path** (`*.spec.ts`, `*.e2e.ts`, `*.test.ts`): → **File mode** (§2, pass file to runner)
- **No arguments**: → **Suite mode** (§2, run full suite)

## §2. Suite Mode — Detect & Run Existing E2E Framework

Detect framework by checking for config files in the project root:

| Config File | Framework | Command |
|------------|-----------|---------|
| `playwright.config.*` | Playwright | `npx playwright test` |
| `cypress.config.*` | Cypress | `npx cypress run` |
| `wdio.conf.*` | WebDriverIO | `npx wdio run` |

Also check `package.json` for scripts: `test:e2e`, `e2e`, `test:integration`.

**Run the detected framework:**
- If a specific file was provided (File mode), pass it to the test runner
- Capture screenshots on failure (most frameworks do this automatically)
- If no framework detected, inform the user:
  > No E2E framework detected. Use ad-hoc mode with a URL, or set up Playwright/Cypress.

## §3. Ad-hoc Mode — Interactive Browser Testing

Parse `--scenario` description if provided.

### Start browser session

```bash
agent-browser open {URL}
agent-browser wait --load networkidle
```

### Load auth state (if configured)

If `browser.authState` is set in `workflow.json`:
```bash
agent-browser state load {authState path}
agent-browser open {URL}
agent-browser wait --load networkidle
```

### Take initial screenshot

```bash
agent-browser screenshot .e2e-results/{timestamp}-initial.png
```

### Execute scenario (if `--scenario` provided)

Use a sub-agent (Task tool) to interpret and execute the scenario:

1. Read the scenario description
2. Take a snapshot: `agent-browser snapshot -i`
3. For each step in the scenario:
   - Identify the target element from snapshot refs
   - Execute the interaction (`click`, `fill`, `select`, etc.)
   - Wait for result: `agent-browser wait --load networkidle`
   - Re-snapshot to verify: `agent-browser snapshot -i`
   - Take screenshot: `agent-browser screenshot .e2e-results/{timestamp}-step{N}.png`
   - Report pass/fail for the step

### No scenario — page state report

If no `--scenario`, take snapshot + screenshot and report:
- Page title and URL
- Interactive elements found
- Console errors (if any)

## §4. Capture Results

- Screenshots saved to `.e2e-results/` directory (should be gitignored)
- Create `.e2e-results/` if it doesn't exist
- On failure, capture:
  - Full-page screenshot: `agent-browser screenshot --full .e2e-results/{timestamp}-failure.png`
  - Accessibility snapshot: `agent-browser snapshot -i`
  - Console errors via page evaluation

## §5. Report

Output a structured report:

```markdown
## E2E Test Results

**Mode**: {suite|file|ad-hoc}
**Target**: {URL or test file}
**Result**: PASS / FAIL

### Steps Executed (ad-hoc mode)
| # | Action | Result |
|---|--------|--------|
| 1 | Navigate to /login | OK |
| 2 | Fill email field | OK |
| 3 | Click submit | OK |
| 4 | Verify redirect to /dashboard | OK |

### Failures (if any)
- Screenshot: .e2e-results/{timestamp}.png
- Error: {description}

### Screenshots
- .e2e-results/{timestamp}-initial.png
- .e2e-results/{timestamp}-step1.png
- ...
```

## §6. Cleanup

Always close the browser session when done:
```bash
agent-browser close
```

## §7. Error Handling

| Error | Action |
|-------|--------|
| `agent-browser` not installed | Show install instructions and exit |
| Dev server not running (localhost URL returns error) | Warn: "Dev server not responding at {URL}. Start it and retry." |
| Browser timeout | Suggest using `agent-browser wait --load networkidle` |
| No E2E framework detected (suite mode) | Suggest ad-hoc mode or framework setup |
| Scenario step fails | Capture failure screenshot, continue remaining steps, report all |
