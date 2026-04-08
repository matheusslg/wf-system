---
description: Check for and apply wf-system updates
allowed-tools: Bash, Read, Write, AskUserQuestion
---

# WF-System Update

Check for available updates and optionally apply them.

## 1. Check Installed Version

Read the installed version from the metadata file:

```bash
cat ~/.claude/hooks/.wf-version 2>/dev/null || echo "unknown"
```

Store this as `INSTALLED_VERSION`.

## 2. Check Install Mode

Determine how wf-system was installed:

```bash
cat ~/.claude/hooks/.wf-install-mode 2>/dev/null || echo "unknown"
```

Store this as `INSTALL_MODE` (should be "symlink" or "copy").

## 3. Get Source Path

Find where wf-system repo is located:

```bash
cat ~/.claude/hooks/.wf-source 2>/dev/null || echo ""
```

Store this as `SOURCE_PATH`.

## 4. Check Remote Version

Fetch the latest version from GitHub:

```bash
curl -s --connect-timeout 5 https://raw.githubusercontent.com/matheusslg/wf-system/main/VERSION 2>/dev/null || echo "fetch_failed"
```

Store this as `REMOTE_VERSION`.

## 5. Display Status

Show the current state:

```markdown
## WF-System Status

**Installed Version**: {INSTALLED_VERSION}
**Latest Version**: {REMOTE_VERSION}
**Install Mode**: {INSTALL_MODE}
**Source Path**: {SOURCE_PATH}
```

## 6. Compare Versions

If `REMOTE_VERSION` is newer than `INSTALLED_VERSION`:

- Fetch and display the changelog excerpt for the new version
- Ask user if they want to update

```bash
# Fetch changelog
curl -s --connect-timeout 5 https://raw.githubusercontent.com/matheusslg/wf-system/main/CHANGELOG.md 2>/dev/null | head -50
```

Use AskUserQuestion:
```
header: "Update"
question: "Update available ({INSTALLED_VERSION} -> {REMOTE_VERSION}). Would you like to update now?"
options:
  - label: "Yes, update now"
    description: "Pull latest changes and reinstall if needed"
  - label: "No, skip for now"
    description: "Continue without updating"
```

## 7. Apply Update

If user confirms update:

### For Symlink Install:
```bash
cd {SOURCE_PATH} && git pull origin main
```

Then read the new version and update the metadata:
```bash
cat {SOURCE_PATH}/VERSION > ~/.claude/hooks/.wf-version
```

### For Copy Install:
```bash
cd {SOURCE_PATH} && git pull origin main && ./install.sh
```

Note: The install script will prompt for installation preferences.

## 8. Sync Scripts to Current Project

After updating wf-system, check if the current project uses Jira and needs scripts synced:

```bash
# Check if this project uses Jira
PLATFORM=$(cat .claude/workflow.json 2>/dev/null | jq -r '.ticketing.platform // "github"')
```

If platform is `"jira"`:

```bash
# Sync jira-cli.sh from wf-system to project
if [[ -f "{SOURCE_PATH}/scripts/jira-cli.sh" ]]; then
  mkdir -p scripts
  cp "{SOURCE_PATH}/scripts/jira-cli.sh" scripts/jira-cli.sh
  chmod +x scripts/jira-cli.sh
  echo "Synced scripts/jira-cli.sh to project"
fi
```

If jira-cli.sh was synced, check if credentials are configured:

```bash
if ! grep -q JIRA_BASE_URL .env 2>/dev/null; then
  echo ""
  echo "Note: Jira credentials not found. Add these to your project's .env:"
  echo ""
  echo "  JIRA_BASE_URL=https://yourcompany.atlassian.net"
  echo "  JIRA_EMAIL=you@company.com"
  echo "  JIRA_API_TOKEN=your-token-here"
  echo ""
  echo "Get your token at: https://id.atlassian.com/manage-profile/security/api-tokens"
fi
```

## 9. Clear Update Flag

After successful update, remove the update-available flag:

```bash
rm -f ~/.claude/hooks/.wf-update-available
```

## 10. Report Result

```markdown
## Update Complete

**Previous Version**: {INSTALLED_VERSION}
**New Version**: {NEW_VERSION}

Changes applied successfully. Please restart Claude Code for any hook changes to take effect.
```

---

## If No Update Available

Simply report:

```markdown
## WF-System Up to Date

**Version**: {INSTALLED_VERSION}
**Install Mode**: {INSTALL_MODE}

You're running the latest version of wf-system.
```
