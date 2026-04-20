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

# Step 3: Clone repositories (with DNS retry — Istio sidecar may not be ready immediately)
if [ -n "$REPOSITORIES" ]; then
    # Wait for DNS to resolve github.com — Istio proxy can take a few seconds to become ready
    echo "[worker] Waiting for DNS to resolve github.com..."
    for i in $(seq 1 30); do
        if getent hosts github.com >/dev/null 2>&1; then
            echo "[worker] DNS ready"
            break
        fi
        sleep 1
    done

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

        # Retry up to 3 times with backoff — DNS / Istio / transient failures
        for attempt in 1 2 3; do
            if GIT_TERMINAL_PROMPT=0 git clone --branch "$branch" --single-branch "$auth_url" ~/jarvis/"$repo_name" 2>&1; then
                break
            fi
            rm -rf ~/jarvis/"$repo_name" 2>/dev/null || true
            if [ "$attempt" -lt 3 ]; then
                echo "[worker] Clone attempt $attempt failed, retrying in $((attempt * 2))s..."
                sleep $((attempt * 2))
            else
                echo "[worker] WARNING: Failed to clone $git_url after 3 attempts"
            fi
        done
    done
fi

# Step 4: Pull skills from JAAR (selective by name@version) into Claude Code skills dir.
# Rootless dockerd — uses slirp4netns for network isolation so the pod's DNS/iptables
# stay clean. No sudo, no privileged: true on the pod.
if [ -n "$SKILLS" ] && [ -n "$JAAR_URL" ] && command -v arctl &> /dev/null; then
    echo "[worker] Starting rootless dockerd for skill pulls..."
    mkdir -p "$XDG_RUNTIME_DIR"
    # On Alpine the script is shipped as `dockerd-rootless` (no .sh suffix);
    # on other distros it's `dockerd-rootless.sh`.
    if command -v dockerd-rootless >/dev/null 2>&1; then
        dockerd-rootless > /tmp/dockerd.log 2>&1 &
    else
        dockerd-rootless.sh > /tmp/dockerd.log 2>&1 &
    fi
    DOCKERD_PID=$!

    # Wait for rootless docker socket to be ready (up to 30s)
    DOCKERD_READY=0
    for i in $(seq 1 30); do
        if docker info >/dev/null 2>&1; then
            echo "[worker] rootless dockerd ready"
            DOCKERD_READY=1
            break
        fi
        # Bail early if dockerd crashed so we can show the log
        if ! kill -0 "$DOCKERD_PID" 2>/dev/null; then
            echo "[worker] rootless dockerd crashed — dumping log:"
            cat /tmp/dockerd.log 2>&1 || true
            break
        fi
        sleep 1
    done

    if [ "$DOCKERD_READY" != "1" ]; then
        echo "[worker] WARNING: rootless dockerd did not become ready — dumping last 40 lines of log:"
        tail -40 /tmp/dockerd.log 2>&1 || true
        echo "[worker] Skipping skill pull"
    else
        # Authenticate with GHCR so arctl can pull private skill images.
        # Username for GHCR with a PAT can be any non-empty string; the token does the work
        # as long as it has the `read:packages` scope.
        if [ -n "$GITHUB_TOKEN" ]; then
            GHCR_USER="${GHCR_USERNAME:-USERNAME}"
            echo "[worker] Logging into ghcr.io as ${GHCR_USER}..."
            echo "$GITHUB_TOKEN" | docker login ghcr.io -u "${GHCR_USER}" --password-stdin 2>&1 || \
                echo "[worker] WARNING: docker login failed — ensure GITHUB_TOKEN has read:packages scope"
        fi

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
    fi

    # Stop rootless dockerd — no longer needed after skills are pulled
    pkill -x dockerd 2>/dev/null || true
    pkill -x rootlesskit 2>/dev/null || true
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
