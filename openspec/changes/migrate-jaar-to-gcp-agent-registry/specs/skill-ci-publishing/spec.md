## MODIFIED Requirements

### Requirement: GitHub Actions workflow publishes skill revisions to the Agent Registry
The `artifacts-publish.yml` workflow SHALL include a `publish-skills` job that publishes a new `Skill`/`SkillRevision` to the GCP Agent Registry API on push to `main` when files under `artifacts/skills/` change. The job SHALL use a matrix strategy with one entry per skill directory containing a `SKILL.md`. No Docker image is built for skills.

#### Scenario: Skill revision published on push to main
- **WHEN** a commit is pushed to `main` that modifies files under `artifacts/skills/planner__daily_wrap_up/`
- **THEN** the workflow zips the directory's contents and publishes a new `SkillRevision` under `skills/planner-daily-wrap-up` in the Agent Registry

#### Scenario: Version extracted from SKILL.md
- **WHEN** the workflow publishes a skill revision
- **THEN** the revision's version metadata is extracted from the `version` field in `SKILL.md` YAML frontmatter, falling back to a content-hash-derived identifier if the field is absent

#### Scenario: First publish creates the Skill container
- **WHEN** a skill directory is published for the first time (no existing `Skill` resource for that `skillId`)
- **THEN** the workflow calls `skills.create` with an inline `initialRevision`; subsequent publishes call `skills.revisions.create` against the existing `Skill`

### Requirement: Makefile provides skill sync targets
The Makefile SHALL include a `sync-artifacts-skills` target that publishes skill directories under `artifacts/skills/` to the GCP Agent Registry Skills API. The existing `sync-artifacts` target SHALL invoke `sync-artifacts-skills` alongside `sync-artifacts-servers`.

#### Scenario: Sync publishes skill to the Agent Registry
- **WHEN** `make sync-artifacts-skills` is executed with valid GCP credentials configured
- **THEN** all skill directories under `artifacts/skills/` are published (created or revised) in the Agent Registry Skills API

#### Scenario: sync-artifacts includes skills
- **WHEN** `make sync-artifacts` is executed
- **THEN** both `sync-artifacts-servers` and `sync-artifacts-skills` targets are invoked

### Requirement: Skill naming convention
Skill directory names in `artifacts/skills/` SHALL use double-underscore (`__`) to separate namespace from name (e.g., `planner__daily_wrap_up`). The published `skillId` SHALL convert underscores to hyphens (e.g., `planner-daily-wrap-up`), matching the Agent Registry's `skillId` format requirements (`^[a-z]([a-z0-9-]{0,61}[a-z0-9])?$`).

#### Scenario: Name conversion for publishing
- **WHEN** a skill directory named `planner__daily_wrap_up` is published
- **THEN** the Agent Registry `skillId` is `planner-daily-wrap-up`

## REMOVED Requirements

### Requirement: Skill without Dockerfile is skipped
**Reason**: Skills are no longer packaged as Docker/OCI images — the Agent Registry Skills API accepts a zipped `SKILL.md` + assets directly, so there is no Dockerfile to check for.
**Migration**: No action needed; any skill directory with a `SKILL.md` is publishable regardless of whether it has a `Dockerfile`. Per-skill `Dockerfile`s are deleted as part of this change.

### Requirement: Build uses arctl skill build
**Reason**: Publishing no longer goes through `arctl`/JAAR OCI image build-and-push — it calls the Agent Registry API's `skills.create`/`skills.revisions.create` methods directly.
**Migration**: CI and Makefile targets are updated to call the Agent Registry API (via `gcloud`/REST) instead of `arctl skill build --push`.
