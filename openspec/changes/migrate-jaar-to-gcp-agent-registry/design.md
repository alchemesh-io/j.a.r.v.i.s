## Context

JAAR (`helm/jaar/`) wraps the upstream `agentregistry-dev/agentregistry` OSS chart with a bundled Postgres, deployed via its own ArgoCD Application CR and `jaar` namespace, reachable at `jaar.jarvis.io` — in local dev only. On the target cluster (GKE sandbox `t2-d-sbx-arch`, project `d-platform-raytflf9`, deployed via ArgoCD from `doctolib/unified-healthcare-data-platform-infra`), JAAR was never stood up: no `jaar` namespace, no ArgoCD Application, no vendored Helm config. So "remove JAAR" is a local-dev-only cleanup.

Two things currently depend on JAAR:

1. **Skill distribution**: `worker/entrypoint.sh` starts an unprivileged dockerd, authenticates to GHCR, and runs `arctl skill pull <name> <dir> --version <v> --registry-url $JAAR_URL` per skill reference on `Worker.skills`. The pod only sets `privileged: true` when `skills` is non-empty, purely to run dockerd.
2. **Dashboard visibility**: `frontend/src/api/jaar.ts` + `Dashboard.tsx` call JAAR's HTTP API directly for per-type artifact counts.

**This exact migration was already fully implemented and live-verified against this same target cluster once before**, on a branch (`jaar-gcp-registry-migration`) that diverged before the main-brain worker / interactive-PTY-terminal / worker-infra-tooling / sidebar / session-id work landed on `worktree-remote-worker`. That prior session's own design doc and task list (preserved in that branch's `openspec/changes/migrate-jaar-to-gcp-agent-registry/`) already did the hard research and empirical verification; this design carries its conclusions forward rather than re-deriving them, calling out only what's different now.

**Infra prerequisites — reverified live before writing this design, not assumed carried over**:
- `gcloud container fleet memberships list --project d-platform-raytflf9` shows `t2-d-sbx-arch` registered.
- `gcloud storage ls gs://d-platform-raytflf9-jarvis-skills` shows the bucket exists and already contains a published `planner-daily-wrap-up/` skill from the prior session's testing.
- The backend/worker Workload Identity GSA (`sbx-arch-t2-d-db@...`) has `roles/agentregistry.viewer` bound at the project level.

So Task Group 1 (infra prerequisites) and most of Task Group 3.5 (GCS bucket) from the prior implementation are **already done** — this change is scoped to porting the application code that uses this infra.

## Goals / Non-Goals

**Goals:**
- Remove JAAR (chart, Application CR, secrets, `JAAR_URL` plumbing) — local-dev-only cleanup.
- Replace OCI-based skill distribution with the GCP Agent Registry Skills API + GCS bucket, dropping the privileged/dind requirement for skill-enabled worker pods entirely.
- Ship the MCP server's Agent Card endpoint and GKE auto-discovery labels (mechanism only — see Non-Goals on registry-side discovery).
- Keep the worker's skill-pull flow idempotent (skip if already cached) and resume-safe, matching the existing cached/pulled counters pattern in `entrypoint.sh`.
- Keep `Worker.skills: list[{name, version}]` unchanged — no DB migration.
- Reconcile cleanly against everything `worktree-remote-worker` has gained since the prior branch diverged (main-brain worker, terminal rework, worker infra/ops-tooling change, sidebar, stable session ids) — port the *intent* of each prior commit, not a blind cherry-pick, since several touch the same files this session already changed.

**Non-Goals:** (see proposal.md's Non-Goals section — MCP auto-discovery registration itself, CI WIF-based publishing, worker base image, session/resume logic.)

## Decisions

### 1. Worker image keeps `docker:dind` + already-added `gcloud` — no base image change
**Decision**: The prior implementation switched the worker base image to `gcr.io/google.com/cloudsdktool/cloud-sdk:alpine` specifically to get `gcloud` (and hit a real uid/gid-1000 collision with that image's own `cloudsdk` user, needing a workaround). This session's earlier worker infra/ops-tooling change already added `gcloud` (core + alpha + beta) on top of the current `docker:dind` base via the official Google Cloud SDK tarball — so `gcloud` is already present and no base-image switch, and no uid/gid workaround, is needed.
**Why over reopening the base-image question**: keeping `docker:dind` was an explicit standing decision from earlier this session (the prior base-image revert, commit `d7a763e`, is not reopened). This migration removes the only thing that ever *used* dockerd (arctl skill pulls) but that doesn't obligate also changing the base image — no other task in this change depends on it.
**What actually changes in `worker/Dockerfile`**: remove the `arctl` install stage (ARCTL_VERSION arg + curl/chmod block) and the `unzip` dependency it uniquely needed is already present from the infra-tooling change. `bash`/`curl`/`jq` (needed for the new `fetch_skill()` JSON parsing) are already present.

### 2. Skills are published to and fetched from the Agent Registry Skills API + a dedicated GCS bucket — not the registry's own download path
**Decision**: `artifacts/skills/<name>/` content (zipped) is published via the Skills API (create/patch skill + revision), with the revision's `gcsSource` pointing at the already-live `d-platform-raytflf9-jarvis-skills` bucket. The worker resolves a skill reference to a revision (JSON API, `gcloud auth print-access-token` + `curl`), reads that revision's `gcsSource.uri`, and downloads the payload via `gcloud storage cp` — **not** the registry's `alt=media` endpoint.
**Why over the registry's own download path**: the prior session found, via live repro from inside this exact cluster, that `agentregistry.googleapis.com`'s `alt=media` download is blocked by this project's VPC-SC perimeter (`t2_data_dev`) for any in-cluster caller — confirmed at both `global` and `eu` locations, 403 "not available on Google's Restricted VIPs". The plain JSON API (list/get/search) works fine through the same perimeter; only file download is blocked. Direct `storage.googleapis.com` access through the same perimeter, same Workload Identity, works without issue — hence the GCS-hybrid design: registry owns metadata/discovery, GCS serves bytes. This is empirical, re-verifiable finding from testing against this real cluster, not a design preference — retested as part of this change's own verification (Task Group 2) rather than assumed still true.
**Resolving a skill's actual ID**: the registry assigns a `private-`-prefixed `skillId` to unpublished skills rather than honoring the requested name — the fetch/publish scripts resolve by listing and matching `displayName`, never by guessing the id.

### 3. Skill-enabled pods drop `privileged: true` and the dockerd bootstrap entirely
**Decision**: `backend/app/services/k8s.py`'s `has_skills` → `privileged=True` branch is removed; `worker/entrypoint.sh`'s dockerd start/stop and GHCR docker-login block is removed.
**Why**: dockerd was the sole reason skill-enabled workers ran privileged; the registry/GCS fetch needs no docker daemon at all.

### 4. `Worker.skills` JSON shape unchanged; env vars swap `JAAR_URL` for `AGENT_REGISTRY_PROJECT`/`AGENT_REGISTRY_LOCATION`
**Decision**: Keep `Worker.skills: list[{name, version}]` unchanged in the model/schema. `backend/app/services/k8s.py` drops `JAAR_URL` and adds `AGENT_REGISTRY_PROJECT`/`AGENT_REGISTRY_LOCATION` as direct `os.getenv` reads (same convention as `WORKER_CPU_REQUEST` etc. — `JAAR_URL` was never in the Pydantic `Settings` class either).
**Why**: avoids a `Worker` table/schema migration and keeps the frontend's skill-selection UI untouched; only pod-spec plumbing and the worker script change.

### 5. Agent Card endpoint lives on the MCP server, not the backend
**Decision**: `GET /.well-known/agent-card.json` on `artifacts/servers/jarvis` (FastMCP `custom_route`), not `backend/app/main.py`.
**Why**: the MCP server is already the artifact-registry-facing surface and the natural analogue of "the agent" from an external-registry point of view.

### 6. GKE auto-discovery: ship the mechanism, don't gate this change on registry-side discovery actually working
**Decision**: Add `registry.gke.io/functional-type: "AGENT"` label, `a2a-protocol.org/agent-card` annotation, and `iam.gke.io/spiffe-identity-type: agent-identity` to the MCP deployment (this repo's `helm/jarvis/templates/mcp-deployment.yaml` + the infra repo's vendored copy) — note the vendored copy currently hardens `automountServiceAccountToken: false` on this deployment, which must be overridden to `true` for SPIFFE identity issuance to work at all, the same admission-policy-shaped lesson from earlier this session's ServiceAccount work (a suppressed-token pattern that conflicts with a specific identity mechanism the cluster needs to issue).
**Why not block on confirmed registry-side discovery**: the prior session left Fleet membership, correct labels, and a working Agent Card live for over an hour without the MCP server appearing in `mcpServers.list`. That's either a timing issue, an undocumented additional prerequisite, or something needing the `services.create` explicit-registration fallback — none of which is resolved by anything this change controls. Re-verified as part of this change's own testing (not assumed to now work just because time has passed), but not a merge-blocking exit criterion.

### 7. Skill publishing stays a manual, human-run step — no CI Workload Identity Federation
**Decision**: `scripts/publish-skill.sh` is run by a human with their own `gcloud` credentials (`make sync-artifacts-skills`), not by GitHub Actions.
**Why**: this session already independently hit and resolved the exact same blocker the prior session flagged — the TFE execution identity lacks `iam.workloadIdentityPools.create` on this project, encountered while deploying the earlier worker infra/ops-tooling change's own (unrelated) WIF pool, and resolved by removing that pool rather than fighting the permission. Treated as an intentional guardrail on trust-boundary IAM resources in this project, not something to route around by hand-crafting a different pool. If CI-driven publishing is wanted later, it needs its own explicit decision from whoever administers that IAM boundary.

### 8. Dashboard card degrades gracefully; MCP Servers/Agents/Prompts stay "—"
**Decision**: `frontend/src/api/jaar.ts` is deleted; the dashboard reuses the existing `listSkills()` client call against a rewritten `GET /api/v1/skills` (Agent-Registry-backed). Agents/MCP Servers/Prompts counts remain "—" (`count: number | null`) until a registry read API for those is confirmed reachable.
**Why**: ships the low-risk half (skills) without blocking on Phase 2's unresolved agent/MCP-server counting question.

## Risks / Trade-offs

- **[Agent Registry API is `v1alpha`]** → same mitigation as before: keep the worker's fetch logic isolated to a small, well-tested shell function so a schema change is a small, localized fix.
- **[VPC-SC perimeter blocks the registry's own download path]** → already worked around via the GCS-hybrid design (Decision 2); re-verify empirically as part of this change rather than assume the workaround still applies unchanged.
- **[MCP auto-discovery may simply not work / need an undocumented prerequisite]** → shipped as a non-blocking mechanism (Decision 6); explicitly not a merge gate.
- **[Reconciling against a heavily-diverged branch]** → several files this migration touches (`worker/entrypoint.sh`, `backend/app/services/k8s.py`, `worker/Dockerfile`, `helm/jarvis/templates/mcp-deployment.yaml`) were also touched by this session's own earlier worker infra/ops-tooling change and the terminal/session-id work. Each task below is scoped to a specific, reviewable hunk rather than a blind branch merge, and existing tests are run after each file to catch silent regressions.
- **[Losing JAAR removes the only place Agents/Prompts artifacts were ever cataloged]** → no functional loss today, both are empty placeholders.
- **[Breaking change for in-flight stateful workers with skills already pulled via JAAR]** → `entrypoint.sh`'s existing cache check (`[ -f "$skill_dir/SKILL.md" ]`) is format-compatible; already-pulled skills on a PVC are untouched, only new pulls use the new path.
- **[Materialized post-deployment] Worker pods had no Workload Identity binding at all, breaking every skill fetch in production.** The earlier worker infra/ops-tooling change (Decision 3 there) deliberately gave worker pods their own `jarvis-worker` KSA with zero RoleBindings — correct in isolation, since it stopped workers from inheriting the backend's K8s RBAC and CloudSQL Workload Identity access. Neither that change nor this one, reviewed alone, was wrong; the gap only existed at their *intersection*: this migration's `fetch_skill()` needs a real GCP identity with `agentregistry.viewer` to call the Agent Registry API, and the only identity ever wired for that (`sbx-arch-t2-d-db`, via `jarvis-backend`'s KSA) wasn't reachable from the now-separate `jarvis-worker` KSA. Confirmed live: `gcloud auth print-access-token` inside a worker pod returned a token, but calling the Skills API with it 403'd (`agentregistry.skills.list` denied) — the KSA had no `iam.gke.io/gcp-service-account` annotation, so Workload Identity resolved it to an unbound default identity, not a permissioned one. **Fix**: a dedicated GSA (`agent_registry.tf`'s `jarvis_worker`) granted `agentregistry.viewer` and the skills bucket's `storage.objectViewer` — nothing else, specifically not CloudSQL — bound to the `jarvis-worker` KSA. Confirmed GKE re-evaluates Workload Identity live (no pod restart needed) and the fix restored skill fetching against an already-running pod. **Lesson**: when a change grants a workload a new capability (here: calling an external API), explicitly check whether a *prior, unrelated* security-hardening change already removed the ambient identity that capability was implicitly relying on — reviewing each change against the current file diff isn't enough if the interaction is at the IAM/identity layer, not the code layer.

## Migration Plan

1. Port Task Group 2 (worker skill fetch) and Task Group 4 (JAAR removal) together — hard cutover, not dual-write, since skill-enabled workers are ephemeral/stateful pods recreated on demand.
2. Port Task Group 3 (publish script) and confirm the already-published `planner-daily-wrap-up` skill is still resolvable end-to-end with the ported fetch logic before touching anything else.
3. Port Task Group 5 (dashboard card) in lockstep with the backend route rewrite.
4. Port Task Group 6 (Agent Card + GKE labels) last, as the lowest-priority, non-blocking piece.
5. Full local test suite (backend pytest, frontend tsc+build+vitest, MCP server pytest) before any image rebuild.
6. Live verification on the real cluster, following this session's now-established rebuild → whitelist → digest bump → ArgoCD sync → stale-ReplicaSet-scale-down → ConfigMap-rollout-restart sequence, with a real worker-with-skills creation as the acceptance test (mirroring the prior session's own verification).
7. Rollback: reverting this change's commits restores JAAR/arctl; no data migration needed either direction (`Worker.skills` shape unchanged).

## Open Questions

Carried forward from the prior session, still unresolved and out of this change's scope to resolve (see proposal.md Non-Goals): MCP auto-discovery registration, CI Workload Identity Federation for publishing, and the advisory Sentinel policy gap on the infra repo's `google_gke_hub_membership` resource (missing `platform-service`/`platform-component` labels — did not block apply, correct values not known).
