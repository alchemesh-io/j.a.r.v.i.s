## 1. Worker skill fetch (GCS, replaces arctl/JAAR)

- [x] 1.1 `worker/entrypoint.sh` Step 4: replace the dockerd bootstrap + GHCR docker-login + `arctl skill pull` loop with a loop that runs `gcloud storage cp -r "gs://$SKILLS_BUCKET/<name>/<version>" "<skill_dir>"` per pending skill reference; keep the existing cached-skip check (`SKILL.md` present) and cached/pulled counters
- [x] 1.2 `worker/entrypoint.sh`: log a clear error and continue (not silently skip) when `SKILLS` is non-empty but `SKILLS_BUCKET` is unset
- [x] 1.3 `worker/Dockerfile`: ensure `gcloud`/Google Cloud SDK (`gcloud storage` component) is present; remove `arctl` and dockerd-only-for-skills packages if not needed elsewhere (keep dockerd if still required for other privileged flows — check before removing). Done by switching the base image to `gcr.io/google.com/cloudsdktool/cloud-sdk:alpine` (Google's own Alpine + gcloud image) and dropping the `docker:dind` base, the `arctl` install stage, and the dockerd sudoers/env setup entirely
- [x] 1.4 `backend/app/services/k8s.py`: replace the `JAAR_URL` env var with `SKILLS_BUCKET` (sourced from a new `SKILLS_BUCKET` config/env value); remove the `has_skills` → `privileged=True` branch entirely so skill-enabled pods run unprivileged
- [x] 1.5 `backend/app/config.py`: not applicable — `JAAR_URL` was never in the Pydantic `Settings` class (it was a direct `os.getenv` in `k8s.py`/`routes/skills.py`, matching the pattern of other pod-env-vars like `WORKER_CPU_REQUEST`). `SKILLS_BUCKET` follows the same direct-env-var convention in both files; no `config.py` change needed

## 2. Skill artifact publishing to GCS

- [x] 2.1 Update the artifact-publishing GitHub Actions workflow: drop the skill Docker build/push job, add a step that uploads each `artifacts/skills/<name>/` directory's `SKILL.md` + assets to `gs://$SKILLS_BUCKET/<name>/<version>/` (version parsed from `SKILL.md` frontmatter, default `latest`) via `google-github-actions/auth` + `google-github-actions/upload-cloud-storage`
- [x] 2.2 Makefile: rewrite `sync-artifacts-skills` to upload `artifacts/skills/*` to the GCS bucket instead of publishing to JAAR; keep `sync-artifacts` invoking both `sync-artifacts-servers` and `sync-artifacts-skills`. `sync-artifacts-servers` becomes a no-op notice (MCP server registration is now automatic via GKE auto-discovery, not a manual publish step)
- [x] 2.3 Remove the per-skill `Dockerfile` under `artifacts/skills/<name>/` (e.g. `artifacts/skills/planner__daily_wrap_up/Dockerfile`) since no OCI image is built anymore

## 3. Remove JAAR

- [x] 3.1 Delete `helm/jaar/` (Chart.yaml, values.yaml, templates/, Chart.lock)
- [x] 3.2 Delete `argocd/jaar-app.yaml` and `argocd/jaar-app-local.yaml`
- [x] 3.3 Delete `secrets/jaar-secret.yaml` (if present locally) and `secrets/jaar-secret.example.yaml`
- [x] 3.4 Makefile: remove `_deploy-jaar-secrets`, `_helm-dep-update` (helm/jaar/), JAAR namespace labeling, JAAR data-mount dir; remove JAAR from `deploy`, `deploy-local`, `undeploy`, and `sync` targets
- [x] 3.5 Removed remaining `JAAR_URL`/`jaar` references: `helm/jarvis/templates/backend-configmap.yaml` (`JAAR_URL` → `SKILLS_BUCKET`), deleted `helm/jarvis/templates/jaar-destination-rule.yaml` (Istio DestinationRule pointing at the now-gone `jaar-agentregistry.jaar.svc`), rewrote `backend/app/routes/skills.py` to list from GCS instead of proxying JAAR's `/v0/skills`

## 4. Dashboard Agent Registry card

- [x] 4.1 Backend: rewrote the existing `GET /api/v1/skills` (`backend/app/routes/skills.py`) to list skills from the GCS bucket (name/version/description/is_latest) instead of proxying JAAR — this endpoint already backed the worker/task-board skill pickers, so reusing it for the dashboard count avoided adding a redundant endpoint
- [x] 4.2 Frontend: deleted `frontend/src/api/jaar.ts`; the dashboard now reuses the existing `listSkills()` from `frontend/src/api/client.ts` (already used by the skill pickers) instead of a JAAR-specific client
- [x] 4.3 `frontend/src/pages/Dashboard/Dashboard.tsx`: Agent Registry card now shows a skills count deduplicated from `listSkills()` and "—" for MCP Servers/Agents/Prompts (count typed `number | null`); "Open Registry" link only renders when `VITE_AGENT_REGISTRY_CONSOLE_URL` is set
- [ ] 4.4 Frontend tests: update/replace tests covering the Agent Registry card and API client for the new data source — not done yet, no existing Dashboard.tsx test file was found to update; flagged for follow-up if test coverage is added for this page

## 5. Backend tests

- [x] 5.1 Updated `backend/tests/test_k8s_service.py`: replaced the two privileged/unprivileged skills tests with a single `test_create_worker_pod_unprivileged_with_skills` (asserts `V1SecurityContext` is never called) and a new `test_create_worker_pod_passes_skills_bucket_env` (asserts `SKILLS_BUCKET` is set and `JAAR_URL` is gone)
- [x] 5.2 `backend/tests/test_workers.py`: no changes needed — its skills assertions target the unchanged `Worker.skills` JSON shape (name/version), not the JAAR/GCS distribution mechanism
- [x] 5.3 Added `backend/tests/test_skills.py` covering the rewritten `list_skills` route: unconfigured bucket, unavailable GCS client, successful multi-version listing, and error handling

## 6. Agent Registry registration (A2A Agent Card + GKE auto-discovery)

- [ ] 6.1 NOT STARTED — confirming whether the Gemini Enterprise Agent Platform API is enabled (or enable-able) in the target GCP project, and GKE Fleet/Hub membership + Workload Identity SPIFFE support, requires access to the actual target GCP project/cluster that this session does not have decided yet (see design.md Open Questions). Deferred per explicit instruction to skip this group for now.
- [ ] 6.2 NOT STARTED — depends on 6.1
- [ ] 6.3 NOT STARTED — depends on 6.1
- [ ] 6.4 NOT STARTED — depends on 6.1

## 7. Docs & verification

- [x] 7.1 Updated `CLAUDE.md`: removed JAAR from the repository structure tree, prerequisites table, cluster-up steps, routing sections, and Infrastructure section; rewrote "Artifacts & Agent Registry (JAAR)" as "Artifacts, skill hosting & Agent Registry" describing the GCS skill flow and Phase 2 registration; updated the worker privileged-pod bullet and idempotence bullet; added two Known Limitations rows for the GCS bucket and Gemini Enterprise prerequisites being unconfirmed (the previously-flagged `deny-privileged-containers` line was never actually present in this file's Known Limitations table, so nothing to remove there)
- [x] 7.2 Ran `uv run pytest tests/ -q` in `backend/` (233 passed), `npx tsc --noEmit` + `npm run build` in `frontend/` (clean), and `npm test` in `frontend/packages/jads/` (85 passed) — no regressions
- [x] 7.3 Re-scoped to match what actually changed this round (task group 6's labels/annotations are deferred): ran `helm template helm/jarvis/` — renders cleanly with `SKILLS_BUCKET: ""` in the ConfigMap and no `JAAR`/`jaar` remnants anywhere in the rendered output
