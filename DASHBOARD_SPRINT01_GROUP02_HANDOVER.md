# Sprint 1 — Group 2: Polling & Abort (S1-02 + S1-06)

**Tasks Completed:** S1-02 (Consolidate polling) + S1-06 (AbortController)
**Files Changed:** 9 (0 new, 9 modified)

---

## What Was Done

### S1-02: Consolidate Polling into `apps.js` Store Only

**Problem:** Five views ran their own `setInterval(() => appsStore.fetchApps(), N)`, creating duplicate network requests to `/api/v1/apps` (up to 4× the needed rate).

**Solution:** All app polling now flows through `appsStore.startPolling()` / `appsStore.stopPolling()` with reference counting. Child components no longer poll at all.

| File | Before | After |
|------|--------|-------|
| `StackList.vue` | Own `setInterval(fetchApps, 10000)` | Removed — parent (`ServicesView`) handles polling |
| `SwarmOverview.vue` | Own `setInterval(fetchApps, 10000)` | Removed — parent (`DashboardView`) handles polling |
| `ServicesView.vue` | Own `setInterval(fetchApps, 15000)` | `appsStore.startPolling()` / `stopPolling()` |
| `ServiceDetailView.vue` | `startPolling()` + own `setInterval` for local sync | `startPolling()` + reactive `watch` on store |
| `DashboardView.vue` | Already correct (`startPolling`/`stopPolling`) | No change for S1-02 |
| `AppsView.vue` | Already correct (`startPolling`/`stopPolling`) | No change needed |

**Result:** Max 1 request to `/apps` per 10s interval across all views, regardless of how many are mounted.

### S1-06: AbortController on All Polling Views

**Store-level changes:**
- `apps.js` — `fetchApps()`, `getApp()`, `getAppLogs()` now accept optional `{ signal }` parameter
- `apps.js` — Internal `AbortController` in centralized polling: each poll tick aborts the previous in-flight request, and `stopPolling()` aborts the final one
- `system.js` — `fetchAll()`, `fetchStats()`, `fetchBattery()`, `fetchHardware()`, `fetchWifiClients()` all accept optional `{ signal }`

**View-level changes (5 views):**

| View | What gets signal |
|------|-----------------|
| `DashboardView.vue` | Initial `fetchAll()` + `fetchApps()`, recurring `fetchStats()` |
| `ServicesView.vue` | Initial `fetchApps()` |
| `ServiceDetailView.vue` | `fetchApp()`, `fetchLogs()` |
| `SystemView.vue` | `fetchAll()`, `fetchPowerStatus()`, `fetchBackups()` |
| `LogsView.vue` | `fetchOptions()`, `fetchLogs()` (also calls `abort()` before each new log fetch) |

**Result:** Navigate away from any view mid-request → requests are cleanly aborted → no console errors, no wasted bandwidth, no memory leaks.

---

## File Inventory

```
EDIT  src/stores/apps.js                            — Signal param on fetchApps/getApp/getAppLogs + internal poll AbortController
EDIT  src/stores/system.js                          — Signal param on all fetch methods
EDIT  src/components/swarm/StackList.vue             — Removed duplicate polling (child component)
EDIT  src/components/swarm/SwarmOverview.vue          — Removed duplicate polling (child component)
EDIT  src/components/services/ServicesView.vue        — Switched to centralized polling + AbortController
EDIT  src/components/services/ServiceDetailView.vue   — Replaced sync interval with watch + AbortController
EDIT  src/components/DashboardView.vue                — Added AbortController to all fetches
EDIT  src/components/logs/LogsView.vue                — Added AbortController + abort-before-refetch
EDIT  src/components/system/SystemView.vue            — Added AbortController to all fetches
```

---

## How to Apply

Drop each file into its corresponding path in your dashboard repo, replacing the existing files. No new dependencies — this is purely internal refactoring.

**Note:** The `useAbortOnUnmount` composable (`src/composables/useAbortOnUnmount.js`) already exists in the codebase and required no changes.

---

## Technical Details

### Polling Architecture (After)

```
App.vue
  └─ setInterval(systemStore.fetchStats, 5000)   ← system stats for header

DashboardView
  ├─ appsStore.startPolling()                     ← shared 10s interval
  ├─ setInterval(systemStore.fetchStats, 10000)   ← view-specific stats
  └─ SwarmOverview                                ← reads store reactively (no polling)

ServicesView
  ├─ appsStore.startPolling()                     ← shared 10s interval
  └─ StackList                                    ← reads store reactively (no polling)

ServiceDetailView
  ├─ appsStore.startPolling()                     ← shared 10s interval
  └─ watch(appsStore.apps)                        ← reactive sync to local ref

AppsView
  └─ appsStore.startPolling()                     ← shared 10s interval

SystemView
  └─ setInterval(fetchPowerStatus, 10000)         ← unique to system page

LogsView
  └─ setInterval(fetchLogs, 5000)                 ← user-toggled auto-refresh
```

### AbortController Flow

```
Component mounts → useAbortOnUnmount() creates controller set
  → signal() returns current AbortSignal
  → Passed to api.get() via { signal: signal() }
Component unmounts → onUnmounted aborts all tracked controllers
  → In-flight fetch() rejects with AbortError
  → ApiClient catches AbortError → returns null
  → Store methods check for null → skip state update
```

---

## QA Checklist (Group 2 subset)

| Check | Method | Pass Criteria |
|-------|--------|---------------|
| No duplicate polling | Open DevTools Network tab on `/services` | Max 1 request to `/apps` per 10s |
| StackList no own polling | Mount ServicesView in stacks mode | No extra `/apps` requests from StackList |
| SwarmOverview no own polling | Mount DashboardView | No extra `/apps` requests from SwarmOverview |
| Polling starts/stops correctly | Navigate to `/services`, then away, then back | Interval active only while view is mounted |
| ServiceDetail syncs from store | Open service detail, wait for poll cycle | Status updates without own interval |
| AbortController on navigate | Open Network tab, navigate away mid-request | Requests show "(canceled)", no console errors |
| LogsView abort-before-refetch | Switch log tabs rapidly | Only the last tab's request completes |
| System page power polling | Open `/system`, check Network tab | Power status polls at 10s, aborts on leave |

---

## Remaining Groups

| Group | Tasks | Status |
|-------|-------|--------|
| **G1 — Foundation** | S1-01 + S1-05 | **DONE** |
| **G2 — Polling & Abort** | S1-02 + S1-06 | **DONE** |
| G3 — Confirm Dialogs | S1-03 | Next |
| G4 — Theme + WebSocket | S1-04 + S1-07 | Pending |
