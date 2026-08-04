#!/bin/bash
set -e

WORKER_MODE="${WORKER_MODE:-ephemeral}"
WORKSPACE_DIR="$HOME/jarvis/$TASK_ID"
echo "[worker] Starting worker ${WORKER_ID} for task ${TASK_ID} (mode=${WORKER_MODE})"

# Step 0: Fix PVC ownership and ensure the home directory layout exists.
# When the worker is stateful, the PVC mount overlays /home/node — and on most storage
# classes (including minikube's hostPath) the volume root is owned root:root regardless
# of fsGroup, so the node user (uid 1000) can't write to it. We chown the mount once at
# startup, then mkdir -p the layout the entrypoint expects.
if [ "$WORKER_MODE" = "stateful" ] && [ "$(stat -c %u "$HOME" 2>/dev/null || echo 0)" != "1000" ]; then
    echo "[worker] Fixing /home/node ownership (PVC mount root owned by uid $(stat -c %u "$HOME"))"
    sudo chown -R node:node "$HOME"
fi

mkdir -p \
    "$WORKSPACE_DIR" \
    "$HOME/.claude" \
    "$HOME/.claude/skills" \
    "$HOME/.claude/projects"

# Step 1: Copy Claude config from init volume. Always re-applied so cluster ConfigMap updates
# take effect on resume. We never touch ~/.claude/projects/ or ~/.claude/skills/.
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

# Step 2: Configure Claude Code (hooks, MCP, workspace trust). Idempotent — merges into existing
# settings.json when present, never touches ~/.claude/projects/.
/opt/jarvis-worker/setup-claude.sh

# Step 3: Write Terraform Enterprise credentials when TFE_TOKEN is present. Re-applied on
# every start (fresh or resumed), same as the ConfigMap-sourced Claude config above —
# mirrors how GOOGLE_WORKSPACE_CLI_CREDENTIALS is written to /etc/gws/credentials.json.
# The Terraform CLI credentials file is keyed by host, not org.
if [ -n "$TFE_TOKEN" ]; then
    echo "[worker] Writing Terraform Enterprise credentials for tfe.doctolib.net..."
    mkdir -p ~/.terraform.d
    cat > ~/.terraform.d/credentials.tfrc.json <<EOF
{
  "credentials": {
    "tfe.doctolib.net": {
      "token": "$TFE_TOKEN"
    }
  }
}
EOF
fi

# Step 4: Clone repositories (with DNS retry — Istio sidecar may not be ready immediately)
REPOS_CACHED=0
REPOS_CLONED=0
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

    echo "[worker] Resolving repositories..."
    IFS=',' read -ra REPOS <<< "$REPOSITORIES"
    for repo_spec in "${REPOS[@]}"; do
        git_url="${repo_spec%@*}"
        branch="${repo_spec#*@}"
        repo_name=$(basename "$git_url" .git)
        target_dir="$WORKSPACE_DIR/$repo_name"

        if [ -d "$target_dir/.git" ]; then
            echo "[worker] Repo $repo_name already cloned at $target_dir, skipping"
            REPOS_CACHED=$((REPOS_CACHED + 1))
            continue
        fi

        echo "[worker] Cloning $git_url (branch: $branch) into $target_dir"

        if [ -n "$GITHUB_TOKEN" ]; then
            auth_url=$(echo "$git_url" | sed "s|https://|https://x-access-token:${GITHUB_TOKEN}@|")
        else
            auth_url="$git_url"
        fi

        # Retry up to 3 times with backoff — DNS / Istio / transient failures
        for attempt in 1 2 3; do
            if GIT_TERMINAL_PROMPT=0 git clone --branch "$branch" --single-branch "$auth_url" "$target_dir" 2>&1; then
                REPOS_CLONED=$((REPOS_CLONED + 1))
                break
            fi
            rm -rf "$target_dir" 2>/dev/null || true
            if [ "$attempt" -lt 3 ]; then
                echo "[worker] Clone attempt $attempt failed, retrying in $((attempt * 2))s..."
                sleep $((attempt * 2))
            else
                echo "[worker] WARNING: Failed to clone $git_url after 3 attempts"
            fi
        done
    done
fi

# Step 5: Pull skills from JAAR (selective by name@version) into Claude Code skills dir.
# Rootless dockerd — uses slirp4netns for network isolation so the pod's DNS/iptables
# stay clean. No sudo, no privileged: true on the pod.
SKILLS_CACHED=0
SKILLS_PULLED=0
if [ -n "$SKILLS" ] && [ -n "$JAAR_URL" ] && command -v arctl &> /dev/null; then
    # Determine which skills are missing — avoids starting dockerd unnecessarily on resume.
    PENDING_SKILLS=()
    IFS=',' read -ra SKILL_REFS <<< "$SKILLS"
    for skill_ref in "${SKILL_REFS[@]}"; do
        skill_name="${skill_ref%@*}"
        skill_dir="$HOME/.claude/skills/$skill_name"
        if [ -f "$skill_dir/SKILL.md" ]; then
            echo "[worker] Skill $skill_name already cached at $skill_dir, skipping"
            SKILLS_CACHED=$((SKILLS_CACHED + 1))
        else
            PENDING_SKILLS+=("$skill_ref")
        fi
    done

    if [ ${#PENDING_SKILLS[@]} -gt 0 ]; then
        echo "[worker] Starting dockerd for skill pulls..."
        sudo sh -c 'dockerd > /var/log/dockerd.log 2>&1 &'
        sleep 1

        # Wait for dockerd socket to be ready (up to 15s)
        for i in $(seq 1 15); do
            if sudo docker info >/dev/null 2>&1; then
                echo "[worker] dockerd ready"
                break
            fi
            sleep 1
        done

        # Authenticate with GHCR so arctl can pull private skill images.
        if [ -n "$GITHUB_TOKEN" ]; then
            GHCR_USER="${GHCR_USERNAME:-USERNAME}"
            echo "[worker] Logging into ghcr.io as ${GHCR_USER}..."
            echo "$GITHUB_TOKEN" | sudo docker login ghcr.io -u "${GHCR_USER}" --password-stdin 2>&1 || \
                echo "[worker] WARNING: docker login failed — ensure GITHUB_TOKEN has read:packages scope"
        fi

        echo "[worker] Pulling ${#PENDING_SKILLS[@]} skills from JAAR..."
        for skill_ref in "${PENDING_SKILLS[@]}"; do
            skill_name="${skill_ref%@*}"
            skill_version="${skill_ref#*@}"
            skill_dir="$HOME/.claude/skills/$skill_name"
            echo "[worker] Pulling skill $skill_name (version: $skill_version) to $skill_dir"
            if sudo arctl skill pull "$skill_name" "$skill_dir" --version "$skill_version" --registry-url "$JAAR_URL" 2>&1; then
                SKILLS_PULLED=$((SKILLS_PULLED + 1))
            else
                echo "[worker] WARNING: Failed to pull skill $skill_name@$skill_version"
            fi
            sudo chown -R node:node "$skill_dir" 2>/dev/null || true
        done

        # Stop dockerd — no longer needed after skills are pulled
        sudo pkill -x dockerd 2>/dev/null || true
    else
        echo "[worker] All skills already cached, no skill pull required"
    fi
elif [ -z "$SKILLS" ]; then
    echo "[worker] No skills configured (SKILLS env var empty), skipping skill pull"
fi

# Stateful summary log so resume vs fresh-start is visible at a glance.
if [ "$WORKER_MODE" = "stateful" ]; then
    echo "[worker] mode=stateful, PVC mounted at /home/node, ${REPOS_CACHED} repos cached, ${SKILLS_CACHED} skills cached"
fi

# Step 6: Launch Claude Code interactively as the container's main process so the
# Kubernetes Attach API reaches its PTY. The status server runs in a dedicated
# sidecar container; the hooks report Claude's state through the shared
# /worker-state emptyDir (see setup-claude.sh / STATE_FILE).
export TERM="${TERM:-xterm-256color}"

# Resume probe: Claude Code keys sessions by an encoded form of the project's
# absolute path (every / and . becomes -), under ~/.claude/projects/<encoded>/*.jsonl.
# We check specifically for a session scoped to THIS task's workspace, not
# "any session exists anywhere" — a worker upgrading from the old shared-$HOME
# layout (pre this per-task-workspace change) has an old session keyed to the
# old cwd, which a global check would wrongly match, picking --continue over
# TASK_PROMPT while --continue (cwd-scoped) finds nothing and silently starts
# an empty session that never receives the task prompt.
WORKSPACE_PROJECT_KEY=$(echo "$WORKSPACE_DIR" | sed 's/[\/.]/-/g')
LATEST_SESSION=$(ls -t "$HOME/.claude/projects/$WORKSPACE_PROJECT_KEY"/*.jsonl 2>/dev/null | head -1)
cd "$WORKSPACE_DIR"
if [ -n "$LATEST_SESSION" ]; then
    echo "[worker] Resuming Claude Code session in ${WORKSPACE_DIR}..."
    exec claude --dangerously-skip-permissions --continue
elif [ -n "$TASK_PROMPT" ]; then
    echo "[worker] Starting Claude Code in ${WORKSPACE_DIR} with task prompt..."
    exec claude --dangerously-skip-permissions "$TASK_PROMPT"
else
    echo "[worker] Starting Claude Code in ${WORKSPACE_DIR} (no task prompt)..."
    exec claude --dangerously-skip-permissions
fi
