## Why

JAAR (the self-hosted AgentRegistry OSS chart) requires its own Postgres, namespace, gateway route, and a privileged/dind sidecar in every skill-enabled worker pod just to pull skill files via OCI images. Google Cloud's Gemini Enterprise Agent Platform now offers a managed Agent Registry for governing agents and MCP servers, and skills — being plain files (`SKILL.md` + assets) — don't need a registry or an OCI pull at all; a GCS bucket with Workload Identity read access is sufficient and removes the need for privileged containers entirely.

## What Changes

- **BREAKING**: Remove JAAR entirely — `helm/jaar/` chart, `argocd/jaar-app.yaml` (+ `-local` variant), the `jaar` namespace, `secrets/jaar-secret*.yaml`, and all `JAAR_URL` config plumbing.
- **BREAKING**: Replace the worker's skill-pull mechanism (`worker/entrypoint.sh` Step 4: dockerd + `arctl skill pull ... --registry-url $JAAR_URL`) with a direct GCS fetch (e.g. `gcloud storage cp -r`) authenticated via Workload Identity. Skill-enabled worker pods no longer require `privileged: true` or a docker-in-docker sidecar.
- Add a CI step/Makefile target that syncs `artifacts/skills/*` (SKILL.md + assets) to the new GCS bucket, replacing the current build-Docker-image-and-`arctl register` flow.
- Update the `Worker` model and pod-spec plumbing so skill references point at GCS object paths/versions instead of JAAR name@version OCI refs.
- Remove the Agent Registry dashboard card's dependency on the JAAR HTTP API; re-source its counts (skills from GCS listing; agents/MCP servers/prompts from Gemini Enterprise Agent Registry once available) or simplify the card if a given count isn't yet queryable.
- Add an A2A-protocol Agent Card endpoint (`/.well-known/agent-card.json`) to the JARVIS backend and/or MCP server, plus the GKE auto-discovery label/annotations (`registry.gke.io/functional-type: "AGENT"`, `a2a-protocol.org/agent-card`, `iam.gke.io/spiffe-identity-type: agent-identity`) so the deployments auto-register with Gemini Enterprise Agent Registry.
- Cross-repo dependency: the GCS bucket itself, its IAM bindings, and enabling the Gemini Enterprise Agent Platform API are infra/Terraform concerns whose owning repo is not yet decided (candidates: the UHDP sandbox Terraform stood up this session, or a new dedicated JARVIS infra config) — flagged in design.md, not resolved here.

## Capabilities

### New Capabilities
- `skill-gcs-hosting`: GCS-bucket-backed storage and retrieval of skill files, replacing JAAR/arctl-based OCI skill distribution; worker fetch flow, IAM/Workload Identity access model, and the artifact-sync mechanism that publishes `artifacts/skills/*` to the bucket.
- `agent-platform-registration`: A2A Agent Card endpoint exposed by the JARVIS backend/MCP server and the GKE labels/annotations that let Gemini Enterprise Agent Registry auto-discover them.

### Modified Capabilities
- `skill-worker-integration`: skill references stored on `Worker` change from JAAR name@version OCI refs to GCS object paths/versions; worker pod env vars drop `JAAR_URL` and gain a GCS bucket/path; skill-enabled pods no longer run privileged/dind.
- `skill-ci-publishing`: CI publishes skill files to the GCS bucket instead of building Docker images and registering them with JAAR via `arctl`.
- `jaar-artifacts-ci`: artifacts directory structure and MCP server registration path change now that JAAR/arctl registration is gone; `servers/`, `agents/`, `prompts/` artifacts move toward Gemini Enterprise Agent Registry registration where applicable.
- `jaar-dashboard-card`: card's data sources change from the JAAR HTTP API to GCS (skills count) and Gemini Enterprise Agent Registry (agents/servers/prompts counts, where queryable).
- `helm-deployment`: remove JAAR Application CRs and Makefile targets (`deploy-local` no longer builds/loads JAAR images); update local-dev memory guidance.
- `jaar-deployment`: capability removed — JAAR is no longer deployed via Helm/ArgoCD.
- `jaar-gateway-routing`: capability removed — no HTTPRoute for JAAR since the namespace/service no longer exists.

## Impact

- Code: `worker/entrypoint.sh`, `worker/Dockerfile` (drop dind/docker deps if no longer needed elsewhere), `backend/app/services/k8s.py`, `backend/app/routes/workers.py`, `backend/app/models/worker.py` (skill reference shape), `frontend` Agent Registry dashboard card + API client, `artifacts/servers/jarvis` (Agent Card endpoint), CI workflow(s) publishing skills.
- Infra/deploy: `helm/jaar/` deleted, `argocd/jaar-app.yaml` (+ `-local`) deleted, `helm/jarvis/` gains GKE registration labels/annotations, `secrets/jaar-secret*.yaml` removed, Makefile targets updated.
- Dependencies: new dependency on `google-cloud-storage`/`gcloud` CLI in the worker image (replacing `arctl`/dockerd for skills); new dependency on GCS bucket + IAM provisioned outside this repo; new dependency on Gemini Enterprise Agent Platform API being enabled in the target GCP project.
- Docs: `CLAUDE.md` repository structure, worker runtime section, and Known Limitations table need updates (privileged-container limitation for skills goes away; JAAR references removed).
