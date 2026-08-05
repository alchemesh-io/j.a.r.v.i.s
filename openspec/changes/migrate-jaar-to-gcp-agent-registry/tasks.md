## 1. Infra prerequisites — already live, reverify only

- [x] 1.1 Reverify `gcloud container fleet memberships list --project d-platform-raytflf9` shows `t2-d-sbx-arch` — confirmed live before writing this change's design.
- [x] 1.2 Reverify `gcloud storage ls gs://d-platform-raytflf9-jarvis-skills` shows the bucket with `planner-daily-wrap-up/` already published — confirmed.
- [x] 1.3 Reverify `agentregistry.viewer` is bound on the backend/worker GSA — confirmed via `gcloud projects get-iam-policy`.
- [x] 1.4 No new Terraform needed for this task group — confirmed nothing regressed.

## 2. Worker skill fetch

- [x] 2.1 `worker/Dockerfile`: removed the `arctl` install stage. Kept `docker:dind` base and the `gcloud`/apk tooling already added this session; also removed the now-vestigial `DOCKERD_ROOTLESS_ROOTLESSKIT_NET` env var and corrected the sudoers comment.
- [x] 2.2 `worker/entrypoint.sh`: removed the dockerd start/stop + GHCR docker-login block. Added `fetch_skill()`: resolves the skill by listing `.../skills` and matching `displayName` (JSON API via `gcloud auth print-access-token` + `curl`); resolves the revision (`defaultRevision` for `"latest"`, else pinned); reads `gcsSource.uri`; downloads via `gcloud storage cp`; unzips into `~/.claude/skills/<name>/`.
- [x] 2.3 Preserved the cache-check behavior and cached/pulled counters.
- [x] 2.4 Per-skill errors logged clearly (not silently skipped); clear error when `SKILLS` is set but `AGENT_REGISTRY_PROJECT`/`AGENT_REGISTRY_LOCATION` are not.
- [x] 2.5 `backend/app/services/k8s.py`: `JAAR_URL` → `AGENT_REGISTRY_PROJECT`/`AGENT_REGISTRY_LOCATION`. Removed the `has_skills` → `privileged=True` branch entirely (and the now-unused `has_skills` variable).
- [x] 2.6 `backend/tests/test_k8s_service.py`: replaced the privileged/unprivileged tests with `test_create_worker_pod_unprivileged_with_skills` (asserts `V1SecurityContext` never called) and `test_create_worker_pod_passes_agent_registry_env` (asserts the new env vars present, `JAAR_URL` absent).
- [x] 2.7 `fetch_skill()` verified live end-to-end by extracting the function and running it standalone against the real Agent Registry + bucket: resolved `planner-daily-wrap-up`, its `defaultRevision`, downloaded via `gcloud storage cp`, unzipped — SKILL.md + LICENSE.txt + assets/references/scripts all present and correct. **Not done**: a full worker image build — local Docker's containerd storage backend hit an `input/output error` (disk corruption, unrelated to this change) with 15 other containers running in the shared colima VM; restarting it wasn't done unilaterally. The Dockerfile edit itself is a self-contained block removal, low risk.

## 3. Skill artifact publishing

- [x] 3.1 Added `scripts/publish-skill.sh` (ported verbatim from the prior session's already-live-tested version): `TARGET_STATE_DRAFT` at creation, `displayName`-based resolution, GCS upload, revision creation tracked via `metadata.target`, poll-until-`ACTIVE` with backoff, then activate with `defaultRevision` set.
- [x] 3.2 Makefile: `sync-artifacts-skills` calls `scripts/publish-skill.sh` per skill directory; `sync-artifacts-servers` is now an informational no-op (GKE auto-discovery replaces `arctl register`).
- [x] 3.3 Removed `artifacts/skills/planner__daily_wrap_up/Dockerfile`.
- [x] 3.4 Verified live: ran `scripts/publish-skill.sh` against the real project/bucket — created a new revision (`rev-1c037974-...`), confirmed via a direct API call that `defaultRevision` points at it.

## 4. Remove JAAR (this repo, local-dev only)

- [x] 4.1 Deleted `helm/jaar/` (Chart.yaml, values.yaml, templates/, Chart.lock).
- [x] 4.2 Deleted `argocd/jaar-app.yaml` and `argocd/jaar-app-local.yaml`.
- [x] 4.3 Deleted `secrets/jaar-secret.example.yaml`; removed the `.gitignore` entry (no live `secrets/jaar-secret.yaml` existed).
- [x] 4.4 Makefile: removed `_deploy-jaar-secrets`, the JAAR-only `_helm-dep-update`, JAAR namespace labeling/data-mount dir, and all JAAR references from `deploy`, `deploy-local`, `undeploy`, `sync`, `jarvis-ui`.
- [x] 4.5 `helm/jarvis/templates/backend-configmap.yaml`: `JAAR_URL` → `AGENT_REGISTRY_PROJECT`/`AGENT_REGISTRY_LOCATION`; deleted `helm/jarvis/templates/jaar-destination-rule.yaml`.
- [x] 4.6 Rewrote `backend/app/routes/skills.py` as a thin wrapper over new `backend/app/services/agent_registry.py` (filters out `publisher`-tagged entries, uses `displayName`).
- [x] 4.7 Added `backend/tests/test_skills.py` (5 tests: unconfigured, auth failure, transport error, success incl. filtering, route test).

## 5. Dashboard Agent Registry card

- [x] 5.1 Deleted `frontend/src/api/jaar.ts`.
- [x] 5.2 `Dashboard.tsx`: Agent Registry card now sources skills count from `listSkills()` (deduplicated by name), shows "—" for MCP Servers/Agents/Prompts (`count: number | null`, rendered as `m.count ?? '—'`), "Open Registry" link only when `VITE_AGENT_REGISTRY_CONSOLE_URL` is set. Scoped narrowly — this file also has unrelated main-brain-worker/DnD code from work that postdates the reference branch, left untouched.
- [x] 5.3 `tsc --noEmit` clean, `npm run build` clean. No pre-existing Dashboard.tsx test file found (confirmed, not silently skipped).

## 6. Phase 2: GKE auto-discovery (non-blocking, ships the mechanism only)

- [x] 6.1 `artifacts/servers/jarvis`: added `GET /.well-known/agent-card.json` via FastMCP's `custom_route`. Ported cleanly (isolated diff from the reference branch).
- [x] 6.2 `helm/jarvis/templates/mcp-deployment.yaml`: added the GKE auto-discovery label/annotations, `serviceAccountName: {{ .Release.Name }}-backend` (shares Workload Identity). `helm template` renders cleanly. Infra repo's vendored copy sync deferred to the gated deployment step (group 9) since it requires checking whether that copy hardens `automountServiceAccountToken: false`.
- [x] 6.3 Local test added/passing (`TestAgentCard` in `test_server.py`, ported from the reference branch) — asserts the endpoint serves a valid card with the `tasks` skill listed. Live port-forward verification deferred to group 9 (requires a deployed MCP server).
- [ ] 6.4 Deferred to group 9 (requires live deployment). Per design: not a blocker either way.

## 7. Backend tests

- [x] 7.1 Full backend suite passes: 255/255.
- [x] 7.2 Confirmed no changes needed to worker/task tests — `Worker.skills` JSON shape unchanged.

## 8. Docs & local verification

- [x] 8.1 `CLAUDE.md` updated: JAAR removed from repo structure/prerequisites/routing/Infrastructure; "Artifacts & Agent Registry (JAAR)" rewritten as "Artifacts & the GCP Agent Registry"; worker docstring/comments fixed (`k8s.py`, `entrypoint.sh` context); Known Limitations gained rows for the v1alpha API, VPC-SC download restriction, and GKE auto-discovery not-yet-confirmed status.
- [x] 8.2 All green: backend 255/255, MCP server 55/55, JADS 85/85, frontend `tsc --noEmit` + `npm run build` clean.
- [x] 8.3 `helm template helm/jarvis/` renders cleanly, zero `jaar`/`JAAR` matches anywhere in the output.

## 9. Cross-repo sync and live deployment — completed on t2-d-sbx-arch

- [x] 9.1 Confirmed with the user before proceeding.
- [x] 9.2 Built/pushed all four images (all four had real changes this time: backend, frontend, worker, MCP server) via `make publish-images`, tag `b979e3c`.
- [x] 9.3 Bumped the CEL admission whitelist and the vendored chart's `values.yaml` digests in the infra repo; caught and fixed a values-path mismatch first (`agentRegistry.project`/`.location` top-level, not nested under `backend.config` as first drafted — matched against the already-live infra repo convention). `terraform apply` succeeded cleanly (1 added, 2 changed, 1 destroyed — the same recurring benign noise as before).
- [x] 9.4 Pushed the infra repo branch (bypassed the pre-commit GitGuardian hook once, with explicit user confirmation, due to a VPN outage making `gitguardian.doctolib.net` fully unresolvable — confirmed via direct DNS/connect failure, not a config issue). Hard-refreshed ArgoCD; hit the same stale-ReplicaSet quirk on all three deployments (backend/frontend/mcp) and scaled the old RS to 0 for each — not blocked by the classifier this time.
- [x] 9.5 Verification: all new pods 2/2 or 1/1 Ready on the new digests; `jarvis-worker` ServiceAccount confirmed still zero-RBAC on a live pod; a **real user-created worker** (task 6, stateful) spun up mid-verification on the new worker image and cloned its repo cleanly with no dockerd/arctl errors; MCP server's `/.well-known/agent-card.json` confirmed serving valid JSON with all 8 tools listed as skills; ArgoCD Synced/Healthy throughout.
