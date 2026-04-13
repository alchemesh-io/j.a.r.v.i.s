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
    && rm -rf /var/lib/apt/lists/*

# Install uv
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:$PATH"

# Install Claude Code (pinned version)
RUN npm install -g @anthropic-ai/claude-code@1.0.3

# Install arctl
RUN curl -fsSL https://raw.githubusercontent.com/agentregistry-dev/agentregistry/main/scripts/get-arctl | bash \
    || echo "arctl install failed — continuing without it"

# Create non-root user
RUN groupadd -g 1000 worker && \
    useradd -u 1000 -g worker -m -s /bin/bash worker

# Create directories
RUN mkdir -p /home/worker/jarvis /home/worker/.claude && \
    chown -R worker:worker /home/worker

# Copy worker UI built assets
COPY --from=worker-ui-build --chown=worker:worker /app/dist/ /home/worker/worker-ui/

# Install serve for static file hosting
RUN npm install -g serve

# Copy status server
COPY --chown=worker:worker status-server/ /home/worker/status-server/

# Copy entrypoint
COPY --chown=worker:worker entrypoint.sh /home/worker/entrypoint.sh
RUN chmod +x /home/worker/entrypoint.sh

# Switch to non-root user
USER worker
WORKDIR /home/worker/jarvis

EXPOSE 3000 8080

ENTRYPOINT ["/home/worker/entrypoint.sh"]
