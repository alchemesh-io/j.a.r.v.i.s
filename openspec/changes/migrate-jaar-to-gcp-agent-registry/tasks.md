## 1. Infra prerequisites — already live, reverify only

- [x] 1.1 Reverify `gcloud container fleet memberships list --project d-platform-raytflf9` shows `t2-d-sbx-arch` — confirmed live before writing this change's design.
- [x] 1.2 Reverify `gcloud storage ls gs://d-platform-raytflf9-jarvis-skills` shows the bucket with `planner-daily-wrap-up/` already published — confirmed.
- [x] 1.3 Reverify `agentregistry.viewer` is bound on the backend/worker GSA — confirmed via `gcloud projects get-iam-policy`.
- [ ] 1.4 No new Terraform needed for this task group — if a live check above ever regresses, that's a separate infra-repo investigation, not part of this change.

## 2. Worker skill fetch

- [ ] 2.1 `worker/Dockerfile`: remove the `arctl` install stage (ARG + curl/chmod block). Keep `docker:dind` base and the `gcloud`/apk tooling already added this session — no other Dockerfile changes needed (bash/curl/jq/unzip already present).
- [ ] 2.2 `worker/entrypoint.sh`: remove the dockerd start/stop + GHCR docker-login block (Step 5 in the current file). Add a `fetch_skill()` function: resolve the skill by listing `.../skills?filter=displayName="<name>"` (JSON API via `gcloud auth print-access-token` + `curl`) since the registry assigns `private-`-prefixed ids; resolve the revision (`defaultRevision` for `"latest"`, else the pinned revision); read that revision's `gcsSource.uri`; download via `gcloud storage cp`; unzip into `~/.claude/skills/<name>/`.
- [ ] 2.3 Preserve the existing cache-check behavior (`[ -f "$skill_dir/SKILL.md" ]` skips a pull) and cached/pulled counters, and the resume-safety comment about not starting dockerd unnecessarily (now moot — note this in the diff, don't just silently drop the comment).
- [ ] 2.4 Log a clear, per-skill error (not a silent skip) on any resolution/download failure, and a clear error when `SKILLS` is non-empty but `AGENT_REGISTRY_PROJECT`/`AGENT_REGISTRY_LOCATION` are unset.
- [ ] 2.5 `backend/app/services/k8s.py`: replace `JAAR_URL` env var with `AGENT_REGISTRY_PROJECT`/`AGENT_REGISTRY_LOCATION` (direct `os.getenv`, matching `WORKER_CPU_REQUEST`'s convention). Remove the `has_skills` → `privileged=True` branch entirely.
- [ ] 2.6 Update `backend/tests/test_k8s_service.py`: replace privileged/unprivileged skills tests with one asserting `V1SecurityContext` is never called regardless of skills, and one asserting `AGENT_REGISTRY_PROJECT`/`LOCATION` are present and `JAAR_URL` is absent from the pod env.
- [ ] 2.7 Local verification: build the worker image, shell in, confirm `arctl` is gone and `gcloud storage cp`/`curl` work; re-verify the VPC-SC finding still holds (`alt=media` blocked, direct GCS access works) via a live in-cluster test before relying on the GCS-hybrid path in production.

## 3. Skill artifact publishing

- [ ] 3.1 Add `scripts/publish-skill.sh`: create the skill with `targetState=TARGET_STATE_DRAFT` (ACTIVE rejected at creation), resolve the real skill path by listing + matching `displayName` (never guess the `private-`-prefixed id), upload the zip to GCS, create/patch the revision with `gcsSource`, track the *specific* new revision via the create-revision operation's `metadata.target` (not "any ACTIVE revision" — that can race and activate a stale one), poll that exact revision until `ACTIVE` with retry/backoff, then PATCH the skill's `targetState=ACTIVE` + `defaultRevision` together (also needs retry/backoff).
- [ ] 3.2 Makefile: add/update `sync-artifacts-skills` to call `scripts/publish-skill.sh` per skill directory under `artifacts/skills/`; make `sync-artifacts-servers` an informational no-op (MCP registration is via GKE auto-discovery, not `arctl register`).
- [ ] 3.3 Remove `artifacts/skills/planner__daily_wrap_up/Dockerfile` — no OCI image built anymore.
- [ ] 3.4 Verify: republish `planner-daily-wrap-up` (already live in the bucket from prior testing) through the new script and confirm `defaultRevision` points at the newest revision afterward.

## 4. Remove JAAR (this repo, local-dev only)

- [ ] 4.1 Delete `helm/jaar/` (Chart.yaml, values.yaml, templates/, Chart.lock).
- [ ] 4.2 Delete `argocd/jaar-app.yaml` and `argocd/jaar-app-local.yaml`.
- [ ] 4.3 Delete `secrets/jaar-secret.example.yaml`; remove any `.gitignore` entry for `secrets/jaar-secret.yaml`.
- [ ] 4.4 Makefile: remove `_deploy-jaar-secrets`, JAAR-only `_helm-dep-update`, JAAR namespace labeling, JAAR data-mount dir; remove JAAR from `deploy`, `deploy-local`, `undeploy`, `sync` targets.
- [ ] 4.5 `helm/jarvis/templates/backend-configmap.yaml`: swap `JAAR_URL` for `AGENT_REGISTRY_PROJECT`/`AGENT_REGISTRY_LOCATION`; delete `helm/jarvis/templates/jaar-destination-rule.yaml`.
- [ ] 4.6 Rewrite `backend/app/routes/skills.py` as a thin wrapper over a new `backend/app/services/agent_registry.py` that lists skills from the Agent Registry API, filtering to entries without a `publisher` field (the project's catalog includes ~64 platform/vendor skills alongside JARVIS's own) and using `displayName` for naming (`skills.list` responses never include `frontmatter`, only single-resource GETs do).
- [ ] 4.7 Add `backend/tests/test_skills.py`: unconfigured project, auth failure, transport error, success (including the publisher-filtering and displayName-naming behavior).

## 5. Dashboard Agent Registry card

- [ ] 5.1 Delete `frontend/src/api/jaar.ts`.
- [ ] 5.2 `frontend/src/pages/Dashboard/Dashboard.tsx`: Agent Registry card sources its skills count from the existing `listSkills()` client call (deduplicated), shows "—" for MCP Servers/Agents/Prompts (`count: number | null`), "Open Registry" link only when a console URL env var is set.
- [ ] 5.3 Frontend build/typecheck clean (`tsc --noEmit`, `npm run build`); flag (don't silently skip) if no Dashboard.tsx test file exists to update.

## 6. Phase 2: GKE auto-discovery (non-blocking, ships the mechanism only)

- [ ] 6.1 `artifacts/servers/jarvis`: add `GET /.well-known/agent-card.json` via FastMCP's `custom_route`, returning a valid A2A Agent Card (name, description, version, skills derived from loaded tool modules).
- [ ] 6.2 `helm/jarvis/templates/mcp-deployment.yaml` (+ infra repo's vendored copy): add `registry.gke.io/functional-type: "AGENT"` label, `a2a-protocol.org/agent-card` annotation, `iam.gke.io/spiffe-identity-type: agent-identity` annotation. The MCP pod needs Workload Identity (share `jarvis-backend`'s KSA or a dedicated one — decide based on what SPIFFE identity issuance actually requires, verify empirically) with `automountServiceAccountToken: true` — confirm the infra repo's vendored copy doesn't have this hardened to `false` before relying on it (this session's own ServiceAccount work found exactly this class of admission/identity conflict once already).
- [ ] 6.3 Verify the Agent Card endpoint serves valid JSON against the deployed MCP server (port-forward + curl).
- [ ] 6.4 Verify via `GET .../mcpServers` whether the server appears in the registry. **Do not block this change's completion on this succeeding** — if it doesn't appear within a reasonable window (as it didn't in the prior session after 1+ hour), document the current state as an open item rather than debugging indefinitely.

## 7. Backend tests

- [ ] 7.1 Full `backend` suite passes (`uv run pytest tests/ -q`).
- [ ] 7.2 Confirm `backend/tests/test_workers.py` needs no changes (`Worker.skills` JSON shape unchanged).

## 8. Docs & local verification

- [ ] 8.1 Update `CLAUDE.md`: remove JAAR from repository structure/prerequisites/routing/Infrastructure sections; rewrite "Artifacts & Agent Registry (JAAR)" as "Artifacts & the GCP Agent Registry"; update worker privileged-pod bullet; add Known Limitations rows for the v1alpha API, VPC-SC download restriction, and GKE auto-discovery not-yet-confirmed status.
- [ ] 8.2 `uv run pytest tests/ -q` (backend), `npx tsc --noEmit` + `npm run build` (frontend), `uv run pytest tests/ -v` (MCP server) all pass.
- [ ] 8.3 `helm template helm/jarvis/` renders cleanly, no `JAAR`/`jaar` remnants except explanatory comments.

## 9. Cross-repo sync and live deployment — gated checkpoint, requires explicit user confirmation before proceeding

- [ ] 9.1 **STOP for explicit user confirmation** before any step below — production-affecting action on the `t2-d-sbx-arch` sandbox cluster, following this session's now-established sequence.
- [ ] 9.2 Build/push `jarvis-backend`, `jarvis-frontend`, `jarvis-worker`, and the MCP server images (only the ones that actually changed, per this session's established practice of targeted builds over full `make publish-images` runs, unless a full rebuild is specifically warranted).
- [ ] 9.3 Bump the CEL admission whitelist (`files/cel-policies-values.yaml`) and the vendored chart's `values.yaml` digests in the infra repo; `terraform plan`, review, then `apply`.
- [ ] 9.4 Push the infra repo branch; hard-refresh ArgoCD; watch for the stale-ReplicaSet quirk (scale old RS to 0 if `ProgressDeadlineExceeded`) and the ConfigMap-env-var-staleness quirk (rollout-restart the backend if `WORKER_IMAGE` env var doesn't match the new digest) — both confirmed recurring on this cluster earlier this session.
- [ ] 9.5 Verification checklist, mirroring the prior session's own: no `privileged`/dind on a skill-enabled worker pod created via a real API call · a worker with skills actually gets the files onto its filesystem · JAAR fully absent from any live resource · dashboard Agent Registry card shows the correct skill count · Agent Card endpoint serves valid JSON · Fleet membership still present.
