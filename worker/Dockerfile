# Stage 1: Build worker UI from erdrix/claude-code
# TODO: Replace placeholder with actual erdrix/claude-code build
FROM node:22-slim AS worker-ui-build
RUN mkdir -p /app/dist
RUN echo '<!DOCTYPE html><html><head><title>Worker UI</title></head><body><h1>Worker UI placeholder</h1><p>Replace with erdrix/claude-code build</p></body></html>' > /app/dist/index.html

# Stage 2: Final worker image
FROM node:22-slim AS base

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    jq \
    python3 \
    python3-pip \
    python3-venv \
    ca-certificates \
    openssh-server \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /run/sshd

# Install uv
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:$PATH"

# Install Claude Code (pinned version — npm package still available for Docker/Linux)
RUN npm install -g @anthropic-ai/claude-code@2.1.104

# Install arctl
RUN curl -fsSL https://raw.githubusercontent.com/agentregistry-dev/agentregistry/main/scripts/get-arctl | bash \
    || echo "arctl install failed — continuing without it"

# Configure sshd for non-root on port 2222
RUN sed -i 's/#Port 22/Port 2222/' /etc/ssh/sshd_config && \
    sed -i 's/#PermitEmptyPasswords no/PermitEmptyPasswords yes/' /etc/ssh/sshd_config && \
    sed -i 's/#PubkeyAuthentication yes/PubkeyAuthentication yes/' /etc/ssh/sshd_config && \
    sed -i 's/UsePAM yes/UsePAM no/' /etc/ssh/sshd_config && \
    echo "HostKey /home/node/.ssh/ssh_host_ed25519_key" >> /etc/ssh/sshd_config

# Reuse the existing node user (UID 1000) from node:22-slim
# Create working directories and SSH setup
RUN mkdir -p /home/node/jarvis /home/node/.claude /home/node/.ssh && \
    chown -R node:node /home/node && \
    passwd -d node

# Copy worker UI built assets
COPY --from=worker-ui-build --chown=node:node /app/dist/ /home/node/worker-ui/

# Install serve for static file hosting
RUN npm install -g serve

# Copy status server
COPY --chown=node:node status-server/ /home/node/status-server/

# Copy entrypoint
COPY --chown=node:node entrypoint.sh /home/node/entrypoint.sh
RUN chmod +x /home/node/entrypoint.sh

# Switch to non-root user (UID 1000)
USER node
WORKDIR /home/node/jarvis

EXPOSE 2222 3000 8080

ENTRYPOINT ["/home/node/entrypoint.sh"]
