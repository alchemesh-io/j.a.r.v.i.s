## MODIFIED Requirements

### Requirement: GitHub Actions workflow syncs skill files to GCS
The `artifacts-publish.yml` workflow SHALL include a `publish-skills` job that uploads each skill directory's `SKILL.md` and asset files directly to the skills GCS bucket on push to `main` when files under `artifacts/skills/` change. The job SHALL use a matrix strategy with one entry per skill directory. No Docker image is built for skills.

#### Scenario: Skill files synced on push to main
- **WHEN** a commit is pushed to `main` that modifies files under `artifacts/skills/planner__daily_wrap_up/`
- **THEN** the workflow uploads the skill's `SKILL.md` and assets to `gs://<SKILLS_BUCKET>/planner-daily-wrap-up/<version>/`

#### Scenario: Version extracted from SKILL.md
- **WHEN** the workflow syncs a skill's files
- **THEN** the destination version prefix is extracted from the `version` field in `SKILL.md` YAML frontmatter, falling back to `latest` if the field is absent

#### Scenario: Skill directory without SKILL.md is skipped
- **WHEN** a directory exists under `artifacts/skills/` without a `SKILL.md` file
- **THEN** the workflow does not attempt to sync that directory

### Requirement: Makefile provides skill sync targets
The Makefile SHALL include a `sync-artifacts-skills` target that uploads skill files from `artifacts/skills/` to the skills GCS bucket for local development. The existing `sync-artifacts` target SHALL invoke `sync-artifacts-skills` alongside `sync-artifacts-servers`.

#### Scenario: Sync publishes skill to GCS
- **WHEN** `make sync-artifacts-skills` is executed with `SKILLS_BUCKET` configured
- **THEN** all skill directories under `artifacts/skills/` are uploaded to `gs://<SKILLS_BUCKET>/<name>/<version>/`

#### Scenario: sync-artifacts includes skills
- **WHEN** `make sync-artifacts` is executed
- **THEN** both `sync-artifacts-servers` and `sync-artifacts-skills` targets are invoked
