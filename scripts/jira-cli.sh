#!/usr/bin/env bash
# jira-cli.sh — Lightweight Jira REST API wrapper
#
# Configuration (checked in order):
#   1. Already-exported environment variables
#   2. Project-level .env file
#   3. Global ~/.config/wf-system/.env (set once, works across all projects)
#
# Required variables:
#   JIRA_BASE_URL  - e.g., https://mycompany.atlassian.net
#   JIRA_EMAIL     - Your Atlassian email
#   JIRA_API_TOKEN - API token from https://id.atlassian.com/manage-profile/security/api-tokens
#
# Quick setup (global, one-time):
#   mkdir -p ~/.config/wf-system
#   cat > ~/.config/wf-system/.env << 'EOF'
#   JIRA_BASE_URL=https://yourcompany.atlassian.net
#   JIRA_EMAIL=you@company.com
#   JIRA_API_TOKEN=your-token-here
#   EOF
#
# Usage:
#   ./scripts/jira-cli.sh get-ticket PROJ-123
#   ./scripts/jira-cli.sh add-comment PROJ-123 "Comment text"
#   ./scripts/jira-cli.sh search "project = PROJ AND status = 'In Progress'"
#   ./scripts/jira-cli.sh get-transitions PROJ-123
#   ./scripts/jira-cli.sh transition PROJ-123 "In Progress"
#   ./scripts/jira-cli.sh add-label PROJ-123 tech-lead
#   ./scripts/jira-cli.sh remove-label PROJ-123 tech-lead
#   ./scripts/jira-cli.sh create-subtask PROJ-123 "Sub-task title" "Description"
#   ./scripts/jira-cli.sh get-subtasks PROJ-123

set -euo pipefail

# --- Config ---

load_env() {
  # Skip loading if all vars are already exported
  if [[ -n "${JIRA_BASE_URL:-}" && -n "${JIRA_EMAIL:-}" && -n "${JIRA_API_TOKEN:-}" ]]; then
    return
  fi

  # Try loading from (in order): project .env, project root .env, global config
  for envfile in \
    .env \
    "$(git rev-parse --show-toplevel 2>/dev/null)/.env" \
    "$HOME/.config/wf-system/.env"; do
    if [[ -f "$envfile" ]]; then
      set -a
      source "$envfile"
      set +a
      # Stop if we got what we need
      if [[ -n "${JIRA_BASE_URL:-}" && -n "${JIRA_EMAIL:-}" && -n "${JIRA_API_TOKEN:-}" ]]; then
        return
      fi
    fi
  done

  if [[ -z "${JIRA_BASE_URL:-}" || -z "${JIRA_EMAIL:-}" || -z "${JIRA_API_TOKEN:-}" ]]; then
    echo "Error: Missing Jira configuration." >&2
    echo "" >&2
    echo "Quick setup (global, one-time):" >&2
    echo "" >&2
    echo "  mkdir -p ~/.config/wf-system" >&2
    echo "  cat > ~/.config/wf-system/.env << 'EOF'" >&2
    echo "  JIRA_BASE_URL=https://yourcompany.atlassian.net" >&2
    echo "  JIRA_EMAIL=you@company.com" >&2
    echo "  JIRA_API_TOKEN=your-token-here" >&2
    echo "  EOF" >&2
    echo "" >&2
    echo "Get your API token at: https://id.atlassian.com/manage-profile/security/api-tokens" >&2
    echo "" >&2
    echo "Or add to your project's .env file instead." >&2
    exit 1
  fi
}

api() {
  local method="$1"
  local endpoint="$2"
  shift 2

  local auth
  auth=$(printf '%s:%s' "$JIRA_EMAIL" "$JIRA_API_TOKEN" | base64)

  curl -s -X "$method" \
    "${JIRA_BASE_URL}/rest/api/3${endpoint}" \
    -H "Authorization: Basic ${auth}" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    "$@"
}

# --- Commands ---

cmd_get_ticket() {
  local key="$1"
  api GET "/issue/${key}?fields=summary,description,status,issuetype,priority,labels,assignee,reporter,subtasks,comment"
}

cmd_add_comment() {
  local key="$1"
  shift
  local body="$*"

  # Jira Cloud API v3 uses ADF (Atlassian Document Format)
  local payload
  payload=$(jq -n --arg text "$body" '{
    "body": {
      "version": 1,
      "type": "doc",
      "content": [
        {
          "type": "paragraph",
          "content": [
            {
              "type": "text",
              "text": $text
            }
          ]
        }
      ]
    }
  }')

  api POST "/issue/${key}/comment" -d "$payload"
}

cmd_add_comment_raw() {
  # Accepts raw ADF JSON body for rich formatting (tables, headings, etc.)
  local key="$1"
  local adf_body="$2"

  local payload
  payload=$(jq -n --argjson body "$adf_body" '{ "body": $body }')

  api POST "/issue/${key}/comment" -d "$payload"
}

cmd_search() {
  local jql="$1"
  local max_results="${2:-50}"

  api GET "/search?jql=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${jql}'))")&maxResults=${max_results}&fields=summary,status,issuetype,priority,labels,assignee"
}

cmd_get_transitions() {
  local key="$1"
  api GET "/issue/${key}/transitions"
}

cmd_transition() {
  local key="$1"
  local target_name="$2"

  # Get available transitions
  local transitions
  transitions=$(api GET "/issue/${key}/transitions")

  # Find matching transition ID (case-insensitive)
  local transition_id
  transition_id=$(echo "$transitions" | jq -r --arg name "$target_name" \
    '.transitions[] | select(.name | ascii_downcase == ($name | ascii_downcase)) | .id' | head -1)

  if [[ -z "$transition_id" ]]; then
    echo "Error: Transition '${target_name}' not found." >&2
    echo "Available transitions:" >&2
    echo "$transitions" | jq -r '.transitions[] | "  - \(.name) (id: \(.id))"' >&2
    exit 1
  fi

  api POST "/issue/${key}/transitions" -d "{\"transition\":{\"id\":\"${transition_id}\"}}"
}

cmd_add_label() {
  local key="$1"
  local label="$2"

  api PUT "/issue/${key}" -d "{\"update\":{\"labels\":[{\"add\":\"${label}\"}]}}"
}

cmd_remove_label() {
  local key="$1"
  local label="$2"

  api PUT "/issue/${key}" -d "{\"update\":{\"labels\":[{\"remove\":\"${label}\"}]}}"
}

cmd_create_subtask() {
  local parent_key="$1"
  local summary="$2"
  local description="${3:-}"

  # Extract project key from parent
  local project_key
  project_key=$(echo "$parent_key" | grep -oE '^[A-Z]+')

  local payload
  payload=$(jq -n \
    --arg project "$project_key" \
    --arg parent "$parent_key" \
    --arg summary "$summary" \
    --arg desc "$description" \
    '{
      "fields": {
        "project": { "key": $project },
        "parent": { "key": $parent },
        "summary": $summary,
        "issuetype": { "name": "Sub-task" },
        "description": {
          "version": 1,
          "type": "doc",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": $desc
                }
              ]
            }
          ]
        }
      }
    }')

  api POST "/issue" -d "$payload"
}

cmd_get_subtasks() {
  local parent_key="$1"
  cmd_search "parent = ${parent_key} ORDER BY created ASC"
}

# --- Main ---

main() {
  if [[ $# -lt 1 ]]; then
    echo "Usage: $0 <command> [args...]" >&2
    echo "" >&2
    echo "Commands:" >&2
    echo "  get-ticket <KEY>                      Get ticket details" >&2
    echo "  add-comment <KEY> <text>              Add plain text comment" >&2
    echo "  add-comment-raw <KEY> <adf-json>      Add rich ADF comment" >&2
    echo "  search <JQL> [max]                    Search with JQL" >&2
    echo "  get-transitions <KEY>                 List available transitions" >&2
    echo "  transition <KEY> <status>             Transition ticket" >&2
    echo "  add-label <KEY> <label>               Add label" >&2
    echo "  remove-label <KEY> <label>            Remove label" >&2
    echo "  create-subtask <PARENT> <title> [desc] Create sub-task" >&2
    echo "  get-subtasks <KEY>                    Get sub-tasks" >&2
    exit 1
  fi

  load_env

  local cmd="$1"
  shift

  case "$cmd" in
    get-ticket)       cmd_get_ticket "$@" ;;
    add-comment)      cmd_add_comment "$@" ;;
    add-comment-raw)  cmd_add_comment_raw "$@" ;;
    search)           cmd_search "$@" ;;
    get-transitions)  cmd_get_transitions "$@" ;;
    transition)       cmd_transition "$@" ;;
    add-label)        cmd_add_label "$@" ;;
    remove-label)     cmd_remove_label "$@" ;;
    create-subtask)   cmd_create_subtask "$@" ;;
    get-subtasks)     cmd_get_subtasks "$@" ;;
    *)
      echo "Error: Unknown command '${cmd}'" >&2
      echo "Run '$0' without arguments to see available commands." >&2
      exit 1
      ;;
  esac
}

main "$@"
