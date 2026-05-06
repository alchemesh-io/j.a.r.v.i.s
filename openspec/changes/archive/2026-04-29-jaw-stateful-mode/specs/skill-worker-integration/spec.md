# Spec Delta: skill-worker-integration

## ADDED Requirements

### Requirement: Stateful worker entrypoint skips skill pull for already-pulled skills

When the worker is in stateful mode, the entrypoint SHALL skip `arctl skill pull` for any skill whose target directory already exists with a non-empty content marker — specifically when `/home/node/.claude/skills/<skill-name>/SKILL.md` (or, failing that, any non-empty file) is present. This avoids re-pulling skills on restart and avoids overwriting user-modified skill content. Ephemeral worker behaviour is unchanged: every skill in `SKILLS` is pulled on every start.

#### Scenario: Stateful restart skips already-pulled skill

- **WHEN** a stateful worker pod starts with `SKILLS=planner-daily-wrap-up@0.1.0,code-reviewer@latest`
- **AND** `/home/node/.claude/skills/planner-daily-wrap-up/SKILL.md` already exists from a prior run
- **AND** `/home/node/.claude/skills/code-reviewer/` does not exist yet
- **THEN** the entrypoint SHALL NOT call `arctl skill pull` for `planner-daily-wrap-up`
- **AND** the entrypoint SHALL call `arctl skill pull "code-reviewer" --version "latest" --registry-url "$JAAR_URL"` for the missing skill

#### Scenario: First start of stateful worker pulls all skills

- **WHEN** a stateful worker pod starts for the first time with `SKILLS=planner-daily-wrap-up@0.1.0`
- **AND** `/home/node/.claude/skills/` is empty
- **THEN** the entrypoint pulls `planner-daily-wrap-up` at version `0.1.0` from JAAR

#### Scenario: Ephemeral worker still pulls every skill on every start

- **WHEN** an ephemeral worker pod starts with `SKILLS=planner-daily-wrap-up@0.1.0`
- **THEN** the entrypoint pulls `planner-daily-wrap-up` at version `0.1.0` from JAAR
- **AND** the existing skill-worker-integration spec governs the rest of the behaviour
