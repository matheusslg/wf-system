---
description: Create a PRD from scratch with guided questions
allowed-tools: Read, Write, Bash, AskUserQuestion
argument-hint: [project-name]
---

# Create PRD

Generate a Product Requirements Document (PRD) through an interactive Q&A flow. The output is structured for compatibility with `/wf-parse-prd`.

**Note**: Can be run before or after `/wf-init`. However, `/wf-parse-prd` requires `workflow.json` for GitHub integration, so run `/wf-init` before parsing the PRD.

## Arguments

- `$ARGUMENTS` - Project name. **MUST use this value if provided.**

## 0. Get Project Name

**CRITICAL**: If `$ARGUMENTS` is provided, use it as the project name. Do NOT ask the user again.

```
Project Name = $ARGUMENTS (if not empty)
             = Ask user (if $ARGUMENTS is empty)
             = Current directory name (as fallback default)
```

Store this project name for use in the PRD header and throughout the document.

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

### Light Guidance Questions (3-4)

Ask these in a single AskUserQuestion with text inputs:

1. **Problem & Solution**: "What problem are you solving, and what's your proposed solution?"
2. **Target Users**: "Who will use this product/feature?"
3. **MVP Scope**: "What are the must-have features for the first version?"
4. **Success Criteria** (optional): "How will you measure success?"

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

**Batch 3: Scope**
7. **Non-Goals**: "What's explicitly out of scope?"
8. **Technical Constraints**: "Any technical requirements or limitations?"
9. **Dependencies**: "External systems, APIs, or services needed?"

**Batch 4: Planning**
10. **Success Metrics**: "How will you measure success? (KPIs, goals)"
11. **Timeline/Phases**: "Rough phasing? (e.g., Phase 0 = MVP, Phase 1 = ...)"
12. **Risks**: "Known risks or potential blockers?"

**Batch 5: Final (optional)**
13. **Open Questions**: "Any unresolved decisions or questions?"

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

## Technical Considerations

{Only for Full PRD - constraints, dependencies, architecture notes}

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
2. Run /wf-parse-prd to create GitHub Issues from the roadmap
3. Run /wf-breakdown #N to break parent issues into sub-tasks

Workflow: /wf-create-prd → /wf-parse-prd → /wf-breakdown → /wf-delegate
```

---

## Error Handling

### No Project Name

If `$ARGUMENTS` is empty and user doesn't provide one:
- Use the current directory name as default
- Confirm with user before proceeding

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
User: /wf-create-prd my-awesome-app

Claude:
1. Project name = "my-awesome-app" (from argument)
2. Checks for existing PRD.md
3. Asks: PRD scope? → User selects "Minimal"
4. Asks: Guidance level? → User selects "Light"
5. Asks 3-4 questions about problem, users, MVP
6. Generates PRD.md with "# PRD: my-awesome-app"
7. Suggests next steps
```