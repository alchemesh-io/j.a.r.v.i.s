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
MOUNT_PID_FILE  := .minikube-mount.pid
REPO_ROOT       := $(shell pwd)
MOUNT_TARGET    := /mnt/jarvis-repo
GHCR_ORG        := alchemesh-io


.PHONY: cluster-up cluster-down cluster-status deploy undeploy deploy-local argocd-ui jarvis-ui sync test-backend test-frontend test-e2e test-mcp _check-prereqs _mount-start _istio-install _argocd-install _argocd-patch-repo-server _argocd-add-repo _deploy-secrets _deploy-jaar-secrets _helm-dep-update

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

## Stop the Minikube cluster and clean up background processes
cluster-down: _check-prereqs
	@echo "==> Stopping minikube mount process..."
	@if [ -f $(MOUNT_PID_FILE) ]; then \
		PID=$$(cat $(MOUNT_PID_FILE)); \
		if kill -0 $$PID 2>/dev/null; then \
			kill $$PID && echo "  Killed mount PID $$PID"; \
		else \
			echo "  Mount process $$PID not running (stale PID file)"; \
		fi; \
		rm -f $(MOUNT_PID_FILE); \
	else \
		echo "  No PID file found, skipping."; \
	fi
	@echo "==> Deleting Minikube cluster..."
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
	@echo "==> minikube mount process:"
	@if [ -f $(MOUNT_PID_FILE) ]; then \
		PID=$$(cat $(MOUNT_PID_FILE)); \
		if kill -0 $$PID 2>/dev/null; then \
			echo "  Running (PID $$PID)"; \
		else \
			echo "  NOT running (stale PID $$PID)"; \
		fi; \
	else \
		echo "  Not started (no PID file)"; \
	fi

# ---------------------------------------------------------------------------
# Application deployment
# ---------------------------------------------------------------------------

## Pull latest published images from GHCR, load into Minikube, apply ArgoCD App CRs, hard sync
deploy: _check-prereqs _deploy-secrets _deploy-jaar-secrets _helm-dep-update
	@echo "==> Pulling latest images from GHCR..."
	docker pull ghcr.io/$(GHCR_ORG)/jarvis-backend:latest
	docker pull ghcr.io/$(GHCR_ORG)/jarvis-frontend:latest
	docker pull ghcr.io/$(GHCR_ORG)/jarvis-mcp:latest
	@echo "==> Loading images into Minikube..."
	minikube image load ghcr.io/$(GHCR_ORG)/jarvis-backend:latest
	minikube image load ghcr.io/$(GHCR_ORG)/jarvis-frontend:latest
	minikube image load ghcr.io/$(GHCR_ORG)/jarvis-mcp:latest
	@echo "==> Applying ArgoCD Application CRs (GHCR images)..."
	kubectl apply -f argocd/jarvis-app.yaml
	kubectl apply -f argocd/jaar-app.yaml
	@$(MAKE) sync
	@echo "==> Deployment complete. Run 'make argocd-ui' to monitor sync status."
	@echo "==> Access via Istio ingress gateway:"
	@echo "    minikube tunnel  (in a separate terminal)"
	@echo "    kubectl get svc istio-ingressgateway -n istio-system"

## Build images locally, load into Minikube, apply ArgoCD App CRs, hard sync
deploy-local: _check-prereqs _deploy-secrets _deploy-jaar-secrets _helm-dep-update
	$(eval LOCAL_TAG := $(shell git rev-parse --short HEAD))
	@echo "==> Building Docker images locally (tag: $(LOCAL_TAG))..."
	docker build -t jarvis-backend:$(LOCAL_TAG) ./backend
	docker build -t jarvis-frontend:$(LOCAL_TAG) ./frontend
	docker build -t jarvis-mcp:$(LOCAL_TAG) ./artifacts/servers/jarvis-mcp
	@echo "==> Loading images into Minikube..."
	minikube image load jarvis-backend:$(LOCAL_TAG)
	minikube image load jarvis-frontend:$(LOCAL_TAG)
	minikube image load jarvis-mcp:$(LOCAL_TAG)
	@echo "==> Applying ArgoCD Application CRs (local images, tag: $(LOCAL_TAG))..."
	@sed 's/tag: local/tag: "$(LOCAL_TAG)"/g' argocd/jarvis-app-local.yaml | kubectl apply -f -
	kubectl apply -f argocd/jaar-app-local.yaml
	@$(MAKE) sync
	@echo "==> Deployment complete. Run 'make argocd-ui' to monitor sync status."
	@echo "==> Access via Istio ingress gateway:"
	@echo "    minikube tunnel  (in a separate terminal)"
	@echo "    kubectl get svc istio-ingressgateway -n istio-system"

## Delete the ArgoCD Application CRs (cascade deletes all managed resources)
undeploy: _check-prereqs
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
	@echo "    http://jaar.jarvis.io    (Agent Registry)"
	@echo "    http://jaac.jarvis.io  (ArgoCD)"
	@echo ""
	@echo "==> Ensure /etc/hosts contains:"
	@echo "    <GATEWAY-IP>  main.jarvis.io jaar.jarvis.io jaac.jarvis.io"
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

_mount-start:
	@echo "==> Starting minikube mount $(REPO_ROOT) -> $(MOUNT_TARGET)..."
	@if [ -f $(MOUNT_PID_FILE) ]; then \
		PID=$$(cat $(MOUNT_PID_FILE)); \
		if kill -0 $$PID 2>/dev/null; then \
			echo "  Mount already running (PID $$PID), skipping."; \
			exit 0; \
		fi; \
	fi
	minikube mount $(REPO_ROOT):$(MOUNT_TARGET) &
	echo $$! > $(MOUNT_PID_FILE)
	@echo "  Mount started (PID $$(cat $(MOUNT_PID_FILE)))"
	@sleep 2

_istio-install:
	@echo "==> Deploying Istio + Gateway API CRDs via ArgoCD..."
	kubectl apply -f argocd/istio-app.yaml
	@echo "==> Waiting for Istio to sync and become healthy (timeout 5m)..."
	@kubectl wait --for=jsonpath='{.status.health.status}'=Healthy application/istio -n argocd --timeout=300s 2>/dev/null || \
		echo "  (Waiting for Istio sync — may take a moment on first deploy)"
	@echo "==> Labeling jarvis and jaar namespaces for Istio sidecar injection..."
	kubectl create namespace jarvis --dry-run=client -o yaml | kubectl apply -f -
	kubectl label namespace jarvis istio-injection=enabled --overwrite
	kubectl create namespace jaar --dry-run=client -o yaml | kubectl apply -f -
	kubectl label namespace jaar istio-injection=enabled --overwrite

_argocd-install:
	@echo "==> Installing ArgoCD $(ARGOCD_VERSION)..."
	kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -
	kubectl apply -n argocd --server-side --force-conflicts -f https://raw.githubusercontent.com/argoproj/argo-cd/$(ARGOCD_VERSION)/manifests/install.yaml
	@echo "==> Waiting for ArgoCD to be Ready (timeout 5m)..."
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
# Tests
# ---------------------------------------------------------------------------
test-backend:
	cd backend && uv run pytest tests/ -v

test-frontend:
	cd frontend/packages/jads && npm test

test-e2e:
	cd frontend && npx playwright test --config e2e/playwright.config.ts

test-mcp:
	cd artifacts/servers/jarvis-mcp && uv run pytest tests/ -v
