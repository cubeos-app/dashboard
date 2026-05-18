# Requirements — API client + auth (spec/001 — RETROSPECTIVE)

Source: `src/api/client.js`, `src/api/demo-client.js`, `src/stores/auth.js` (CGC-verified via file inspection 2026-05-18).

> Retrospective. Both client.js and the auth store have shipped. ID convention: 001-block (`001..099`).

## Client construction

REQ-001: The system shall expose a single `api` object from `src/api/client.js` that components import via `import api from '@/api/client'`.
REQ-002: When the build flag VITE_DEMO_MODE=true is set, the Vite resolve.alias shall swap `src/api/client.js` for `src/api/demo-client.js` (Article C-IV).
REQ-003: The system shall use `import.meta.env.VITE_API_BASE_URL` as the base URL, defaulting to `/api` (same-origin via nginx reverse proxy).

## JWT lifecycle

REQ-004: When a user successfully authenticates via POST /api/v1/auth/login, the system shall store the returned JWT in `localStorage.jwt` keyed by `window.location.hostname`.
REQ-005: The system shall attach `Authorization: Bearer <jwt>` to every outgoing API request via a request interceptor.
REQ-006: While the JWT is missing or expired (HTTP 401 response), the system shall clear `localStorage.jwt` and redirect to `/login` via the router.
REQ-007: When a JWT is within 5 minutes of expiry, the system shall call POST /api/v1/auth/refresh in the background to extend it.

## Retry policy

REQ-008: The system shall retry idempotent requests (GET, HEAD, PUT, DELETE) up to 2 times on network error with exponential backoff (200ms, 600ms).
REQ-009: The system shall NEVER retry POST, PATCH requests automatically — operator confirmation required.
REQ-010: When a 5xx response is received, the system shall surface the error to the toast notification system without retrying.

## Error mapping

REQ-011: The system shall map HTTP responses to typed errors: 401 → AuthError, 403 → ForbiddenError, 404 → NotFoundError, 5xx → ServerError, network → NetworkError.
REQ-012: The system shall expose a uniform shape `{ ok: boolean, data?: T, error?: { type: string, message: string, status?: number } }` from every api method.

## Demo mode

REQ-013: The system shall serve static fixtures from `src/api/demo-data.js` for every endpoint the demo build exposes.
REQ-014: While in demo mode, the system shall reject all mutation methods (POST/PUT/DELETE) with `{ ok: false, error: { type: 'DemoModeError', message: '...' } }`.

## Out of scope

REQ-015: The system shall NOT implement OAuth flows in this spec — local JWT only. Future spec/004-oauth-providers handles SSO.
REQ-016: The system shall NOT cover WebSocket transport in this spec — covered by future spec/002-realtime-streams.
