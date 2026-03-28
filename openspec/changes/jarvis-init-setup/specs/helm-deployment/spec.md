## ADDED Requirements

### Requirement: ArgoCD Application CR deploys the full J.A.R.V.I.S stack
The system SHALL provide an ArgoCD `Application` manifest at `argocd/jarvis-app.yaml` that deploys the Helm chart at `helm/jarvis/` onto the Minikube cluster. The Application SHALL use `repoURL: file:///mnt/jarvis-repo`, `path: helm/jarvis`, and `targetRevision: local-deploy`, with automated sync policy (prune and selfHeal enabled).

#### Scenario: Application syncs successfully on Minikube
- **WHEN** ArgoCD syncs the Application CR against a running Minikube cluster
- **THEN** the release is created, all pods reach `Running` state, and both services are accessible

#### Scenario: Chart upgrade via re-deploy
- **WHEN** developer modifies `helm/jarvis/` and runs `make deploy` (which auto-commits to `local-deploy` and triggers a hard sync)
- **THEN** ArgoCD reconciles the updated chart without data loss and all pods return to `Running` state

#### Scenario: Application uninstalled via CR deletion
- **WHEN** the ArgoCD Application CR is deleted (e.g., via `make undeploy`)
- **THEN** all Kubernetes resources created by the chart are removed via cascade finalizer

### Requirement: SQLite data persisted via PersistentVolumeClaim
The Helm chart SHALL create a PersistentVolumeClaim for SQLite storage and mount it into the backend pod.

#### Scenario: PVC provisioned on sync
- **WHEN** ArgoCD syncs the chart on a cluster with a default StorageClass
- **THEN** a PVC is created and bound, and the backend pod mounts it at `/data`

#### Scenario: Data survives pod restart
- **WHEN** the backend pod is deleted and rescheduled
- **THEN** the SQLite database file at `/data/jarvis.db` is intact and no data is lost

### Requirement: Configurable image references and replica counts
The Helm chart SHALL expose image repository, tag, and replica count as configurable `values.yaml` parameters, overridable via the ArgoCD Application CR's `spec.source.helm.parameters`.

#### Scenario: Override image tag via Application CR
- **WHEN** the ArgoCD Application CR sets `spec.source.helm.parameters` with `name: backend.image.tag, value: abc1234`
- **THEN** the backend Deployment uses the image tag `abc1234` after sync

#### Scenario: Default values work without overrides
- **WHEN** the Application CR specifies no Helm parameter overrides
- **THEN** ArgoCD uses the default values from `values.yaml` and the cluster reaches a healthy state

### Requirement: Services exposed via LoadBalancer with local port on Minikube
The Helm chart SHALL expose both the frontend and backend via `LoadBalancer` Services. On Minikube, `minikube tunnel` SHALL assign a local IP and port so both services are reachable directly from the developer's machine.

#### Scenario: Frontend accessible on a local port after minikube tunnel
- **WHEN** `minikube tunnel` is running and the Application has been synced
- **THEN** the frontend Service receives an `EXTERNAL-IP` and is accessible at `http://<external-ip>:80` in a browser

#### Scenario: Backend accessible on a local port after minikube tunnel
- **WHEN** `minikube tunnel` is running and the Application has been synced
- **THEN** the backend Service receives an `EXTERNAL-IP` and is accessible at `http://<external-ip>:8000` from the developer's machine

#### Scenario: Service type configurable via values
- **WHEN** the ArgoCD Application CR sets `spec.source.helm.parameters` with `name: frontend.service.type, value: ClusterIP`
- **THEN** the frontend Service is created with type `ClusterIP` instead of `LoadBalancer`
