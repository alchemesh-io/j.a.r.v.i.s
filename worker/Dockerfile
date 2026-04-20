FROM node:22 AS base

# Install system dependencies + Docker Engine (docker.io) for dockerd + CLI inside the container.
# The worker pod must run with privileged: true to start dockerd.
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    jq \
    python3 \
    python3-pip \
    python3-venv \
    ca-certificates \
    docker.io \
    sudo \
    && rm -rf /var/lib/apt/lists/*

# Allow the node user to run dockerd / arctl / docker as root without a password prompt
RUN echo "node ALL=(ALL) NOPASSWD: /usr/sbin/dockerd, /usr/bin/docker, /root/.local/bin/arctl, /bin/kill, /bin/chown" \
    > /etc/sudoers.d/node-docker

# Install uv
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:$PATH"

# Install Claude Code (pinned version — npm package still available for Docker/Linux)
RUN npm install -g @anthropic-ai/claude-code@2.1.104

# Install arctl
RUN curl -fsSL https://raw.githubusercontent.com/agentregistry-dev/agentregistry/main/scripts/get-arctl | bash \
    || echo "arctl install failed — continuing without it"

# Reuse the existing node user (UID 1000) from node:22-slim
RUN mkdir -p /home/node/jarvis /home/node/.claude && \
    chown -R node:node /home/node

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
