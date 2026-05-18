# Constitution — CubeOS Dashboard

Component repo of the CubeOS project. Inherits all 19 parent Articles from `cubeos/docs/constitution.md`.

## Article C-I — All API calls go through `src/api/client.js`

Every fetch to cubeos-api MUST go through `src/api/client.js`. Never use raw `fetch()` in components, composables, or stores. The client centralises: JWT header injection, retry policy, error mapping, demo-mode interception.

This satisfies parent Article I (HAL owns the host — components never bypass api → HAL chain).

## Article C-II — Pinia is the only state store

Component-local refs are fine for ephemeral UI state. Cross-component state MUST live in a Pinia store under `src/stores/`. Never use Vuex, never use global event buses, never use a custom singleton.

## Article C-III — Routes are declared in `src/router/index.js`

Every navigable route is registered in `src/router/index.js`. Dynamic-route shortcuts inside components (push to ad-hoc paths) are forbidden — they cause keep-alive cache + breadcrumb breakage.

## Article C-IV — Demo mode is a build-time flag, not runtime branching

`VITE_DEMO_MODE=true npm run build:demo` swaps `src/api/client.js` → `src/api/demo-client.js` via Vite resolve.alias. Components MUST NOT contain `if (DEMO_MODE) ...` branches; the swap is total.

## Article C-V — i18n via vue-i18n, source-of-truth at `src/i18n/`

Every user-visible string lives in `src/i18n/<locale>/*.json`. Components use `{{ $t('key') }}` or `t('key')` from `useI18n()`. Hardcoded English in components is a lint failure.

## Article C-VI — Tailwind utility-first; design tokens in `tailwind.config.js`

Component styles MUST be Tailwind utility classes. Custom CSS lives only in `src/assets/main.css` for global resets + the rare animation. Design tokens (colors, spacing, font sizes) live in `tailwind.config.js`, not inline.

## Article C-VII — XSS posture

Vue's `{{ }}` escapes by default. `v-html` is FORBIDDEN except in `src/components/docs/MarkdownRenderer.vue` where it's gated by DOMPurify. PR reviews fail any new `v-html` outside that file.

This satisfies parent Article XI (security defaults) at the frontend layer.

## Article C-VIII — Build output is reproducible

`npm run build` against the same `package-lock.json` MUST produce byte-identical `dist/` output (modulo timestamps in manifest). CI compares dist-hash across two runs of the same commit.

## Article C-IX — No third-party CDN scripts

`index.html` MUST NOT load any `<script src="https://...">` from a non-cubeos origin. All deps bundled via Vite. Reason: the dashboard runs on customer LAN with no internet expectation.

## Article C-X — nginx.conf.template is the production runtime

`nginx.conf.template` (envsubst'd at container start) is the only supported serving config. The Dockerfile-baked nginx serves `dist/` + reverse-proxies `/api/` → cubeos-api at the Docker network alias. No webpack-dev-server, no vite preview in production.
