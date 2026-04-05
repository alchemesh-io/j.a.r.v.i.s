## MODIFIED Requirements

### Requirement: Vite.js frontend application skeleton
The system SHALL provide a Vite.js frontend application in the `frontend/` directory, implemented as a React single-page application. The Vite configuration SHALL set `base: '/jarvis/'` so all assets are served under the `/jarvis/` path prefix. The React Router SHALL use `basename="/jarvis"`. The API client base URL SHALL be `/jarvis/api/v1`.

#### Scenario: Development server starts
- **WHEN** developer runs `npm run dev` inside `frontend/`
- **THEN** the Vite development server starts on port 5173 and the application is accessible in a browser

#### Scenario: Production build succeeds
- **WHEN** `npm run build` is executed inside `frontend/`
- **THEN** a production bundle is emitted to `frontend/dist/` with all asset paths prefixed with `/jarvis/`

#### Scenario: Application routes use /jarvis base path
- **WHEN** the frontend is accessed via the ingress gateway
- **THEN** all client-side routes are prefixed with `/jarvis` (e.g., `/jarvis/dashboard`, `/jarvis/tasks`)

#### Scenario: API calls use /jarvis prefix
- **WHEN** the frontend makes API requests to the backend
- **THEN** requests are sent to `/jarvis/api/v1/*` paths
