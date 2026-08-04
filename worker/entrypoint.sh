#!/bin/bash
set -e

WORKER_MODE="${WORKER_MODE:-ephemeral}"
WORKSPACE_DIR="$HOME/jarvis/task-$TASK_ID"
echo "[worker] Starting worker ${WORKER_ID} for task ${TASK_ID} (mode=${WORKER_MODE})"

# Pin agentregistry.googleapis.com to Google's restricted VIP. A pod-level
# hostAliases equivalent is hard-denied by this cluster's deny-host-aliases
# ValidatingAdmissionPolicy, so this has to happen inside the container instead
# — /etc/hosts is a per-pod file the kubelet mounts writable regardless of any
# container-level readOnlyRootFilesystem setting.
if ! grep -q "agentregistry.googleapis.com" /etc/hosts 2>/dev/null; then
    echo "199.36.153.8 agentregistry.googleapis.com" | sudo tee -a /etc/hosts >/dev/null
fi

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

# Step 5: Fetch skills from the GCP Agent Registry (selective by name@version) into the
# Claude Code skills dir, entirely through the `gcloud alpha agent-registry skills`
# command group (list/describe/revisions describe/revisions download) — gcloud
# already carries the pod's Workload Identity credentials, no hand-rolled REST/curl
# needed. Skill-enabled pods run fully unprivileged — no dockerd, no sudo needed for
# this step.
SKILLS_CACHED=0
SKILLS_PULLED=0

fetch_skill() {
    local skill_name="$1" skill_version="$2" skill_dir="$3"

    # The registry may assign a different resource id than the requested displayName
    # (e.g. a "private-" prefix for unpublished project-owned skills), so resolve by
    # listing and matching displayName rather than guessing skills/{skill_name} directly.
    local skill_id
    skill_id=$(gcloud alpha agent-registry skills list \
        --project="$AGENT_REGISTRY_PROJECT" --location="$AGENT_REGISTRY_LOCATION" \
        --format=json 2>/dev/null | python3 -c "
import json, sys
name = sys.argv[1]
data = json.load(sys.stdin)
for s in data:
    if s.get('displayName') == name and 'publisher' not in s:
        print(s['name'].rsplit('/', 1)[-1])
        break
" "$skill_name") || true
    if [ -z "$skill_id" ]; then
        echo "[worker] ERROR: could not find skill '$skill_name' in the Agent Registry"
        return 1
    fi

    local revision="$skill_version"
    if [ "$skill_version" = "latest" ] || [ -z "$skill_version" ]; then
        local default_revision
        default_revision=$(gcloud alpha agent-registry skills describe "$skill_id" \
            --project="$AGENT_REGISTRY_PROJECT" --location="$AGENT_REGISTRY_LOCATION" \
            --format='value(defaultRevision)' 2>/dev/null) || true
        revision="${default_revision##*/}"
        if [ -z "$revision" ]; then
            echo "[worker] ERROR: could not resolve defaultRevision for skill $skill_name"
            return 1
        fi
    fi

    local tmp_zip
    tmp_zip=$(mktemp)
    if ! gcloud alpha agent-registry skills revisions download "$revision" \
        --skill="$skill_id" --project="$AGENT_REGISTRY_PROJECT" --location="$AGENT_REGISTRY_LOCATION" \
        --destination="$tmp_zip" --allow-overwrite 2>/dev/null; then
        echo "[worker] ERROR: failed to download skill $skill_name revision $revision"
        rm -f "$tmp_zip"
        return 1
    fi

    mkdir -p "$skill_dir"
    if ! unzip -oq "$tmp_zip" -d "$skill_dir"; then
        echo "[worker] ERROR: failed to unzip skill $skill_name payload"
        rm -f "$tmp_zip"
        return 1
    fi
    rm -f "$tmp_zip"
    return 0
}

if [ -n "$SKILLS" ] && [ -n "$AGENT_REGISTRY_PROJECT" ] && [ -n "$AGENT_REGISTRY_LOCATION" ]; then
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

        echo "[worker] Fetching skill $skill_name (version: $skill_version) from the Agent Registry to $skill_dir"
        if fetch_skill "$skill_name" "$skill_version" "$skill_dir"; then
            SKILLS_PULLED=$((SKILLS_PULLED + 1))
        else
            echo "[worker] WARNING: Failed to fetch skill $skill_name@$skill_version"
        fi
    done
elif [ -n "$SKILLS" ]; then
    echo "[worker] ERROR: SKILLS is set but AGENT_REGISTRY_PROJECT/AGENT_REGISTRY_LOCATION are not — cannot fetch skills"
else
    echo "[worker] No skills configured (SKILLS env var empty), skipping skill fetch"
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

# Session id is derived deterministically from WORKER_ID (a uuid4().hex from the
# backend) rather than left to Claude Code to assign, so it's stable across restarts
# and addressable by the backend/frontend without discovery. Claude Code keys session
# files by an encoded form of the project's absolute path (every / and . becomes -)
# under ~/.claude/projects/<encoded>/<session-id>.jsonl — we check specifically for
# THIS worker's session id scoped to THIS task's workspace, not "any session exists
# anywhere": a worker upgrading from the old shared-$HOME layout (pre per-task-workspace)
# has an old session keyed to the old cwd, which a global check would wrongly match.
WORKSPACE_PROJECT_KEY=$(echo "$WORKSPACE_DIR" | sed 's/[\/.]/-/g')
SESSION_UUID="${WORKER_ID:0:8}-${WORKER_ID:8:4}-${WORKER_ID:12:4}-${WORKER_ID:16:4}-${WORKER_ID:20:12}"
EXISTING_SESSION="$HOME/.claude/projects/$WORKSPACE_PROJECT_KEY/$SESSION_UUID.jsonl"
cd "$WORKSPACE_DIR"
if [ -f "$EXISTING_SESSION" ]; then
    echo "[worker] Resuming Claude Code session ${SESSION_UUID} in ${WORKSPACE_DIR}..."
    exec claude --dangerously-skip-permissions --resume "$SESSION_UUID"
elif [ -n "$TASK_PROMPT" ]; then
    echo "[worker] Starting Claude Code session ${SESSION_UUID} in ${WORKSPACE_DIR} with task prompt..."
    exec claude --dangerously-skip-permissions --session-id "$SESSION_UUID" "$TASK_PROMPT"
else
    echo "[worker] Starting Claude Code session ${SESSION_UUID} in ${WORKSPACE_DIR} (no task prompt)..."
    exec claude --dangerously-skip-permissions --session-id "$SESSION_UUID"
fi
