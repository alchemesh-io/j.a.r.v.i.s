# Spec: skill-worker-integration

## Purpose

Defines the requirements for storing JAAR skill references (name + version) on workers and passing them to worker pods for selective skill pulling.

## ADDED Requirements

### Requirement: Worker model stores skill references as JSON
The `Worker` model SHALL include a `skills` column (`sa.JSON`, default `[]`) storing a list of skill reference objects. Each object contains `name` (string) and `version` (string). These reference skills registered in the JAAR (AgentRegistry) — no local `Skill` table exists.

#### Scenario: Worker created with skill references
- **WHEN** a worker is created with `skills: [{"name": "planner-daily-wrap-up", "version": "0.1.0"}]`
- **THEN** the `skills` JSON column stores that list

#### Scenario: Worker created without skills
- **WHEN** a worker is created without specifying `skills`
- **THEN** the `skills` JSON column defaults to `[]`

#### Scenario: Alembic migration adds skills column
- **WHEN** Alembic migrations are run
- **THEN** the `worker` table includes a `skills` JSON column with default `[]`

### Requirement: Worker creation accepts skill references
The `WorkerCreate` schema SHALL accept an optional `skills` field as a list of `SkillRef` objects (Pydantic model with `name: str` and `version: str = "latest"`). The worker creation route SHALL store these references on the `Worker.skills` JSON column.

#### Scenario: Create worker with versioned skills
- **WHEN** `POST /api/v1/workers` is called with `{"task_id": 1, "skills": [{"name": "planner-daily-wrap-up", "version": "0.1.0"}, {"name": "code-reviewer"}]}`
- **THEN** the worker is created with `skills` containing both entries, the second defaulting to `version: "latest"`

#### Scenario: Create worker with empty skills
- **WHEN** `POST /api/v1/workers` is called with `{"task_id": 1, "skills": []}`
- **THEN** the worker is created with an empty `skills` list

### Requirement: Worker response exposes skill references
The `WorkerResponse` schema SHALL include a `skills` field containing the list of skill reference objects stored on the worker.

#### Scenario: Worker response shows skills
- **WHEN** `GET /api/v1/workers/{id}` returns a worker with two skill references
- **THEN** the response includes `skills` with both `name` and `version` for each entry

### Requirement: Worker pod receives skill references via environment variable
When creating a worker pod, the K8s service SHALL serialize the worker's skill references into a `SKILLS` environment variable as comma-separated `name@version` pairs (e.g., `planner-daily-wrap-up@0.1.0,code-reviewer@latest`). If the worker has no skills, `SKILLS` SHALL be empty.

#### Scenario: Skills passed to worker pod
- **WHEN** a worker pod is created for a worker with skills `[{"name": "planner-daily-wrap-up", "version": "0.1.0"}, {"name": "code-reviewer", "version": "latest"}]`
- **THEN** the pod's `SKILLS` environment variable is `planner-daily-wrap-up@0.1.0,code-reviewer@latest`

#### Scenario: No skills results in empty env var
- **WHEN** a worker pod is created for a worker with an empty skills list
- **THEN** the pod's `SKILLS` environment variable is empty

### Requirement: Worker entrypoint pulls skills by name and version
The worker entrypoint SHALL parse the `SKILLS` env var, splitting on commas and then on `@` to extract name and version. For each entry it SHALL run `arctl skill pull "<name>" --version "<version>" --registry "$JAAR_URL"`. If `SKILLS` is empty, no skills are pulled.

#### Scenario: Selective skill pull
- **WHEN** the worker starts with `SKILLS=planner-daily-wrap-up@0.1.0,code-reviewer@latest`
- **THEN** the entrypoint pulls `planner-daily-wrap-up` at version `0.1.0` and `code-reviewer` at version `latest` from JAAR

#### Scenario: No skills configured
- **WHEN** the worker starts with `SKILLS` empty or unset
- **THEN** the entrypoint skips skill pulling entirely

### Requirement: Worker card renders skill references with consistent iconography
The Workers page worker card SHALL render each skill reference as a row visually consistent with repository rows but visually distinct as a different artifact type. The icon SHALL be a monochrome SVG (not an emoji) using `currentColor` so it inherits the surrounding text color, mirroring the repository icon style. Skill rows SHALL use an amber accent (`#f59e0b`) for the icon and version badge to differentiate them from the cyan-accented repository rows. The version SHALL be displayed in monospace to match commit/identifier styling elsewhere on the card.

#### Scenario: Skill row uses SVG icon, not emoji
- **WHEN** a worker with one or more skills is rendered on the Workers page
- **THEN** each skill row displays a `SkillBoltIcon` SVG (lightning bolt) styled with `currentColor` rather than the `⚡` emoji

#### Scenario: Skill rows are visually distinct from repository rows
- **WHEN** a worker has both repositories and skills
- **THEN** repository rows use the cyan accent (`var(--color-accent-cyan)`) and skill rows use the amber accent (`#f59e0b`) for the icon and version badge

#### Scenario: Skill version displayed in monospace
- **WHEN** a skill row is rendered
- **THEN** the version badge text uses monospace font, matching the worker ID styling in the card footer

#### Scenario: Create-worker skill picker uses the same SVG icon
- **WHEN** the Create Worker overlay renders the skill picker (on the Workers page or the Task Board worker-create flow)
- **THEN** each selectable skill entry uses the `SkillBoltIcon` SVG, not the `⚡` emoji, for visual consistency with the worker card

#### Scenario: TaskBoard worker-create skill picker uses the amber accent
- **WHEN** the Task Board's inline worker-create panel renders the skill picker
- **THEN** the skill icon is rendered with the amber accent (`#f59e0b`) via the `task-board__worker-skill-icon` class, mirroring the Workers page styling
