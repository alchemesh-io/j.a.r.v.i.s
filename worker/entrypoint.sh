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

# Step 2: Configure Claude Code (hooks, MCP, workspace trust)
~/setup-claude.sh

# Step 3: Clone repositories
if [ -n "$REPOSITORIES" ]; then
    echo "[worker] Cloning repositories..."
    IFS=',' read -ra REPOS <<< "$REPOSITORIES"
    for repo_spec in "${REPOS[@]}"; do
        git_url="${repo_spec%@*}"
        branch="${repo_spec#*@}"
        repo_name=$(basename "$git_url" .git)
        echo "[worker] Cloning $git_url (branch: $branch) into ~/jarvis/$repo_name"

        if [ -n "$GITHUB_TOKEN" ]; then
            auth_url=$(echo "$git_url" | sed "s|https://|https://x-access-token:${GITHUB_TOKEN}@|")
        else
            auth_url="$git_url"
        fi

        GIT_TERMINAL_PROMPT=0 git clone --branch "$branch" --single-branch "$auth_url" ~/jarvis/"$repo_name" 2>&1 || \
            echo "[worker] WARNING: Failed to clone $git_url"
    done
fi

# Step 4: Pull skills from JAAR (selective by name@version) into Claude Code skills dir
if [ -n "$SKILLS" ] && [ -n "$JAAR_URL" ] && command -v arctl &> /dev/null; then
    echo "[worker] Pulling skills from JAAR..."
    mkdir -p ~/.claude/skills
    IFS=',' read -ra SKILL_REFS <<< "$SKILLS"
    for skill_ref in "${SKILL_REFS[@]}"; do
        skill_name="${skill_ref%@*}"
        skill_version="${skill_ref#*@}"
        skill_dir="$HOME/.claude/skills/$skill_name"
        echo "[worker] Pulling skill $skill_name (version: $skill_version) to $skill_dir"
        arctl skill pull "$skill_name" "$skill_dir" --version "$skill_version" --registry-url "$JAAR_URL" 2>&1 || \
            echo "[worker] WARNING: Failed to pull skill $skill_name@$skill_version"
    done
elif [ -z "$SKILLS" ]; then
    echo "[worker] No skills configured (SKILLS env var empty), skipping skill pull"
fi

# Step 5: Start all processes
echo "[worker] Starting status server on port 8080..."
node ~/status-server/index.js &
STATUS_PID=$!

# Convert 32-char hex worker ID to UUID format (8-4-4-4-12)
SESSION_UUID="${WORKER_ID:0:8}-${WORKER_ID:8:4}-${WORKER_ID:12:4}-${WORKER_ID:16:4}-${WORKER_ID:20:12}"

# Start Claude Code in non-interactive streaming mode via a named pipe
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

echo "$CLAUDE_PID" > /tmp/claude.pid

echo "[worker] All processes started. Claude PID=$CLAUDE_PID, Status PID=$STATUS_PID"

# Keep the pod alive — wait for status server to exit
wait $STATUS_PID
echo "[worker] Status server exited, shutting down..."
kill $STATUS_PID $CLAUDE_PID 2>/dev/null || true
wait
