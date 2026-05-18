# ADR-0001 — Vue 3 + Vite + Pinia + Tailwind for the operator UI

## Status

Accepted (retrospective, 2026-05-18).

## Context

The dashboard needs to:
- Render fast on Raspberry Pi 4-class hardware (limited cpu, served over LAN)
- Bundle small (initial install over slow WAN possible)
- Support i18n (operators speak many languages)
- Be operator-installable (no docker-in-docker, no node runtime on the Pi)

## Decision

- **Vue 3 + Composition API** — small runtime (~30 KiB gzipped), idiomatic with `<script setup>`
- **Vite** — instant dev reload, esbuild + Rollup production builds, no webpack legacy
- **Pinia** — official Vue 3 state store, simpler than Vuex
- **Vue Router** — official routing
- **vue-i18n** — official i18n
- **Tailwind CSS** — utility-first; no per-component CSS files needed; JIT keeps dist small

Build artefact is static — served by nginx (no Node at runtime).

## Consequences

- Pro: small bundle (typical dist/ ~150-250 KiB gzipped)
- Pro: dev experience excellent (Vite HMR)
- Pro: no SSR/SSG complexity needed (LAN-only, no SEO requirement)
- Con: Tailwind utility classes can grow markup verbosity (mitigated by Vue's component encapsulation)
- Con: Pinia + Composition API has steeper onramp than Options API + Vuex (mitigated by extensive docs + this constitution)

## Alternatives rejected

- **Svelte / SvelteKit** — smaller runtime but smaller ecosystem; vue-i18n + Tailwind tooling more mature
- **React + Vite + Zustand** — equally viable; team experience leans Vue
- **Pre-rendered HTMX** — too dynamic UI surface (real-time hardware status, log streaming)

## Related Articles

- Article C-I (api/client.js as the only HTTP boundary)
- Article C-IV (demo mode via Vite alias, not runtime branch)
- Article C-X (nginx.conf.template as production runtime)
