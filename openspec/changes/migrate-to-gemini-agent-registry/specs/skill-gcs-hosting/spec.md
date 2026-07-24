## ADDED Requirements

### Requirement: GCS bucket layout for skill artifacts
Skill artifacts SHALL be stored in a dedicated GCS bucket as plain files, one object prefix per skill version: `gs://<SKILLS_BUCKET>/<skill-name>/<version>/SKILL.md` plus any accompanying asset files under the same prefix. No OCI image or Dockerfile is required per skill.

#### Scenario: Skill content addressable by name and version
- **WHEN** a skill named `planner-daily-wrap-up` at version `0.1.0` is published
- **THEN** its `SKILL.md` and assets are readable at `gs://<SKILLS_BUCKET>/planner-daily-wrap-up/0.1.0/`

### Requirement: Worker fetches skills from GCS via Workload Identity
The worker entrypoint SHALL fetch skill content by running `gcloud storage cp -r "gs://$SKILLS_BUCKET/<name>/<version>" "<skill_dir>"` (or an equivalent GCS copy command), authenticating via the pod's Workload Identity — no static GCS credentials or service-account key files SHALL be baked into the worker image or passed as environment variables.

#### Scenario: Skill fetched via Workload Identity
- **WHEN** a worker pod with Workload Identity bound to a GCS-read-capable Google service account starts with a pending skill reference
- **THEN** the entrypoint copies the skill's objects from `gs://$SKILLS_BUCKET/<name>/<version>/` into the skill's local directory without any explicit credential file

#### Scenario: Missing bucket configuration fails loudly
- **WHEN** the worker has pending skill references but the `SKILLS_BUCKET` environment variable is empty or unset
- **THEN** the entrypoint logs a clear error identifying the missing configuration and does not silently skip the skill pull

### Requirement: Skill-enabled worker pods run unprivileged
Worker pods SHALL NOT set `privileged: true` and SHALL NOT start a docker daemon, regardless of whether the worker has skill references. Skill retrieval SHALL require no container runtime beyond the `gcloud`/GCS copy tooling already present in the worker image.

#### Scenario: Pod spec omits privileged security context for skills
- **WHEN** a worker pod is created for a worker with one or more skill references
- **THEN** the pod's `worker` container security context does not set `privileged: true`

#### Scenario: No dockerd bootstrap for skill pulls
- **WHEN** the worker entrypoint runs its skill-pull step
- **THEN** it does not start, wait on, or stop a docker daemon
