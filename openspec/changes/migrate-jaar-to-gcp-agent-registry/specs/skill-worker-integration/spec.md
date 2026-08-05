## MODIFIED Requirements

### Requirement: Worker model stores skill references as JSON
The `Worker` model SHALL include a `skills` column (`sa.JSON`, default `[]`) storing a list of skill reference objects. Each object contains `name` (string) and `version` (string). These reference skills registered in the GCP Agent Registry API (`agentregistry.googleapis.com`) — no local `Skill` table exists.

#### Scenario: Worker created with skill references
- **WHEN** a worker is created with `skills: [{"name": "planner-daily-wrap-up", "version": "0.1.0"}]`
- **THEN** the `skills` JSON column stores that list

#### Scenario: Worker created without skills
- **WHEN** a worker is created without specifying `skills`
- **THEN** the `skills` JSON column defaults to `[]`

#### Scenario: Alembic migration adds skills column
- **WHEN** Alembic migrations are run
- **THEN** the `worker` table includes a `skills` JSON column with default `[]`

### Requirement: Worker entrypoint fetches skills from the GCP Agent Registry
The worker entrypoint SHALL parse the `SKILLS` env var, splitting on commas and then on `@` to extract name and version. For each entry it SHALL resolve the corresponding `SkillRevision` in the GCP Agent Registry API (using the Skill's `defaultRevision` when version is `"latest"`, or the pinned revision otherwise) and download its payload via an authenticated `GET .../revisions/{revision}?alt=media` request (bearer token from Workload Identity), extracting the zip into the skill's target directory. If `SKILLS` is empty, no skills are fetched. No `arctl` invocation or `JAAR_URL` reference remains in this path.

#### Scenario: Selective skill fetch
- **WHEN** the worker starts with `SKILLS=planner-daily-wrap-up@0.1.0,code-reviewer@latest`
- **THEN** the entrypoint fetches `planner-daily-wrap-up` revision `0.1.0` and `code-reviewer`'s `defaultRevision` from the Agent Registry API and extracts both into their skill directories

#### Scenario: No skills configured
- **WHEN** the worker starts with `SKILLS` empty or unset
- **THEN** the entrypoint skips skill fetching entirely

### Requirement: Stateful worker entrypoint skips skill fetch for already-pulled skills

When the worker is in stateful mode, the entrypoint SHALL skip the Agent Registry fetch for any skill whose target directory already exists with a non-empty content marker — specifically when `/home/node/.claude/skills/<skill-name>/SKILL.md` (or, failing that, any non-empty file) is present. This avoids re-fetching skills on restart and avoids overwriting user-modified skill content. Ephemeral worker behaviour is unchanged: every skill in `SKILLS` is fetched on every start.

#### Scenario: Stateful restart skips already-pulled skill
- **WHEN** a stateful worker pod starts with `SKILLS=planner-daily-wrap-up@0.1.0,code-reviewer@latest`
- **AND** `/home/node/.claude/skills/planner-daily-wrap-up/SKILL.md` already exists from a prior run
- **AND** `/home/node/.claude/skills/code-reviewer/` does not exist yet
- **THEN** the entrypoint SHALL NOT re-fetch `planner-daily-wrap-up` from the Agent Registry
- **AND** the entrypoint SHALL fetch `code-reviewer`'s `latest` revision from the Agent Registry for the missing skill

#### Scenario: First start of stateful worker fetches all skills
- **WHEN** a stateful worker pod starts for the first time with `SKILLS=planner-daily-wrap-up@0.1.0`
- **AND** `/home/node/.claude/skills/` is empty
- **THEN** the entrypoint fetches `planner-daily-wrap-up` revision `0.1.0` from the Agent Registry

#### Scenario: Ephemeral worker still fetches every skill on every start
- **WHEN** an ephemeral worker pod starts with `SKILLS=planner-daily-wrap-up@0.1.0`
- **THEN** the entrypoint fetches `planner-daily-wrap-up` revision `0.1.0` from the Agent Registry
- **AND** the existing skill-worker-integration spec governs the rest of the behaviour
