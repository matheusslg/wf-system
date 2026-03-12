# wf-match-figma Design Spec

**Date**: 2026-03-11
**Status**: Draft
**Author**: Brainstorming session

## Overview

`/wf-match-figma` is a command + skill for pixel-level visual comparison between a rendered UI and Figma designs. It captures screenshots, fetches Figma frames, runs pixel diff analysis, and produces scored reports with pass/fail verdicts.

## Goals

- Pixel-level diff with match percentage scoring
- Batch comparison of multiple pages from workflow.json keyFrames
- Component-level matching via CSS selectors
- Responsive breakpoint testing (multiple viewports per page)
- HTML report generation with side-by-side images and diff overlays
- Threshold-based pass/fail (default 80%)
- Support for user-attached images as input (skip browser capture)

## Architecture

### Files

| File | Purpose |
|------|---------|
| `commands/wf-match-figma.md` | User-facing command definition |
| `.claude/skills/match-figma/SKILL.md` | Sub-agent invocable skill (same logic, skill frontmatter) |
| `scripts/pixelmatch-diff.js` | Pixel comparison + HTML report generation (~120 lines) |

### Flow

```
1. Parse args (URL + Figma link, attached image + Figma link, or "batch")
2. For each page/component x breakpoint:
   a. Capture rendered screenshot (agent-browser or use attached image)
   b. Capture Figma frame (Figma MCP get_screenshot)
   c. Run pixelmatch-diff.js -> diff image + match score
3. Aggregate results, apply pass/fail threshold
4. Generate HTML report (single file, base64 images)
5. Print terminal summary
```

## Input Modes

### 1. Live Mode (URL + Figma link)

```
/wf-match-figma http://localhost:3000/dashboard https://www.figma.com/design/abc123/MyApp?node-id=45-678
```

- agent-browser captures the URL
- Figma MCP captures the node
- Supports `--selector`, `--threshold`, `--breakpoints` flags

### 2. Attached Image Mode

```
/wf-match-figma https://www.figma.com/design/abc123/MyApp?node-id=45-678
[user attaches screenshot.png in the prompt]
```

- Skips browser capture, uses the attached image directly
- Saves attached image to output dir
- Figma MCP captures the node
- Runs diff as normal

### 3. Batch Mode

```
/wf-match-figma --batch
```

- Reads `design.figma.keyFrames` from `.claude/workflow.json`
- Iterates all keyFrames that have a `route` field (keyFrames without `route` are skipped)
- Resolves full URLs using `design.matchFigma.baseUrl` + keyFrame `route` (e.g., `http://localhost:3000` + `/dashboard`)
- Captures each at configured breakpoints
- Produces a full report across all pages

## Configuration

Extends `.claude/workflow.json`:

```json
{
  "design": {
    "figma": {
      "fileKey": "abc123",
      "keyFrames": [
        {
          "nodeId": "45:678",
          "name": "Dashboard",
          "route": "/dashboard",
          "breakpoints": ["desktop", "mobile"],
          "selector": null
        },
        {
          "nodeId": "45:680",
          "name": "Login",
          "route": "/login"
        },
        {
          "nodeId": "12:345",
          "name": "Header Nav",
          "route": "/dashboard",
          "selector": ".header-nav"
        }
      ]
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

### Configuration Fields

- **baseUrl**: Base URL for batch mode route resolution (e.g., `http://localhost:3000`). Required for batch mode.
- **threshold**: Match percentage for pass/fail (default 80%). Overridable via `--threshold` CLI arg.
- **breakpoints**: Named viewport sizes. keyFrames reference them by name. If a keyFrame has no `breakpoints` field, defaults to `["desktop"]`.
- **outputDir**: Where reports and screenshots are saved.

## Figma URL Parsing

Full Figma URLs are the primary interface. The command extracts `fileKey` and `nodeId`:

- URL format: `https://www.figma.com/design/:fileKey/:fileName?node-id=:nodeId`
- Node ID conversion: `45-678` (URL format) -> `45:678` (API format)

No shorthand syntax required. Users paste Figma links directly.

## Diff Script (`scripts/pixelmatch-diff.js`)

### Responsibilities

1. Read two PNG images from disk
2. Auto-resize the smaller image to match the larger one's dimensions (using `sharp` for high-quality Lanczos resampling)
3. Run `pixelmatch` to produce a diff image and mismatch pixel count
4. Calculate match percentage: `matchPercent = (1 - mismatchPixels / totalPixels) * 100`
5. Output JSON to stdout
6. Optionally generate HTML report when `--report` flag is passed with a results JSON file

### Interface

```bash
node scripts/pixelmatch-diff.js --img1 rendered.png --img2 figma.png --output diff.png --sensitivity 0.1
```

### Output (JSON to stdout)

```json
{
  "matchPercent": 94.2,
  "mismatchPixels": 1847,
  "totalPixels": 31680,
  "diffImage": "path/to/diff.png"
}
```

### Dependencies

- `pixelmatch` — zero-dep, ~200 lines, pixel-level image comparison
- `pngjs` — zero-dep, PNG encode/decode
- `sharp` — high-performance image processing (resize with Lanczos resampling)

Installed locally in wf-system (`npm install --save-dev pixelmatch pngjs sharp`).

### Exit behavior

Always exits 0. The command interprets the score; the script just reports numbers.

### Sensitivity

The `--sensitivity` flag controls pixelmatch's per-pixel color distance threshold (0.1 = default). This is separate from the pass/fail percentage threshold. Lower values = stricter pixel matching.

## Component-Level Matching

For individual components instead of full pages:

```
/wf-match-figma http://localhost:3000/dashboard --selector ".header-nav" https://www.figma.com/design/abc123/MyApp?node-id=12-345
```

1. agent-browser navigates to the URL
2. Snapshot scoped to selector to get element ref: `agent-browser snapshot -s ".header-nav"`
3. Screenshot the element via its ref: `agent-browser screenshot @e1`
4. Figma MCP captures the specific component node
5. Diff runs on the cropped images

**Fallback (Playwright MCP):**
1. Navigate: `mcp__playwright__browser_navigate`
2. Snapshot to find element: `mcp__playwright__browser_snapshot`
3. Screenshot: `mcp__playwright__browser_take_screenshot` with element reference

In batch mode, keyFrames can include a `selector` field for component-level entries.

## Responsive Breakpoint Testing

When breakpoints are specified (via CLI or keyFrame config):

1. Close current page and reopen with viewport size: `agent-browser close && agent-browser open [URL] --viewport 375x812`
2. Wait for layout: `agent-browser wait --load networkidle`
3. Capture screenshot at that viewport
4. Fetch corresponding Figma frame (same node). Note: Figma frames are typically static at one resolution, so non-native breakpoints may have inherently lower match scores. For accurate responsive testing, use separate Figma frames per breakpoint and map them as distinct keyFrames with per-breakpoint `nodeId` values.
5. Run diff

**Per-breakpoint Figma nodes** (optional): keyFrames can specify breakpoint-specific nodes:
```json
{
  "nodeId": "45:678",
  "name": "Dashboard",
  "route": "/dashboard",
  "breakpoints": {
    "desktop": { "nodeId": "45:678" },
    "mobile": { "nodeId": "45:690" }
  }
}
```
When `breakpoints` is an array of strings, the same `nodeId` is used for all. When it's an object, each breakpoint can override the node.

Each breakpoint produces its own row in the report.

## Report Generation

### HTML Report

Location: `__ai__/reports/match-figma/report-YYYY-MM-DD-HHmmss.html`

Contents:
- **Summary header**: date, overall PASS/FAIL, average match %, threshold used
- **Per-page card**:
  - Page name + route + Figma link
  - Three images side-by-side: Rendered | Figma | Diff overlay
  - Match percentage with color coding (green >= threshold, red < threshold)
  - Per-breakpoint rows if multiple breakpoints tested
- **Footer**: threshold, total pages tested, tool versions

Images embedded as base64 so the report is a single portable file.

### Terminal Output

```
Match Figma Report - 2026-03-11

  /dashboard      desktop  94.2%  PASS
  /dashboard      mobile   78.3%  FAIL
  /login          desktop  99.1%  PASS

Overall: 2/3 passed (threshold: 80%)
Report: __ai__/reports/match-figma/report-2026-03-11-143022.html
```

## Browser Tool Priority

Consistent with the existing `visual-verify` skill:

1. **agent-browser CLI** (preferred) — headless, fast, supports snapshots and viewport control
2. **Chrome extension** (fallback) — if running with `claude --chrome`, has user's auth state
3. **Playwright MCP** (fallback) — official Microsoft server, works headless

The command checks availability in this order and uses the first working option.

## Error Handling

- **Dev server not responding**: Warn user, abort that page, continue batch
- **Figma MCP not available**: Error with setup instructions (point to `wf-design-setup`)
- **agent-browser not installed**: Fall back to Playwright MCP, then Chrome extension
- **Image dimension mismatch**: Auto-resize via `sharp` Lanczos resampling (handled by diff script)
- **pixelmatch deps not installed**: Auto-install via `npm install --save-dev pixelmatch pngjs sharp`

## Command Arguments

| Arg | Required | Description | Example |
|-----|----------|-------------|---------|
| `url` | No* | Page URL to capture | `http://localhost:3000/dashboard` |
| `figma` | No* | Figma design URL | `https://www.figma.com/design/abc123/MyApp?node-id=45-678` |
| `--batch` | No | Run all keyFrames from workflow.json | `--batch` |
| `--selector` | No | CSS selector for component capture | `--selector ".header-nav"` |
| `--threshold` | No | Pass/fail percentage (default: 80) | `--threshold 90` |
| `--breakpoints` | No | Comma-separated breakpoint names | `--breakpoints desktop,mobile` |
| `--sensitivity` | No | Pixel-level color distance (default: 0.1, lower = stricter) | `--sensitivity 0.05` |

*In live mode, at least `url` + `figma` required. In attached mode, only `figma` required. In batch mode, only `--batch` required.

### Argument Parsing Rules

- URLs containing `figma.com` are identified as Figma links; all other URLs are treated as page URLs
- Named flags (`--selector`, `--threshold`, etc.) can appear in any position
- Attached images are detected by the AI agent from the conversation context (Claude natively sees image attachments); the command instructions tell the agent to save the image to disk before passing to the diff script

## Skill Definition (`.claude/skills/match-figma/SKILL.md`)

The skill mirrors the command logic but is formatted as a skill for sub-agent invocation:

```yaml
---
name: match-figma
description: Pixel-level visual comparison between rendered UI and Figma designs. Captures screenshots, runs pixel diff, produces scored reports.
allowed-tools: Read, Bash(agent-browser:*), Bash(node:*), mcp__figma__get_screenshot, mcp__figma__get_design_context, mcp__playwright__browser_navigate, mcp__playwright__browser_take_screenshot, mcp__playwright__browser_snapshot, mcp__claude-in-chrome__navigate, mcp__claude-in-chrome__read_page
---
```

The skill body contains the same process steps as the command (parse args, capture, diff, report). Sub-agents invoke it by name. The skill reads `workflow.json` for batch config and accepts the same arguments as the command.

## Relationship to `visual-verify`

`visual-verify` is a lighter-weight skill for quick subjective checks (screenshot + Figma side-by-side, AI-judged discrepancies). `match-figma` is a quantitative tool that produces pixel-level scores, diff images, and structured reports. They coexist:

- Use `visual-verify` during development for quick "does this look right?" checks
- Use `match-figma` for formal design QA, regression testing, and batch verification
