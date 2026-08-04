## Context

The worker image is `docker@sha256:4d2c6e...` — Alpine 3.23.4-based `docker:dind` — running as non-root `node` (uid/gid 1000), with `dockerd` + rootless Docker + `sudo NOPASSWD: ALL` already present solely to support `arctl skill pull` (pods run privileged only when a worker references skills). Existing tools are installed via `apk` (bash, git, jq, nodejs, npm, curl, etc.), `npm` (`@anthropic-ai/claude-code`, `@googleworkspace/cli`), and pinned GitHub-release binaries fetched with `curl` (`arctl`, per-arch, verified by exact filename convention). All of that stays as-is.

Credentials reach the worker pod exclusively through `jarvis-jaw-secret`, referenced as optional `V1EnvVar`/`V1SecretKeySelector` entries in `backend/app/services/k8s.py` (`ANTHROPIC_API_KEY`, `CLAUDE_CODE_OAUTH_TOKEN`, `GITHUB_TOKEN`, `DD_API_KEY`), or written to a file on boot by `entrypoint.sh` (`GOOGLE_WORKSPACE_CLI_CREDENTIALS` → `/etc/gws/credentials.json`). New tools follow the same two patterns.

**Load-bearing finding that changes this design's scope:** `backend/app/services/k8s.py:343` sets the worker pod's `service_account_name` to `"jarvis-backend"` — the **same** ServiceAccount the backend deployment itself uses, bound (via `helm/jarvis/templates/worker-rolebinding.yaml`) to the `worker-manager` Role (`helm/jarvis/templates/worker-role.yaml`): `create/get/list/delete` on `pods`, `services`, `persistentvolumeclaims`, plus `pods/attach` and `pods/exec`, all in the `jarvis` namespace. That Role exists so the **backend** can manage worker pods (create them, attach/exec into their PTY for the terminal bridge). Because the worker pod is given the *same* ServiceAccount rather than one scoped to itself, every worker pod already has an automatically-mounted token carrying those same permissions — it is simply inert today because no worker image ships a `kubectl` (or any Kubernetes client) to use it.

Adding `kubectl` to the worker image, without changing this, would activate that token: any worker could `kubectl exec` into *any other* pod in the `jarvis` namespace — including the backend and every other worker — and create/delete pods, services, and PVCs. Combined with the documented, pre-existing gap that **worker terminals have no auth of their own** ("Anyone who can reach `main.jarvis.io` can attach to a worker PTY / shell — root-equivalent in the pod" — CLAUDE.md, Known Limitations), this change would turn a latent, currently-unreachable over-privilege into an actively exploitable one: reach any worker's terminal → get `kubectl` → exec into every other pod in the namespace using the backend's own identity. This is addressed directly in Decisions below rather than deferred, since shipping `kubectl` on top of the ambient `jarvis-backend` SA as-is would make the change net-negative for security.

## Goals / Non-Goals

**Goals:**
- Ship a curated set of infra/ops CLIs in the worker image, installed via the most maintainable available channel (prefer Alpine `apk` — same trust/update model as existing deps — over hand-pinned binaries wherever Alpine packages the tool).
- Wire TFE and Datadog credentials through the existing optional-secret-env-var / boot-time-file pattern.
- Close the gap where installing `kubectl` would silently inherit the backend's own cluster permissions, by giving the worker pod its own, separately-scoped identity.

**Non-Goals:**
- Changing the worker image's base (`docker:dind` stays; the earlier cloud-sdk base-image revert, commit `d7a763e`, is not reopened).
- Changing the privileged-only-when-skills-referenced mechanism, or the `dockerd`/`sudo` setup that exists for `arctl skill pull`.
- Building a general auth layer for the worker terminal itself — out of scope for this change; the ServiceAccount fix below narrows what a terminal-based attacker can *reach*, it does not add authentication to the terminal.
- Wiring real external GCP project/cluster access for `gcloud`/`kubectl` (e.g. `gcloud container clusters get-credentials` against a GKE cluster outside this Minikube deployment) — no such external target is in scope; `gcloud` ships unauthenticated by default (`gcloud auth login` is interactive and out of scope, same reasoning as `tfctl auth login`).

## Decisions

### 1. Installation channel per tool — prefer `apk`, verified against the actual base image

Ran `apk update && apk search <name>` inside the exact pinned base image (`docker@sha256:4d2c6e334de4b26d492c0a8cc5438e3dbf1a02eee899fc0d4d39b96202c943a7`, Alpine 3.23.4) rather than assuming. Results:

| Tool | Available via `apk`? | Package | Version found |
|---|---|---|---|
| kubectl | Yes | `kubectl` | 1.34.2-r6 |
| helm | Yes | `helm` | 3.19.0-r7 |
| k9s | Yes | `k9s` | 0.50.16-r6 |
| kubectx + kubens | Yes (one package, both binaries) | `kubectx` | 0.9.5-r23 |
| gh (GitHub CLI) | Yes | `github-cli` | 2.83.0-r6 |
| crane | Yes | `crane` | 0.20.6-r10 |
| yq | Yes (package renamed) | `yq-go` | 4.49.2-r6 |
| terraform | No | — | install from `releases.hashicorp.com` |
| tfctl | No | — | install from `releases.hashicorp.com` |
| argocd CLI | No | — | pinned GitHub-release binary |
| tflint | No | — | pinned GitHub-release binary |
| terraform-docs | No | — | pinned GitHub-release binary |
| ggshield | No (not a general package) | — | `pip install` (PyPI, `py3-pip` already present) |
| pup (Datadog) | **Package exists but is the wrong tool** | `pup` = an HTML/XML CLI processor, unrelated to Datadog | pinned GitHub-release binary, **do not** `apk add pup` |
| gcloud | No | — | official Google Cloud SDK tarball |

Rationale: apk packages ride Alpine's own security-patch cadence and match the existing install pattern for every other current dependency (bash, git, jq, etc.) — strictly less maintenance than hand-pinning seven more binaries. Only reach for a pinned binary/official installer where Alpine genuinely doesn't package the tool.

**`pup` naming collision** is the one correctness trap here: Alpine's own `pup` package is a well-known HTML-parsing CLI (`EddieCash/pup`), not Datadog's cost/telemetry CLI (`DataDog/pup`, distributed only via GitHub releases / Homebrew tap `datadog-labs/pack/pup`). `apk add pup` would silently install the wrong binary at `/usr/bin/pup` and every `pup costs ...`-style invocation would fail confusingly. Datadog's `pup` must be a pinned GitHub-release binary, and Alpine's `pup` package must never be added.

Real current stable versions (verified via `gh api repos/<org>/<repo>/releases/latest`, not guessed, checked 2026-08-04):

| Tool | Repo | Version | Linux asset naming |
|---|---|---|---|
| tfctl | hashicorp/tfctl-cli (binaries via `releases.hashicorp.com/tfctl/`, no GitHub release assets) | v0.4.0 | `tfctl_0.4.0_linux_{amd64,arm64}.zip` |
| terraform | hashicorp/terraform (binaries via `releases.hashicorp.com/terraform/`) | v1.15.8 | `terraform_1.15.8_linux_{amd64,arm64}.zip` |
| argocd CLI | argoproj/argo-cd | v3.5.0 | `argocd-linux-{amd64,arm64}` (no archive, raw binary) |
| tflint | terraform-linters/tflint | v0.64.0 | `tflint_linux_{amd64,arm64}.zip` |
| terraform-docs | terraform-docs/terraform-docs | v0.24.0 | `terraform-docs-v0.24.0-linux-{amd64,arm64}.tar.gz` |
| ggshield | PyPI `ggshield` | 1.53.0 | n/a — `pip install ggshield==1.53.0` |
| pup (Datadog) | DataDog/pup (aliased from `datadog-labs/pup`) | v1.10.3 | `pup_1.10.3_Linux_{x86_64,arm64}.tar.gz` |
| gcloud | Google Cloud SDK | latest (Google does not version-pin this URL) | `storage.googleapis.com/cloud-sdk-release/google-cloud-cli-linux-x86_64.tar.gz` |

All GitHub-release and HashiCorp-release binaries are fetched with an arch switch (`x86_64`/`aarch64` → `amd64`/`arm64`) mirroring the existing `arctl` install stanza, and verified against the published `SHA256SUMS`/checksum file at implementation time (HashiCorp and most GitHub releases publish one; `argocd` publishes `.sha256` sidecar files per asset).

### 2. `gcloud`: install core + alpha + beta, but do not wire any GCP credential

Installed from the official Google Cloud SDK Linux tarball (glibc-free? — no: the SDK's own Python/Bash toolchain runs fine under Alpine's Python 3, already present via `py3-pip`; the SDK does not require glibc for its Python-based `gcloud` wrapper, only some optional components do, and none of those are installed here). Steps: extract to `/opt/google-cloud-sdk`, run its installer non-interactively, then `gcloud components install alpha beta -q`. `kubectl` is **not** installed as a gcloud component — it comes from `apk` per Decision 1, so there is exactly one `kubectl` binary in the image and no confusion about which one is on `PATH`.

`gcloud` ships with no credentials and no default project. `gcloud auth login` is interactive/browser-based and out of scope (mirrors why `tfctl auth login` is out of scope). If a future change wants `gcloud` to actually reach a GCP project, that's a separate, explicit decision (service account key vs. workload identity) — not part of this change (see Non-Goals).

### 3. `kubectl`'s identity: give the worker pod its own ServiceAccount, not the backend's

**Decision:** add a new `{{ .Release.Name }}-worker` ServiceAccount (`helm/jarvis/templates/worker-pod-serviceaccount.yaml`, new file — named distinctly from the pre-existing `worker-serviceaccount.yaml`, which defines the *backend's own* ServiceAccount) with **no RoleBinding at all** by default, and change `backend/app/services/k8s.py:343` to set the worker pod's `service_account_name` to this new SA instead of `"jarvis-backend"`. Additionally set `automount_service_account_token=False` on the worker pod spec unless a future capability specifically needs the K8s API from inside the pod.

This means `kubectl`/`k9s`/`kubectx` inside a worker pod, out of the box, get `Forbidden` (no token, or a token with zero bindings) against the in-cluster API — same posture as if they weren't installed at all from a permissions standpoint. They remain fully useful for everything that isn't the in-cluster API: `kubectl` against a different context a task explicitly configures, `k9s`/`kubectx` for local kubeconfig inspection, `helm template`/`helm lint` (no cluster needed), etc.

**Why not just keep reusing `jarvis-backend`'s SA (status quo):** that SA's Role includes `pods/attach` and `pods/exec` cluster-namespace-wide specifically so the *backend* can bridge terminals — granting the same token to every worker means every worker can, today, exec into every other worker and the backend pod itself. Given the worker terminal has no auth of its own (CLAUDE.md Known Limitations), that token is the difference between "compromise one worker's terminal" and "compromise the whole `jarvis` namespace." Not fixing this while adding the one tool (`kubectl`) that would let a worker actually use that token would make this change actively worse for security, not neutral.

**Why not instead grant a new, narrower, but non-empty Role (e.g. read-only `get/list/watch` on `pods`/`services`):** considered and rejected for now. Any standing grant — even read-only — is reachable by anyone who can attach to any worker's unauthenticated terminal, and "read-only" in this namespace still exposes env vars via `pods` describe-equivalent calls (though not secret values themselves, since `get pods` doesn't reveal secret contents, only names/refs) and full visibility into every other worker's and the backend's pod metadata. Given no concrete task in this change actually requires in-cluster read access, the safer default is zero standing grant; a future change can add a scoped read-only Role if a real use case needs it, as its own explicit, reviewed decision.

**Alternative considered and rejected:** external cluster access via `gcloud container clusters get-credentials` using a dedicated GCP service-account key mounted as a new secret. Rejected because (a) it requires provisioning and rotating a new long-lived GCP credential, (b) it's reachable by the same unauthenticated-terminal path, so it has the identical blast-radius problem as the in-cluster token, just pointed at a different (potentially production) cluster, and (c) no concrete task in this change needs external cluster access — the worker only ever needed to reach the cluster it already runs in, and per the decision above, it now explicitly doesn't.

### 4. `tfctl`/Terraform Enterprise credentials: host-level, not org-scoped

Terraform's CLI credentials file (`~/.terraform.d/credentials.tfrc.json`) is keyed by **hostname only** (`{"credentials": {"tfe.doctolib.net": {"token": "..."}}}`) — there is no per-org field in that file format, so "which org does the token belong to" isn't a property the credentials file can express at all; org scope is determined by what the token itself is authorized for on the TFE side, and by `--org`/workspace selection in individual `tfctl`/`terraform` invocations. Grepped `argocd/`, `helm/`, and `Makefile` for any existing TFE/Terraform reference — none exist in this repo today, so there's no existing convention to match. `entrypoint.sh` writes the file when `TFE_TOKEN` is present, keyed to `tfe.doctolib.net`; which org(s) the underlying token is scoped to is a property of how the token is issued in TFE, outside this repo's control, and doesn't change anything on the worker side.

### 5. `DD_API_KEY` documentation gap

Pre-existing: wired in `k8s.py` since the `pup`/Datadog integration was first added, but never added to `secrets/jaw-secret.example.yaml`. Fixed here alongside the three genuinely new fields (`TFE_TOKEN`, `DD_APP_KEY`, `DD_SITE`) so the example file is complete.

## Risks / Trade-offs

- **[Risk]** Changing the worker pod's ServiceAccount (Decision 3) is a behavior change for every existing worker, not just ones that use the new tools — any code path that happened to rely on the worker pod having `jarvis-backend`'s permissions would break. → **Mitigation**: grep confirms nothing in `worker/entrypoint.sh` or `worker/setup-claude.sh` calls `kubectl` or the K8s API today (no client exists in the image yet), so nothing currently depends on that token. Called out explicitly as a task to verify at implementation time, and as a reviewable, isolated commit.
- **[Risk]** Alpine's packaged versions (kubectl 1.34.2, helm 3.19.0, k9s 0.50.16, gh 2.83.0) trail the very latest upstream releases (kubectl still 1.34.2 vs. no newer minor available at time of writing, helm 4.2.3 upstream vs. 3.19.0 packaged, gh 2.97.0 upstream vs. 2.83.0 packaged) → **Mitigation**: acceptable trade-off for apk's maintenance benefits; these are ops/inspection tools, not something with a hard version-compat requirement against this cluster (no pinned Kubernetes server version in this repo's Minikube setup). Revisit if a specific feature/CVE fix requires a newer version than Alpine has packaged.
- **[Risk]** `pup` naming collision (Decision 1) is a trap for future maintainers who might reflexively `apk add pup` when updating the image. → **Mitigation**: comment directly above the Datadog `pup` install stanza in the Dockerfile calling out the collision by name.
- **[Risk]** Worker image build time and size increase measurably (7 apk packages + 6 pinned binaries + a Python package + the gcloud SDK tarball, which alone is >300MB uncompressed). → **Mitigation**: accepted; no current CI/build-time budget documented for this image. Flagged for awareness, not blocking.
- **[Risk]** Rebuilding and redeploying the worker image is a live, production-affecting action on the `t2-d-sbx-arch` sandbox cluster (image build/push to GHCR + Artifact Registry, admission-whitelist digest bump via Terraform in the infra repo, then an ArgoCD values bump). → **Mitigation**: `tasks.md` gates this explicitly behind user confirmation; not treated as a routine automated step.

## Migration Plan

1. Implement Dockerfile/entrypoint/k8s.py/helm changes on a branch; build the image locally (`make deploy-local` inner loop) and verify each new binary runs (`--version`/`--help`) inside a shell in the built image before touching the cluster.
2. Verify the ServiceAccount change (Decision 3) by creating a test worker and confirming `kubectl auth can-i --list` inside it returns no permissions, while confirming the backend's own worker-management flows (create/attach/exec/delete via the API) still work unaffected (they use the backend's own pod identity, not the worker pod's).
3. Only after local verification: rebuild/push to GHCR + Artifact Registry, bump the admission-whitelist digest via Terraform in the infra repo, then bump the ArgoCD values — each gated on explicit user confirmation (see `tasks.md`).
4. Rollback: revert the image tag in the ArgoCD values to the prior digest; the ServiceAccount/Helm changes revert via the same Helm sync. No data migration involved (no schema/DB changes in this proposal).

## Open Questions

None outstanding — the two questions raised in the proposal (kubectl source, kubectl identity model) are resolved above (Decisions 1 and 3). Flag for user confirmation before implementation: Decision 3 changes the worker pod's ServiceAccount for *all* workers, which is a broader behavioral change than "just add some CLIs," and is the one decision in this design most worth a second look before coding begins.
