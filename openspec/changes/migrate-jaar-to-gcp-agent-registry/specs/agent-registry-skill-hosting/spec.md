## ADDED Requirements

### Requirement: Skills are published as versioned Skill Revisions in the GCP Agent Registry
Publishing `artifacts/skills/<name>/` (SKILL.md + assets, zipped) SHALL create or update a `Skill` resource in the GCP Agent Registry API (`agentregistry.googleapis.com`) identified by a `skillId` derived from the skill's directory name (double-underscore converted to hyphens, matching the existing naming convention). The first publish of a skill SHALL create the `Skill` container with an inline `initialRevision`; subsequent publishes SHALL create a new `SkillRevision` under the existing `Skill` via `skills.revisions.create`.

#### Scenario: First publish creates the Skill container and initial revision
- **WHEN** `artifacts/skills/planner__daily_wrap_up/` is published for the first time
- **THEN** a `Skill` resource is created with `skillId: planner-daily-wrap-up` and an inline `initialRevision` containing the zipped `SKILL.md` + assets

#### Scenario: Subsequent publish creates a new revision under the existing Skill
- **WHEN** `artifacts/skills/planner__daily_wrap_up/` is published again after a content change
- **THEN** a new `SkillRevision` is created under `skills/planner-daily-wrap-up` via `skills.revisions.create`, and the `Skill`'s `defaultRevision` is updated to point at it

### Requirement: Skill frontmatter maps to the Agent Registry Frontmatter schema
The publishing mechanism SHALL extract `name`, `description`, `license`, `compatibility`, and any custom metadata fields from each skill's `SKILL.md` YAML frontmatter and populate the corresponding `Frontmatter` fields on the `Skill`/`SkillRevision` resource.

#### Scenario: Frontmatter fields populate the registry resource
- **WHEN** `artifacts/skills/planner__daily_wrap_up/SKILL.md` has frontmatter `{name: planner-daily-wrap-up, description: "...", license: MIT}`
- **THEN** the created `SkillRevision`'s `frontmatter.name`, `frontmatter.description`, and `frontmatter.license` match those values

### Requirement: Worker fetches skill payloads via authenticated media download
The worker entrypoint SHALL resolve a skill reference (`{name, version}`) to a specific `SkillRevision` — using the `Skill`'s `defaultRevision` when `version` is `"latest"`, or a pinned revision name otherwise — then fetch the revision's zip payload via an authenticated `GET .../skills/{skill}/revisions/{revision}?alt=media` request, using a bearer token obtained via Workload Identity (`gcloud auth print-access-token`). The downloaded zip SHALL be extracted into the skill's target directory.

#### Scenario: Latest version resolves via defaultRevision
- **WHEN** the worker fetches skill reference `{name: "planner-daily-wrap-up", version: "latest"}`
- **THEN** it first calls `GET .../skills/planner-daily-wrap-up` to read `defaultRevision`, then downloads that revision's payload via `alt=media`

#### Scenario: Pinned version resolves directly
- **WHEN** the worker fetches skill reference `{name: "planner-daily-wrap-up", version: "v2"}`
- **THEN** it downloads `.../skills/planner-daily-wrap-up/revisions/v2?alt=media` directly without reading the Skill resource first

#### Scenario: Downloaded payload is extracted into the skill directory
- **WHEN** a skill revision's zip payload is downloaded
- **THEN** its contents (including `SKILL.md`) are extracted into `<skills-dir>/<skill-name>/`

### Requirement: Skill-enabled worker pods run unprivileged
Worker pods configured with one or more skill references SHALL NOT set `privileged: true` on any container, and SHALL NOT run a docker-in-docker sidecar. Skill fetching SHALL require no local docker daemon.

#### Scenario: Pod spec has no privileged containers when skills are configured
- **WHEN** a worker pod is created for a worker with `skills: [{"name": "planner-daily-wrap-up", "version": "latest"}]`
- **THEN** no container in the pod spec has `securityContext.privileged: true`

#### Scenario: Worker fetch failure surfaces a clear error
- **WHEN** the Agent Registry API call fails (auth error, missing skill, network failure)
- **THEN** the entrypoint logs a clear, actionable error identifying the failed skill and does not silently continue as if the skill were present
