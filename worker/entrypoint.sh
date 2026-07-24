#!/bin/bash
set -e

WORKER_MODE="${WORKER_MODE:-ephemeral}"
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
    "$HOME/jarvis" \
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

# Step 3: Clone repositories (with DNS retry — Istio sidecar may not be ready immediately)
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
        target_dir="$HOME/jarvis/$repo_name"

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

# Step 4: Fetch skills from GCS (selective by name@version) into Claude Code skills dir.
# Skills are plain files (SKILL.md + assets) — no OCI pull, no dockerd, no privileged pod.
SKILLS_CACHED=0
SKILLS_PULLED=0
if [ -n "$SKILLS" ]; then
    if [ -z "$SKILLS_BUCKET" ]; then
        echo "[worker] ERROR: SKILLS is set (${SKILLS}) but SKILLS_BUCKET is empty — cannot fetch skills"
    elif ! command -v gcloud &> /dev/null; then
        echo "[worker] ERROR: SKILLS is set but gcloud is not available in this image — cannot fetch skills"
    else
        IFS=',' read -ra SKILL_REFS <<< "$SKILLS"
        for skill_ref in "${SKILL_REFS[@]}"; do
            skill_name="${skill_ref%@*}"
            skill_version="${skill_ref#*@}"
            skill_dir="$HOME/.claude/skills/$skill_name"
            if [ -f "$skill_dir/SKILL.md" ]; then
                echo "[worker] Skill $skill_name already cached at $skill_dir, skipping"
                SKILLS_CACHED=$((SKILLS_CACHED + 1))
                continue
            fi
            echo "[worker] Fetching skill $skill_name (version: $skill_version) from gs://$SKILLS_BUCKET/$skill_name/$skill_version/ to $skill_dir"
            mkdir -p "$skill_dir"
            if gcloud storage cp -r "gs://$SKILLS_BUCKET/$skill_name/$skill_version/*" "$skill_dir" 2>&1; then
                SKILLS_PULLED=$((SKILLS_PULLED + 1))
            else
                echo "[worker] WARNING: Failed to fetch skill $skill_name@$skill_version from GCS"
            fi
        done
    fi
else
    echo "[worker] No skills configured (SKILLS env var empty), skipping skill fetch"
fi

# Stateful summary log so resume vs fresh-start is visible at a glance.
if [ "$WORKER_MODE" = "stateful" ]; then
    echo "[worker] mode=stateful, PVC mounted at /home/node, ${REPOS_CACHED} repos cached, ${SKILLS_CACHED} skills cached"
fi

# Step 5: Launch Claude Code interactively as the container's main process so the
# Kubernetes Attach API reaches its PTY. The status server runs in a dedicated
# sidecar container; the hooks report Claude's state through the shared
# /worker-state emptyDir (see setup-claude.sh / STATE_FILE).
export TERM="${TERM:-xterm-256color}"

# Resume probe: if a previous session exists under ~/.claude/projects/ (stateful
# restart), resume the most recent one; otherwise start fresh with the task
# prompt as the first turn.
LATEST_SESSION=$(ls -t "$HOME/.claude/projects"/*/*.jsonl 2>/dev/null | head -1)
if [ -n "$LATEST_SESSION" ]; then
    SESSION_ID=$(basename "$LATEST_SESSION" .jsonl)
    echo "[worker] Resuming Claude Code session ${SESSION_ID}..."
    exec claude --dangerously-skip-permissions --resume "$SESSION_ID"
elif [ -n "$TASK_PROMPT" ]; then
    echo "[worker] Starting Claude Code with task prompt..."
    exec claude --dangerously-skip-permissions "$TASK_PROMPT"
else
    echo "[worker] Starting Claude Code (no task prompt)..."
    exec claude --dangerously-skip-permissions
fi
