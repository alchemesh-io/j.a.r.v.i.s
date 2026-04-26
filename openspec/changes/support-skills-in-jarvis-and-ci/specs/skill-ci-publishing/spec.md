# Spec: skill-ci-publishing

## Purpose

Defines the requirements for the CI/CD pipeline and Makefile targets that build, publish, and sync skill artifacts to GHCR and JAAR.

## ADDED Requirements

### Requirement: GitHub Actions workflow builds and publishes skill images
The `artifacts-publish.yml` workflow SHALL include a `publish-skills` job that builds skill Docker images and pushes them to GHCR on push to `main` when files under `artifacts/skills/` change. The job SHALL use a matrix strategy with one entry per skill directory containing a `Dockerfile`.

#### Scenario: Skill image published on push to main
- **WHEN** a commit is pushed to `main` that modifies files under `artifacts/skills/planner__daily_wrap_up/`
- **THEN** the workflow builds the skill image and pushes it to `ghcr.io/<org>/planner-daily-wrap-up:<version>` and `ghcr.io/<org>/planner-daily-wrap-up:latest`

#### Scenario: Version extracted from SKILL.md
- **WHEN** the workflow builds a skill image
- **THEN** the version tag is extracted from the `version` field in `SKILL.md` YAML frontmatter, falling back to `latest` if the field is absent

#### Scenario: Skill without Dockerfile is skipped
- **WHEN** a skill directory exists under `artifacts/skills/` without a `Dockerfile`
- **THEN** the workflow does not attempt to build that skill

#### Scenario: Build uses arctl skill build
- **WHEN** the workflow builds a skill image
- **THEN** it uses `arctl skill build <path> --image <registry>/<name>:<version> --push` to build and push, consistent with the MCP server publishing pattern

### Requirement: Makefile provides skill sync targets
The Makefile SHALL include a `sync-artifacts-skills` target that publishes skill images from GHCR to the local JAAR instance. The existing `sync-artifacts` target SHALL invoke `sync-artifacts-skills` alongside `sync-artifacts-servers`.

#### Scenario: Sync publishes skill to JAAR
- **WHEN** `make sync-artifacts-skills` is executed with JAAR running
- **THEN** all skill image tags from GHCR are published to the JAAR registry via `arctl skill publish`

#### Scenario: sync-artifacts includes skills
- **WHEN** `make sync-artifacts` is executed
- **THEN** both `sync-artifacts-servers` and `sync-artifacts-skills` targets are invoked

### Requirement: Skill naming convention
Skill directory names in `artifacts/skills/` SHALL use double-underscore (`__`) to separate namespace from name (e.g., `planner__daily_wrap_up`). The published image name SHALL convert underscores to hyphens (e.g., `planner-daily-wrap-up`).

#### Scenario: Name conversion for publishing
- **WHEN** a skill directory named `planner__daily_wrap_up` is published
- **THEN** the GHCR image is named `planner-daily-wrap-up`
