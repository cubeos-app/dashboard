# S08 HANDOVER — System Page (Standard + Advanced)

## Summary

Consolidated System + Monitoring + Processes + Logs + Hardware into one tabbed SystemPage with mode-aware content. Replaced monolithic SystemView.vue (887 lines) with 7 focused components totaling ~1724 lines. Fixed processes store calling wrong endpoint. Removed stale TODO from API system.go.

## Components Created (7)

| File | Lines | Mode | Description |
|------|-------|------|-------------|
| `SystemPage.vue` | 237 | Shell | Tab management, shared data fetching (system info + power), 15s polling, `?tab=` query param |
| `SystemOverviewTab.vue` | 497 | Both | Hostname, OS, Pi model, uptime, resource bars (Std); + throttle flags, boot config (Adv) |
| `PowerCard.vue` | 141 | Shared | Battery/UPS status: level bar, charging state, voltage. Color-coded levels |
| `MonitoringTab.vue` | 592 | Advanced | Sub-tabs: Overview (stats + SVG charts), Alerts (table), Settings (threshold form). WS + HTTP polling |
| `ProcessesTab.vue` | 17 | Advanced | Wraps existing ProcessesView.vue — search, sort, kill/terminate, top consumers |
| `LogsTab.vue` | 16 | Advanced | Wraps existing LogsView.vue — 9 log sources, 12 endpoints |
| `HardwareTab.vue` | 19 | Advanced | Wraps existing HardwareView.vue — GPIO, I2C, Sensors, RTC/Watchdog sub-tabs |

## Router Change

```
/system → SystemPage.vue (was SystemView.vue)
```

Backward-compat redirects (pre-existing):
- `/monitoring` → `/system?tab=monitoring`
- `/processes` → `/system?tab=processes`
- `/logs` → `/system?tab=logs`
- `/hardware` → `/system?tab=hardware`

## Tab Structure

**Standard Mode:** Overview
**Advanced Mode:** Overview, Monitoring, Processes, Logs, Hardware

Mode switch auto-resets to 'overview' if current tab becomes invalid.

## Stores Used

- `system.js` — System info, stats, hostname, reboot/shutdown
- `hardware.js` — Throttle, boot config, HAL devices, GPIO, I2C, sensors
- `monitoring.js` — Real-time stats, alerts, thresholds (including PUT /monitoring/thresholds)
- `processes.js` — Process list, stats, top consumers, kill/terminate
- `logs.js` — All 12 log source endpoints
- `auth.js` — Admin check, password change

## API Endpoints Wired

| Endpoint | Method | Store | Status |
|----------|--------|-------|--------|
| `/processes/stats/summary` | GET | processes.js | **Fixed** (was `/processes/stats` — 404) |
| `/monitoring/thresholds` | PUT | monitoring.js | Already wired, now used in MonitoringTab settings sub-tab |

All other endpoints (system info, hardware, logs, process CRUD) were already wired in existing stores.

## API Changes

| File | Change |
|------|--------|
| `internal/system/system.go` | Removed stale Sprint 1.1 TODO (lines 45-49). Updated package doc comment. |

## Architecture Patterns

1. **Shell → Tab**: SystemPage fetches shared data (system info + power status), passes as props to SystemOverviewTab. Other tabs self-manage via stores.
2. **Mode-aware tabs**: TAB_DEFS computed array, tabs filtered by `isAdvanced`
3. **Emit 'navigate-tab'**: SystemOverviewTab links to Monitoring tab from resource usage card
4. **Wrap existing views**: ProcessesTab/LogsTab/HardwareTab wrap existing standalone components to avoid duplicating 2000+ lines of code
5. **Polling**: SystemPage polls shared data every 15s. MonitoringTab has separate 5s polling with WebSocket fallback. Visibility-aware (pauses when tab hidden).

## Props Flow

```
SystemPage → SystemOverviewTab:
  loading, powerStatus

SystemPage → MonitoringTab, ProcessesTab, LogsTab, HardwareTab:
  Self-managed (use stores directly)
```

## Build Verification

- `vite build` passes cleanly
- SystemPage chunk: 117.96 KB (26.92 KB gzipped)
- Consistent with StoragePage (116.47 KB) and NetworkPage (111.65 KB)
- No import errors, all composables resolved

## Files Modified

- `src/router/index.js` — `/system` route → `SystemPage.vue`
- `src/stores/processes.js` — Fixed `fetchStats()` endpoint: `/processes/stats` → `/processes/stats/summary`
- `api/internal/system/system.go` — Removed stale TODO, updated package doc

## Files Created

All in `src/components/system/`:
- SystemPage.vue
- SystemOverviewTab.vue
- PowerCard.vue
- MonitoringTab.vue
- ProcessesTab.vue
- LogsTab.vue
- HardwareTab.vue

## Files That Can Be Removed (After Validation in S12)

- `src/components/system/SystemView.vue` — Replaced by SystemPage + tabs
- `src/components/system/SystemStatsCard.vue` — Orphaned, not imported anywhere

**Do NOT remove** (still used by tab wrappers):
- `src/components/processes/ProcessesView.vue` — Used by ProcessesTab
- `src/components/logs/LogsView.vue` — Used by LogsTab
- `src/components/hardware/HardwareView.vue` — Used by HardwareTab
- `src/components/hardware/GPIOPanel.vue` — Used by HardwareView
- `src/components/hardware/I2CPanel.vue` — Used by HardwareView
- `src/components/hardware/SensorsPanel.vue` — Used by HardwareView
- `src/components/hardware/RTCPanel.vue` — Used by HardwareView
- `src/components/hardware/WatchdogPanel.vue` — Used by HardwareView

## What's Next (S09)

Communication + Media pages consolidation — CommunicationPage.vue with GPS, Cellular, Meshtastic, Iridium, Bluetooth tabs (conditional on detected hardware). MediaPage.vue with Audio + Camera tabs. Both pages hidden from nav when HAL reports no hardware. Wire GET /communication/cellular/android/status.
