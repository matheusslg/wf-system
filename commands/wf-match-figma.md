---
description: Match rendered UI against Figma designs with pixel-level comparison, scoring, and reports
allowed-tools: Read, Write, Bash, Glob, Grep, Task
argument-hint: "<page-url> <figma-url> [--selector '.css'] [--threshold 80] [--breakpoints desktop,mobile] [--sensitivity 0.1] | --batch"
---

# Match Figma — Pixel-Level Visual Comparison

Compare rendered UI screenshots against Figma designs using pixel-level diffing. Produces match scores, diff overlay images, and HTML reports.

## §0. Load Configuration

Read `.claude/workflow.json` for design config:
```json
{
  "design": {
    "figma": {
      "fileKey": "...",
      "keyFrames": [{ "nodeId": "...", "name": "...", "route": "...", "breakpoints": [...], "selector": null }]
    },
    "matchFigma": {
      "baseUrl": "http://localhost:3000",
      "threshold": 80,
      "breakpoints": {
        "desktop": { "width": 1440, "height": 900 },
        "tablet": { "width": 768, "height": 1024 },
        "mobile": { "width": 375, "height": 812 }
      },
      "outputDir": "__ai__/reports/match-figma"
    }
  }
}
```

Defaults if no config:
- `threshold`: 80
- `breakpoints`: `{ "desktop": { "width": 1440, "height": 900 } }`
- `outputDir`: `__ai__/reports/match-figma`

## §1. Check Prerequisites

### Diff script dependencies
```bash
node -e "require('pixelmatch'); require('pngjs'); require('sharp')" 2>/dev/null
```

If this fails:
```bash
npm install --save-dev pixelmatch pngjs sharp
```

### Browser tool availability

Check in this order (use first available):

1. **agent-browser CLI**:
```bash
which agent-browser
```

2. **Chrome extension**: Check if `mcp__claude-in-chrome__navigate` is available in current session tools.

3. **Playwright MCP**: Check if `mcp__playwright__browser_navigate` is available in current session tools.

If none available:
> **No browser tool found.** Install agent-browser:
> ```
> npm i -g agent-browser && agent-browser install
> ```

### Figma MCP

Check if `mcp__figma__get_screenshot` is available. If not:
> **Figma MCP not available.** Run `/wf-design-setup` to configure Figma integration, or install Figma MCP server.

## §2. Parse Arguments

Parse `$ARGUMENTS`:

### Argument parsing rules
- URLs containing `figma.com` → Figma design URL
- Other URLs (`http://`, `https://`, `localhost`) → page URL to capture
- `--batch` → batch mode (iterate keyFrames from workflow.json)
- `--selector ".css"` → CSS selector for component-level capture
- `--threshold N` → pass/fail percentage (overrides config, default: 80)
- `--breakpoints name1,name2` → comma-separated breakpoint names
- `--sensitivity N` → pixel-level color distance for pixelmatch (default: 0.1)

### Detect input mode

| Mode | Condition |
|------|-----------|
| **Live** | Both page URL and Figma URL provided |
| **Attached** | Figma URL provided + image attachment detected in conversation |
| **Batch** | `--batch` flag present |

### Figma URL extraction

From a URL like `https://www.figma.com/design/ABC123/MyApp?node-id=45-678`:
- `fileKey` = `ABC123`
- `nodeId` = `45:678` (convert `-` to `:`)

## §3. Prepare Output Directory

```bash
mkdir -p {outputDir}
```

Use `outputDir` from config or default `__ai__/reports/match-figma`.

## §4. Execute Comparison

### 4a. Attached Image Mode

If an image is attached in the conversation:

1. Save the attached image to `{outputDir}/attached-{timestamp}.png`
2. Fetch Figma frame:
   ```
   mcp__figma__get_screenshot(fileKey, nodeId)
   ```
   Save the Figma screenshot to `{outputDir}/figma-{timestamp}.png`
3. Run diff:
   ```bash
   node scripts/pixelmatch-diff.js --img1 {outputDir}/attached-{timestamp}.png --img2 {outputDir}/figma-{timestamp}.png --output {outputDir}/diff-{timestamp}.png --sensitivity {sensitivity}
   ```
4. Parse the JSON output.

### 4b. Live Mode (single page)

For each breakpoint (default: just `desktop`):

1. **Check dev server** (if localhost):
   ```bash
   curl -s -o /dev/null -w "%{http_code}" {url} --max-time 5
   ```
   If non-200, warn and skip.

2. **Capture rendered page**:

   **agent-browser:**
   ```bash
   agent-browser open {url} --viewport {width}x{height} && agent-browser wait --load networkidle
   ```
   If `--selector` is provided:
   ```bash
   agent-browser snapshot -s "{selector}"
   agent-browser screenshot --ref @e1 {outputDir}/rendered-{name}-{breakpoint}.png
   ```
   If `--ref` is not supported, fall back to full-page screenshot.

   Otherwise (full page):
   ```bash
   agent-browser screenshot {outputDir}/rendered-{name}-{breakpoint}.png
   ```

   **Chrome extension (fallback):**
   ```
   mcp__claude-in-chrome__navigate({ url })
   mcp__claude-in-chrome__computer({ action: "screenshot" })
   ```
   Save screenshot to `{outputDir}/rendered-{name}-{breakpoint}.png`.
   Note: Chrome extension requires `claude --chrome`. Full-page screenshots only.

   **Playwright MCP (fallback):**
   ```
   mcp__playwright__browser_navigate({ url })
   mcp__playwright__browser_take_screenshot()
   ```
   Save screenshot to `{outputDir}/rendered-{name}-{breakpoint}.png`.

3. **Fetch Figma frame**:
   ```
   mcp__figma__get_screenshot(fileKey, nodeId)
   ```
   Save to `{outputDir}/figma-{name}-{breakpoint}.png`.

4. **Run diff**:
   ```bash
   node scripts/pixelmatch-diff.js --img1 {outputDir}/rendered-{name}-{breakpoint}.png --img2 {outputDir}/figma-{name}-{breakpoint}.png --output {outputDir}/diff-{name}-{breakpoint}.png --sensitivity {sensitivity}
   ```

5. Parse JSON output and store result.

6. Close browser between breakpoints and reopen with new viewport:
   ```bash
   agent-browser close
   ```

### 4c. Batch Mode

1. Read `design.figma.keyFrames` from workflow.json
2. Read `design.matchFigma.baseUrl` — if missing, ask user for base URL
3. For each keyFrame that has a `route` field:
   - Resolve full URL: `{baseUrl}{route}`
   - Determine breakpoints and resolve nodeId per breakpoint:
     - If keyFrame `breakpoints` is an **array of strings** (e.g., `["desktop", "mobile"]`) → use those breakpoint names, use the keyFrame's top-level `nodeId` for all
     - If keyFrame `breakpoints` is an **object** (e.g., `{ "desktop": { "nodeId": "45:678" }, "mobile": { "nodeId": "45:690" } }`) → use `breakpoints[breakpointName].nodeId` for each
     - If keyFrame has no `breakpoints` field → default to `["desktop"]` with the top-level `nodeId`
   - For each breakpoint, run the Live Mode flow (§4b) with the resolved URL and nodeId
   - If keyFrame has a `selector`, pass it through

## §5. Generate Report

Collect all results into a JSON structure:

```json
{
  "threshold": 80,
  "date": "YYYY-MM-DD",
  "entries": [
    {
      "name": "Dashboard",
      "route": "/dashboard",
      "breakpoint": "desktop",
      "figmaUrl": "https://www.figma.com/design/...",
      "matchPercent": 94.2,
      "renderedImage": "path/to/rendered.png",
      "figmaImage": "path/to/figma.png",
      "diffImage": "path/to/diff.png"
    }
  ]
}
```

Save to `{outputDir}/results-{timestamp}.json`.

Generate HTML report:
```bash
node scripts/pixelmatch-diff.js --report {outputDir}/results-{timestamp}.json --output {outputDir}/report-{timestamp}.html
```

## §6. Terminal Summary

Print results in this format:

```
Match Figma Report — YYYY-MM-DD

  /dashboard      desktop  94.2%  PASS
  /dashboard      mobile   78.3%  FAIL
  /login          desktop  99.1%  PASS

Overall: 2/3 passed (threshold: 80%)
Report: __ai__/reports/match-figma/report-YYYY-MM-DD-HHmmss.html
```

## §7. Cleanup

Close browser session:
```bash
agent-browser close
```

## §8. Error Handling

| Error | Action |
|-------|--------|
| Diff script deps missing | Auto-install: `npm install --save-dev pixelmatch pngjs sharp` |
| No browser tool available | Show install instructions and exit |
| Figma MCP not available | Show setup instructions and exit |
| Dev server not responding | Warn, skip that page, continue batch |
| Figma URL parse failure | Warn: "Could not extract fileKey/nodeId from Figma URL" |
| Diff script error | Show stderr, skip that comparison, continue batch |
| No keyFrames with routes (batch) | Warn: "No keyFrames with routes in workflow.json. Run /wf-design-setup or use live mode." |
| Missing baseUrl (batch) | Ask user to provide base URL |
