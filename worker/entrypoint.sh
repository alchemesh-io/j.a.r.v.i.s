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

# Step 2: Configure JARVIS MCP server in Claude Code settings
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

# Step 5: Start all processes
echo "[worker] Starting worker UI on port 3000..."
serve -s ~/worker-ui -l 3000 &
UI_PID=$!

echo "[worker] Starting status server on port 8080..."
node ~/status-server/index.js &
STATUS_PID=$!

echo "[worker] Starting Claude Code session (ID: ${WORKER_ID})..."
claude --session-id "$WORKER_ID" --resume &
CLAUDE_PID=$!

# Export PIDs for status server
export CLAUDE_PID
echo "$CLAUDE_PID" > /tmp/claude.pid

echo "[worker] All processes started. Claude PID=$CLAUDE_PID, Status PID=$STATUS_PID, UI PID=$UI_PID"

# Wait for any process to exit
wait -n
echo "[worker] A process exited, shutting down..."
kill $STATUS_PID $CLAUDE_PID $UI_PID 2>/dev/null || true
wait
