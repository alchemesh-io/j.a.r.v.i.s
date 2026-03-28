## ADDED Requirements

### Requirement: GitHub Actions workflow builds and publishes Docker images
The system SHALL provide GitHub Actions workflows that automatically build and push Docker images for the backend and frontend to GitHub Container Registry (GHCR) on every push to `main`.

#### Scenario: Image published on push to main
- **WHEN** a commit is pushed to the `main` branch
- **THEN** GitHub Actions builds the backend and frontend Docker images and pushes them to `ghcr.io/<org>/jarvis-backend:<sha>` and `ghcr.io/<org>/jarvis-frontend:<sha>` respectively

#### Scenario: Image tagged with git SHA
- **WHEN** the workflow publishes an image
- **THEN** the image is tagged with both the short git commit SHA and `latest`

#### Scenario: Workflow uses GITHUB_TOKEN for authentication
- **WHEN** the workflow pushes to GHCR
- **THEN** it authenticates using the built-in `GITHUB_TOKEN` secret without requiring any manually configured credentials

### Requirement: Workflow fails fast on build errors
The CI workflow SHALL fail and report an error if either Docker image fails to build.

#### Scenario: Build failure stops the workflow
- **WHEN** the Docker build step exits non-zero for either service
- **THEN** the GitHub Actions job is marked as failed and no image is pushed

### Requirement: Images are publicly pullable
Images published to GHCR SHALL be publicly accessible without authentication.

#### Scenario: Public image pull
- **WHEN** a user runs `docker pull ghcr.io/<org>/jarvis-backend:latest`
- **THEN** the image is downloaded without requiring a login
