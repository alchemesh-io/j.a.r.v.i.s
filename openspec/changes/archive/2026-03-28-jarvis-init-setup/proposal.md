## Why

J.A.R.V.I.S needs a foundational setup to bootstrap local development: a working local Kubernetes environment, a Python backend, a Vite.js frontend, Docker image publishing pipelines, and a Helm chart for deployment — none of which exist yet. This is the first step to enable iterative development of the multi-agent personal assistant platform.

## What Changes

- Add a `Makefile` to provision and manage a local Minikube cluster for development
- Install ArgoCD on Minikube; configure it to sync from the local Helm chart via `minikube mount` and a `file://` git source, replacing manual `helm install/upgrade/uninstall`
- Initialize a Python backend application (FastAPI + SQLite)
- Initialize a Vite.js (v8.0.2) frontend application with a futuristic, WCAG-compliant UI theme
- Add GitHub Actions workflows to build and publish Docker images for both frontend and backend
- Create a Helm chart to deploy the full stack on Minikube (frontend, backend, SQLite with local persistence)
- Add an initial `CLAUDE.md` with project conventions and best practices

## Capabilities

### New Capabilities

- `local-dev-cluster`: Minikube-based local Kubernetes cluster with ArgoCD, provisioned via Makefile
- `backend-api`: Python backend application with SQLite database and REST API
- `frontend-app`: Vite.js frontend with futuristic WCAG-compliant UI theme
- `docker-publish`: GitHub Actions CI/CD workflows for building and publishing Docker images
- `helm-deployment`: Helm chart deploying the full stack on Minikube via ArgoCD, with persistent SQLite storage

### Modified Capabilities

<!-- None — this is the initial setup, no existing capabilities to modify -->

## Impact

- New root-level `Makefile` for cluster lifecycle management
- New `backend/` directory: Python app, Dockerfile, dependencies
- New `frontend/` directory: Vite.js app, Dockerfile, build config
- New `.github/workflows/` directory: image build and publish pipelines
- New `helm/` directory: Helm chart for Minikube deployment (applied by ArgoCD, not manually)
- New `argocd/` directory: ArgoCD Application CR and repo-server patch manifest
- New `CLAUDE.md` at repo root
- Dependencies: Python 3.12+, Node.js 22+, Minikube, Docker, kubectl. `helm` is no longer a user-facing prerequisite (ArgoCD renders Helm charts internally). `argocd` CLI is optional.
- ArgoCD installed in `argocd` namespace on Minikube; `minikube mount` background process managed by Makefile
