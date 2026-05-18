# Design — API client + auth (spec/001 — RETROSPECTIVE)

CGC-grounded against `src/api/client.js` + `src/stores/auth.js` 2026-05-18.

## Real shape

```js
// src/api/client.js
const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30000,
})

client.interceptors.request.use((cfg) => {
  const jwt = useAuthStore().jwt
  if (jwt) cfg.headers.Authorization = `Bearer ${jwt}`
  return cfg
})

client.interceptors.response.use(
  (res) => ({ ok: true, data: res.data }),
  (err) => {
    if (err.response?.status === 401) {
      useAuthStore().clearJwt()
      router.push('/login')
    }
    return Promise.resolve({ ok: false, error: mapError(err) })
  },
)

export default {
  auth: {
    login: (creds) => client.post('/v1/auth/login', creds),
    refresh: () => client.post('/v1/auth/refresh'),
    logout: () => client.post('/v1/auth/logout'),
  },
  apps: { ... },
  hardware: { ... },
  // ... 1 namespace per bounded_context
}
```

## Real file paths (CGC-verified)

| File | Status |
|---|---|
| `src/api/client.js` | EXISTS — single source of API access |
| `src/api/demo-client.js` | EXISTS — swap target for VITE_DEMO_MODE builds |
| `src/api/demo-data.js` | EXISTS — fixtures |
| `src/api/casaos-apps-snapshot.js` | EXISTS — appstore catalogue |
| `src/stores/auth.js` | EXISTS — JWT lifecycle store |
| `src/router/index.js` | EXISTS — registers /login route + nav guards |

## JWT keying by hostname (REQ-004)

```js
const STORAGE_KEY = `cubeos.jwt.${window.location.hostname}`
```

Keying by hostname lets operators run two CubeOS boxes on the same browser without one box's JWT being sent to the other.

## Retry policy (REQ-008..010)

axios-retry config:
```js
axiosRetry(client, {
  retries: 2,
  retryDelay: (n) => 200 * Math.pow(3, n - 1),  // 200, 600
  retryCondition: (err) => {
    if (!err.response) return true  // network error
    return ['get', 'head', 'put', 'delete'].includes(err.config.method)
  },
})
```

## Error mapping (REQ-011, REQ-012)

```js
function mapError(err) {
  if (!err.response) return { type: 'NetworkError', message: err.message }
  const status = err.response.status
  if (status === 401) return { type: 'AuthError', message: 'session expired', status }
  if (status === 403) return { type: 'ForbiddenError', message: err.response.data?.message, status }
  if (status === 404) return { type: 'NotFoundError', message: err.response.data?.message, status }
  if (status >= 500)   return { type: 'ServerError',   message: err.response.data?.message, status }
  return { type: 'Error', message: err.response.data?.message || 'unknown', status }
}
```

## Out of scope

- OAuth (spec/004 future)
- WebSocket real-time streams (spec/002 future)
- Service worker / offline cache (spec/003 future)
