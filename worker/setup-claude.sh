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

# --- Pre-trust workspace ---

if [ ! -f "$CLAUDE_JSON" ]; then
    echo '{}' > "$CLAUDE_JSON"
fi

jq --arg ws "$WORKSPACE" '.projects[$ws].hasTrustDialogAccepted = true' "$CLAUDE_JSON" \
    > /tmp/claude.json && mv /tmp/claude.json "$CLAUDE_JSON"

# --- Configure JARVIS MCP (HTTP) via the Claude Code CLI ---

if [ -n "$JARVIS_MCP_URL" ]; then
    claude mcp remove jarvis --scope user 2>/dev/null || true
    claude mcp add --transport http --scope user jarvis "$JARVIS_MCP_URL" 2>&1 && \
        echo "[setup-claude] JARVIS MCP configured at $JARVIS_MCP_URL"
fi

echo "[setup-claude] Settings, hooks, and workspace trust configured"
