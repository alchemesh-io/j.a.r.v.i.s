## MODIFIED Requirements

### Requirement: Vite.js frontend application skeleton
The system SHALL provide a Vite.js frontend application in the `frontend/` directory, implemented as a React single-page application. No `base` path prefix is needed — the frontend is served at the root of its hostname (`main.jarvis.io`). The API client base URL SHALL be `/api/v1`. The Vite dev proxy SHALL forward `/api`, `/docs`, and `/openapi.json` to the backend.

#### Scenario: Development server starts
- **WHEN** developer runs `npm run dev` inside `frontend/`
- **THEN** the Vite development server starts on port 5173 and the application is accessible in a browser

#### Scenario: Production build succeeds
- **WHEN** `npm run build` is executed inside `frontend/`
- **THEN** a production bundle is emitted to `frontend/dist/` with standard asset paths (no prefix)

#### Scenario: Application routes use root paths
- **WHEN** the frontend is accessed via `main.jarvis.io`
- **THEN** client-side routes are at the root (e.g., `/`, `/tasks`) — host-based routing eliminates the need for path prefixes

#### Scenario: API calls use standard paths
- **WHEN** the frontend makes API requests to the backend
- **THEN** requests are sent to `/api/v1/*` on the same hostname
