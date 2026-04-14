#!/usr/bin/env bash
# Lockstep version bumper for wf-system.
# Usage: bump-version.sh <new-version>   (e.g., bump-version.sh 2.0.0)

set -eu

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <new-version>" >&2
  exit 2
fi

NEW="$1"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# 1. VERSION file
echo "$NEW" > "$REPO_ROOT/VERSION"

# 2. plugin.json
PLUGIN_JSON="$REPO_ROOT/plugins/wf-core/.claude-plugin/plugin.json"
python3 - "$PLUGIN_JSON" "$NEW" <<'PY'
import json, sys
path, new = sys.argv[1], sys.argv[2]
with open(path) as f:
    data = json.load(f)
data["version"] = new
with open(path, "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
PY

# 3. marketplace.json
MKT_JSON="$REPO_ROOT/.claude-plugin/marketplace.json"
python3 - "$MKT_JSON" "$NEW" <<'PY'
import json, sys
path, new = sys.argv[1], sys.argv[2]
with open(path) as f:
    data = json.load(f)
data["metadata"]["version"] = new
with open(path, "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
PY

echo "Version bumped to $NEW in:"
echo "  - VERSION"
echo "  - $PLUGIN_JSON"
echo "  - $MKT_JSON"
