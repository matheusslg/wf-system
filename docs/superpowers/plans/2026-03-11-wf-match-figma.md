# wf-match-figma Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a command + skill that performs pixel-level visual comparison between rendered UI and Figma designs, with scoring, batch mode, and HTML reports.

**Architecture:** Three files — a Node.js diff script (`scripts/pixelmatch-diff.js`) that handles image comparison and report generation, a command definition (`commands/wf-match-figma.md`) for user invocation, and a skill (`.claude/skills/match-figma/SKILL.md`) for sub-agent use. The diff script is the only "real code"; the command and skill are markdown instruction files following existing wf-system patterns.

**Tech Stack:** Node.js (pixelmatch, pngjs, sharp), agent-browser CLI, Figma MCP, Playwright MCP (fallback)

**Spec:** `docs/superpowers/specs/2026-03-11-wf-match-figma-design.md`

---

## Chunk 1: Diff Script Foundation

### Task 1: Initialize npm project and install dependencies

**Files:**
- Create: `package.json`

- [ ] **Step 1: Initialize package.json**

```bash
cd /Users/cavallini/wf-system && npm init -y
```

- [ ] **Step 2: Install dependencies**

```bash
cd /Users/cavallini/wf-system && npm install --save-dev pixelmatch pngjs sharp
```

- [ ] **Step 3: Add package.json and lockfile to git, gitignore node_modules**

Check if `.gitignore` exists and has `node_modules`. If not, add it.

```bash
grep -q 'node_modules' .gitignore 2>/dev/null || echo 'node_modules/' >> .gitignore
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .gitignore
git commit -m "chore: add pixelmatch, pngjs, sharp for visual diff"
```

---

### Task 2: Write the pixelmatch diff script (core comparison)

**Files:**
- Create: `scripts/pixelmatch-diff.js`

- [ ] **Step 1: Write a test for the diff script**

Create a test that verifies the script can compare two identical images and return 100% match. Create two small 10x10 red PNG test fixtures using sharp.

Create: `scripts/__tests__/pixelmatch-diff.test.js`

```js
const { execSync } = require('child_process');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SCRIPT = path.join(__dirname, '..', 'pixelmatch-diff.js');
const TMP = path.join(__dirname, '..', '__test_tmp__');

beforeAll(async () => {
  fs.mkdirSync(TMP, { recursive: true });

  // Create a 10x10 red PNG
  const red = Buffer.alloc(10 * 10 * 4, 0);
  for (let i = 0; i < 10 * 10; i++) {
    red[i * 4] = 255;     // R
    red[i * 4 + 1] = 0;   // G
    red[i * 4 + 2] = 0;   // B
    red[i * 4 + 3] = 255; // A
  }
  await sharp(red, { raw: { width: 10, height: 10, channels: 4 } })
    .png()
    .toFile(path.join(TMP, 'red.png'));

  // Create a 10x10 blue PNG
  const blue = Buffer.alloc(10 * 10 * 4, 0);
  for (let i = 0; i < 10 * 10; i++) {
    blue[i * 4] = 0;       // R
    blue[i * 4 + 1] = 0;   // G
    blue[i * 4 + 2] = 255; // B
    blue[i * 4 + 3] = 255; // A
  }
  await sharp(blue, { raw: { width: 10, height: 10, channels: 4 } })
    .png()
    .toFile(path.join(TMP, 'blue.png'));
});

afterAll(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('identical images return 100% match', () => {
  const result = execSync(
    `node ${SCRIPT} --img1 ${TMP}/red.png --img2 ${TMP}/red.png --output ${TMP}/diff_identical.png`,
    { encoding: 'utf8' }
  );
  const json = JSON.parse(result);
  expect(json.matchPercent).toBe(100);
  expect(json.mismatchPixels).toBe(0);
  expect(json.totalPixels).toBe(100);
  expect(fs.existsSync(json.diffImage)).toBe(true);
});

test('completely different images return low match', () => {
  const result = execSync(
    `node ${SCRIPT} --img1 ${TMP}/red.png --img2 ${TMP}/blue.png --output ${TMP}/diff_different.png`,
    { encoding: 'utf8' }
  );
  const json = JSON.parse(result);
  expect(json.matchPercent).toBeLessThan(10);
  expect(json.mismatchPixels).toBeGreaterThan(90);
});

test('sensitivity flag affects results', () => {
  // With very high sensitivity (1.0 = most lenient), even different colors pass
  const lenient = JSON.parse(execSync(
    `node ${SCRIPT} --img1 ${TMP}/red.png --img2 ${TMP}/blue.png --output ${TMP}/diff_lenient.png --sensitivity 1.0`,
    { encoding: 'utf8' }
  ));
  const strict = JSON.parse(execSync(
    `node ${SCRIPT} --img1 ${TMP}/red.png --img2 ${TMP}/blue.png --output ${TMP}/diff_strict.png --sensitivity 0.01`,
    { encoding: 'utf8' }
  ));
  // Lenient should have fewer mismatches (or equal) compared to strict
  expect(lenient.mismatchPixels).toBeLessThanOrEqual(strict.mismatchPixels);
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd /Users/cavallini/wf-system && npx jest scripts/__tests__/pixelmatch-diff.test.js --no-cache
```

Expected: FAIL — `pixelmatch-diff.js` does not exist yet.

- [ ] **Step 3: Write the diff script**

Create: `scripts/pixelmatch-diff.js`

```js
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const pixelmatch = require('pixelmatch');
const sharp = require('sharp');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, '');
    args[key] = argv[i + 1];
  }
  return args;
}

async function loadAndResize(filePath, targetWidth, targetHeight) {
  const resized = await sharp(filePath)
    .resize(targetWidth, targetHeight, { fit: 'fill', kernel: 'lanczos3' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return resized;
}

async function main() {
  const args = parseArgs(process.argv);
  const img1Path = args.img1;
  const img2Path = args.img2;
  const outputPath = args.output;
  const sensitivity = parseFloat(args.sensitivity || '0.1');

  if (!img1Path || !img2Path || !outputPath) {
    console.error('Usage: pixelmatch-diff.js --img1 <path> --img2 <path> --output <path> [--sensitivity <0-1>]');
    process.exit(1);
  }

  // Get dimensions of both images
  const meta1 = await sharp(img1Path).metadata();
  const meta2 = await sharp(img2Path).metadata();

  // Use the larger dimensions as target
  const width = Math.max(meta1.width, meta2.width);
  const height = Math.max(meta1.height, meta2.height);

  // Load and resize both to matching dimensions
  const buf1 = await loadAndResize(img1Path, width, height);
  const buf2 = await loadAndResize(img2Path, width, height);

  const totalPixels = width * height;
  const diffBuf = Buffer.alloc(totalPixels * 4);

  const mismatchPixels = pixelmatch(
    buf1.data, buf2.data, diffBuf,
    width, height,
    { threshold: sensitivity }
  );

  // Write diff image
  const diffPng = new PNG({ width, height });
  diffPng.data = diffBuf;
  const diffStream = fs.createWriteStream(outputPath);
  diffPng.pack().pipe(diffStream);

  await new Promise((resolve, reject) => {
    diffStream.on('finish', resolve);
    diffStream.on('error', reject);
  });

  const matchPercent = parseFloat(((1 - mismatchPixels / totalPixels) * 100).toFixed(1));

  const result = {
    matchPercent,
    mismatchPixels,
    totalPixels,
    diffImage: path.resolve(outputPath)
  };

  console.log(JSON.stringify(result));
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd /Users/cavallini/wf-system && npx jest scripts/__tests__/pixelmatch-diff.test.js --no-cache
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/pixelmatch-diff.js scripts/__tests__/pixelmatch-diff.test.js
git commit -m "feat: add pixelmatch-diff.js for pixel-level image comparison"
```

---

### Task 3: Add image resize test (different dimensions)

**Files:**
- Modify: `scripts/__tests__/pixelmatch-diff.test.js`

- [ ] **Step 1: Add test for dimension mismatch auto-resize**

Add to the test file:

```js
test('auto-resizes images with different dimensions', async () => {
  // Create a 20x20 green PNG (larger than the 10x10 fixtures)
  const green = Buffer.alloc(20 * 20 * 4, 0);
  for (let i = 0; i < 20 * 20; i++) {
    green[i * 4] = 0;
    green[i * 4 + 1] = 255;
    green[i * 4 + 2] = 0;
    green[i * 4 + 3] = 255;
  }
  await sharp(green, { raw: { width: 20, height: 20, channels: 4 } })
    .png()
    .toFile(path.join(TMP, 'green_20x20.png'));

  const result = execSync(
    `node ${SCRIPT} --img1 ${TMP}/red.png --img2 ${TMP}/green_20x20.png --output ${TMP}/diff_resize.png`,
    { encoding: 'utf8' }
  );
  const json = JSON.parse(result);
  // Should not crash, should return a valid result
  expect(json.matchPercent).toBeDefined();
  expect(json.totalPixels).toBe(400); // 20x20
  expect(fs.existsSync(json.diffImage)).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it passes**

```bash
cd /Users/cavallini/wf-system && npx jest scripts/__tests__/pixelmatch-diff.test.js --no-cache
```

Expected: 4 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add scripts/__tests__/pixelmatch-diff.test.js
git commit -m "test: add dimension mismatch resize test for pixelmatch-diff"
```

---

### Task 4: Add HTML report generation to the diff script

**Files:**
- Modify: `scripts/pixelmatch-diff.js`
- Create: `scripts/__tests__/report.test.js`

The diff script already handles single-pair comparison. Now add a `--report` mode that takes a JSON file of results and generates an HTML report.

- [ ] **Step 1: Write the report test**

Create: `scripts/__tests__/report.test.js`

```js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SCRIPT = path.join(__dirname, '..', 'pixelmatch-diff.js');
const TMP = path.join(__dirname, '..', '__test_tmp_report__');

beforeAll(async () => {
  fs.mkdirSync(TMP, { recursive: true });

  // Create minimal test images
  const px = Buffer.alloc(4 * 4, 0);
  for (let i = 0; i < 4; i++) { px[i * 4] = 255; px[i * 4 + 3] = 255; }
  await sharp(px, { raw: { width: 2, height: 2, channels: 4 } })
    .png()
    .toFile(path.join(TMP, 'a.png'));
  await sharp(px, { raw: { width: 2, height: 2, channels: 4 } })
    .png()
    .toFile(path.join(TMP, 'b.png'));
  await sharp(px, { raw: { width: 2, height: 2, channels: 4 } })
    .png()
    .toFile(path.join(TMP, 'diff.png'));
});

afterAll(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('generates HTML report from results JSON', () => {
  const results = {
    threshold: 80,
    date: '2026-03-11',
    entries: [
      {
        name: 'Dashboard',
        route: '/dashboard',
        breakpoint: 'desktop',
        figmaUrl: 'https://www.figma.com/design/abc/App?node-id=1-2',
        matchPercent: 94.2,
        renderedImage: path.join(TMP, 'a.png'),
        figmaImage: path.join(TMP, 'b.png'),
        diffImage: path.join(TMP, 'diff.png')
      },
      {
        name: 'Login',
        route: '/login',
        breakpoint: 'desktop',
        figmaUrl: 'https://www.figma.com/design/abc/App?node-id=3-4',
        matchPercent: 72.1,
        renderedImage: path.join(TMP, 'a.png'),
        figmaImage: path.join(TMP, 'b.png'),
        diffImage: path.join(TMP, 'diff.png')
      }
    ]
  };

  const resultsPath = path.join(TMP, 'results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(results));

  const reportPath = path.join(TMP, 'report.html');
  const stdout = execSync(`node ${SCRIPT} --report ${resultsPath} --output ${reportPath}`, { encoding: 'utf8' });
  const out = JSON.parse(stdout);
  expect(out.report).toContain('report.html');

  expect(fs.existsSync(reportPath)).toBe(true);

  const html = fs.readFileSync(reportPath, 'utf8');
  expect(html).toContain('Match Figma Report');
  expect(html).toContain('Dashboard');
  expect(html).toContain('94.2%');
  expect(html).toContain('72.1%');
  expect(html).toContain('PASS');
  expect(html).toContain('FAIL');
  // Images should be base64-embedded
  expect(html).toContain('data:image/png;base64,');
  // Overall stats
  expect(html).toContain('1/2 passed');
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/cavallini/wf-system && npx jest scripts/__tests__/report.test.js --no-cache
```

Expected: FAIL — `--report` mode not implemented yet.

- [ ] **Step 3: Implement report generation**

Add the report mode to `scripts/pixelmatch-diff.js`. At the top of `main()`, check for `--report` flag. If present, branch to report generation instead of diff comparison.

Add this function before `main()`:

```js
function generateReport(resultsPath, outputPath) {
  const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
  const { threshold, date, entries } = results;

  let passCount = 0;
  let totalCount = entries.length;

  const rows = entries.map(entry => {
    const passed = entry.matchPercent >= threshold;
    if (passed) passCount++;
    const statusClass = passed ? 'pass' : 'fail';
    const statusText = passed ? 'PASS' : 'FAIL';

    const toBase64 = (imgPath) => {
      if (!fs.existsSync(imgPath)) return '';
      return 'data:image/png;base64,' + fs.readFileSync(imgPath).toString('base64');
    };

    return `
      <div class="card ${statusClass}">
        <h3>${entry.name} — ${entry.route} (${entry.breakpoint})</h3>
        <p><a href="${entry.figmaUrl}" target="_blank">Figma Link</a></p>
        <div class="images">
          <div><p>Rendered</p><img src="${toBase64(entry.renderedImage)}" /></div>
          <div><p>Figma</p><img src="${toBase64(entry.figmaImage)}" /></div>
          <div><p>Diff</p><img src="${toBase64(entry.diffImage)}" /></div>
        </div>
        <p class="score ${statusClass}">${entry.matchPercent}% — ${statusText}</p>
      </div>`;
  }).join('\n');

  const overallPass = passCount === totalCount;
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Match Figma Report — ${date}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
  h1 { border-bottom: 2px solid #333; padding-bottom: 10px; }
  .summary { font-size: 1.2em; margin: 20px 0; padding: 15px; background: white; border-radius: 8px; }
  .card { background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #ccc; }
  .card.pass { border-left-color: #22c55e; }
  .card.fail { border-left-color: #ef4444; }
  .images { display: flex; gap: 10px; margin: 10px 0; }
  .images div { flex: 1; text-align: center; }
  .images img { max-width: 100%; border: 1px solid #ddd; border-radius: 4px; }
  .score { font-size: 1.3em; font-weight: bold; }
  .score.pass { color: #22c55e; }
  .score.fail { color: #ef4444; }
  .footer { margin-top: 30px; color: #666; font-size: 0.9em; }
</style></head><body>
  <h1>Match Figma Report — ${date}</h1>
  <div class="summary">
    <strong>Overall: ${overallPass ? 'PASS' : 'FAIL'}</strong> — ${passCount}/${totalCount} passed (threshold: ${threshold}%)
  </div>
  ${rows}
  <div class="footer">Threshold: ${threshold}% | Pages tested: ${totalCount}</div>
</body></html>`;

  fs.writeFileSync(outputPath, html);
  console.log(JSON.stringify({ report: path.resolve(outputPath) }));
}
```

Then in `main()`, add at the top before the existing logic:

```js
if (args.report) {
  generateReport(args.report, args.output);
  return;
}
```

- [ ] **Step 4: Run both test files to verify all pass**

```bash
cd /Users/cavallini/wf-system && npx jest scripts/__tests__/ --no-cache
```

Expected: All tests PASS (4 from pixelmatch-diff.test.js + 1 from report.test.js).

- [ ] **Step 5: Commit**

```bash
git add scripts/pixelmatch-diff.js scripts/__tests__/report.test.js
git commit -m "feat: add HTML report generation to pixelmatch-diff.js"
```

---

## Chunk 2: Command and Skill

### Task 5: Create the wf-match-figma command

**Files:**
- Create: `commands/wf-match-figma.md`

Reference existing commands for structure: `commands/wf-e2e.md`, `commands/wf-ai-qa.md`, `commands/wf-design-setup.md`.

- [ ] **Step 1: Write the command file**

Create: `commands/wf-match-figma.md`

```markdown
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
> **Figma MCP not available.** Run `/wf-design-setup` to configure Figma integration, or install Figma MCP:
> ```json
> { "mcpServers": { "figma": { "command": "npx", "args": ["@anthropic-ai/figma-mcp@latest"] } } }
> ```

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
   # Use the element ref from snapshot output to screenshot just that element
   agent-browser screenshot --ref @e1 {outputDir}/rendered-{name}-{breakpoint}.png
   ```
   If `--ref` is not supported, fall back to full-page screenshot and note that component matching may be less accurate.

   Otherwise (full page):
   ```bash
   agent-browser screenshot {outputDir}/rendered-{name}-{breakpoint}.png
   ```

   > **Implementation note:** Verify exact `agent-browser screenshot` CLI flags by running `agent-browser screenshot --help` at implementation time. The element ref syntax (`@e1`) comes from snapshots but the screenshot command's flag for targeting a specific ref may differ.

   **Playwright MCP (fallback):**
   ```
   mcp__playwright__browser_navigate({ url })
   mcp__playwright__browser_take_screenshot()
   ```
   Save screenshot to `{outputDir}/rendered-{name}-{breakpoint}.png`.

   **Chrome extension (fallback):**
   ```
   mcp__claude-in-chrome__navigate({ url })
   mcp__claude-in-chrome__computer({ action: "screenshot" })
   ```
   Save the screenshot to `{outputDir}/rendered-{name}-{breakpoint}.png`.
   Note: Chrome extension requires `claude --chrome` and has limited element-level capture. Full-page screenshots only.

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
     - If keyFrame `breakpoints` is an **object** (e.g., `{ "desktop": { "nodeId": "45:678" }, "mobile": { "nodeId": "45:690" } }`) → use each breakpoint's own `nodeId` via `breakpoints[breakpointName].nodeId`
     - If keyFrame has no `breakpoints` field → default to `["desktop"]` with the top-level `nodeId`
   - For each breakpoint, run the Live Mode flow (§4b) with the resolved URL and the resolved nodeId for that breakpoint
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
```

**END OF COMMAND FILE CONTENT** — everything above between the opening ```` ```markdown ```` and closing ```` ``` ```` is the content of `commands/wf-match-figma.md`.

- [ ] **Step 2: Verify command file syntax**

Read the file back and ensure frontmatter is valid YAML, sections are numbered consistently, all agent-browser commands match the skill docs.

- [ ] **Step 3: Commit**

```bash
git add commands/wf-match-figma.md
git commit -m "feat: add /wf-match-figma command for pixel-level Figma comparison"
```

---

### Task 6: Create the match-figma skill

**Files:**
- Create: `.claude/skills/match-figma/SKILL.md`

The skill mirrors the command but with skill frontmatter so sub-agents can invoke it.

- [ ] **Step 1: Write the skill file**

Create: `.claude/skills/match-figma/SKILL.md`

The skill should have the same process sections as the command (§0 through §8) but with skill-appropriate frontmatter. Copy the command content and adjust the frontmatter:

```markdown
---
name: match-figma
description: Pixel-level visual comparison between rendered UI and Figma designs. Captures screenshots, runs pixel diff, produces scored reports. Use when you need quantitative design accuracy verification.
allowed-tools: Read, Write, Bash(agent-browser:*), Bash(node:*), Bash(curl:*), Bash(mkdir:*), Bash(npm:*), mcp__figma__get_screenshot, mcp__figma__get_design_context, mcp__playwright__browser_navigate, mcp__playwright__browser_take_screenshot, mcp__playwright__browser_snapshot, mcp__claude-in-chrome__navigate, mcp__claude-in-chrome__read_page
---
```

The body should be identical to the command file content (§0 through §8), minus the command-specific frontmatter. This keeps them in sync and avoids duplication logic.

- [ ] **Step 2: Verify skill structure matches other skills**

Compare against `.claude/skills/visual-verify/SKILL.md` to ensure frontmatter format is consistent.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/match-figma/SKILL.md
git commit -m "feat: add match-figma skill for sub-agent visual comparison"
```

---

### Task 7: Update documentation

**Files:**
- Modify: `docs/COMMANDS.md`

- [ ] **Step 1: Add wf-match-figma entry to COMMANDS.md**

Find the "Testing" or "Quality Assurance" section in `docs/COMMANDS.md` (near `wf-e2e`, `wf-ai-qa`). Add:

```markdown
### `/wf-match-figma [url] [figma-url] [--batch] [--selector] [--threshold] [--breakpoints] [--sensitivity]`
Pixel-level visual comparison between rendered UI and Figma designs.

**Modes:**
- **Live**: `wf-match-figma http://localhost:3000/page https://figma.com/design/...`
- **Attached**: Paste Figma URL + attach screenshot image
- **Batch**: `wf-match-figma --batch` — runs all keyFrames from workflow.json

**Output:**
- Match percentage per page/breakpoint
- Diff overlay images
- HTML report with side-by-side comparison
- Terminal PASS/FAIL summary (default threshold: 80%)
```

- [ ] **Step 2: Commit**

```bash
git add docs/COMMANDS.md
git commit -m "docs: add /wf-match-figma to command reference"
```

---

### Task 8: Final verification

- [ ] **Step 1: Run all tests**

```bash
cd /Users/cavallini/wf-system && npx jest scripts/__tests__/ --no-cache --verbose
```

Expected: All tests pass.

- [ ] **Step 2: Verify all files exist**

```bash
ls -la scripts/pixelmatch-diff.js
ls -la commands/wf-match-figma.md
ls -la .claude/skills/match-figma/SKILL.md
ls -la scripts/__tests__/pixelmatch-diff.test.js
ls -la scripts/__tests__/report.test.js
```

- [ ] **Step 3: Verify command appears in wf-system**

```bash
grep -l "wf-match-figma" commands/ .claude/skills/match-figma/ docs/COMMANDS.md
```

Expected: All 3 locations found.
