## Why

JARVIS worker pods currently run only Claude Code plus JAAR skill-fetch (`arctl`), but the platform they operate on is Kubernetes/Terraform/GitHub-centric. Tasks that need to inspect a cluster, drive a Terraform run, check a GitHub Action/PR, inspect a container image, or pull Datadog cost/telemetry data currently require a human to step outside the worker pod entirely. Equipping worker pods with a curated set of infra/ops CLIs — with credentials wired through the existing `jarvis-jaw-secret` optional-env-var pattern — lets a worker act as a general-purpose infra/ops agent for the platform it already runs inside, not just a code-editing agent.

## What Changes

- Add `gcloud` CLI (core + `alpha` + `beta` components) to the existing `docker:dind`-based worker image. This layers the `gcloud` binary onto the **current** base image via apk/official install script — it does **not** reintroduce the cloud-sdk base image switch that was reverted in commit `d7a763e`, and does not change the image's `FROM`.
- Add Kubernetes tooling: `kubectl`, `helm`, `k9s`, `kubectx`/`kubens`. Source (gcloud component vs. apk vs. pinned GitHub-release binary) and the identity/RBAC model `kubectl` runs under (worker pod's own in-cluster ServiceAccount vs. `gcloud container clusters get-credentials` external access) are open questions resolved in `design.md`, not silently defaulted.
- Add `terraform` CLI, `tfctl` (HashiCorp's HCP Terraform/Terraform Enterprise CLI), `gh` (GitHub CLI), `argocd` CLI, `yq`, `crane`, `ggshield`, `tflint`, `terraform-docs` — via apk where packaged, otherwise as pinned GitHub-release binaries following the existing `arctl` install pattern (verified current stable version/checksum at implementation time).
- Add three new optional `jarvis-jaw-secret` fields, wired through `backend/app/services/k8s.py` the same way as the existing `GITHUB_TOKEN` (`V1EnvVarSource` / `V1SecretKeySelector`, `optional=True`): `TFE_TOKEN`, `DD_APP_KEY`, `DD_SITE`.
- `entrypoint.sh`: when `TFE_TOKEN` is present, write it into `~/.terraform.d/credentials.tfrc.json` on boot (standard Terraform CLI credentials file), mirroring the existing `GOOGLE_WORKSPACE_CLI_CREDENTIALS` → `/etc/gws/credentials.json` pattern. Target TFE host/org(s) confirmed in `design.md`.
- Fix a pre-existing gap: `DD_API_KEY` is already wired in `backend/app/services/k8s.py` but was never documented in `secrets/jaw-secret.example.yaml`. Document it there alongside the three new fields.
- **Non-goals** (explicitly out of scope): no changes to the `docker:dind` base image itself or the existing privileged-only-when-skills-referenced mechanism; no docker/docker-compose/colima tooling beyond what already exists; no cloudflared, caddy, mysql/postgresql clients, ruby/node version managers, qemu, gdal, or ffmpeg.

## Capabilities

### New Capabilities
- `worker-infra-ops-tooling`: the worker image ships a curated set of infra/ops CLIs (gcloud, kubectl, helm, k9s, kubectx/kubens, terraform, tfctl, gh, argocd, yq, crane, ggshield, tflint, terraform-docs), with TFE and Datadog credentials wired through the existing optional-secret-env-var pattern and written to the tools' expected config-file locations on boot.

### Modified Capabilities
_None._ No requirements of existing specs (`skill-worker-integration`, `worker-stateful-mode`, `helm-deployment`) change. If `kubectl` ends up targeting the worker's in-cluster ServiceAccount, any resulting RBAC widening in `helm/jarvis/templates/worker-role.yaml` is an implementation detail of the new capability, not a change to another capability's documented requirements.

## Impact

- `worker/Dockerfile` — new apk packages and pinned GitHub-release binary installs.
- `worker/entrypoint.sh` — writes `~/.terraform.d/credentials.tfrc.json` from `TFE_TOKEN` on boot when present.
- `backend/app/services/k8s.py` — three new optional `V1EnvVar` entries (`TFE_TOKEN`, `DD_APP_KEY`, `DD_SITE`).
- `secrets/jaw-secret.example.yaml` — documents `DD_API_KEY` (existing gap), `TFE_TOKEN`, `DD_APP_KEY`, `DD_SITE`.
- `helm/jarvis/templates/worker-role.yaml` — possible RBAC widening, contingent on the `design.md` decision for `kubectl`'s identity model.
- Worker image size and build time increase; no change to the pod's privilege model (still privileged only when skills are referenced).
- Rollout requires a worker image rebuild + push (GHCR + Artifact Registry), an admission-whitelist digest bump via Terraform in the infra repo, and an ArgoCD values bump — all production-affecting on the `t2-d-sbx-arch` sandbox cluster. `tasks.md` gates this on explicit user confirmation; it is not an automatic implementation step.
