## 1. Local Dev Cluster (Makefile + Minikube)

- [x] 1.1 Create `Makefile` at repo root with `cluster-up`, `cluster-down`, `cluster-status` targets
- [x] 1.2 Add prerequisite checks to Makefile (minikube, kubectl, docker; argocd CLI optional)
- [x] 1.3 Add `deploy` target (build images, load into Minikube, auto-commit to `local-deploy` branch, apply ArgoCD Application CR, trigger hard sync) and `undeploy` target (delete Application CR with cascade)
- [x] 1.4 Add `deploy-local` target that builds images, loads into Minikube via `minikube image load`, auto-commits to `local-deploy` branch, and triggers ArgoCD sync
- [x] 1.5 Document Minikube resource defaults (4 CPU, 8 GB RAM) and how to override them
- [x] 1.6 Add `minikube mount` lifecycle to `cluster-up` and `cluster-down` (start as background process, store PID in `.minikube-mount.pid`, kill on teardown)
- [x] 1.7 Add ArgoCD installation to `cluster-up` (apply official manifests pinned at `v3.19` to `argocd` namespace, wait for all ArgoCD pods Ready)
- [x] 1.8 Patch `argocd-repo-server` Deployment to add hostPath volume mounting `/mnt/jarvis-repo` (via `argocd/repo-server-patch.yaml`)
- [x] 1.9 Configure ArgoCD repository entry pointing to `file:///mnt/jarvis-repo` (via `kubectl` or `argocd` CLI in `cluster-up`)
- [x] 1.10 Create `argocd/jarvis-app.yaml` ArgoCD Application CR (repoURL: `file:///mnt/jarvis-repo`, path: `helm/jarvis`, targetRevision: `local-deploy`, syncPolicy: automated with prune + selfHeal)
- [x] 1.11 Add `make argocd-ui` target that runs `kubectl port-forward svc/argocd-server -n argocd 8080:443` and prints the initial admin password
- [x] 1.12 Add `make sync` target that triggers `argocd app sync jarvis` (or `kubectl` equivalent if CLI not available)
- [x] 1.13 Implement auto-commit logic in `make deploy`: stage chart changes, commit to `local-deploy` branch (creating it if absent), return to original branch

## 2. Python Backend

- [x] 2.1 Initialise `backend/` directory with `pyproject.toml` (or `requirements.txt`) — FastAPI, SQLAlchemy, uvicorn
- [x] 2.2 Create `backend/app/main.py` with FastAPI app, `GET /` and `GET /health` endpoints
- [x] 2.3 Configure SQLAlchemy to use the `DATABASE_URL` environment variable (SQLite default)
- [x] 2.4 Create `backend/Dockerfile` (multi-stage, non-root user, port 8000)
- [x] 2.5 Verify `docker build` and `docker run` work locally; health check returns `{"status": "ok"}`

## 3. Vite.js Frontend

- [x] 3.1 Scaffold `frontend/` with `npm create vite@8.0.2 -- --template react-ts`
- [x] 3.2 Implement futuristic dark-mode theme (dark background `#0a0e1a`, neon accents `#00d4ff` / `#7b2fff`)
- [x] 3.3 Verify WCAG 2.2 AA contrast ratios for body text (4.5:1) and large text/UI components (3:1)
- [x] 3.4 Add keyboard navigation support with visible focus indicators on all interactive elements
- [x] 3.5 Structure page with `<header>`, `<main>`, `<footer>` landmarks; set document title to "J.A.R.V.I.S"
- [x] 3.6 Create `frontend/Dockerfile` (multi-stage: build → Nginx), configure Nginx for SPA fallback routing
- [x] 3.7 Verify `docker build` and `docker run` work locally; frontend accessible on port 80

## 4. GitHub Actions CI/CD

- [x] 4.1 Create `.github/workflows/docker-publish.yml` triggered on push to `main`
- [x] 4.2 Add build-and-push step for `jarvis-backend` image using `GITHUB_TOKEN` to authenticate with GHCR
- [x] 4.3 Add build-and-push step for `jarvis-frontend` image using `GITHUB_TOKEN` to authenticate with GHCR
- [x] 4.4 Tag images with both the short git SHA and `latest`
- [x] 4.5 Ensure workflow fails fast if either Docker build exits non-zero

## 5. Helm Chart

- [x] 5.1 Scaffold `helm/jarvis/` chart with `Chart.yaml`, `values.yaml`, and template directory
- [x] 5.2 Create backend `Deployment` and `Service` templates; reference configurable image repo/tag from values
- [x] 5.3 Create frontend `Deployment` and `Service` (LoadBalancer) templates; reference configurable image repo/tag
- [x] 5.4 Create PersistentVolumeClaim template for SQLite storage; mount into backend pod at `/data`
- [x] 5.5 Configure backend `DATABASE_URL` env var in Deployment to point to the PVC mount path
- [x] 5.6 Add Kubernetes liveness and readiness probes to backend Deployment using `GET /health`
- [X] 5.7 Verify ArgoCD syncs the Application successfully on Minikube; verify chart modification + `make deploy` triggers re-sync without data loss; verify Application CR deletion removes all resources; confirm data survives pod restart

## 6. CLAUDE.md

- [x] 6.1 Create `CLAUDE.md` at repo root covering: project overview, repo structure, local dev workflow, coding conventions, and known limitations (SQLite single-writer, pinned Vite version)
