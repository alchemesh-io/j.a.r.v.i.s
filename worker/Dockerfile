FROM gcr.io/google.com/cloudsdktool/cloud-sdk:alpine AS base

# Google's own Alpine image ships the gcloud CLI (incl. `gcloud storage`), used by
# the entrypoint to fetch skills from GCS via Workload Identity — no docker/dind
# needed anymore since skills are plain files, not OCI images.
# Install the remaining runtime dependencies: Node.js, Python, git, jq, sudo, etc.
RUN apk add --no-cache \
    bash \
    ca-certificates \
    curl \
    git \
    jq \
    nodejs \
    npm \
    openssl \
    python3 \
    py3-pip \
    shadow \
    sudo \
    tar

# Create a non-root 'node' user (UID 1000) to match the previous Debian layout.
# The base image ships its own uid/gid-1000 'cloudsdk' user — remove it first
# since /google-cloud-sdk is root-owned and world-executable, so gcloud works
# fine under any uid and doesn't need that user to exist.
RUN deluser cloudsdk 2>/dev/null; delgroup cloudsdk 2>/dev/null; \
    addgroup -g 1000 node && \
    adduser -u 1000 -G node -s /bin/bash -D node && \
    mkdir -p /home/node/jarvis /home/node/.claude && \
    chown -R node:node /home/node

# Allow the node user to run any command as root without a password prompt.
# Covers the stateful-mode chown fallback (in-container root is enough); no
# privileged pod is required anymore since skill fetch no longer needs dockerd.
RUN echo "node ALL=(ALL) NOPASSWD: ALL" > /etc/sudoers.d/node-docker

# Install uv
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:$PATH"

# Install Claude Code (pinned version — npm package still available for Docker/Linux)
RUN npm install -g @anthropic-ai/claude-code@2.1.104

# Install gws (Google Workspace CLI) via npm
RUN npm install -g @googleworkspace/cli@0.22.5

# Worker scripts and status-server live OUTSIDE /home/node so a stateful PVC mounted
# at /home/node does not shadow them. /opt/jarvis-worker is owned by the node user but
# treated as read-only worker code, while /home/node holds user data only.
RUN mkdir -p /opt/jarvis-worker && chown -R node:node /opt/jarvis-worker

# Copy status server
COPY --chown=node:node status-server/ /opt/jarvis-worker/status-server/

# Copy scripts
COPY --chown=node:node setup-claude.sh /opt/jarvis-worker/setup-claude.sh
COPY --chown=node:node entrypoint.sh /opt/jarvis-worker/entrypoint.sh
RUN chmod +x /opt/jarvis-worker/entrypoint.sh /opt/jarvis-worker/setup-claude.sh

# Switch to non-root user (UID 1000)
USER node
WORKDIR /home/node/jarvis

EXPOSE 8080

ENTRYPOINT ["/opt/jarvis-worker/entrypoint.sh"]
