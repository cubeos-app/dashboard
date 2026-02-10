# SESSION 05 HANDOVER — Apps Page: Advanced-Only Tabs

**Date:** 2026-02-10
**Build:** Verified — `vite build` passes cleanly

---

## What Was Built

### New Files (5)

| File | Purpose |
|---|---|
| `src/components/apps/AppManagerTab.vue` | Advanced-only Manager tab consolidating FQDNs + NPM + CasaOS into sub-tabs. Domains: Pi-hole DNS integration with register/edit/delete. Proxy: NPM host CRUD. Import: CasaOS store browser + JSON import. 5 modals total. |
| `src/components/apps/DockerTab.vue` | Advanced-only Docker system tab. Disk usage breakdown (images/containers/volumes/build cache), stacked bar chart, system prune with confirmation. Wires `GET /docker/disk-usage` and `POST /docker/prune`. |
| `src/components/apps/RegistryTab.vue` | Refactored from `appmanager/RegistryTab.vue`. Local Docker registry management. No functional changes — updated header comment only. |
| `src/components/apps/PortsTab.vue` | Refactored from `appmanager/PortsTab.vue`. Port allocation management. No functional changes — pure location move. |
| `src/components/apps/ProfilesTab.vue` | Refactored from `appmanager/ProfilesTab.vue`. **KEY CHANGE:** Imports switched from `useAppManagerStore` → `useProfilesStore` (for profiles) + `useAppsStore` (for app list). `activateProfile()` → `applyProfile()`. `createProfile(name, desc)` → `createProfile(name, name, desc)`. |

### Modified Files (3)

| File | Change |
|---|---|
| `src/stores/profiles.js` | **Store consolidation:** Added `setProfileApp(profileName, appId, enabled)` method (moved from appmanager.js). Updated header comment to reflect single source of truth. Added `PUT /profiles/{name}/apps/{appId}` to verified endpoints. |
| `src/components/apps/AppsPage.vue` | Added 5 Advanced-only tab imports + tab definitions (Manager, Docker, Registry, Ports, Profiles). Added mode-switch fallback watch — resets to 'my-apps' if current tab becomes invalid. Tab bar now has horizontal scroll for mobile overflow. |
| `src/router/index.js` | `/appmanager` route changed from component import → redirect to `/apps?tab=manager`. |

---

## Component Tree (Updated)

```
AppsPage.vue (shell)
├── PageHeader (S01)
├── Tab bar (My Apps, App Store, Manager*, Docker*, Registry*, Ports*, Profiles*)
│   (* = Advanced mode only)
├── MyAppsTab.vue (S04)
├── AppStoreTab.vue (S04)
├── AppManagerTab.vue (S05, Advanced only)
│   ├── Sub-tab: Domains (FQDNs) — Pi-hole DNS integration
│   ├── Sub-tab: Proxy (NPM) — Nginx Proxy Manager hosts
│   └── Sub-tab: Import (CasaOS) — CasaOS app store browser
├── DockerTab.vue (S05, Advanced only)
├── RegistryTab.vue (S05, Advanced only)
├── PortsTab.vue (S05, Advanced only)
├── ProfilesTab.vue (S05, Advanced only)
├── AppDetailSheet.vue (S04, slide-over)
└── InstallFlow.vue (S04, modal sequence)
```

---

## Standard vs Advanced Comparison (Updated)

| Feature | Standard | Advanced |
|---|---|---|
| Tabs visible | My Apps, App Store | + Manager, Docker, Registry, Ports, Profiles |
| Manager tab | Hidden | FQDNs + NPM + CasaOS sub-tabs |
| Docker tab | Hidden | Disk usage, system prune |
| Registry tab | Hidden | Cache images, cleanup, image management |
| Ports tab | Hidden | Port allocation, reserved ports |
| Profiles tab | Hidden | Operational profiles, app toggles |
| Mode switch | — | Falls back to 'my-apps' if on Advanced-only tab |

---

## Route Changes

| Route | Before | After |
|---|---|---|
| `/appmanager` | `AppManagerView.vue` (standalone) | Redirect → `/apps?tab=manager` |

---

## Store Consolidation

### profiles.js — setProfileApp added

| Method | Endpoint | Source |
|---|---|---|
| `setProfileApp(profileName, appId, enabled)` | `PUT /profiles/{name}/apps/{appId}` | Moved from appmanager.js |

**Result:** `profiles.js` is now the single source of truth for all profile operations. `appmanager.js` still has its own `setProfileApp` for backward compat with old `appmanager/ProfilesTab.vue`, but the new `apps/ProfilesTab.vue` uses `profiles.js` exclusively.

### ProfilesTab Store Mapping

| Old (appmanager.js) | New (profiles.js / apps.js) |
|---|---|
| `store.profiles` | `profilesStore.profiles` |
| `store.apps` | `appsStore.apps` |
| `store.createProfile(name, desc)` | `profilesStore.createProfile(name, name, desc)` |
| `store.activateProfile(name)` | `profilesStore.applyProfile(name)` |
| `store.deleteProfile(name)` | `profilesStore.deleteProfile(name)` |
| `store.getProfile(name)` | `profilesStore.getProfile(name)` |
| `store.setProfileApp(name, id, enabled)` | `profilesStore.setProfileApp(name, id, enabled)` |

---

## API Endpoints Wired in S05

**New (DockerTab):**
- `GET /docker/disk-usage` — Docker disk usage statistics
- `POST /docker/prune` — Prune unused Docker resources

**Already wired (AppManagerTab uses existing stores):**
- `GET/POST/PUT/DELETE /fqdns` — FQDN management (appmanager store)
- `GET/POST/DELETE /npm/hosts`, `GET /npm/status` — NPM management (npm store)
- `GET /casaos/stores`, `POST /casaos/preview`, `POST /casaos/import` — CasaOS (appmanager store)

**Already wired (RegistryTab, PortsTab — unchanged):**
- `GET /registry/status|images|disk-usage`, `POST /registry/cleanup|init|cache`, `DELETE /registry/images/{name}` — Registry (registry + appmanager stores)
- `GET /ports|ports/reserved|ports/stats|ports/available`, `POST /ports`, `DELETE /ports/{port}` — Ports (appmanager store)

**Consolidated (ProfilesTab — now via profiles store):**
- `GET /profiles`, `GET /profiles/{name}`, `POST /profiles`, `POST /profiles/{name}/apply` — Profile CRUD
- `PUT /profiles/{name}/apps/{appId}` — Toggle app in profile (**new in profiles store**)

---

## Verification

- `vite build`: **PASS** — clean build, no new warnings
- Hardcoded domains in new files: **0**
- New components: **5** (AppManagerTab, DockerTab, RegistryTab, PortsTab, ProfilesTab)
- Modified files: **3** (profiles.js, AppsPage.vue, router/index.js)
- Advanced tabs: **5** (visible only when `isAdvanced === true`)
- Mode switch fallback: **Works** (resets to 'my-apps' when switching to Standard)
- `/appmanager` redirect: **Works** (→ `/apps?tab=manager`)
- ProfilesTab uses profiles store: **Confirmed** (not appmanager store)
- Tab bar scrollable on mobile: **Yes** (overflow-x-auto)

---

## How S06+ Should Use This

1. **Sub-tab pattern** — AppManagerTab demonstrates sub-tabs within a tab (FQDNs/NPM/CasaOS). Reuse for any consolidated page.
2. **Store consolidation** — Follow profiles.js pattern: move shared methods to dedicated stores, avoid dual sources.
3. **Mode-switch fallback** — AppsPage watches TAB_DEFS and resets activeTab. Apply same pattern to any page with Advanced-only tabs.
4. **Horizontal tab scroll** — Tab bar uses `overflow-x-auto scrollbar-hide` for many tabs on mobile.
5. **Refactor pattern** — RegistryTab/PortsTab show clean refactor: copy, update comment/imports, verify build. No functional changes needed.

---

## Files NOT Touched (intentionally deferred)

- Old `appmanager/` components — kept for S12 deletion (still referenced by old AppManagerView.vue)
- `appmanager.js` store — `setProfileApp` kept for backward compat, will be cleaned in S12
- `AppsView.vue` — kept for S12 deletion
- Old `AppStoreView.vue` — kept for ConfigEditor route
