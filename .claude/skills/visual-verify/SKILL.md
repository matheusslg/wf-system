---
description: Visual verification of UI against Figma designs. Uses Chrome if available, falls back to Playwright.
allowed-tools: Read, Bash, mcp__figma__get_screenshot, mcp__figma__get_design_context, mcp__MCP_DOCKER__browser_navigate, mcp__MCP_DOCKER__browser_take_screenshot, mcp__MCP_DOCKER__browser_snapshot, mcp__playwright__browser_navigate, mcp__playwright__browser_take_screenshot, mcp__playwright__browser_snapshot
---

# Visual Verify

Verify rendered UI matches the Figma design. Attempts Chrome first, falls back to Playwright MCP.

## Prerequisites

### Option A: Chrome Extension (Recommended for main agent)
- Install [Claude in Chrome extension](https://chromewebstore.google.com/detail/claude/fcoeoabgfenejglbffodgkkbkcdhcgfn) (v1.0.36+)
- Start Claude with `claude --chrome`

### Option B: Playwright MCP Server (For sub-agents or headless)
Add to your MCP config (`~/.claude/settings.json` or project `.mcp.json`):
```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```
See: https://github.com/microsoft/playwright-mcp

## Arguments

| Arg | Required | Description | Example |
|-----|----------|-------------|---------|
| `url` | Yes | Page URL to verify | `http://localhost:3000/dashboard` |
| `figma` | No | Figma URL or node ID | `https://figma.com/design/abc123?node-id=1-2` |

## Process

### 1. Parse Arguments

Extract URL and optional Figma reference from the task prompt.

### 2. Check Dev Server (if localhost)

If URL is localhost, verify server is responding:
```bash
curl -s -o /dev/null -w "%{http_code}" [URL] --max-time 5
```

If not responding (non-200), warn user:
> "Dev server not responding at [URL]. Please start it and retry."

### 3. Capture Rendered Page

Try browser tools in this order (use first available):

**Option 1: Chrome Extension** (best - has auth state):
```
browser_navigate to [URL]
browser_take_screenshot
```

**Option 2: Playwright MCP** (official Microsoft server):
```
mcp__playwright__browser_navigate to [URL]
mcp__playwright__browser_take_screenshot
```

**Option 3: MCP_DOCKER Playwright** (fallback):
```
mcp__MCP_DOCKER__browser_navigate to [URL]
mcp__MCP_DOCKER__browser_take_screenshot
```

Use whichever browser tools are available in your current session.

### 4. Get Figma Design (if provided)

If Figma URL/node provided, extract fileKey and nodeId:
- URL format: `https://figma.com/design/:fileKey/:fileName?node-id=:nodeId`
- nodeId format: `1-2` or `1:2`

Use `mcp__figma__get_screenshot` to capture the design:
```
fileKey: [extracted]
nodeId: [extracted, convert 1-2 to 1:2]
```

### 5. Compare & Report

Compare the rendered screenshot against Figma design:

**Report format:**
```markdown
## Visual Verification: [URL]

### Screenshots
- Rendered: [screenshot path or description]
- Figma: [screenshot path or description]

### Discrepancies Found
- [ ] Issue 1: [description]
- [ ] Issue 2: [description]

### Assessment
**PASS** - Matches design
OR
**NEEDS FIXES** - [N] issues found
```

### 6. Optional: Fix Issues

If discrepancies found and within scope, offer to fix:
> "Found [N] visual issues. Should I fix them?"

If yes, make code changes and re-verify.

## Example Usage

**Basic (no Figma comparison):**
```
Run visual-verify on http://localhost:3000/settings
```

**With Figma design:**
```
Run visual-verify on http://localhost:3000/dashboard against https://figma.com/design/abc123/MyApp?node-id=45-678
```

**After implementation:**
```
Verify the login page matches the Figma design at [figma-url]
```

## Notes

- Chrome extension required for authenticated external pages
- Playwright works for localhost without auth
- Always check dev server is running before verification
- Figma comparison is optional but recommended for design accuracy
