# Spec: local-dev-cluster

## Purpose

Defines the requirements for the Makefile-driven local development cluster lifecycle, including Minikube provisioning, Istio installation, ArgoCD setup, application deployment targets, and local dev mode.

## Requirements

### Requirement: Makefile provisions Minikube cluster with Istio and ArgoCD
The system SHALL provide a `Makefile` at the repository root that manages the full lifecycle of a local Minikube-based Kubernetes cluster, including Istio service mesh installation, ArgoCD installation, and the `minikube mount` background process.

#### Scenario: Cluster creation
- **WHEN** developer runs `make cluster-up`
- **THEN** a Minikube cluster is created, `minikube mount` is started, Istio + Gateway API CRDs are deployed via ArgoCD Application CR, the `jarvis` namespace is labeled for sidecar injection, ArgoCD is installed, the repo-server is patched, and a repository entry is configured

#### Scenario: Cluster teardown
- **WHEN** developer runs `make cluster-down`
- **THEN** the `minikube mount` background process is killed, the PID file is removed, and the Minikube cluster is deleted

#### Scenario: Cluster status check
- **WHEN** developer runs `make cluster-status`
- **THEN** the current Minikube status, ArgoCD namespace pod status, and `minikube mount` process status are printed

### Requirement: Makefile deploys the application stack via ArgoCD
The Makefile SHALL provide targets to deploy and undeploy the full J.A.R.V.I.S application stack. ArgoCD Application CRs target `HEAD` — no `local-deploy` branch needed.

#### Scenario: Remote image deployment
- **WHEN** developer runs `make deploy`
- **THEN** GHCR images are pulled, loaded into Minikube, the default ArgoCD Application CR is applied, and a hard sync is triggered

#### Scenario: Local image deployment
- **WHEN** developer runs `make deploy-local`
- **THEN** Docker images are built with a git-SHA tag, loaded into Minikube, the local ArgoCD Application CR (with image overrides) is applied via sed, and a hard sync is triggered

#### Scenario: Stack removal
- **WHEN** developer runs `make undeploy`
- **THEN** the ArgoCD Application CR is deleted with cascade finalizers

### Requirement: Local dev mode without Docker
The Makefile SHALL provide targets to run frontend and backend locally without Docker, with the frontend proxying API requests to either a local backend or the Minikube backend.

#### Scenario: Full local dev
- **WHEN** developer runs `make dev-backend` and `make dev-frontend` in separate terminals
- **THEN** the backend runs on port 8000, the frontend dev server runs on port 5173 and proxies `/api` to `localhost:8000`

#### Scenario: Frontend with Minikube backend
- **WHEN** developer runs `make dev-frontend-minikube`
- **THEN** the frontend dev server proxies `/api` to the Istio ingress gateway IP on Minikube

### Requirement: Makefile prerequisite check
The Makefile SHALL verify that required tools are installed before executing any target.

#### Scenario: Missing prerequisite
- **WHEN** a required tool (`minikube`, `kubectl`, `docker`) is not found on PATH
- **THEN** the Makefile prints a clear error message naming the missing tool and exits non-zero

### Requirement: ArgoCD dashboard accessible to developer
The Makefile SHALL provide a target to access the ArgoCD web UI and retrieve credentials.

#### Scenario: ArgoCD UI accessible
- **WHEN** developer runs `make argocd-ui`
- **THEN** `kubectl port-forward` is started for the ArgoCD server on local port 8080, and the initial admin password is printed
