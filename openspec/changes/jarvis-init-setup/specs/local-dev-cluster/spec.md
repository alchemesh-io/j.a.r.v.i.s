## ADDED Requirements

### Requirement: Makefile provisions Minikube cluster with ArgoCD
The system SHALL provide a `Makefile` at the repository root that manages the full lifecycle of a local Minikube-based Kubernetes cluster, including ArgoCD installation and the `minikube mount` background process.

#### Scenario: Cluster creation
- **WHEN** developer runs `make cluster-up`
- **THEN** a Minikube cluster is created with at least 4 CPUs and 8 GB RAM, ArgoCD `v3.3.6` is installed into the `argocd` namespace using its official install manifest, all ArgoCD pods reach `Ready` state, a `minikube mount` background process mounts the repo root at `/mnt/jarvis-repo` inside the VM (PID stored in `.minikube-mount.pid`), the `argocd-repo-server` Deployment is patched with a hostPath volume for `/mnt/jarvis-repo`, and an ArgoCD repository entry is configured for `file:///mnt/jarvis-repo`

#### Scenario: Cluster teardown
- **WHEN** developer runs `make cluster-down`
- **THEN** the `minikube mount` background process is killed (using `.minikube-mount.pid`), the PID file is removed, and the Minikube cluster is deleted along with all associated resources

#### Scenario: Cluster status check
- **WHEN** developer runs `make cluster-status`
- **THEN** the current Minikube status, ArgoCD namespace pod status, and `minikube mount` process status are printed to stdout

### Requirement: Makefile deploys the application stack via ArgoCD
The Makefile SHALL provide targets to deploy and undeploy the full J.A.R.V.I.S application stack by managing an ArgoCD Application CR.

#### Scenario: Full stack deployment
- **WHEN** developer runs `make deploy`
- **THEN** Docker images are built and loaded into Minikube, any Helm chart changes are auto-committed to the local `local-deploy` git branch, the ArgoCD Application CR is applied, a hard sync is triggered, and all application pods reach `Running` state within 3 minutes

#### Scenario: Stack removal
- **WHEN** developer runs `make undeploy`
- **THEN** the ArgoCD Application CR is deleted with cascade finalizers, all application pods and resources managed by the Application are terminated

#### Scenario: Re-sync after chart change
- **WHEN** developer modifies the Helm chart locally and runs `make deploy` or `make sync`
- **THEN** the changes are auto-committed to `local-deploy`, ArgoCD detects the new commit and reconciles the running Application to match the updated chart

### Requirement: Makefile prerequisite check
The Makefile SHALL verify that required tools are installed before executing any target.

#### Scenario: Missing prerequisite
- **WHEN** a required tool (`minikube`, `kubectl`, `docker`) is not found on PATH and a Makefile target is invoked
- **THEN** the Makefile prints a clear error message naming the missing tool and exits non-zero

### Requirement: ArgoCD dashboard accessible to developer
The Makefile SHALL provide a target to access the ArgoCD web UI and retrieve credentials.

#### Scenario: ArgoCD UI accessible
- **WHEN** developer runs `make argocd-ui`
- **THEN** `kubectl port-forward` is started for the ArgoCD server on local port 8080, and the initial admin password is printed to stdout
