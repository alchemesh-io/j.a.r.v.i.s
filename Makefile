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
ORIGINAL_BRANCH := $(shell git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)
GHCR_ORG        := alchemesh-io

.PHONY: cluster-up cluster-down cluster-status deploy undeploy deploy-local argocd-ui sync test-backend test-frontend test-e2e test-mcp _check-prereqs _mount-start _argocd-install _argocd-patch-repo-server _argocd-add-repo

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

## Pull latest published images from GHCR, auto-commit to local-deploy, apply ArgoCD App CR, hard sync
deploy: _check-prereqs
	@echo "==> Pulling latest images from GHCR..."
	docker pull ghcr.io/$(GHCR_ORG)/jarvis-backend:latest
	docker pull ghcr.io/$(GHCR_ORG)/jarvis-frontend:latest
	docker pull ghcr.io/$(GHCR_ORG)/jarvis-mcp:latest
	@echo "==> Loading images into Minikube..."
	minikube image load ghcr.io/$(GHCR_ORG)/jarvis-backend:latest
	minikube image load ghcr.io/$(GHCR_ORG)/jarvis-frontend:latest
	minikube image load ghcr.io/$(GHCR_ORG)/jarvis-mcp:latest
	@$(MAKE) _auto-commit
	@echo "==> Applying ArgoCD Application CR..."
	kubectl apply -f argocd/jarvis-app.yaml
	@$(MAKE) sync
	@echo "==> Deployment complete. Run 'make argocd-ui' to monitor sync status."
	@echo "==> Run 'minikube tunnel' in a separate terminal, then check service IPs with:"
	@echo "    kubectl get svc -n jarvis"

## Build images locally, load into Minikube, auto-commit to local-deploy, apply ArgoCD App CR, hard sync
deploy-local: _check-prereqs
	@echo "==> Building Docker images locally..."
	docker build -t ghcr.io/$(GHCR_ORG)/jarvis-backend:latest ./backend
	docker build -t ghcr.io/$(GHCR_ORG)/jarvis-frontend:latest ./frontend
	docker build -t ghcr.io/$(GHCR_ORG)/jarvis-mcp:latest ./mcp_server
	@echo "==> Loading images into Minikube..."
	minikube image load ghcr.io/$(GHCR_ORG)/jarvis-backend:latest
	minikube image load ghcr.io/$(GHCR_ORG)/jarvis-frontend:latest
	minikube image load ghcr.io/$(GHCR_ORG)/jarvis-mcp:latest
	@$(MAKE) _auto-commit
	@echo "==> Applying ArgoCD Application CR..."
	kubectl apply -f argocd/jarvis-app.yaml
	@$(MAKE) sync
	@echo "==> Deployment complete. Run 'make argocd-ui' to monitor sync status."
	@echo "==> Run 'minikube tunnel' in a separate terminal, then check service IPs with:"
	@echo "    kubectl get svc -n jarvis"

## Delete the ArgoCD Application CR (cascade deletes all managed resources)
undeploy: _check-prereqs
	@echo "==> Deleting ArgoCD Application CR (cascade)..."
	kubectl delete -f argocd/jarvis-app.yaml --ignore-not-found=true
	@echo "==> Application undeployed."

# ---------------------------------------------------------------------------
# ArgoCD helpers
# ---------------------------------------------------------------------------

## Port-forward ArgoCD UI to localhost:8080 and print admin password
argocd-ui: _check-prereqs
	@echo "==> ArgoCD initial admin password:"
	@kubectl -n argocd get secret argocd-initial-admin-secret \
		-o jsonpath="{.data.password}" 2>/dev/null | base64 --decode && echo || \
		echo "  (Secret not found — password may have been changed)"
	@echo ""
	@echo "==> Starting port-forward: https://localhost:8080"
	@echo "    Username: admin"
	kubectl port-forward svc/argocd-server -n argocd 8080:443

## Trigger ArgoCD hard sync for the jarvis application
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
	@echo "==> Sync triggered."

# ---------------------------------------------------------------------------
# Internal helpers (not intended for direct use)
# ---------------------------------------------------------------------------

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

_auto-commit:
	@echo "==> Auto-committing Helm chart changes to 'local-deploy' branch..."
	@CURRENT_BRANCH=$$(git rev-parse --abbrev-ref HEAD); \
	if git show-ref --verify --quiet refs/heads/local-deploy; then \
		git checkout local-deploy; \
	else \
		git checkout -b local-deploy; \
	fi; \
	git add helm/ argocd/ 2>/dev/null || true; \
	if git diff --cached --quiet; then \
		echo "  No chart changes to commit."; \
	else \
		git commit -m "chore(deploy): auto-commit local deploy state [skip ci]"; \
		echo "  Committed chart changes to local-deploy."; \
	fi; \
	git checkout $$CURRENT_BRANCH

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
	cd mcp_server && uv run pytest tests/ -v
