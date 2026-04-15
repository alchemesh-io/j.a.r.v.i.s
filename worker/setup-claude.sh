#!/bin/bash
# setup-claude.sh — Configure Claude Code settings, hooks, and workspace trust
set -e

STATE_FILE="/tmp/claude-state"
SETTINGS_FILE="$HOME/.claude/settings.json"
CLAUDE_JSON="$HOME/.claude.json"
WORKSPACE="$HOME/jarvis"

# --- State hook scripts ---

echo "initialized" > "$STATE_FILE"

cat > "$HOME/worker-hook-working.sh" << 'HOOK'
#!/bin/bash
echo "working" > /tmp/claude-state
HOOK
chmod +x "$HOME/worker-hook-working.sh"

cat > "$HOME/worker-hook-idle.sh" << 'HOOK'
#!/bin/bash
echo "waiting_for_human" > /tmp/claude-state
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

if [ -n "$BACKEND_URL" ]; then
    MCP_CONFIG="{\"mcpServers\":{\"jarvis\":{\"command\":\"npx\",\"args\":[\"-y\",\"@modelcontextprotocol/server-fetch\"],\"env\":{\"BACKEND_URL\":\"$BACKEND_URL\"}}}}"
    jq --argjson mcp "$MCP_CONFIG" '. * $mcp' "$SETTINGS_FILE" > /tmp/settings.json && mv /tmp/settings.json "$SETTINGS_FILE"
fi

# --- Pre-trust workspace ---

if [ -f "$CLAUDE_JSON" ]; then
    jq --arg ws "$WORKSPACE" '.projects[$ws].hasTrustDialogAccepted = true' "$CLAUDE_JSON" > /tmp/claude.json && mv /tmp/claude.json "$CLAUDE_JSON"
else
    echo "{\"projects\":{\"$WORKSPACE\":{\"hasTrustDialogAccepted\":true}}}" > "$CLAUDE_JSON"
fi

echo "[setup-claude] Settings, hooks, and workspace trust configured"
