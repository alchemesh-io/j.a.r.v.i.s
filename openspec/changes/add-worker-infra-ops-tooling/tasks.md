## 1. Dockerfile — apk-packaged tooling

- [x] 1.1 Add `kubectl`, `helm`, `k9s`, `kubectx`, `crane`, `yq-go`, `github-cli` to the existing `apk add --no-cache` list in `worker/Dockerfile`.
- [x] 1.2 Verify no other install step in the Dockerfile also installs a `kubectl` binary (gcloud components must not include `kubectl`).

## 2. Dockerfile — gcloud SDK

- [x] 2.1 Download and extract the Google Cloud SDK Linux tarball (`storage.googleapis.com/cloud-sdk-release/google-cloud-cli-linux-{x86_64,arm64}.tar.gz`, arch-switched like the existing `arctl` stanza) to `/opt/google-cloud-sdk`, run its non-interactive installer, and add it to `PATH`.
- [x] 2.2 Run `gcloud components install alpha beta -q` in the same layer.
- [x] 2.3 Confirm no credential, service-account key, or default project is baked into the image (`gcloud auth list` reports nothing in the built image).

## 3. Dockerfile — pinned HashiCorp releases

- [x] 3.1 Install `terraform` v1.15.8 from `releases.hashicorp.com/terraform/1.15.8/terraform_1.15.8_linux_{amd64,arm64}.zip`, verified against HashiCorp's published `SHA256SUMS`.
- [x] 3.2 Install `tfctl` v0.4.0 from `releases.hashicorp.com/tfctl/0.4.0/tfctl_0.4.0_linux_{amd64,arm64}.zip`, verified against HashiCorp's published `SHA256SUMS`.
- [x] 3.3 Re-verify both versions are still current at implementation time (`releases.hashicorp.com/<tool>/index.json`) before pinning — this design was written 2026-08-04.

## 4. Dockerfile — pinned GitHub-release binaries

- [x] 4.1 Install `argocd` CLI v3.5.0 from `github.com/argoproj/argo-cd/releases/download/v3.5.0/argocd-linux-{amd64,arm64}`, verified against the published `.sha256` sidecar file, following the existing `arctl` install pattern.
- [x] 4.2 Install `tflint` v0.64.0 from `github.com/terraform-linters/tflint/releases/download/v0.64.0/tflint_linux_{amd64,arm64}.zip`, verified against its published checksum file.
- [x] 4.3 Install `terraform-docs` v0.24.0 from `github.com/terraform-docs/terraform-docs/releases/download/v0.24.0/terraform-docs-v0.24.0-linux-{amd64,arm64}.tar.gz`, verified against its published checksum file.
- [x] 4.4 Install Datadog's `pup` v1.10.3 from `github.com/DataDog/pup/releases/download/v1.10.3/pup_1.10.3_Linux_{x86_64,arm64}.tar.gz`. Add a comment directly above this stanza noting Alpine's own `pup` apk package is an unrelated HTML-processing tool and must never be `apk add`-ed alongside this one.
- [x] 4.5 Re-verify all four versions are still current at implementation time (`gh api repos/<org>/<repo>/releases/latest`) before pinning.

## 5. Dockerfile — pip-installed tooling

- [x] 5.1 `pip install ggshield==1.53.0` (re-verify current PyPI version at implementation time via `pypi.org/pypi/ggshield/json`).

## 6. Secret wiring — backend

- [x] 6.1 In `backend/app/services/k8s.py`, add `TFE_TOKEN`, `DD_APP_KEY`, `DD_SITE` as optional `V1EnvVar`/`V1SecretKeySelector` entries on the worker pod spec, following the exact pattern of the existing `GITHUB_TOKEN` entry (`secret_key_ref` on `jarvis-jaw-secret`, `optional=True`).
- [x] 6.2 Update `backend/tests/test_k8s_service.py` to cover the three new optional env vars (present and absent cases), mirroring existing `GITHUB_TOKEN`/`DD_API_KEY` test coverage.

## 7. Secret wiring — documentation

- [x] 7.1 Add a commented-out `DD_API_KEY` field (with base64 encoding instructions) to `secrets/jaw-secret.example.yaml` — pre-existing gap, already wired in code but never documented.
- [x] 7.2 Add commented-out `TFE_TOKEN`, `DD_APP_KEY`, `DD_SITE` fields (with base64 encoding instructions) to `secrets/jaw-secret.example.yaml`.

## 8. entrypoint.sh — TFE credentials

- [x] 8.1 Add a step to `worker/entrypoint.sh` that writes `~/.terraform.d/credentials.tfrc.json` (host `tfe.doctolib.net`) whenever `TFE_TOKEN` is non-empty, re-applied on every boot (fresh or resumed) — mirroring how `GOOGLE_WORKSPACE_CLI_CREDENTIALS` is written to `/etc/gws/credentials.json`.
- [x] 8.2 Confirm the step is a no-op (no file written, no error) when `TFE_TOKEN` is unset or empty.

## 9. Worker pod ServiceAccount separation

- [x] 9.1 Add `helm/jarvis/templates/worker-pod-serviceaccount.yaml` defining a new ServiceAccount named `{{ .Release.Name }}-worker`, with no accompanying RoleBinding. (Named distinctly from the pre-existing `worker-serviceaccount.yaml`, which defines the **backend's own** ServiceAccount — reusing that filename would have collided with it.)
- [x] 9.2 In `backend/app/services/k8s.py`, change the worker pod spec's `service_account_name` from `"jarvis-backend"` to the new `{{ .Release.Name }}-worker` account name. **Do NOT set `automount_service_account_token=False`** — deployed to the real `t2-d-sbx-arch` cluster, this combination is hard-denied by its `deny-automount-token-without-sa` ValidatingAdmissionPolicy, which broke worker creation in production (503 on every attempt) until reverted. Safety comes from the zero RoleBindings on the new SA, not from suppressing the token mount.
- [x] 9.3 Confirm `helm/jarvis/templates/worker-serviceaccount.yaml` (backend's own), `worker-role.yaml`, and `worker-rolebinding.yaml` are left unmodified — the backend's own permissions for managing worker pods (create/attach/exec/delete) are unaffected.
- [x] 9.4 Update or add backend tests asserting the worker pod spec's `service_account_name` is the new dedicated account, not `jarvis-backend`, and that `automount_service_account_token` is not set at all.

## 10. Local verification (before any cluster rollout)

- [x] 10.1 Build the worker image locally and open a shell in it; run `--version`/`--help` for every newly added tool (`kubectl`, `helm`, `k9s`, `kubectx`, `kubens`, `crane`, `yq`, `gh`, `gcloud`, `terraform`, `tfctl`, `argocd`, `tflint`, `terraform-docs`, `ggshield`, `pup`) and confirm each exits `0`. Done via a direct `docker build`/`docker run` (minikube was not running in this environment, so the `make deploy-local` inner loop specifically was not exercised — the image build and tool checks are otherwise equivalent).
- [x] 10.2 Confirm `pup --version` reports Datadog's `pup`, not an HTML-processing tool.
- [ ] 10.3 Create a test worker against the locally-deployed chart; from inside its pod, run `kubectl auth can-i --list` and confirm it reports no permissions. **Not done** — requires a running minikube cluster with the chart deployed; minikube was stopped in this environment and starting it was treated as a separate decision rather than assumed under "local verification."
- [ ] 10.4 From the JARVIS UI/API, exercise the existing backend worker-management flows (create, attach terminal, exec shell, stop/restart if stateful, delete) against a test worker and confirm they still work unaffected by the ServiceAccount change. **Not done** — same reason as 10.3.
- [ ] 10.5 With `TFE_TOKEN` set on a test worker, confirm `~/.terraform.d/credentials.tfrc.json` is written correctly on boot; with it unset, confirm the file is absent. The underlying shell logic was verified standalone (both branches produce the expected file/no-file result), but not inside an actual running worker pod.

## 11. Cluster rollout — gated checkpoint, requires explicit user confirmation before proceeding

- [ ] 11.1 **STOP for explicit user confirmation** before any step below — this is a live, production-affecting action on the `t2-d-sbx-arch` sandbox cluster, not a routine automated step.
- [ ] 11.2 Build and push the worker image to GHCR and Artifact Registry.
- [ ] 11.3 Bump the admission-whitelist digest via Terraform in the infra repo.
- [ ] 11.4 Bump the worker image reference in the ArgoCD values (`make deploy` / ArgoCD sync) and confirm the new pods come up healthy.
- [ ] 11.5 Re-run the relevant checks from Section 10 against the real cluster (tool versions present, `kubectl auth can-i --list` empty, backend worker-management flows unaffected).
