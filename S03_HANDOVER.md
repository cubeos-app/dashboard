# SESSION 03 HANDOVER — Dashboard: Standard + Advanced Views

**Date:** 2026-02-10
**Build:** Verified — `vite build` passes cleanly

---

## What Was Built

### New Files (6)

| File | Purpose |
|---|---|
| `src/components/dashboard/DashboardView.vue` | Shell that renders Standard or Advanced sub-view based on `useMode()`. Handles shared data fetching (system, apps, favorites, network), app open/favorite logic, chat modal, and health modal. Uses `PageHeader` from S01. |
| `src/components/dashboard/DashboardStandard.vue` | Standard mode ("iPad mode") dashboard: status gauge rings (CPU/RAM/Disk/Temp), quick info bar (services, network mode, uptime, battery), favorites grid, recently used, service grid with status pills, quick actions (App Store, Network, Ask CubeOS). Glassmorphism panels when wallpaper is active. |
| `src/components/dashboard/DashboardAdvanced.vue` | Advanced mode dashboard: everything in Standard PLUS: detailed system info bar (deploy modes, WiFi clients, WS status, Pi model), SwarmOverview widget, AlertsFeed, detailed service grids with deploy mode badges, user apps section, quick link buttons (Monitoring, Logs, App Store, Chat). Wires monitoring store endpoints. |
| `src/components/dashboard/StatusCard.vue` | Reusable circular SVG gauge card with progress ring, color-coded thresholds (green → warning → critical), label, value, unit, subtitle, compact mode. |
| `src/components/dashboard/ServiceGrid.vue` | Responsive app/service card grid with status pills, favorite stars, loading skeletons. `detailed` prop adds deploy mode badges for Advanced. Shared between both dashboard modes. |
| `src/components/dashboard/AlertsFeed.vue` | Compact monitoring alerts list with severity icons, timestamps, empty state ("All clear"), and link to monitoring page. Advanced mode only. |

### Modified Files (1)

| File | Change |
|---|---|
| `src/router/index.js` | Dashboard route import changed from `@/components/DashboardView.vue` → `@/components/dashboard/DashboardView.vue` |

---

## Component Tree

```
DashboardView.vue (shell)
├── PageHeader (S01)
├── DashboardStandard.vue (Standard mode)
│   ├── StatusCard ×4 (CPU, Memory, Disk, Temp)
│   ├── Quick Info Bar (services, network, uptime, battery, hostname)
│   ├── Favorites Grid (from favorites store)
│   ├── Recently Used (from localStorage, fallback if no favorites)
│   ├── ServiceGrid (core apps with status pills)
│   └── Quick Actions (App Store, Network, Ask CubeOS)
├── DashboardAdvanced.vue (Advanced mode)
│   ├── StatusCard ×4
│   ├── System Info Bar (detailed: deploy modes, clients, WS, Pi model)
│   ├── SwarmOverview (existing component, unchanged)
│   ├── AlertsFeed (monitoring alerts)
│   ├── Favorites Grid
│   ├── ServiceGrid (core apps, detailed mode)
│   ├── ServiceGrid (user apps, if any)
│   └── Quick Links (Monitoring, Logs, App Store, Chat)
├── AskCubeOS modal (shared)
└── ServiceHealthModal (shared)
```

---

## Standard vs Advanced Comparison

| Feature | Standard | Advanced |
|---|---|---|
| Status gauges | CPU, RAM, Disk, Temp rings | Same |
| Info bar | Services count, network mode, uptime, battery | + deploy modes, WiFi clients, WS status, Pi model |
| Swarm Overview | Hidden | Full SwarmOverview widget |
| Alerts | Hidden | AlertsFeed with severity, timestamps |
| Service grid | Simple: icon, name, status pill | + deploy mode badge (swarm/compose) |
| User apps grid | Merged into core grid | Separate section |
| Favorites | Card grid with status | Compact inline list |
| Quick actions | 3 card buttons | Compact link row with alert badge |
| Glassmorphism | Yes (wallpaper active) | No (clean flat) |

---

## API Endpoints Wired

All endpoints were already implemented in the monitoring store from Sprint 4. S03 wires them into the dashboard UI:

| Endpoint | Used In | Purpose |
|---|---|---|
| `GET /monitoring/alerts` | DashboardAdvanced → AlertsFeed | Alert feed |
| `GET /monitoring/history` | DashboardAdvanced (onMounted) | Sparkline data (future) |
| `GET /monitoring/websocket` | DashboardAdvanced | WS connection count |

---

## Stores Used (no changes)

| Store | Data Consumed |
|---|---|
| `system` | cpuUsage, memoryUsage, diskUsage, temperature, uptime, battery, hostname, piModel, wifiClients, wsConnected |
| `apps` | coreApps, userApps, runningCount, appCount, healthyCount, getAppIcon, getDisplayName, getAppUrl |
| `favorites` | favoriteNames, isFavorite, toggleFavorite |
| `monitoring` | alerts, alertCount, wsConnectionCount, fetchAlerts, fetchHistory, fetchWebSocketInfo |
| `network` | currentMode (fetchStatus) |
| `preferences` | uiMode (via useMode composable) |

---

## S01/S02 Composables Used

| Composable | Used For |
|---|---|
| `useMode()` | `isAdvanced` toggle in DashboardView shell |
| `useWallpaper()` | `panelClass`, `isActive` for glassmorphism in Standard mode |
| `useBreakpoint()` | Via PageHeader (responsive stacking) |
| `useAbortOnUnmount()` | Signal for data fetching in DashboardView + DashboardAdvanced |

---

## Verification

- `vite build`: **PASS** — clean build, no new warnings
- Hardcoded domains in dashboard files: **0**
- New components: **6** (StatusCard, ServiceGrid, AlertsFeed, DashboardStandard, DashboardAdvanced, DashboardView)
- Modified files: **1** (router/index.js)
- Old DashboardView.vue: **Kept** (will be deleted in S12 cleanup)
- Backward compatibility: Dashboard route `/` still works, same auth guard

---

## How S04+ Should Use This

1. **StatusCard** — Reusable gauge in any page (System overview, Storage overview, etc.)
2. **ServiceGrid** — Reusable app grid in Apps page (MyAppsTab) or anywhere services are displayed
3. **AlertsFeed** — Can be embedded in System page monitoring tab
4. **Pattern** — Follow the shell → Standard/Advanced sub-view pattern for all pages:
   ```
   SomePage.vue (shell, data fetching, shared modals)
   ├── SomeStandard.vue (or inline with v-if)
   └── SomeAdvanced.vue (or inline with v-if)
   ```
5. **PageHeader** — Already used; all subsequent pages should use it consistently

---

## Files NOT Touched (intentionally deferred)

- Old `components/DashboardView.vue` — kept for S12 deletion
- All stores — unchanged
- All S01 composables — used as-is
- SwarmOverview — used as-is inside DashboardAdvanced
- CSS/theme — unchanged
- Search functionality — removed from dashboard (will be global Ctrl+K in S12, or per-page)
