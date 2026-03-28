## Context

J.A.R.V.I.S is a multi-agent personal assistant platform targeting a production Kubernetes deployment (vLLM, Dapr, kagent, etc.). Before any agent logic can be built, a local development environment and a deployable skeleton application are needed. Currently the repository contains no runnable code, no infrastructure config, and no CI/CD pipeline.

The long-term architecture calls for microservices, GPU-accelerated inference, and a service mesh — but this initial setup intentionally keeps things simple (monolith backend, SQLite) so the team can iterate fast.

## Goals / Non-Goals

**Goals:**
- Provision a reproducible local Kubernetes cluster via Minikube and a Makefile
- Bootstrap a Python (FastAPI) backend with SQLite persistence, packaged as a Docker image
- Bootstrap a Vite.js (v8.0.2) frontend with a futuristic, WCAG 2.2 AA-compliant UI, packaged as a Docker image
- Publish Docker images to GitHub Container Registry (GHCR) via GitHub Actions
- Deploy the full stack to Minikube using ArgoCD syncing from the local Helm chart, with SQLite data persisted via a PersistentVolumeClaim
- Provide a `CLAUDE.md` to orient contributors and Claude Code sessions

**Non-Goals:**
- Production Kubernetes deployment (vLLM, llm-d, GPU nodes, Dapr, kagent — all future work)
- Agent logic, LLM integration, or RAG pipelines
- Database migration tooling (no schema evolution at this stage)
- Multi-replica or high-availability configuration

## Decisions

### 1. Minikube over kind/k3s for local cluster

**Decision**: Use Minikube as the local Kubernetes distribution.

**Rationale**: Minikube has the best support for GPU passthrough (needed for future vLLM work), supports the full Gateway API, and is the most widely documented for local development. The Makefile abstracts the setup so it can be swapped later.

**Alternatives considered**: kind (lighter but limited GPU support), k3s (good for edge but less alignment with production EKS/GKE).

### 2. FastAPI + SQLite for backend

**Decision**: Use FastAPI with SQLAlchemy (sync) and SQLite as the database.

**Rationale**: FastAPI provides auto-generated OpenAPI docs, async support for future agent streaming, and a minimal footprint. SQLite requires no separate database pod and persists via a PVC in Kubernetes — appropriate for single-replica development. When the project scales, swapping to PostgreSQL only requires changing the SQLAlchemy connection string and the Helm chart.

**Alternatives considered**: Flask (less modern, no async), Django (too heavyweight for an API-only service), PostgreSQL now (premature complexity).

### 3. Vite.js v8.0.2 for frontend

**Decision**: Pin Vite.js at v8.0.2 as specified in the task.

**Rationale**: Vite offers near-instant HMR, native ESM, and a minimal config surface. The frontend is a React SPA served by Nginx in production.

**Alternatives considered**: Next.js (SSR not needed at this stage), Create React App (deprecated).

### 4. GitHub Container Registry (GHCR) for images

**Decision**: Publish Docker images to GHCR using `ghcr.io/alchemesh-io/jarvis-<service>:<sha>` tags (e.g., `ghcr.io/alchemesh-io/jarvis-backend`, `ghcr.io/alchemesh-io/jarvis-frontend`).

**Rationale**: GHCR is free for public repos, integrates natively with GitHub Actions, and supports OCI image manifests. No external registry credentials needed beyond `GITHUB_TOKEN`.

### 5. Helm chart with one PVC for SQLite, applied by ArgoCD

**Decision**: A single Helm chart at `helm/jarvis/` deploys both services. SQLite data is stored in a `PersistentVolumeClaim` mounted into the backend pod. The chart is applied by ArgoCD (not manually via `helm install`).

**Rationale**: Keeps deployment simple and co-located. The PVC uses the Minikube `standard` StorageClass, which provisions host-path volumes automatically. Delegating rendering to ArgoCD removes `helm` as a user-facing prerequisite.

### 6. ArgoCD for GitOps-style local deployment

**Decision**: Install ArgoCD on Minikube and use it to deploy and reconcile the J.A.R.V.I.S Helm chart, replacing manual `helm install/upgrade/uninstall`.

**Rationale**: ArgoCD provides declarative, GitOps-style deployment that mirrors the intended production architecture. Running ArgoCD locally gives the team familiarity with the tool before production use, and the ArgoCD UI gives instant visibility into sync status and diff. ArgoCD renders Helm charts internally, so developers never run `helm` commands directly.

**Alternatives considered**: Manual Helm (simpler but not GitOps), Flux (comparable but ArgoCD has a better local dev UI), direct `kubectl apply` (no Helm support).

### 7. Local chart access via minikube mount + file:// git source

**Decision**: Mount the repo root into the Minikube VM at `/mnt/jarvis-repo` via `minikube mount` (managed as a background process by the Makefile). Patch the `argocd-repo-server` Deployment with a hostPath volume so it can access the mount. Configure ArgoCD with `repoURL: file:///mnt/jarvis-repo`.

**Rationale**: Avoids running an in-cluster git server (e.g., Gitea). Avoids requiring a remote git push before deploying locally. The `minikube mount` process is started by `make cluster-up` and cleaned up by `make cluster-down`.

**Alternatives considered**: Gitea in-cluster (too heavy), pointing to GitHub remote (requires push before local test), ArgoCD repo-server direct filesystem plugin (breaks git model).

### 8. Auto-commit to throwaway local-deploy branch

**Decision**: `make deploy` automatically stages Helm chart changes and commits them to a local `local-deploy` branch before triggering an ArgoCD sync. The developer's working branch is unchanged after the operation.

**Rationale**: ArgoCD syncs from `HEAD` of a git branch, so uncommitted changes are invisible. Auto-committing to a throwaway branch avoids manual commit friction while keeping `main` clean. Developers never need to think about this — `make deploy` handles it transparently.

**Alternatives considered**: Require manual commit (too much friction), direct filesystem mount bypassing git (complex patching, breaks ArgoCD's diff model), auto-commit to main (pollutes history).

### 9. UI theme: futuristic dark with accessible contrast

**Decision**: Dark background (`#0a0e1a`), neon accent (`#00d4ff` / `#7b2fff`), sans-serif typography. All text/background pairs meet WCAG 2.2 AA (4.5:1 for body, 3:1 for large text).

**Rationale**: Matches the "Iron Man HUD" aesthetic referenced in the task image while keeping the interface usable for all users.

## Risks / Trade-offs

- **SQLite on Kubernetes is single-writer only** → Mitigation: acceptable at this stage; documented as a known limitation in `CLAUDE.md`. Future migration to PostgreSQL is planned.
- **Minikube resource usage on developer laptops** → Mitigation: Makefile sets sane defaults (4 CPU, 8GB RAM) and documents how to adjust. ArgoCD adds ~500MB overhead; resource requests can be tuned for local dev.
- **Pinned Vite.js v8.0.2 may lag security patches** → Mitigation: GitHub Actions Dependabot will flag upstream CVEs; version pin is intentional per task spec.
- **GHCR image tags use git SHA** → Mitigation: ArgoCD Application CR defaults to `latest` tag for local development; SHA tags used in CI for reproducibility.
- **`minikube mount` process must stay running** → Mitigation: `make cluster-status` checks the PID file; `make cluster-up` is idempotent and restarts the mount if the process is dead.
- **ArgoCD syncs from git, not live filesystem** → Mitigation: `make deploy` auto-commits chart changes to the `local-deploy` branch before triggering sync. Uncommitted changes that haven't gone through `make deploy` will not be live.
- **ArgoCD version drift** → Mitigation: The `cluster-up` Makefile target references a pinned ArgoCD version (`v3.19`), not the `stable` floating tag.

## Migration Plan

1. Run `make cluster-up` to create the Minikube cluster, install ArgoCD, start `minikube mount`, and configure the ArgoCD repository entry
2. Run `make deploy` to build images, load them into Minikube, auto-commit chart state to `local-deploy`, apply the ArgoCD Application CR, and trigger a hard sync
3. Optionally run `make argocd-ui` to open the ArgoCD dashboard and monitor sync status
4. Access the frontend via `minikube tunnel` + the LoadBalancer external IP (printed by `make deploy`)
5. Subsequent deploys: modify charts locally, run `make deploy` again — auto-commit + sync handles the rest
6. Rollback: `make cluster-down` tears down the entire cluster and kills the mount process; no persistent state outside the cluster

## Open Questions

- Should the frontend be served via Nginx or a Node.js server? (Decision: Nginx — simpler, production-grade)
- What GitHub org/repo path should GHCR images use? (Resolved: `ghcr.io/alchemesh-io/jarvis-<service>` — update in `.github/workflows` and Helm values)
