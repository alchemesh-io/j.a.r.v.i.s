# Delta: local-dev-cluster

## MODIFIED Requirements

### Requirement: Makefile provisions Minikube cluster with Istio and ArgoCD

The system SHALL provide a `Makefile` at the repository root that manages the full lifecycle of a local Minikube-based Kubernetes cluster, including Istio service mesh installation, ArgoCD installation, and the `minikube mount` background processes. The repo mount (`/mnt/jarvis-repo`) SHALL be required only for local-source deployment (`deploy-local` and the `-local` Application CRs); the data mount (`.data/` → `/mnt/jarvis-data`) SHALL be required only when `persistence.hostPath` is used.

#### Scenario: Cluster creation

- **WHEN** developer runs `make cluster-up`
- **THEN** a Minikube cluster is created, `minikube mount` is started, Istio + Gateway API CRDs are deployed via ArgoCD Application CR, the `jarvis` namespace is labeled for sidecar injection, ArgoCD is installed, the repo-server is patched, and a repository entry is configured

#### Scenario: Cluster teardown

- **WHEN** developer runs `make cluster-down`
- **THEN** the `minikube mount` background processes are killed, the PID files are removed, and the Minikube cluster is deleted

#### Scenario: Cluster status check

- **WHEN** developer runs `make cluster-status`
- **THEN** the current Minikube status, ArgoCD namespace pod status, and `minikube mount` process status are printed

### Requirement: Makefile deploys the application stack via ArgoCD

The Makefile SHALL provide targets to deploy and undeploy the full J.A.R.V.I.S application stack. `make deploy` SHALL apply the Git-sourced Application CRs and SHALL NOT depend on the repo mount being alive; `make deploy-local` SHALL apply the mount-sourced local CRs (`targetRevision: HEAD`).

#### Scenario: Remote image deployment

- **WHEN** developer runs `make deploy`
- **THEN** GHCR images are pulled, loaded into Minikube, the Git-sourced ArgoCD Application CR is applied, and a hard sync is triggered — with no dependency on the `/mnt/jarvis-repo` mount

#### Scenario: Local image deployment

- **WHEN** developer runs `make deploy-local`
- **THEN** Docker images are built with a git-SHA tag, loaded into Minikube, the local ArgoCD Application CR (with image overrides) is applied via sed, and a hard sync is triggered

#### Scenario: Stack removal

- **WHEN** developer runs `make undeploy`
- **THEN** the ArgoCD Application CR is deleted with cascade finalizers
