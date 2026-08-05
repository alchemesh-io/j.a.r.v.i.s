#!/bin/bash
# setup-claude.sh — Configure Claude Code settings, hooks, and workspace trust
set -e

# State file shared with the status sidecar via the /worker-state emptyDir.
STATE_FILE="${STATE_FILE:-/worker-state/claude-state}"
SETTINGS_FILE="$HOME/.claude/settings.json"
CLAUDE_JSON="$HOME/.claude.json"
WORKSPACE="$HOME/jarvis/task-$TASK_ID"

# --- State hook scripts ---

mkdir -p "$(dirname "$STATE_FILE")" 2>/dev/null || true
echo "initialized" > "$STATE_FILE"

# Unquoted heredocs: $STATE_FILE is resolved now, when the hook is generated.
cat > "$HOME/worker-hook-working.sh" << HOOK
#!/bin/bash
echo "working" > "$STATE_FILE"
HOOK
chmod +x "$HOME/worker-hook-working.sh"

cat > "$HOME/worker-hook-idle.sh" << HOOK
#!/bin/bash
echo "waiting_for_human" > "$STATE_FILE"
HOOK
chmod +x "$HOME/worker-hook-idle.sh"

# --- Build settings.json (hooks + MCP) ---

SETTINGS=$(cat << JSONEOF
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "",
        "hooks": [{ "type": "command", "command": "$HOME/worker-hook-working.sh" }]
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "hooks": [{ "type": "command", "command": "$HOME/worker-hook-idle.sh" }]
      }
    ],
    "Notification": [
      {
        "matcher": "",
        "hooks": [{ "type": "command", "command": "$HOME/worker-hook-idle.sh" }]
      }
    ]
  }
}
JSONEOF
)

if [ -f "$SETTINGS_FILE" ]; then
    jq --argjson patch "$SETTINGS" '. * $patch' "$SETTINGS_FILE" > /tmp/settings.json && mv /tmp/settings.json "$SETTINGS_FILE"
else
    echo "$SETTINGS" > "$SETTINGS_FILE"
fi

# --- Pre-trust workspace, pre-seed onboarding (skips the first-run theme wizard
# and the Bypass Permissions mode confirmation — both otherwise block the
# interactive PTY on a keypress) ---

if [ ! -f "$CLAUDE_JSON" ]; then
    echo '{}' > "$CLAUDE_JSON"
fi

jq --arg ws "$WORKSPACE" \
    '.projects[$ws].hasTrustDialogAccepted = true
     | .theme = "dark"
     | .hasCompletedOnboarding = true
     | .bypassPermissionsModeAccepted = true' \
    "$CLAUDE_JSON" > /tmp/claude.json && mv /tmp/claude.json "$CLAUDE_JSON"

# --- Configure JARVIS MCP (HTTP) via the Claude Code CLI ---

if [ -n "$JARVIS_MCP_URL" ]; then
    claude mcp remove jarvis --scope user 2>/dev/null || true
    claude mcp add --transport http --scope user jarvis "$JARVIS_MCP_URL" 2>&1 && \
        echo "[setup-claude] JARVIS MCP configured at $JARVIS_MCP_URL"
fi

echo "[setup-claude] Settings, hooks, and workspace trust configured"
