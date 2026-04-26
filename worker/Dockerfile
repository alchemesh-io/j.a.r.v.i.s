FROM docker@sha256:4d2c6e334de4b26d492c0a8cc5438e3dbf1a02eee899fc0d4d39b96202c943a7 AS base

# Alpine-based docker:dind already includes dockerd + docker CLI.
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

# Create a non-root 'node' user (UID 1000) to match the previous Debian layout
RUN addgroup -g 1000 node && \
    adduser -u 1000 -G node -s /bin/bash -D node && \
    mkdir -p /home/node/jarvis /home/node/.claude && \
    chown -R node:node /home/node

# Allow the node user to run any command as root without a password prompt.
# The worker pod runs with privileged: true so dockerd can start.
RUN echo "node ALL=(ALL) NOPASSWD: ALL" > /etc/sudoers.d/node-docker

# Use slirp4netns as the rootlesskit networking backend for dockerd.
ENV DOCKERD_ROOTLESS_ROOTLESSKIT_NET=slirp4netns

# Install uv
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:$PATH"

# Install Claude Code (pinned version — npm package still available for Docker/Linux)
RUN npm install -g @anthropic-ai/claude-code@2.1.104

# Install arctl directly from GitHub releases into /usr/local/bin (readable by node user)
ARG ARCTL_VERSION=v0.3.3
RUN ARCH=$(uname -m) && \
    case "$ARCH" in \
      x86_64) ARCTL_ARCH=amd64 ;; \
      aarch64|arm64) ARCTL_ARCH=arm64 ;; \
      *) echo "unsupported arch: $ARCH" && exit 1 ;; \
    esac && \
    curl -fsSL "https://github.com/agentregistry-dev/agentregistry/releases/download/${ARCTL_VERSION}/arctl-linux-${ARCTL_ARCH}" \
      -o /usr/local/bin/arctl \
    && chmod 755 /usr/local/bin/arctl

# Install gws (Google Workspace CLI) via npm
RUN npm install -g @googleworkspace/cli@0.22.5

# Copy status server
COPY --chown=node:node status-server/ /home/node/status-server/

# Copy scripts
COPY --chown=node:node setup-claude.sh /home/node/setup-claude.sh
COPY --chown=node:node entrypoint.sh /home/node/entrypoint.sh
RUN chmod +x /home/node/entrypoint.sh /home/node/setup-claude.sh

# Switch to non-root user (UID 1000)
USER node
WORKDIR /home/node/jarvis

EXPOSE 8080

ENTRYPOINT ["/home/node/entrypoint.sh"]
