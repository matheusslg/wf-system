---
description: Create a PRD from scratch with guided questions
allowed-tools: Read, Write, Bash, AskUserQuestion
---

# Create PRD

Generate a Product Requirements Document (PRD) through an interactive Q&A flow. The output is structured for compatibility with `/wf-parse-prd`.

**Prerequisite**: Run `/wf-init` first to set up the project name and workflow structure.

## 0. Get Project Name from workflow.json

Read the project name from `.claude/workflow.json`:

```bash
cat .claude/workflow.json 2>/dev/null
```

**If workflow.json exists**: Extract the `project` field and use it as the project name.

**If workflow.json doesn't exist**:
- Display: "Workflow not initialized. Run `/wf-init` first to set up the project."
- Exit without creating PRD.

## 1. Check for Existing PRD

```bash
ls PRD.md 2>/dev/null && echo "EXISTS" || echo "NOT_FOUND"
```

**If PRD.md exists**, use AskUserQuestion:

| Option | Behavior |
|--------|----------|
| **Overwrite** | Replace existing PRD.md completely |
| **Append** | Add new sections to existing PRD (useful for expanding scope) |
| **Cancel** | Abort and keep existing PRD |

If user selects "Cancel", stop here and suggest reviewing the existing PRD with `/wf-parse-prd`.

## 2. Choose PRD Scope

Use AskUserQuestion to ask:

**"What type of PRD do you need?"**

| Option | Description |
|--------|-------------|
| **Full PRD** | Complete document with vision, personas, technical considerations, success metrics |
| **Minimal** | Lightweight version focused on features and roadmap (optimized for task extraction) |

Store the choice for later sections.

## 3. Choose Guidance Level

Use AskUserQuestion to ask:

**"How much guidance do you want?"**

| Option | Description |
|--------|-------------|
| **Heavy guidance** | 10-15 structured questions covering all aspects |
| **Light guidance** | 3-4 high-level questions, AI fills in reasonable defaults |

Store the choice for question flow.

## 4. Interactive Q&A

Based on choices from Steps 2 and 3, ask the appropriate questions.

**Remember**: Project name was already determined in Step 0. Use that value.

### Light Guidance Questions (5-6)

Ask these in a single AskUserQuestion with text inputs:

1. **Problem & Solution**: "What problem are you solving, and what's your proposed solution?"
2. **Target Users**: "Who will use this product/feature?"
3. **MVP Scope**: "What are the must-have features for the first version?"
4. **Tech Stack**: "What technologies will you use? (e.g., React, Node.js, PostgreSQL, AWS)"
5. **Design Resources**: "Do you have any design resources? (Figma links, design system like Shadcn/MUI/Tailwind, wireframes, or 'none')"
6. **Success Criteria** (optional): "How will you measure success?"

### Heavy Guidance Questions (10-15)

Ask in batches of 3-4 questions using AskUserQuestion:

**Batch 1: Core** (Project name already known from Step 0)
1. **Problem Statement**: "What problem does this solve? Who experiences this problem?"
2. **Target Users**: "Who are your primary users? Describe them briefly."
3. **User Personas**: "Describe 1-2 typical users (name, role, goals, pain points)"

**Batch 2: Solution**
4. **Proposed Solution**: "What's your high-level approach to solving this?"
5. **Key Features (MVP)**: "List the must-have features for the first version"
6. **Future Features**: "What features come after MVP? (Phase 1, Phase 2...)"

**Batch 3: Scope & Tech**
7. **Non-Goals**: "What's explicitly out of scope?"
8. **Tech Stack**: "What technologies will you use? (frontend, backend, database, infrastructure)"
9. **Dependencies**: "External systems, APIs, or services needed?"

**Batch 4: Design**
10. **Design Resources**: "Do you have Figma designs, wireframes, or mockups? (paste links or describe)"
11. **Design System**: "What UI component library or design system? (e.g., Shadcn, MUI, Tailwind, custom, none)"
12. **Brand/Style Guide**: "Any existing brand guidelines, color palette, or typography specs?"

**Batch 5: Planning**
13. **Success Metrics**: "How will you measure success? (KPIs, goals)"
14. **Timeline/Phases**: "Rough phasing? (e.g., Phase 0 = MVP, Phase 1 = ...)"
15. **Risks**: "Known risks or potential blockers?"

**Batch 6: Final (optional)**
16. **Open Questions**: "Any unresolved decisions or questions?"

## 5. Generate PRD

Using the collected answers and the project name from Step 0, generate `PRD.md` with the following structure:

```markdown
# PRD: {Project Name}

## Vision

{One paragraph summarizing the product vision based on problem + solution}

## Problem Statement

{Detailed problem description from user answers}

## Target Users

{User description from answers}

## Personas

{Only for Full PRD - persona descriptions}

### {Persona Name}
- **Role**: {role}
- **Goals**: {goals}
- **Pain Points**: {pain points}

## Goals

- {Goal 1 derived from success metrics}
- {Goal 2}

## Non-Goals

- {Explicit exclusion 1}
- {Explicit exclusion 2}

## Features

### MVP (Phase 0)
- {Feature 1}
- {Feature 2}
- {Feature 3}

### Phase 1
- {Feature 4}
- {Feature 5}

### Future
- {Feature N}

## Tech Stack

{Technologies chosen by the user - this section is used by /wf-generate}

### Frontend
- {e.g., React, Next.js, Vue}

### Backend
- {e.g., Node.js, NestJS, FastAPI, Django}

### Database
- {e.g., PostgreSQL, MongoDB, MySQL}

### Infrastructure
- {e.g., AWS, Docker, Kubernetes}

### Other
- {Additional tools, services, APIs}

## Design

{Design resources and guidelines - this section is used by /wf-design-setup}

### Design Resources
- {Figma links, wireframes, mockups, or "None"}

### Design System
- {Component library: Shadcn, MUI, Tailwind, custom, or "None"}

### Brand/Style Guide
- {Color palette, typography, spacing guidelines, or "To be defined"}

## Success Metrics

- {Metric 1}
- {Metric 2}

## Roadmap

### Phase 0: MVP
- [ ] {Task 1 derived from MVP features}
- [ ] {Task 2}
- [ ] {Task 3}

### Phase 1: {Phase Name}
- [ ] {Task 4}
- [ ] {Task 5}

### Phase 2: {Phase Name}
- [ ] {Task N}

## Risks

{Only for Full PRD}

- {Risk 1}
- {Risk 2}

## Open Questions

- {Question 1}
- {Question 2}

---
*Generated with /wf-create-prd*
```

Use the Write tool to create `PRD.md` in the project root.

## 6. Validate Output

After writing, read back the file to confirm:

```bash
head -50 PRD.md
```

Verify:
- All sections are present (based on scope choice)
- Roadmap has proper `### Phase N` structure for `/wf-parse-prd` parsing
- No placeholder text remains

## 7. Suggest Next Steps

After successful PRD creation, display:

```
PRD.md created successfully!

Next steps:
1. Review and refine the PRD manually if needed
2. (Optional) Run /wf-design-setup to configure detailed design resources (Figma, tokens, etc.)
3. Run /wf-parse-prd to create GitHub Issues from the roadmap
4. Run /wf-generate to create agents and skills based on your tech stack
5. Run /wf-start-session to begin development

Workflow: /wf-create-prd → /wf-design-setup (optional) → /wf-parse-prd → /wf-generate → /wf-start-session
```

---

## Error Handling

### No workflow.json

If `.claude/workflow.json` doesn't exist:
- Display: "Workflow not initialized. Run `/wf-init` first."
- Exit without creating PRD

### User Provides Incomplete Answers

If critical questions are skipped:
- For MVP features: Cannot proceed, ask again
- For optional fields (risks, open questions): Use "None identified" or skip section

### PRD.md Write Fails

If Write tool fails:
- Check permissions
- Try alternative path (e.g., `./docs/PRD.md`)
- Report error and suggest manual creation

---

## Example Flow

```
User: /wf-create-prd

Claude:
1. Reads .claude/workflow.json → project = "my-awesome-app"
2. Checks for existing PRD.md
3. Asks: PRD scope? → User selects "Minimal"
4. Asks: Guidance level? → User selects "Light"
5. Asks 4-5 questions about problem, users, MVP, tech stack
6. Generates PRD.md with "# PRD: my-awesome-app" (includes Tech Stack section)
7. Suggests next steps → /wf-parse-prd then /wf-generate
```

Tech Stack in PRD enables `/wf-generate` to create appropriate agents and skills.