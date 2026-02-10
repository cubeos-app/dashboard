# SESSION 04 HANDOVER — Apps Page: Standard + Advanced

**Date:** 2026-02-10
**Build:** Verified — `vite build` passes cleanly

---

## What Was Built

### New Files (5)

| File | Purpose |
|---|---|
| `src/components/apps/AppsPage.vue` | Shell with tab management (My Apps, App Store). Fetches shared data (apps, appstore, favorites). Manages AppDetailSheet (slide-over) and InstallFlow modals. Reads `?tab=` query param for backward-compat redirects from `/appstore`. Uses PageHeader, useMode, useBreakpoint, useAbortOnUnmount. |
| `src/components/apps/MyAppsTab.vue` | My Apps tab. Standard: clean grid with status pills, favorite toggle, start/stop/restart. Advanced: + deploy mode badges, port info. Favorites section, category chips, search, system apps toggle. Reuses ServiceGrid pattern from S03. Glassmorphism in Standard mode. |
| `src/components/apps/AppStoreTab.vue` | App Store tab (refactored from AppStoreView.vue 1094→~300 lines). Sub-tabs: Browse / Installed. Browse: search, category filter, grid with quick install. Installed: list view with lifecycle actions. Standard has one-click install, Advanced adds options in detail sheet. |
| `src/components/apps/AppDetailSheet.vue` | Right-side slide-over panel. Detects catalog vs installed app. Catalog: screenshots carousel, description, architectures, install button (Advanced: expandable port/FQDN options). Installed: tabs (Overview, Logs, Docker). Overview: status, quick actions, danger zone. Logs: container logs. Docker (Advanced only): container info, resources, networks, mounts. |
| `src/components/apps/InstallFlow.vue` | Multi-step install wrapper. Loads volume preview → InstallConfirmModal → InstallProgressModal via SSE. Standard: confirm→install. Advanced: confirm (with options)→install. Error state with retry. Reuses existing modal components from `appstore/`. |

### Modified Files (3)

| File | Change |
|---|---|
| `src/router/index.js` | `/apps` route now imports `AppsPage.vue` (was `AppsView.vue`). `/appstore` route changed from standalone component to redirect → `/apps?tab=store`. |
| `src/stores/appmanager.js` | Removed 5 outdated `TODO: ⚡ Backend endpoint not yet implemented` markers — all endpoints confirmed in backend. Updated `deleteRegistryImage()` to support tag-level deletion via `DELETE /registry/images/{name}/tags/{tag}`. |
| `src/stores/setup.js` | Removed TODO marker for `/setup/complete` endpoint — confirmed in backend. Kept preference fallback as defensive coding. |

---

## Component Tree

```
AppsPage.vue (shell)
├── PageHeader (S01)
├── Tab bar (My Apps, App Store)
├── MyAppsTab.vue (tab content)
│   ├── Search bar + Category chips
│   ├── Favorites grid (from favorites store)
│   ├── ServiceGrid (core + user apps)
│   │   ├── Standard: status pills, favorite stars
│   │   └── Advanced: + deploy mode badges, ports
│   └── System apps toggle
├── AppStoreTab.vue (tab content)
│   ├── Sub-tabs (Browse / Installed)
│   ├── Browse: search, category filter, app grid
│   └── Installed: list view with actions
├── AppDetailSheet.vue (slide-over)
│   ├── Catalog app: screenshots, description, install
│   └── Installed app: Overview / Logs / Docker tabs
└── InstallFlow.vue (modal sequence)
    ├── InstallConfirmModal (volume preview)
    └── InstallProgressModal (SSE job progress)
```

---

## Standard vs Advanced Comparison

| Feature | Standard | Advanced |
|---|---|---|
| My Apps grid | Icon, name, status pill, favorite star | + deploy mode badge, port in footer |
| App Store browse | One-click install button | Install button, detail sheet shows port/FQDN options |
| App detail (catalog) | Screenshots, description, install button | + expandable install options (port, FQDN) |
| App detail (installed) | Overview + Logs tabs | + Docker tab (container info, resources, mounts) |
| System apps | Hidden by default, toggle to show | Visible, toggle to hide |
| Install flow | Confirm → Install | Confirm (with options) → Install |
| Glassmorphism | Yes (wallpaper active) | No (clean flat) |

---

## Route Changes

| Route | Before | After |
|---|---|---|
| `/apps` | `AppsView.vue` | `AppsPage.vue` |
| `/appstore` | `AppStoreView.vue` (standalone) | Redirect → `/apps?tab=store` |
| `/appstore/config/:appId` | ConfigEditor (unchanged) | ConfigEditor (unchanged) |
| `/apps/:name` | ServiceDetailView (unchanged) | ServiceDetailView (unchanged) |

---

## Store Cleanup Summary

### appmanager.js — 5 TODO markers removed

| Function | Endpoint | Status |
|---|---|---|
| `setProfileApp()` | `PUT /profiles/{name}/apps/{appId}` | Confirmed in backend |
| `initRegistry()` | `POST /registry/init` | Confirmed in backend |
| `cacheImage()` | `POST /registry/cache` | Confirmed in backend |
| `deleteRegistryImage()` | `DELETE /registry/images/{name}/tags/{tag}` | Updated to use tag-level deletion |
| `getAvailablePort()` | `GET /ports/available?type={type}` | Confirmed in backend |

### setup.js — 1 TODO marker removed

| Function | Endpoint | Status |
|---|---|---|
| `markComplete()` | `POST /setup/complete` | Confirmed in backend, kept preference fallback |

---

## API Endpoints Wired

All endpoints were already implemented in stores from Sprint 4. S04 wires them into the new UI components:

| Endpoint | Used By | Purpose |
|---|---|---|
| `GET /apps` | AppsPage → apps store | Fetch all apps |
| `POST /apps/{name}/start\|stop\|restart` | MyAppsTab, AppDetailSheet | App lifecycle |
| `GET /apps/{name}/logs` | AppDetailSheet (Logs tab) | Container logs |
| `GET /services/{name}` | AppDetailSheet (Docker tab) | Docker inspect |
| `GET /appstore/apps` | AppStoreTab → appstore store | Catalog apps |
| `GET /appstore/categories` | AppStoreTab | Category filter |
| `POST /appstore/installed` | InstallFlow → appstore store | Install app |
| `GET /appstore/stores/{id}/apps/{name}/volumes` | InstallFlow | Volume preview |
| `GET /favorites` | AppsPage → favorites store | Fetch favorites |
| `POST /favorites/{name}/toggle` | MyAppsTab | Toggle favorite |

---

## S01-S03 Patterns Reused

| Pattern | Used In |
|---|---|
| Shell → sub-view (S03) | AppsPage → MyAppsTab / AppStoreTab |
| `useMode()` (S01) | All components: isAdvanced for conditional rendering |
| `useWallpaper()` (S01) | MyAppsTab: glassmorphism panels in Standard |
| `useBreakpoint()` (S01) | AppsPage, MyAppsTab: responsive behavior |
| `useAbortOnUnmount()` | AppsPage: signal for data fetching |
| `PageHeader` (S01) | AppsPage: consistent header |
| `ServiceGrid` (S03) | MyAppsTab: app card grid with status pills |
| Slide-over sheet | AppDetailSheet: right-side panel (new pattern for S04) |

---

## Verification

- `vite build`: **PASS** — clean build, no new warnings
- Hardcoded domains in new files: **0**
- New components: **5** (AppsPage, MyAppsTab, AppStoreTab, AppDetailSheet, InstallFlow)
- Modified files: **3** (router, appmanager.js, setup.js)
- TODO stubs removed: **6** (5 in appmanager.js, 1 in setup.js)
- Old files kept: AppsView.vue, AppStoreView.vue (S12 cleanup)
- Backward compatibility: `/apps` route works, `/appstore` redirects to `/apps?tab=store`

---

## How S05+ Should Use This

1. **AppDetailSheet** — Slide-over pattern can be reused for any detail panel (storage volumes, network interfaces, etc.)
2. **InstallFlow** — Orchestrator pattern for multi-step modals; can be extended for update/migrate flows
3. **Tab integration** — S05 will add "Manager" tab to AppsPage for AppManager (profiles, registry, ports, FQDNs, NPM, CasaOS)
4. **Route absorption** — S05 should redirect `/appmanager` → `/apps?tab=manager` (same pattern as `/appstore` → `/apps?tab=store`)
5. **ServiceGrid** — Confirmed reusable across dashboard (S03) and apps page (S04)

---

## Files NOT Touched (intentionally deferred)

- Old `AppsView.vue` — kept for S12 deletion
- Old `AppStoreView.vue` — kept for S12 deletion (still used by ConfigEditor route)
- `AppManagerView.vue` — S05 will absorb into Apps page Manager tab
- All `appmanager/` tab components (FQDNs, NPM, Registry, Ports, Profiles, CasaOS) — S05
- `ServiceDetailView.vue` — kept on `/apps/:name` until detail sheet replaces it
