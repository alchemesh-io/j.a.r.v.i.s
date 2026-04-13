# J.A.R.V.I.S — Local Development Makefile
#
# Minikube defaults:
#   MINIKUBE_CPUS  (default: 4)
#   MINIKUBE_MEMORY (default: 8192 MB)
#
# Override with: make cluster-up MINIKUBE_CPUS=6 MINIKUBE_MEMORY=12288

MINIKUBE_CPUS   ?= 4
MINIKUBE_MEMORY ?= 8192
ARGOCD_VERSION  := v3.3.6
MOUNT_PID_FILE      := .minikube-mount.pid
DATA_MOUNT_PID_FILE := .minikube-data-mount.pid
REPO_ROOT           := $(shell pwd)
MOUNT_TARGET        := /mnt/jarvis-repo
DATA_DIR            := $(REPO_ROOT)/.data
DATA_MOUNT_TARGET   := /mnt/jarvis-data
GHCR_ORG            := alchemesh-io


.PHONY: cluster-up cluster-down cluster-status deploy undeploy deploy-local argocd-ui jarvis-ui sync sync-artifacts sync-artifacts-servers db-backup db-restore _db-backup-safe test-backend test-frontend test-e2e test-mcp build-worker setup-worker-ssh sync-claude-config _check-prereqs _mount-start _istio-install _argocd-install _argocd-patch-repo-server _argocd-add-repo _deploy-secrets _deploy-jaw-secrets _deploy-jaar-secrets _sync-claude-config _helm-dep-update _tls-secret

# ---------------------------------------------------------------------------
# Prerequisite checks
# ---------------------------------------------------------------------------
REQUIRED_TOOLS := minikube kubectl docker
OPTIONAL_TOOLS := argocd

_check-prereqs:
	@for tool in $(REQUIRED_TOOLS); do \
		if ! command -v $$tool >/dev/null 2>&1; then \
			echo "ERROR: Required tool '$$tool' not found on PATH. Please install it first."; \
			exit 1; \
		fi; \
	done
	@for tool in $(OPTIONAL_TOOLS); do \
		if ! command -v $$tool >/dev/null 2>&1; then \
			echo "WARNING: Optional tool '$$tool' not found — some targets may fall back to kubectl."; \
		fi; \
	done

# ---------------------------------------------------------------------------
# Cluster lifecycle
# ---------------------------------------------------------------------------

## Start a local Minikube cluster with ArgoCD and minikube mount
cluster-up: _check-prereqs
	@echo "==> Starting Minikube cluster (CPUs=$(MINIKUBE_CPUS), Memory=$(MINIKUBE_MEMORY)MB)..."
	minikube start --cpus=$(MINIKUBE_CPUS) --memory=$(MINIKUBE_MEMORY) --driver=docker
	@$(MAKE) _mount-start
	@$(MAKE) _argocd-install
	@$(MAKE) _argocd-patch-repo-server
	@$(MAKE) _argocd-add-repo
	@$(MAKE) _istio-install
	@echo ""
	@echo "==> Cluster ready. Run 'make argocd-ui' to open the ArgoCD dashboard."

## Stop the Minikube cluster and clean up background processes (data in .data/ is preserved)
cluster-down: _check-prereqs _db-backup-safe
	@echo "==> Stopping minikube mount processes..."
	@for pidfile in $(MOUNT_PID_FILE) $(DATA_MOUNT_PID_FILE); do \
		if [ -f $$pidfile ]; then \
			PID=$$(cat $$pidfile); \
			if kill -0 $$PID 2>/dev/null; then \
				kill $$PID && echo "  Killed mount PID $$PID"; \
			else \
				echo "  Mount process $$PID not running (stale PID file)"; \
			fi; \
			rm -f $$pidfile; \
		fi; \
	done
	@echo "==> Deleting Minikube cluster..."
	@echo "    Note: data in .data/ is preserved on the host."
	minikube delete
	@echo "==> Cluster deleted."

## Print status of Minikube, ArgoCD pods, and minikube mount
cluster-status: _check-prereqs
	@echo "==> Minikube status:"
	minikube status || true
	@echo ""
	@echo "==> ArgoCD pods:"
	kubectl get pods -n argocd 2>/dev/null || echo "  (argocd namespace not found)"
	@echo ""
	@echo "==> minikube mount processes:"
	@for desc_pid in "Repo:$(MOUNT_PID_FILE)" "Data:$(DATA_MOUNT_PID_FILE)"; do \
		desc=$${desc_pid%%:*}; pidfile=$${desc_pid#*:}; \
		if [ -f $$pidfile ]; then \
			PID=$$(cat $$pidfile); \
			if kill -0 $$PID 2>/dev/null; then \
				echo "  $$desc: Running (PID $$PID)"; \
			else \
				echo "  $$desc: NOT running (stale PID $$PID)"; \
			fi; \
		else \
			echo "  $$desc: Not started (no PID file)"; \
		fi; \
	done

# ---------------------------------------------------------------------------
# Application deployment
# ---------------------------------------------------------------------------

## Pull latest published images from GHCR, load into Minikube, apply ArgoCD App CRs, hard sync
deploy: _check-prereqs _db-backup-safe _deploy-secrets _deploy-jaw-secrets _deploy-jaar-secrets _sync-claude-config setup-worker-ssh _helm-dep-update
	@echo "==> Pulling latest images from GHCR..."
	docker pull ghcr.io/$(GHCR_ORG)/jarvis-backend:latest
	docker pull ghcr.io/$(GHCR_ORG)/jarvis-frontend:latest
	@echo "==> Loading images into Minikube..."
	minikube image load ghcr.io/$(GHCR_ORG)/jarvis-backend:latest
	minikube image load ghcr.io/$(GHCR_ORG)/jarvis-frontend:latest
	@echo "==> Applying ArgoCD Application CRs (GHCR images)..."
	kubectl apply -f argocd/jarvis-app.yaml
	kubectl apply -f argocd/jaar-app.yaml
	@$(MAKE) sync
	@echo "==> Deployment complete. Run 'make argocd-ui' to monitor sync status."
	@echo "==> Access via Istio ingress gateway:"
	@echo "    minikube tunnel  (in a separate terminal)"
	@echo "    kubectl get svc istio-ingressgateway -n istio-system"

## Build images locally, load into Minikube, apply ArgoCD App CRs, hard sync
deploy-local: _check-prereqs _db-backup-safe _deploy-secrets _deploy-jaw-secrets _deploy-jaar-secrets _sync-claude-config setup-worker-ssh _helm-dep-update
	$(eval LOCAL_TAG := $(shell git rev-parse --short HEAD))
	@echo "==> Building Docker images locally (tag: $(LOCAL_TAG))..."
	docker build -t jarvis-backend:$(LOCAL_TAG) ./backend
	docker build -t jarvis-frontend:$(LOCAL_TAG) ./frontend
	docker build -t jarvis:$(LOCAL_TAG) ./artifacts/servers/jarvis
	docker build -t jarvis-worker:$(LOCAL_TAG) ./worker
	@echo "==> Loading images into Minikube..."
	minikube image load jarvis-backend:$(LOCAL_TAG)
	minikube image load jarvis-frontend:$(LOCAL_TAG)
	minikube image load jarvis:$(LOCAL_TAG)
	minikube image load jarvis-worker:$(LOCAL_TAG)
	@echo "==> Applying ArgoCD Application CRs (local images, tag: $(LOCAL_TAG))..."
	@sed 's/tag: local/tag: "$(LOCAL_TAG)"/g' argocd/jarvis-app-local.yaml | kubectl apply -f -
	kubectl apply -f argocd/jaar-app-local.yaml
	@$(MAKE) sync
	@echo "==> Deployment complete. Run 'make argocd-ui' to monitor sync status."
	@echo "==> Access via Istio ingress gateway:"
	@echo "    minikube tunnel  (in a separate terminal)"
	@echo "    kubectl get svc istio-ingressgateway -n istio-system"

## Delete the ArgoCD Application CRs (cascade deletes all managed resources)
undeploy: _check-prereqs _db-backup-safe
	@echo "==> Deleting ArgoCD Application CRs (cascade)..."
	kubectl delete -f argocd/jarvis-app.yaml --ignore-not-found=true
	kubectl delete -f argocd/jaar-app.yaml --ignore-not-found=true
	@echo "==> Applications undeployed."

# ---------------------------------------------------------------------------
# ArgoCD helpers
# ---------------------------------------------------------------------------

## Print ArgoCD admin password — UI accessible at http://jaac.jarvis.io
argocd-ui: _check-prereqs
	@echo "==> ArgoCD initial admin password:"
	@kubectl -n argocd get secret argocd-initial-admin-secret \
		-o jsonpath="{.data.password}" 2>/dev/null | base64 --decode && echo || \
		echo "  (Secret not found — password may have been changed)"
	@echo ""
	@echo "==> ArgoCD UI: http://jaac.jarvis.io"
	@echo "    Username: admin"

## Port-forward Istio ingress gateway to localhost:80 (requires minikube tunnel)
## Access: http://main.jarvis.io (JARVIS), http://jaar.jarvis.io (JAAR)
## Ensure /etc/hosts maps *.jarvis.io to the gateway IP (minikube tunnel IP)
jarvis-ui: _check-prereqs
	@echo "==> Access via minikube tunnel:"
	@echo "    http://main.jarvis.io    (JARVIS)"
	@echo "    http://mcp.jarvis.io     (MCP Server)"
	@echo "    http://jaw.jarvis.io     (Worker UIs)"
	@echo "    http://jaar.jarvis.io    (Agent Registry)"
	@echo "    http://jaac.jarvis.io    (ArgoCD)"
	@echo ""
	@echo "==> Ensure /etc/hosts contains:"
	@echo "    <GATEWAY-IP>  main.jarvis.io mcp.jarvis.io jaw.jarvis.io jaar.jarvis.io jaac.jarvis.io"
	@echo ""
	kubectl port-forward svc/jarvis-gateway-istio -n istio-system 7080:80

## Trigger ArgoCD hard sync for jarvis and jaar applications
sync: _check-prereqs
	@echo "==> Triggering ArgoCD sync for 'jarvis'..."
	@if command -v argocd >/dev/null 2>&1; then \
		argocd app sync jarvis --hard-refresh 2>/dev/null || \
		echo "  (argocd CLI sync failed — falling back to kubectl)"; \
	fi
	kubectl -n argocd patch app jarvis \
		--type merge \
		-p '{"operation":{"initiatedBy":{"username":"make-sync"},"sync":{"revision":"HEAD","prune":true}}}' \
		2>/dev/null || true
	@echo "==> Triggering ArgoCD sync for 'jaar'..."
	@if command -v argocd >/dev/null 2>&1; then \
		argocd app sync jaar --hard-refresh 2>/dev/null || \
		echo "  (argocd CLI sync failed — falling back to kubectl)"; \
	fi
	kubectl -n argocd patch app jaar \
		--type merge \
		-p '{"operation":{"initiatedBy":{"username":"make-sync"},"sync":{"revision":"HEAD","prune":true}}}' \
		2>/dev/null || true
	@echo "==> Sync triggered."

# ---------------------------------------------------------------------------
# Internal helpers (not intended for direct use)
# ---------------------------------------------------------------------------

SECRETS_FILE := secrets/backend-secret.yaml

## Apply the local backend secret manifest (gitignored, not managed by ArgoCD)
_deploy-secrets:
	@if [ -f $(SECRETS_FILE) ]; then \
		echo "==> Applying backend secret from $(SECRETS_FILE)..."; \
		kubectl create namespace jarvis --dry-run=client -o yaml | kubectl apply -f - 2>/dev/null; \
		kubectl apply -f $(SECRETS_FILE); \
	else \
		echo "==> No $(SECRETS_FILE) found — skipping secrets deployment."; \
		echo "    Copy secrets/backend-secret.example.yaml to $(SECRETS_FILE) and fill in values."; \
	fi

JAW_SECRETS_FILE := secrets/jaw-secret.yaml

## Apply the local JAW (worker) secret manifest (gitignored, not managed by ArgoCD)
_deploy-jaw-secrets:
	@if [ -f $(JAW_SECRETS_FILE) ]; then \
		echo "==> Applying JAW secret from $(JAW_SECRETS_FILE)..."; \
		kubectl create namespace jarvis --dry-run=client -o yaml | kubectl apply -f - 2>/dev/null; \
		kubectl apply -f $(JAW_SECRETS_FILE); \
	else \
		echo "==> No $(JAW_SECRETS_FILE) found — skipping JAW secrets deployment."; \
		echo "    Copy secrets/jaw-secret.example.yaml to $(JAW_SECRETS_FILE) and fill in values."; \
	fi

_mount-start:
	@echo "==> Starting minikube mount $(REPO_ROOT) -> $(MOUNT_TARGET)..."
	@if [ -f $(MOUNT_PID_FILE) ]; then \
		PID=$$(cat $(MOUNT_PID_FILE)); \
		if kill -0 $$PID 2>/dev/null; then \
			echo "  Repo mount already running (PID $$PID), skipping."; \
		else \
			minikube mount $(REPO_ROOT):$(MOUNT_TARGET) & \
			echo $$! > $(MOUNT_PID_FILE); \
			echo "  Repo mount started (PID $$(cat $(MOUNT_PID_FILE)))"; \
		fi; \
	else \
		minikube mount $(REPO_ROOT):$(MOUNT_TARGET) & \
		echo $$! > $(MOUNT_PID_FILE); \
		echo "  Repo mount started (PID $$(cat $(MOUNT_PID_FILE)))"; \
	fi
	@mkdir -p $(DATA_DIR)/jarvis $(DATA_DIR)/jaar
	@echo "==> Starting minikube mount $(DATA_DIR) -> $(DATA_MOUNT_TARGET)..."
	@if [ -f $(DATA_MOUNT_PID_FILE) ]; then \
		PID=$$(cat $(DATA_MOUNT_PID_FILE)); \
		if kill -0 $$PID 2>/dev/null; then \
			echo "  Data mount already running (PID $$PID), skipping."; \
		else \
			minikube mount $(DATA_DIR):$(DATA_MOUNT_TARGET) & \
			echo $$! > $(DATA_MOUNT_PID_FILE); \
			echo "  Data mount started (PID $$(cat $(DATA_MOUNT_PID_FILE)))"; \
		fi; \
	else \
		minikube mount $(DATA_DIR):$(DATA_MOUNT_TARGET) & \
		echo $$! > $(DATA_MOUNT_PID_FILE); \
		echo "  Data mount started (PID $$(cat $(DATA_MOUNT_PID_FILE)))"; \
	fi
	@sleep 2

_istio-install:
	@echo "==> Deploying Istio + Gateway API CRDs via ArgoCD..."
	kubectl apply -f argocd/istio-app.yaml
	@echo "==> Waiting for Istio to sync and become healthy (timeout 5m)..."
	@kubectl wait --for=jsonpath='{.status.health.status}'=Healthy application/istio -n argocd --timeout=300s 2>/dev/null || \
		echo "  (Waiting for Istio sync — may take a moment on first deploy)"
	@$(MAKE) _tls-secret
	@echo "==> Labeling jarvis and jaar namespaces for Istio sidecar injection..."
	kubectl create namespace jarvis --dry-run=client -o yaml | kubectl apply -f -
	kubectl label namespace jarvis istio-injection=enabled --overwrite
	kubectl create namespace jaar --dry-run=client -o yaml | kubectl apply -f -
	kubectl label namespace jaar istio-injection=enabled --overwrite

## Generate self-signed wildcard TLS cert for *.jarvis.io and store in istio-system
_tls-secret:
	@if kubectl get secret jarvis-io-tls -n istio-system >/dev/null 2>&1; then \
		echo "==> TLS secret jarvis-io-tls already exists, skipping."; \
	else \
		echo "==> Generating self-signed wildcard certificate for *.jarvis.io..."; \
		openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
			-keyout /tmp/jarvis-io-tls.key \
			-out /tmp/jarvis-io-tls.crt \
			-subj "/O=JARVIS/CN=jarvis.io" \
			-addext "subjectAltName=DNS:*.jarvis.io,DNS:jarvis.io" \
			-addext "basicConstraints=critical,CA:TRUE" \
			-addext "keyUsage=critical,digitalSignature,keyEncipherment,keyCertSign" \
			-addext "extendedKeyUsage=serverAuth" 2>/dev/null; \
		kubectl create secret tls jarvis-io-tls \
			--cert=/tmp/jarvis-io-tls.crt \
			--key=/tmp/jarvis-io-tls.key \
			-n istio-system; \
		rm -f /tmp/jarvis-io-tls.key /tmp/jarvis-io-tls.crt; \
		echo "  TLS secret created."; \
	fi

_argocd-install:
	@echo "==> Installing ArgoCD $(ARGOCD_VERSION)..."
	kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -
	kubectl apply -n argocd --server-side --force-conflicts -f https://raw.githubusercontent.com/argoproj/argo-cd/$(ARGOCD_VERSION)/manifests/install.yaml
	@echo "==> Configuring ArgoCD server for insecure mode (TLS terminated at gateway)..."
	@kubectl create configmap argocd-cmd-params-cm -n argocd \
		--from-literal=server.insecure=true \
		--dry-run=client -o yaml | kubectl apply -f -
	@echo "==> Waiting for ArgoCD to be Ready (timeout 5m)..."
	kubectl rollout restart deployment argocd-server -n argocd
	kubectl wait --for=condition=Available deployment --all -n argocd --timeout=300s
	kubectl wait --for=jsonpath='{.status.readyReplicas}'=1 statefulset --all -n argocd --timeout=300s

_argocd-patch-repo-server:
	@echo "==> Patching argocd-repo-server with hostPath volume for $(MOUNT_TARGET)..."
	@if kubectl get deployment argocd-repo-server -n argocd \
		-o jsonpath='{.spec.template.spec.volumes[*].name}' 2>/dev/null | grep -q "jarvis-repo"; then \
		echo "  Patch already applied, skipping rollout restart."; \
	else \
		kubectl patch deployment argocd-repo-server -n argocd \
			--type=strategic --patch-file=argocd/repo-server-patch.yaml; \
	fi
	kubectl rollout status deployment/argocd-repo-server -n argocd --timeout=120s

_argocd-add-repo:
	@echo "==> Configuring ArgoCD repository entry for file:///mnt/jarvis-repo..."
	kubectl apply -f argocd/jarvis-repo-secret.yaml

JAAR_SECRETS_FILE := secrets/jaar-secret.yaml

## Apply the local JAAR secret manifest (gitignored, not managed by ArgoCD)
_deploy-jaar-secrets:
	@if [ -f $(JAAR_SECRETS_FILE) ]; then \
		echo "==> Applying JAAR secret from $(JAAR_SECRETS_FILE)..."; \
		kubectl create namespace jaar --dry-run=client -o yaml | kubectl apply -f - 2>/dev/null; \
		kubectl apply -f $(JAAR_SECRETS_FILE); \
	else \
		echo "==> No $(JAAR_SECRETS_FILE) found — skipping JAAR secrets deployment."; \
		echo "    Copy secrets/jaar-secret.example.yaml to $(JAAR_SECRETS_FILE) and fill in values."; \
	fi

## Build Helm chart dependencies (pull upstream subcharts)
_helm-dep-update:
	@echo "==> Updating Helm dependencies for helm/jaar/..."
	helm dependency update helm/jaar/ 2>/dev/null || \
		echo "  (helm dependency update failed — chart may not render correctly)"


# ---------------------------------------------------------------------------
# Local dev (no Docker)
# ---------------------------------------------------------------------------
## Run frontend dev server proxying to local backend (make dev-backend)
dev-frontend:
	cd frontend && npm run dev

## Run frontend dev server proxying to Minikube backend (requires minikube tunnel)
dev-frontend-minikube:
	$(eval INGRESS_IP := $(shell kubectl get svc -n istio-system istio-ingressgateway -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "localhost"))
	cd frontend && API_URL=http://$(INGRESS_IP) npm run dev

## Run backend locally with SQLite
dev-backend:
	cd backend && DATABASE_URL=sqlite:///./jarvis-dev.db uv run uvicorn app.main:app --reload --port 8000

# ---------------------------------------------------------------------------
# Artifact publishing
# ---------------------------------------------------------------------------

## Sync all artifacts to the Agent Registry (publish remote GHCR versions + local images)
## Requires JAAR to be running. Override registry URL: make sync-artifacts JAAR_URL=http://...
JAAR_URL ?= http://jaar.jarvis.io
sync-artifacts: sync-artifacts-servers

## Publish all MCP servers to Agent Registry — all remote tags from GHCR + local git SHA
sync-artifacts-servers:
	@echo "==> Syncing MCP servers to Agent Registry ($(JAAR_URL))..."
	$(eval LOCAL_TAG := $(shell git rev-parse --short HEAD))
	@for dir in artifacts/servers/*/; do \
		manifest="$${dir}mcp.yaml"; \
		if [ ! -f "$$manifest" ]; then continue; fi; \
		NAME=$$(yq -r '.name' "$$manifest"); \
		DESC=$$(yq -r '.description' "$$manifest"); \
		IMAGE=$$(yq -r '.image' "$$manifest"); \
		echo "  --- $${NAME} ---"; \
		echo "  Fetching remote tags from GHCR..."; \
		TAGS=$$(docker images --format '{{.Tag}}' "$$IMAGE" 2>/dev/null; \
			curl -sf "https://ghcr.io/v2/$(GHCR_ORG)/$${NAME}/tags/list" \
				-H "Authorization: Bearer $$(curl -sf "https://ghcr.io/token?scope=repository:$(GHCR_ORG)/$${NAME}:pull&service=ghcr.io" | jq -r '.token')" \
				2>/dev/null | jq -r '.tags[]' 2>/dev/null) || true; \
		for TAG in $$TAGS; do \
			echo "  Publishing $${NAME}:$${TAG}..."; \
			arctl mcp publish $(GHCR_ORG)/$${NAME} \
				--registry-url "$(JAAR_URL)" \
				--description "$$DESC" \
				--version "$$TAG" \
				--type oci \
				--package-id "$${IMAGE}:$${TAG}" || \
				echo "    Skipped $${TAG}"; \
		done; \
		echo "  Publishing local $${NAME}:$(LOCAL_TAG)..."; \
		arctl mcp publish $(GHCR_ORG)/$${NAME} \
			--registry-url "$(JAAR_URL)" \
			--description "$$DESC" \
			--version "$(LOCAL_TAG)" \
			--type oci \
			--package-id "$${IMAGE}:$(LOCAL_TAG)" || \
			echo "    Skipped local"; \
	done
	@echo "==> Done."

# ---------------------------------------------------------------------------
# Database backup / restore
# ---------------------------------------------------------------------------
BACKUP_DIR := .backups
DB_SOURCE  := $(DATA_DIR)/jarvis/jarvis.db

BACKEND_POD = $(shell kubectl get pod -n jarvis -l app=jarvis-backend -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
DB_POD_PATH = /data/jarvis.db

## Auto-backup before destructive operations — silently skips if no pod is available
_db-backup-safe:
	@if [ -n "$(BACKEND_POD)" ]; then \
		$(MAKE) db-backup || echo "  WARNING: Auto-backup failed, continuing anyway."; \
	else \
		echo "  (No backend pod found — skipping auto-backup)"; \
	fi

## Backup the JARVIS SQLite database from the running pod to .backups/
## Uses sqlite3 .backup inside the pod for a consistent snapshot
db-backup:
	@mkdir -p $(BACKUP_DIR)
	$(eval TS := $(shell date +%Y%m%d-%H%M%S))
	@if [ -z "$(BACKEND_POD)" ]; then \
		echo "ERROR: No backend pod found. Is the cluster running?"; exit 1; \
	fi
	@echo "==> Creating consistent backup inside pod $(BACKEND_POD)..."
	kubectl exec -n jarvis $(BACKEND_POD) -- python -c "import sqlite3; src=sqlite3.connect('$(DB_POD_PATH)'); dst=sqlite3.connect('/tmp/jarvis-backup.db'); src.backup(dst); dst.close(); src.close()"
	@echo "==> Copying backup to local..."
	kubectl cp jarvis/$(BACKEND_POD):/tmp/jarvis-backup.db $(BACKUP_DIR)/jarvis-$(TS).db
	kubectl exec -n jarvis $(BACKEND_POD) -- rm -f /tmp/jarvis-backup.db
	@echo "  Saved to $(BACKUP_DIR)/jarvis-$(TS).db ($$(du -h $(BACKUP_DIR)/jarvis-$(TS).db | cut -f1))"
	@echo "  Backups:"
	@ls -lh $(BACKUP_DIR)/jarvis-*.db 2>/dev/null

## Restore the JARVIS SQLite database from a local backup into the running pod
## Usage: make db-restore              (restores latest backup)
##        make db-restore BACKUP=.backups/jarvis-20260408-001500.db
db-restore:
	@if [ -n "$(BACKUP)" ]; then \
		RESTORE_FILE="$(BACKUP)"; \
	else \
		RESTORE_FILE=$$(ls -t $(BACKUP_DIR)/jarvis-*.db 2>/dev/null | head -1); \
	fi; \
	if [ -z "$$RESTORE_FILE" ] || [ ! -f "$$RESTORE_FILE" ]; then \
		echo "ERROR: No backup found. Run 'make db-backup' first or specify BACKUP=path"; exit 1; \
	fi; \
	if [ -z "$(BACKEND_POD)" ]; then \
		echo "ERROR: No backend pod found. Is the cluster running?"; exit 1; \
	fi; \
	echo "==> Uploading $$RESTORE_FILE to pod $(BACKEND_POD)..."; \
	kubectl cp "$$RESTORE_FILE" jarvis/$(BACKEND_POD):/tmp/jarvis-restore.db; \
	echo "==> Replacing database inside pod..."; \
	kubectl exec -n jarvis $(BACKEND_POD) -- sh -c "cp /tmp/jarvis-restore.db $(DB_POD_PATH) && rm -f $(DB_POD_PATH)-shm $(DB_POD_PATH)-wal /tmp/jarvis-restore.db"; \
	echo "  Database replaced."
	@echo "==> Restarting backend pod to pick up changes..."
	@kubectl rollout restart deployment jarvis-backend -n jarvis && \
		kubectl rollout status deployment/jarvis-backend -n jarvis --timeout=60s && \
		echo "  Backend restarted. Restore complete."

# ---------------------------------------------------------------------------
# Worker
# ---------------------------------------------------------------------------

## (no-op) Placeholder for worker IDE setup — VSCode attaches via Kubernetes Dev Containers extension
setup-worker-ssh:
	@echo "==> VSCode connects to worker pods via Kubernetes Dev Containers extension."
	@echo "    Install: ms-vscode-remote.remote-containers + ms-kubernetes-tools.vscode-kubernetes-tools"
	@echo "    Usage:   Click the VSCode icon on a task card, or use Command Palette > 'Kubernetes: Attach Visual Studio Code'"

## Build the worker Docker image
build-worker:
	$(eval LOCAL_TAG := $(shell git rev-parse --short HEAD))
	@echo "==> Building worker Docker image (tag: $(LOCAL_TAG))..."
	docker build -t jarvis-worker:$(LOCAL_TAG) ./worker
	@echo "==> Worker image built: jarvis-worker:$(LOCAL_TAG)"

## Sync Claude config files from host to the jarvis-claude-config ConfigMap
sync-claude-config: _check-prereqs
	@echo "==> Syncing Claude config to jarvis-claude-config ConfigMap..."
	kubectl create configmap jarvis-claude-config -n jarvis \
		--from-file=policy-limits.json=$(HOME)/.claude/policy-limits.json \
		--from-file=remote-settings.json=$(HOME)/.claude/remote-settings.json \
		--from-file=claude.json=$(HOME)/.claude.json \
		--from-file=settings.json=$(HOME)/.claude/settings.json \
		--dry-run=client -o yaml | kubectl apply -f -
	@echo "==> ConfigMap updated. Note: running workers need restart to pick up changes."

## Auto-sync Claude config during deploy — skips silently if files are missing
_sync-claude-config:
	@if [ -f "$(HOME)/.claude/settings.json" ] && [ -f "$(HOME)/.claude.json" ]; then \
		echo "==> Syncing Claude config to jarvis-claude-config ConfigMap..."; \
		ARGS=""; \
		[ -f "$(HOME)/.claude/policy-limits.json" ] && ARGS="$$ARGS --from-file=policy-limits.json=$(HOME)/.claude/policy-limits.json"; \
		[ -f "$(HOME)/.claude/remote-settings.json" ] && ARGS="$$ARGS --from-file=remote-settings.json=$(HOME)/.claude/remote-settings.json"; \
		[ -f "$(HOME)/.claude.json" ] && ARGS="$$ARGS --from-file=claude.json=$(HOME)/.claude.json"; \
		[ -f "$(HOME)/.claude/settings.json" ] && ARGS="$$ARGS --from-file=settings.json=$(HOME)/.claude/settings.json"; \
		kubectl create namespace jarvis --dry-run=client -o yaml | kubectl apply -f - 2>/dev/null; \
		kubectl create configmap jarvis-claude-config -n jarvis $$ARGS --dry-run=client -o yaml | kubectl apply -f -; \
	else \
		echo "==> No Claude config files found at ~/.claude/ — skipping ConfigMap sync."; \
		echo "    Run 'make sync-claude-config' manually after setting up Claude Code."; \
	fi

# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------
test-backend:
	cd backend && uv run pytest tests/ -v

test-frontend:
	cd frontend/packages/jads && npm test

test-e2e:
	cd frontend && npx playwright test --config e2e/playwright.config.ts

test-mcp:
	cd artifacts/servers/jarvis && uv run pytest tests/ -v
