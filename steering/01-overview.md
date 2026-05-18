# Steering — Dashboard overview

## Stack

- Vue 3 (Composition API + script setup)
- Vite (build + dev server)
- Pinia (state stores)
- Vue Router (route definitions)
- vue-i18n (translations)
- Tailwind CSS + PostCSS

## Layout

```
src/
├── main.js                  # entry — createApp, registers Pinia + router + i18n
├── App.vue                  # root layout
├── api/
│   ├── client.js            # ONLY HTTP client (Article C-I)
│   ├── demo-client.js       # swapped in via Vite alias for VITE_DEMO_MODE builds
│   ├── demo-data.js         # static fixtures for demo mode
│   └── casaos-apps-snapshot.js  # appstore catalogue snapshot
├── components/<context>/    # one dir per bounded_context (apps/, appstore/, hardware/, ...)
├── composables/             # reusable Composition-API logic
├── stores/<context>.js      # one Pinia store per bounded_context
├── router/index.js          # route declarations (Article C-III)
├── i18n/<locale>/*.json     # translations
├── assets/main.css          # global CSS only (rest is Tailwind utilities)
└── utils/                   # pure functions
```

## Trust boundaries

- Browser → nginx (LAN) → cubeos-api (Docker network internal). JWT in `Authorization: Bearer` header.
- Browser stores JWT in `localStorage.jwt` keyed by hostname (Article C-II via `auth` store).
- No third-party origins (Article C-IX).
- Demo mode is build-time only (Article C-IV) — the demo build can ship to demo.cubeos.com without API access.

## Don't

- Don't use `v-html` outside `MarkdownRenderer.vue` (Article C-VII).
- Don't use raw `fetch()` in components (Article C-I).
- Don't hardcode English strings (Article C-V).
- Don't introduce runtime `if (DEMO_MODE)` branches (Article C-IV).
- Don't add third-party CDN `<script>` tags (Article C-IX).
