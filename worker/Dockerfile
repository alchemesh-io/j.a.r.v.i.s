FROM docker@sha256:4d2c6e334de4b26d492c0a8cc5438e3dbf1a02eee899fc0d4d39b96202c943a7 AS base

# Alpine-based docker:dind already includes dockerd + docker CLI.
# Install the remaining runtime dependencies: Node.js, Python, git, jq, sudo, etc.
RUN apk add --no-cache \
    bash \
    ca-certificates \
    crane \
    curl \
    git \
    github-cli \
    helm \
    jq \
    k9s \
    kubectl \
    kubectx \
    nodejs \
    npm \
    openssl \
    python3 \
    py3-pip \
    shadow \
    sudo \
    tar \
    unzip \
    yq-go

# Create a non-root 'node' user (UID 1000) to match the previous Debian layout
RUN addgroup -g 1000 node && \
    adduser -u 1000 -G node -s /bin/bash -D node && \
    mkdir -p /home/node/jarvis /home/node/.claude && \
    chown -R node:node /home/node

# Allow the node user to run any command as root without a password prompt —
# covers the stateful-mode chown fallback (in-container root is enough).
# Skills are fetched from the GCP Agent Registry + GCS (see entrypoint.sh); dockerd
# is never started, so worker pods run fully unprivileged regardless of skills.
RUN echo "node ALL=(ALL) NOPASSWD: ALL" > /etc/sudoers.d/node-docker

# Install uv
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:$PATH"

# Install Claude Code (pinned version — npm package still available for Docker/Linux)
RUN npm install -g @anthropic-ai/claude-code@2.1.104

# Install gws (Google Workspace CLI) via npm
RUN npm install -g @googleworkspace/cli@0.22.5

# Install terraform and tfctl (HCP Terraform/Terraform Enterprise CLI) from HashiCorp's
# official release server — neither is packaged for Alpine. Verified against each
# release's published SHA256SUMS file.
ARG TERRAFORM_VERSION=1.15.8
ARG TFCTL_VERSION=0.4.0
RUN ARCH=$(uname -m) && \
    case "$ARCH" in \
      x86_64) HC_ARCH=amd64 ;; \
      aarch64|arm64) HC_ARCH=arm64 ;; \
      *) echo "unsupported arch: $ARCH" && exit 1 ;; \
    esac && \
    for pkg in "terraform:${TERRAFORM_VERSION}" "tfctl:${TFCTL_VERSION}"; do \
      name="${pkg%%:*}"; version="${pkg##*:}"; \
      file="${name}_${version}_linux_${HC_ARCH}.zip"; \
      curl -fsSL -o "/tmp/${file}" "https://releases.hashicorp.com/${name}/${version}/${file}" && \
      curl -fsSL -o "/tmp/${name}_SHA256SUMS" "https://releases.hashicorp.com/${name}/${version}/${name}_${version}_SHA256SUMS" && \
      (cd /tmp && grep " ${file}\$" "${name}_SHA256SUMS" | sha256sum -c -) && \
      unzip -oq "/tmp/${file}" "${name}" -d /usr/local/bin && \
      chmod 755 "/usr/local/bin/${name}" && \
      rm -f "/tmp/${file}" "/tmp/${name}_SHA256SUMS"; \
    done

# Install argocd CLI, tflint, and terraform-docs as pinned GitHub-release binaries —
# none is packaged for Alpine. Verified against each project's published checksums.
ARG ARGOCD_VERSION=v3.5.0
ARG TFLINT_VERSION=v0.64.0
ARG TERRAFORM_DOCS_VERSION=v0.24.0
RUN ARCH=$(uname -m) && \
    case "$ARCH" in \
      x86_64) GH_ARCH=amd64 ;; \
      aarch64|arm64) GH_ARCH=arm64 ;; \
      *) echo "unsupported arch: $ARCH" && exit 1 ;; \
    esac && \
    # argocd: raw per-arch binary, checked against the combined cli_checksums.txt
    curl -fsSL -o /tmp/argocd "https://github.com/argoproj/argo-cd/releases/download/${ARGOCD_VERSION}/argocd-linux-${GH_ARCH}" && \
    curl -fsSL -o /tmp/cli_checksums.txt "https://github.com/argoproj/argo-cd/releases/download/${ARGOCD_VERSION}/cli_checksums.txt" && \
    (cd /tmp && grep " argocd-linux-${GH_ARCH}\$" cli_checksums.txt | sed 's#argocd-linux-'"${GH_ARCH}"'#argocd#' | sha256sum -c -) && \
    install -m 755 /tmp/argocd /usr/local/bin/argocd && \
    rm -f /tmp/argocd /tmp/cli_checksums.txt && \
    # tflint: zip, checked against the combined checksums.txt
    curl -fsSL -o /tmp/tflint.zip "https://github.com/terraform-linters/tflint/releases/download/${TFLINT_VERSION}/tflint_linux_${GH_ARCH}.zip" && \
    curl -fsSL -o /tmp/tflint_checksums.txt "https://github.com/terraform-linters/tflint/releases/download/${TFLINT_VERSION}/checksums.txt" && \
    (cd /tmp && grep " tflint_linux_${GH_ARCH}.zip\$" tflint_checksums.txt | sed 's#tflint_linux_'"${GH_ARCH}"'.zip#tflint.zip#' | sha256sum -c -) && \
    unzip -oq /tmp/tflint.zip tflint -d /usr/local/bin && \
    chmod 755 /usr/local/bin/tflint && \
    rm -f /tmp/tflint.zip /tmp/tflint_checksums.txt && \
    # terraform-docs: tar.gz, checked against its own .sha256sum file
    curl -fsSL -o /tmp/terraform-docs.tar.gz "https://github.com/terraform-docs/terraform-docs/releases/download/${TERRAFORM_DOCS_VERSION}/terraform-docs-${TERRAFORM_DOCS_VERSION}-linux-${GH_ARCH}.tar.gz" && \
    curl -fsSL -o /tmp/terraform-docs.sha256sum "https://github.com/terraform-docs/terraform-docs/releases/download/${TERRAFORM_DOCS_VERSION}/terraform-docs-${TERRAFORM_DOCS_VERSION}.sha256sum" && \
    (cd /tmp && grep " terraform-docs-${TERRAFORM_DOCS_VERSION}-linux-${GH_ARCH}.tar.gz\$" terraform-docs.sha256sum | sed 's#terraform-docs-'"${TERRAFORM_DOCS_VERSION}"'-linux-'"${GH_ARCH}"'.tar.gz#terraform-docs.tar.gz#' | sha256sum -c -) && \
    tar -xzf /tmp/terraform-docs.tar.gz -C /usr/local/bin terraform-docs && \
    chmod 755 /usr/local/bin/terraform-docs && \
    rm -f /tmp/terraform-docs.tar.gz /tmp/terraform-docs.sha256sum

# Install Datadog's `pup` CLI (cost/telemetry API client) as a pinned GitHub-release
# binary. IMPORTANT: do NOT `apk add pup` — Alpine's `pup` package (ericchiang/pup) is
# an unrelated HTML/XML parser that would silently shadow this binary; Datadog's pup
# is only distributed via GitHub releases / the `datadog-labs/pack/pup` Homebrew tap.
ARG PUP_VERSION=1.10.3
RUN ARCH=$(uname -m) && \
    case "$ARCH" in \
      x86_64) PUP_ARCH=x86_64 ;; \
      aarch64|arm64) PUP_ARCH=arm64 ;; \
      *) echo "unsupported arch: $ARCH" && exit 1 ;; \
    esac && \
    curl -fsSL -o /tmp/pup.tar.gz "https://github.com/DataDog/pup/releases/download/v${PUP_VERSION}/pup_${PUP_VERSION}_Linux_${PUP_ARCH}.tar.gz" && \
    curl -fsSL -o /tmp/pup_checksums.txt "https://github.com/DataDog/pup/releases/download/v${PUP_VERSION}/pup_${PUP_VERSION}_checksums.txt" && \
    (cd /tmp && grep " pup_${PUP_VERSION}_Linux_${PUP_ARCH}.tar.gz\$" pup_checksums.txt | sed 's#pup_'"${PUP_VERSION}"'_Linux_'"${PUP_ARCH}"'.tar.gz#pup.tar.gz#' | sha256sum -c -) && \
    tar -xzf /tmp/pup.tar.gz -C /usr/local/bin pup && \
    chmod 755 /usr/local/bin/pup && \
    rm -f /tmp/pup.tar.gz /tmp/pup_checksums.txt

# Install ggshield (GitGuardian secret scanner) via pip — not packaged for Alpine.
RUN pip install --break-system-packages --no-cache-dir ggshield==1.53.0

# Install the Google Cloud SDK (core + alpha + beta components) from Google's official
# Linux archive — not packaged for Alpine. Ships with no credentials, no default
# project, and no `kubectl` component: `kubectl` already comes from apk above, so
# there is exactly one `kubectl` binary in the image.
RUN ARCH=$(uname -m) && \
    case "$ARCH" in \
      x86_64) GCLOUD_ARCH=x86_64 ;; \
      aarch64|arm64) GCLOUD_ARCH=arm64 ;; \
      *) echo "unsupported arch: $ARCH" && exit 1 ;; \
    esac && \
    curl -fsSL -o /tmp/gcloud-sdk.tar.gz \
      "https://storage.googleapis.com/cloud-sdk-release/google-cloud-cli-linux-${GCLOUD_ARCH}.tar.gz" && \
    tar -xzf /tmp/gcloud-sdk.tar.gz -C /opt && \
    rm -f /tmp/gcloud-sdk.tar.gz && \
    /opt/google-cloud-sdk/install.sh --usage-reporting=false --command-completion=false \
      --path-update=false --quiet && \
    /opt/google-cloud-sdk/bin/gcloud components install alpha beta -q && \
    chown -R node:node /opt/google-cloud-sdk
ENV PATH="/opt/google-cloud-sdk/bin:$PATH"

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
