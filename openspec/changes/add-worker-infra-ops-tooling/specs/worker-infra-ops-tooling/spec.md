## ADDED Requirements

### Requirement: Worker image ships Kubernetes and container tooling via apk
The worker image SHALL install `kubectl`, `helm`, `k9s`, `kubectx` (which SHALL provide both `kubectx` and `kubens` binaries), `crane`, `yq-go`, and `github-cli` (providing the `gh` binary) as Alpine `apk` packages, not as hand-pinned binaries, since Alpine packages all of these for the base image's Alpine version.

#### Scenario: Kubernetes/container CLIs are present and runnable
- **WHEN** a shell is opened in a built worker image
- **THEN** `kubectl version --client`, `helm version`, `k9s version`, `kubectx --help`, `kubens --help`, `crane version`, `yq --version`, and `gh --version` all exit `0`

#### Scenario: Exactly one kubectl binary exists
- **WHEN** the worker image is built
- **THEN** `kubectl` on `PATH` resolves to the `apk`-installed binary, and no other install step (gcloud components or a separate download) also installs a `kubectl` binary

### Requirement: Worker image ships terraform and TFE tooling from HashiCorp's official releases
The worker image SHALL install `terraform` and `tfctl` as pinned binaries downloaded from `releases.hashicorp.com`, verified against HashiCorp's published checksums, since neither is packaged for Alpine.

#### Scenario: Terraform tooling is present and runnable
- **WHEN** a shell is opened in a built worker image
- **THEN** `terraform version` and `tfctl version` both exit `0`

### Requirement: Worker image ships argocd, tflint, and terraform-docs as pinned GitHub-release binaries
The worker image SHALL install `argocd` (CLI), `tflint`, and `terraform-docs` as pinned per-architecture binaries downloaded from their GitHub releases, verified against each project's published checksums, since none is packaged for Alpine.

#### Scenario: argocd/tflint/terraform-docs are present and runnable
- **WHEN** a shell is opened in a built worker image
- **THEN** `argocd version --client`, `tflint --version`, and `terraform-docs --version` all exit `0`

### Requirement: Worker image ships ggshield via pip
The worker image SHALL install `ggshield` via `pip` (PyPI package), since `py3-pip` is already present and Alpine does not package `ggshield`.

#### Scenario: ggshield is present and runnable
- **WHEN** a shell is opened in a built worker image
- **THEN** `ggshield --version` exits `0`

### Requirement: Worker image ships Datadog's pup as a pinned binary, never via apk
The worker image SHALL install Datadog's `pup` CLI as a pinned per-architecture binary downloaded from the `DataDog/pup` GitHub releases. The worker image build SHALL NOT install the Alpine `apk` package named `pup`, since that package is an unrelated HTML/XML processor and would silently shadow the intended binary.

#### Scenario: Datadog pup is present and is the correct binary
- **WHEN** a shell is opened in a built worker image
- **THEN** `pup --version` reports the Datadog `pup` CLI's version output, not an HTML-processing tool's usage text

#### Scenario: The Dockerfile never apk-installs the colliding package
- **WHEN** the worker Dockerfile's apk install list is inspected
- **THEN** it does not contain a bare `pup` package

### Requirement: Worker image ships gcloud core, alpha, and beta components without credentials
The worker image SHALL install the Google Cloud SDK (core) from Google's official Linux tarball, then run `gcloud components install alpha beta -q`. The image SHALL NOT bake in any GCP credential, service-account key, or default project — `gcloud` starts unauthenticated in every worker pod.

#### Scenario: gcloud and its alpha/beta components are present
- **WHEN** a shell is opened in a built worker image
- **THEN** `gcloud version` exits `0` and lists `alpha` and `beta` among installed components

#### Scenario: gcloud has no baked-in credentials
- **WHEN** a shell is opened in a built worker image
- **THEN** `gcloud auth list` reports no active or available accounts

### Requirement: jarvis-jaw-secret supports TFE and Datadog app credentials
`backend/app/services/k8s.py` SHALL wire three additional optional environment variables onto the worker pod, sourced from the `jarvis-jaw-secret` Secret via `V1EnvVarSource`/`V1SecretKeySelector` with `optional=True`, following the same pattern as the existing `GITHUB_TOKEN` wiring: `TFE_TOKEN`, `DD_APP_KEY`, `DD_SITE`.

#### Scenario: Secret present
- **WHEN** `jarvis-jaw-secret` contains a `TFE_TOKEN` key
- **THEN** the worker pod's `TFE_TOKEN` environment variable is populated from it

#### Scenario: Secret absent
- **WHEN** `jarvis-jaw-secret` does not contain a `DD_APP_KEY` or `DD_SITE` key
- **THEN** worker pod creation still succeeds, with those environment variables simply unset (per `optional=True`)

### Requirement: jaw-secret.example.yaml documents all optional worker credentials
`secrets/jaw-secret.example.yaml` SHALL document, as commented-out fields with base64-encoding instructions, every optional credential the worker pod accepts: the pre-existing `DD_API_KEY` (currently wired in code but undocumented) plus the new `TFE_TOKEN`, `DD_APP_KEY`, and `DD_SITE`.

#### Scenario: Example file lists DD_API_KEY
- **WHEN** `secrets/jaw-secret.example.yaml` is read
- **THEN** it contains a commented `DD_API_KEY` field with base64 encoding instructions

#### Scenario: Example file lists the three new fields
- **WHEN** `secrets/jaw-secret.example.yaml` is read
- **THEN** it contains commented `TFE_TOKEN`, `DD_APP_KEY`, and `DD_SITE` fields, each with base64 encoding instructions

### Requirement: entrypoint.sh writes Terraform Enterprise credentials on boot when present
When the `TFE_TOKEN` environment variable is non-empty, `worker/entrypoint.sh` SHALL write `~/.terraform.d/credentials.tfrc.json` on every boot (fresh or resumed) with the standard Terraform CLI credentials format, keyed to host `tfe.doctolib.net`. When `TFE_TOKEN` is empty, no such file is written.

#### Scenario: TFE_TOKEN present
- **WHEN** the worker pod starts with `TFE_TOKEN` set to a non-empty value
- **THEN** `~/.terraform.d/credentials.tfrc.json` exists and contains `{"credentials": {"tfe.doctolib.net": {"token": "<TFE_TOKEN value>"}}}`

#### Scenario: TFE_TOKEN absent
- **WHEN** the worker pod starts with `TFE_TOKEN` unset or empty
- **THEN** `~/.terraform.d/credentials.tfrc.json` is not created

#### Scenario: Re-applied on every start
- **WHEN** a stateful worker with an existing PVC restarts and `TFE_TOKEN` is present
- **THEN** `~/.terraform.d/credentials.tfrc.json` is (re)written, consistent with how other ConfigMap/secret-sourced config files are re-applied on every start

### Requirement: Worker pods run under their own dedicated ServiceAccount, not the backend's
The worker pod SHALL run under a new, dedicated ServiceAccount (`{{ .Release.Name }}-worker`) rather than reusing `{{ .Release.Name }}-backend`. This new ServiceAccount SHALL have no RoleBinding by default, and the worker pod spec SHALL set `automount_service_account_token=False` unless a future capability explicitly requires in-cluster API access. The backend's own ServiceAccount, `worker-manager` Role, and RoleBinding (used for the backend to create/attach/exec/delete worker pods) SHALL remain unchanged.

#### Scenario: Worker pod has no cluster permissions by default
- **WHEN** a shell is opened in a running worker pod and `kubectl auth can-i --list` is run
- **THEN** it reports no permissions (no token mounted, or a token with zero bindings)

#### Scenario: Backend retains its own permissions
- **WHEN** the backend creates, attaches to, execs into, or deletes a worker pod via the K8s API
- **THEN** these operations continue to succeed exactly as before, since they use the backend's own pod identity and ServiceAccount, not the worker pod's

#### Scenario: Worker pod's ServiceAccount is distinct from the backend's
- **WHEN** a worker pod's spec is inspected
- **THEN** its `serviceAccountName` is `{{ .Release.Name }}-worker`, not `{{ .Release.Name }}-backend`
