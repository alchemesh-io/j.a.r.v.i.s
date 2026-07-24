# Delta: helm-deployment

## MODIFIED Requirements

### Requirement: ArgoCD Application CR deploys the full J.A.R.V.I.S stack

The system SHALL provide ArgoCD `Application` manifests: `argocd/jarvis-app.yaml` (GHCR images) and `argocd/jarvis-app-local.yaml` (local images with overrides) for the JARVIS stack. Additionally, the system SHALL provide `argocd/jaar-app.yaml` and `argocd/jaar-app-local.yaml` for the JAAR (AgentRegistry) stack. The GHCR variants (`jarvis-app.yaml`, `jaar-app.yaml`) SHALL source their Helm charts from the project's Git repository URL with `targetRevision: main`, requiring no filesystem mount. The `-local` variants SHALL source from `file:///mnt/jarvis-repo` with `targetRevision: HEAD` for the minikube-mount inner loop. All Application CRs SHALL use automated sync policy.

#### Scenario: Application syncs successfully on Minikube

- **WHEN** ArgoCD syncs the JARVIS and JAAR Application CRs against a running Minikube cluster
- **THEN** both releases are created, all pods reach `Running` state, and services are accessible via the Istio ingress gateway

#### Scenario: GHCR variant syncs without the repo mount

- **WHEN** the `minikube mount` process for `/mnt/jarvis-repo` is not running and `argocd/jarvis-app.yaml` is applied
- **THEN** ArgoCD syncs the chart from the Git repository URL and the deployment succeeds

#### Scenario: Local deployment uses image overrides

- **WHEN** `make deploy-local` applies the local Application CRs
- **THEN** image repositories are overridden to `jarvis-*` and `jaar-*` with git-SHA tags and `pullPolicy: Never`, sourced from `file:///mnt/jarvis-repo` at `HEAD`

#### Scenario: Application uninstalled via CR deletion

- **WHEN** the ArgoCD Application CRs are deleted (e.g., via `make undeploy`)
- **THEN** all Kubernetes resources created by both charts are removed via cascade finalizer

## ADDED Requirements

### Requirement: Worker resources flow from Helm values to the backend

The chart SHALL pass `worker.resources` (requests/limits for CPU and memory) to the backend via the backend ConfigMap so worker pods are created with chart-configured resources. `k8s.py` SHALL NOT hardcode resource quantities.

#### Scenario: Chart-configured worker resources

- **WHEN** the chart sets `worker.resources.limits.memory: 2Gi` and the backend creates a worker pod
- **THEN** the pod's `worker` container carries a 2Gi memory limit

### Requirement: Per-environment storage configuration

SQLite and worker PVC storage SHALL be configurable per environment through values: `persistence.storageClass` / `worker.persistence.storageClass` for dynamically provisioned clusters, and `persistence.hostPath` as a local-only option that binds the SQLite PV to the minikube data mount. Remote deployments SHALL NOT require any hostPath.

#### Scenario: Remote cluster uses a storage class

- **WHEN** the chart is deployed with `persistence.hostPath` unset and a valid `storageClass`
- **THEN** SQLite and worker PVCs bind via dynamic provisioning with no hostPath PV created
