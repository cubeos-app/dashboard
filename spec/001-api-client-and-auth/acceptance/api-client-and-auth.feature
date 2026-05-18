Feature: API client + auth (spec/001 — RETROSPECTIVE)

  # Covers: REQ-001, REQ-002, REQ-003, REQ-004, REQ-005, REQ-006, REQ-007, REQ-008, REQ-009, REQ-010, REQ-011, REQ-012, REQ-013, REQ-014, REQ-015, REQ-016

  Background:
    Given the dashboard is loaded in a browser at https://cubeos.local

  # REQ-001 + REQ-003 — single client + base URL
  Scenario: Components import the single api object from client.js
    When a component imports `@/api/client`
    Then it receives an object with namespaces (auth, apps, hardware, ...)
    And the base URL defaults to "/api" when VITE_API_BASE_URL is not set

  # REQ-002 — demo build swap
  Scenario: Demo build swaps client.js for demo-client.js
    When `VITE_DEMO_MODE=true npm run build:demo` runs
    Then dist/ bundle contains DemoModeError string
    And the regular client.js code is absent from the bundle

  # REQ-004 — JWT keyed by hostname
  Scenario: JWT keyed by hostname allows multiple CubeOS boxes
    Given two boxes at cubeos-a.local and cubeos-b.local
    When the operator logs into both in the same browser
    Then localStorage has BOTH cubeos.jwt.cubeos-a.local AND cubeos.jwt.cubeos-b.local
    And neither JWT is sent to the other host

  # REQ-005 + REQ-006 — JWT lifecycle
  Scenario: 401 response clears JWT and redirects to /login
    Given a stored JWT in localStorage
    When an api call returns HTTP 401
    Then localStorage.jwt is cleared
    And the router pushes to /login

  # REQ-007 — proactive refresh
  Scenario: JWT within 5 min of expiry triggers background refresh
    Given a JWT expiring in 4 minutes
    When any api call goes through the request interceptor
    Then POST /api/v1/auth/refresh is fired in the background
    And the new JWT replaces the old in localStorage

  # REQ-008 + REQ-009 — retry policy
  Scenario: GET retries on network error with backoff
    Given a GET request to /api/v1/apps
    When the first 2 attempts fail with network error
    Then the request is retried twice (200ms, 600ms backoff)
    And the third attempt's response is returned

  Scenario: POST never retries automatically
    Given a POST request to /api/v1/apps/install
    When the request fails with network error
    Then NO retry is attempted
    And the error is surfaced to the toast system immediately

  # REQ-011 + REQ-012 — error mapping
  Scenario: 403 maps to ForbiddenError type
    When an api call returns HTTP 403
    Then the response shape is { ok: false, error: { type: 'ForbiddenError', message, status: 403 } }

  # REQ-013 + REQ-014 — demo mode
  Scenario: Demo mode rejects mutations with DemoModeError
    Given the dashboard is built in demo mode
    When the operator clicks "Install app"
    Then the api call returns { ok: false, error: { type: 'DemoModeError' } }
    And no network request is made

  # REQ-015 + REQ-016 — out of scope
  Scenario: Spec does NOT cover OAuth
    Then OAuth/SSO is explicitly scoped to a future spec/004-oauth-providers

  Scenario: Spec does NOT cover WebSocket transport
    Then WebSocket real-time streams are explicitly scoped to a future spec/002-realtime-streams
