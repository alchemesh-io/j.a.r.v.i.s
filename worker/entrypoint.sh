#!/bin/bash
set -e

echo "[worker] Starting worker ${WORKER_ID} for task ${TASK_ID}"

# Step 1: Copy Claude config from init volume
CONFIG_SRC="/init-claude-config"
if [ -d "$CONFIG_SRC" ]; then
    echo "[worker] Copying Claude config files..."
    [ -f "$CONFIG_SRC/policy-limits.json" ] && cp "$CONFIG_SRC/policy-limits.json" ~/.claude/policy-limits.json
    [ -f "$CONFIG_SRC/remote-settings.json" ] && cp "$CONFIG_SRC/remote-settings.json" ~/.claude/remote-settings.json
    [ -f "$CONFIG_SRC/settings.json" ] && cp "$CONFIG_SRC/settings.json" ~/.claude/settings.json
    [ -f "$CONFIG_SRC/claude.json" ] && cp "$CONFIG_SRC/claude.json" ~/.claude.json
else
    echo "[worker] No Claude config volume found, skipping config copy"
fi

# Step 2: Pre-trust the workspace so Claude Code skips the trust dialog
WORKSPACE="$HOME/jarvis"
CLAUDE_JSON="$HOME/.claude.json"
if [ -f "$CLAUDE_JSON" ]; then
    jq --arg ws "$WORKSPACE" '.projects[$ws].hasTrustDialogAccepted = true' "$CLAUDE_JSON" > /tmp/claude.json && mv /tmp/claude.json "$CLAUDE_JSON"
else
    echo "{\"projects\":{\"$WORKSPACE\":{\"hasTrustDialogAccepted\":true}}}" > "$CLAUDE_JSON"
fi
echo "[worker] Workspace $WORKSPACE pre-trusted"

# Step 3: Configure JARVIS MCP server in Claude Code settings
if [ -n "$BACKEND_URL" ]; then
    echo "[worker] Configuring JARVIS MCP server..."
    MCP_CONFIG="{\"mcpServers\":{\"jarvis\":{\"command\":\"npx\",\"args\":[\"-y\",\"@modelcontextprotocol/server-fetch\"],\"env\":{\"BACKEND_URL\":\"$BACKEND_URL\"}}}}"
    if [ -f ~/.claude/settings.json ]; then
        jq --argjson mcp "$MCP_CONFIG" '. * $mcp' ~/.claude/settings.json > /tmp/settings.json && mv /tmp/settings.json ~/.claude/settings.json
    else
        echo "$MCP_CONFIG" > ~/.claude/settings.json
    fi
fi

# Step 3: Clone repositories
if [ -n "$REPOSITORIES" ]; then
    echo "[worker] Cloning repositories..."
    IFS=',' read -ra REPOS <<< "$REPOSITORIES"
    for repo_spec in "${REPOS[@]}"; do
        git_url="${repo_spec%@*}"
        branch="${repo_spec#*@}"
        repo_name=$(basename "$git_url" .git)
        echo "[worker] Cloning $git_url (branch: $branch) into ~/jarvis/$repo_name"

        # Use GITHUB_TOKEN for auth if available
        if [ -n "$GITHUB_TOKEN" ]; then
            auth_url=$(echo "$git_url" | sed "s|https://|https://${GITHUB_TOKEN}@|")
        else
            auth_url="$git_url"
        fi

        git clone --branch "$branch" --single-branch "$auth_url" ~/jarvis/"$repo_name" 2>&1 || \
            echo "[worker] WARNING: Failed to clone $git_url"
    done
fi

# Step 4: Pull skills from JAAR
if [ -n "$JAAR_URL" ] && command -v arctl &> /dev/null; then
    echo "[worker] Pulling skills from JAAR..."
    arctl skill pull --all --registry "$JAAR_URL" 2>&1 || \
        echo "[worker] WARNING: Failed to pull skills from JAAR"
fi

# Step 5: Start SSH server for VSCode Remote-SSH
echo "[worker] Starting SSH server on port 2222..."
# Generate host key if not present
if [ ! -f ~/.ssh/ssh_host_ed25519_key ]; then
    ssh-keygen -t ed25519 -f ~/.ssh/ssh_host_ed25519_key -N "" -q
fi
# Inject authorized keys from ConfigMap if available
if [ -f /init-claude-config/authorized_keys ]; then
    cp /init-claude-config/authorized_keys ~/.ssh/authorized_keys
    chmod 600 ~/.ssh/authorized_keys
fi
/usr/sbin/sshd -f /etc/ssh/sshd_config -D -e &
SSHD_PID=$!

# Step 6: Start all processes
echo "[worker] Starting worker UI on port 3000..."
serve -s ~/worker-ui -l 3000 &
UI_PID=$!

echo "[worker] Starting status server on port 8080..."
node ~/status-server/index.js &
STATUS_PID=$!

# Convert 32-char hex worker ID to UUID format (8-4-4-4-12)
SESSION_UUID="${WORKER_ID:0:8}-${WORKER_ID:8:4}-${WORKER_ID:12:4}-${WORKER_ID:16:4}-${WORKER_ID:20:12}"

# Start Claude Code in non-interactive streaming mode via a named pipe.
# The chat UI (or any client) can write JSON messages to the pipe to drive the session.
CLAUDE_FIFO="/tmp/claude-input"
mkfifo "$CLAUDE_FIFO"
echo "[worker] Starting Claude Code session (UUID: ${SESSION_UUID}) in stream mode..."
cat "$CLAUDE_FIFO" | claude --resume "$SESSION_UUID" \
    --dangerously-skip-permissions \
    --print \
    --input-format stream-json \
    --output-format stream-json \
    > /tmp/claude-output.log 2>&1 &
CLAUDE_PID=$!

# Write PID for status server
echo "$CLAUDE_PID" > /tmp/claude.pid

echo "[worker] All processes started. SSHD PID=$SSHD_PID, Claude PID=$CLAUDE_PID, Status PID=$STATUS_PID, UI PID=$UI_PID"

# Keep the pod alive — wait for UI or status server to exit
wait $UI_PID $STATUS_PID
echo "[worker] A process exited, shutting down..."
kill $SSHD_PID $STATUS_PID $CLAUDE_PID $UI_PID 2>/dev/null || true
wait
