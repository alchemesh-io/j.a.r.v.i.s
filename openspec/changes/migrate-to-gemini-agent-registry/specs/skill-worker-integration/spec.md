## MODIFIED Requirements

### Requirement: Worker pod receives skill references via environment variable
When creating a worker pod, the K8s service SHALL serialize the worker's skill references into a `SKILLS` environment variable as comma-separated `name@version` pairs (e.g., `planner-daily-wrap-up@0.1.0,code-reviewer@latest`). If the worker has no skills, `SKILLS` SHALL be empty. The pod SHALL also receive a `SKILLS_BUCKET` environment variable naming the GCS bucket hosting skill content, replacing the previous `JAAR_URL` variable.

#### Scenario: Skills passed to worker pod
- **WHEN** a worker pod is created for a worker with skills `[{"name": "planner-daily-wrap-up", "version": "0.1.0"}, {"name": "code-reviewer", "version": "latest"}]`
- **THEN** the pod's `SKILLS` environment variable is `planner-daily-wrap-up@0.1.0,code-reviewer@latest`

#### Scenario: No skills results in empty env var
- **WHEN** a worker pod is created for a worker with an empty skills list
- **THEN** the pod's `SKILLS` environment variable is empty

#### Scenario: Pod receives GCS bucket instead of JAAR URL
- **WHEN** a worker pod is created for a worker with one or more skill references
- **THEN** the pod's environment includes `SKILLS_BUCKET` and does not include `JAAR_URL`

### Requirement: Worker entrypoint pulls skills by name and version
The worker entrypoint SHALL parse the `SKILLS` env var, splitting on commas and then on `@` to extract name and version. For each entry it SHALL run `gcloud storage cp -r "gs://$SKILLS_BUCKET/<name>/<version>" "<skill_dir>"` (or an equivalent GCS copy command) to fetch the skill's `SKILL.md` and assets. If `SKILLS` is empty, no skills are pulled.

#### Scenario: Selective skill pull
- **WHEN** the worker starts with `SKILLS=planner-daily-wrap-up@0.1.0,code-reviewer@latest`
- **THEN** the entrypoint copies `gs://$SKILLS_BUCKET/planner-daily-wrap-up/0.1.0/` and `gs://$SKILLS_BUCKET/code-reviewer/latest/` into their respective local skill directories

#### Scenario: No skills configured
- **WHEN** the worker starts with `SKILLS` empty or unset
- **THEN** the entrypoint skips skill pulling entirely

### Requirement: Stateful worker entrypoint skips skill pull for already-pulled skills

When the worker is in stateful mode, the entrypoint SHALL skip the GCS skill fetch for any skill whose target directory already exists with a non-empty content marker — specifically when `/home/node/.claude/skills/<skill-name>/SKILL.md` (or, failing that, any non-empty file) is present. This avoids re-pulling skills on restart and avoids overwriting user-modified skill content. Ephemeral worker behaviour is unchanged: every skill in `SKILLS` is pulled on every start.

#### Scenario: Stateful restart skips already-pulled skill
- **WHEN** a stateful worker pod starts with `SKILLS=planner-daily-wrap-up@0.1.0,code-reviewer@latest`
- **AND** `/home/node/.claude/skills/planner-daily-wrap-up/SKILL.md` already exists from a prior run
- **AND** `/home/node/.claude/skills/code-reviewer/` does not exist yet
- **THEN** the entrypoint SHALL NOT fetch `planner-daily-wrap-up` from GCS
- **AND** the entrypoint SHALL run `gcloud storage cp -r "gs://$SKILLS_BUCKET/code-reviewer/latest" "<skill_dir>"` for the missing skill

#### Scenario: First start of stateful worker pulls all skills
- **WHEN** a stateful worker pod starts for the first time with `SKILLS=planner-daily-wrap-up@0.1.0`
- **AND** `/home/node/.claude/skills/` is empty
- **THEN** the entrypoint fetches `planner-daily-wrap-up` at version `0.1.0` from GCS

#### Scenario: Ephemeral worker still pulls every skill on every start
- **WHEN** an ephemeral worker pod starts with `SKILLS=planner-daily-wrap-up@0.1.0`
- **THEN** the entrypoint fetches `planner-daily-wrap-up` at version `0.1.0` from GCS
- **AND** the existing skill-worker-integration spec governs the rest of the behaviour
