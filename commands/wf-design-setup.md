---
description: Configure detailed design resources (Figma, design system, tokens)
allowed-tools: Read, Write, Edit, Bash, AskUserQuestion, mcp__figma__get_screenshot, mcp__figma__get_design_context, mcp__figma__get_metadata
---

# Design Setup

Configure detailed design resources for the project. This command sets up Figma integration, design system configuration, and creates design-related documentation.

## Prerequisites

- Run `/wf-init` first to create workflow structure
- Optionally run `/wf-create-prd` to capture basic design info

## 0. Load Current State

Check existing configuration:

```bash
cat .claude/workflow.json 2>/dev/null || echo "NO_WORKFLOW"
cat PRD.md 2>/dev/null | grep -A 20 "## Design" | head -25
```

Extract any existing design info from PRD.md:
- Figma links mentioned
- Design system chosen
- Brand guidelines

## 1. Check Existing Design Config

```bash
cat .claude/workflow.json 2>/dev/null | grep -A 20 '"design"' || echo "NO_DESIGN_CONFIG"
ls docs/STYLE_GUIDE.md STYLE_GUIDE.md 2>/dev/null || echo "NO_STYLE_GUIDE"
```

**If design already configured**, ask user:

| Option | Behavior |
|--------|----------|
| **Update** | Modify existing design configuration |
| **Replace** | Start fresh with new design config |
| **Cancel** | Exit without changes |

## 2. Figma Integration

Ask user about Figma:

**"Do you have Figma designs for this project?"**

| Option | Next Step |
|--------|-----------|
| **Yes, I have Figma files** | Configure Figma integration |
| **No Figma yet** | Skip to design system |
| **Will add later** | Skip, can re-run this command |

### If Yes - Configure Figma

Ask for Figma details:

1. **Figma URL**: "Paste a Figma file URL (e.g., https://figma.com/design/ABC123/...)"

Extract from URL:
- `fileKey`: The file key from the URL
- `nodeId`: The node ID if present in URL (node-id=X-Y)

**Validate Figma access**:

```
mcp__figma__get_metadata(
  fileKey: "{extracted_file_key}",
  nodeId: "{extracted_node_id or '0:1' for root}"
)
```

**If successful**, ask:

2. **Main design pages**: "Which pages contain the main designs? (e.g., 'Components', 'Screens', 'Design System')"

3. **Key screens to reference**: "Any specific screens/frames to use as reference? (paste node IDs or describe)"

### Store Figma Config

Build Figma configuration:

```json
{
  "figma": {
    "fileKey": "{file_key}",
    "fileUrl": "{full_url}",
    "mainPages": ["Components", "Screens"],
    "keyFrames": [
      { "nodeId": "123:456", "name": "Home Screen" },
      { "nodeId": "123:789", "name": "Dashboard" }
    ]
  }
}
```

## 3. Design System Configuration

Ask about design system:

**"What design system or component library are you using?"**

| Option | Config Value |
|--------|--------------|
| **Shadcn/ui** | `shadcn` |
| **Material UI (MUI)** | `mui` |
| **Tailwind CSS (utility-first)** | `tailwind` |
| **Chakra UI** | `chakra` |
| **Ant Design** | `antd` |
| **Custom/None** | `custom` or `none` |
| **Other** | User specifies |

### If Shadcn/Tailwind detected

Ask additional questions:

1. **Theme configuration**: "Where is your theme/tailwind config? (e.g., tailwind.config.js, src/styles/theme.ts)"
2. **Components location**: "Where are your UI components? (e.g., src/components/ui)"

### If Custom

Ask:
1. **Components location**: "Where are your custom components?"
2. **Style approach**: "How do you handle styles? (CSS modules, styled-components, Tailwind, etc.)"

## 4. Brand & Style Guidelines

Ask about brand/style:

**"Do you have brand guidelines or a style guide?"**

| Option | Action |
|--------|--------|
| **Yes, existing document** | Ask for location/link |
| **Yes, in Figma** | Extract from Figma design system |
| **No, create one** | Generate STYLE_GUIDE.md template |
| **Skip for now** | Leave empty |

### If Create New Style Guide

Generate `docs/STYLE_GUIDE.md`:

```markdown
# Style Guide

> Design guidelines for {project_name}

## Colors

### Primary
- Primary: `#` - {description}
- Primary Hover: `#`

### Secondary
- Secondary: `#`

### Neutral
- Background: `#`
- Surface: `#`
- Text Primary: `#`
- Text Secondary: `#`

### Semantic
- Success: `#`
- Warning: `#`
- Error: `#`
- Info: `#`

## Typography

### Font Families
- Headings: {font}
- Body: {font}
- Mono: {font}

### Scale
| Name | Size | Weight | Line Height |
|------|------|--------|-------------|
| h1 | 2.5rem | 700 | 1.2 |
| h2 | 2rem | 700 | 1.25 |
| h3 | 1.5rem | 600 | 1.3 |
| body | 1rem | 400 | 1.5 |
| small | 0.875rem | 400 | 1.5 |

## Spacing

Using {4px/8px} base unit:
- xs: 4px
- sm: 8px
- md: 16px
- lg: 24px
- xl: 32px
- 2xl: 48px

## Border Radius

- none: 0
- sm: 4px
- md: 8px
- lg: 12px
- full: 9999px

## Shadows

- sm: `0 1px 2px rgba(0,0,0,0.05)`
- md: `0 4px 6px rgba(0,0,0,0.1)`
- lg: `0 10px 15px rgba(0,0,0,0.1)`

## Components

### Buttons
- Primary: {description}
- Secondary: {description}
- Ghost: {description}

### Forms
- Input style: {description}
- Label position: {above/inline}
- Error display: {description}

## Layout

- Max content width: {width}
- Sidebar width: {width}
- Header height: {height}
- Grid: {columns}

---
*Generated by /wf-design-setup*
```

## 5. Design Tokens (Optional)

If using a design system, ask:

**"Do you want to set up design tokens?"**

| Option | Action |
|--------|--------|
| **Yes, extract from Figma** | Use Figma variables API |
| **Yes, create manually** | Generate tokens file |
| **No** | Skip |

### If Extract from Figma

```
mcp__figma__get_variable_defs(
  fileKey: "{file_key}",
  nodeId: "0:1"
)
```

Parse and create `src/styles/tokens.ts` or `tokens.json`.

## 6. Update workflow.json

Add/update the design section in `.claude/workflow.json`:

```json
{
  "project": "...",
  "github": { ... },
  "design": {
    "figma": {
      "fileKey": "{key}",
      "fileUrl": "{url}",
      "mainPages": ["Components", "Screens"],
      "keyFrames": []
    },
    "system": "{shadcn|mui|tailwind|custom|none}",
    "systemConfig": {
      "themeFile": "tailwind.config.js",
      "componentsDir": "src/components/ui"
    },
    "styleGuide": "docs/STYLE_GUIDE.md",
    "tokens": "src/styles/tokens.ts"
  }
}
```

Use the Edit tool to update workflow.json.

## 7. Update standards.md

Add design section to `standards.md`:

```markdown
## Design Standards

### Component Library
Using {design_system}. Components are in `{components_dir}`.

### Figma Reference
- File: {figma_url}
- Always reference Figma designs before implementing UI

### Style Guide
See `{style_guide_path}` for colors, typography, and spacing.

### Design Tokens
{If tokens configured: Import tokens from `{tokens_path}`}

### UI Implementation Rules
1. Use existing components from {design_system} before creating custom
2. Follow spacing scale: {xs, sm, md, lg, xl}
3. Use semantic color tokens, not raw hex values
4. Match Figma designs as closely as possible
5. When in doubt, ask or check the design system documentation
```

## 8. Create Design Skills (Optional)

If Figma is configured, suggest creating design-related skills:

**"Create design helper skills?"**

| Option | Skills Created |
|--------|----------------|
| **Yes** | figma-inspect, design-tokens, style-check |
| **No** | Skip |

### Skill: figma-inspect

Create `.claude/skills/figma-inspect/SKILL.md`:

```markdown
---
description: Inspect Figma designs for implementation reference
---

# Figma Inspect

Get design context from Figma for implementation.

## Usage

When implementing a UI component or screen, use this skill to:
1. Get the design context from Figma
2. Extract colors, typography, spacing
3. Understand component structure

## How to Use

Provide either:
- A Figma URL with node ID
- A description of what you're looking for

## Figma Configuration

- File Key: {from workflow.json}
- Main Pages: {from workflow.json}

## Actions

1. Use `mcp__figma__get_design_context` for implementation details
2. Use `mcp__figma__get_screenshot` for visual reference
3. Use `mcp__figma__get_variable_defs` for design tokens
```

## 9. Report Results

```markdown
## Design Setup Complete

**Figma**: {Configured | Not configured}
{If configured: File: {url}}

**Design System**: {system_name}
{If configured: Components: {components_dir}}

**Style Guide**: {Created | Linked | Not configured}
{If created: Path: {path}}

**Design Tokens**: {Extracted | Created | Not configured}

**Files Modified**:
- `.claude/workflow.json` - Added design configuration
- `standards.md` - Added design standards section
- {If created: `docs/STYLE_GUIDE.md` - Created style guide}
- {If skills: `.claude/skills/figma-inspect/SKILL.md` - Created}

**Next Steps**:
1. Review the generated style guide and fill in specific values
2. Run `/wf-generate` to create design-aware frontend agents
3. When implementing UI, reference Figma with: `mcp__figma__get_design_context`

**Tip**: Re-run `/wf-design-setup` anytime to update design configuration.
```

---

## Error Handling

### Figma Access Failed

```markdown
Error: Could not access Figma file

Possible causes:
1. Invalid Figma URL
2. Figma MCP not authenticated
3. No access to this file

**To authenticate Figma**:
Check your Figma MCP configuration in Claude settings.

**To continue without Figma**:
Re-run `/wf-design-setup` and select "No Figma yet"
```

### No Workflow Found

```markdown
Error: Workflow not initialized

Run `/wf-init` first to create the workflow structure.
```

---

## Related Commands

- `/wf-init` - Initialize project workflow
- `/wf-create-prd` - Create PRD with basic design questions
- `/wf-generate` - Generate agents (including design-aware frontend)
- `/wf-breakdown` - Break down tickets (fetches Figma context for UI tasks)
