# Alpha.22 Batch 2: Dashboard Bug Fixes — Complete Code Changes

**Tasks:** T03 (B63), T06 (B64), T08 (B71), T09 (B72), T11 (B69), T13 (B67), T14 (B73), T15 (B75)  
**Repo affected:** `cubeos-dashboard` (all changes)  
**Date:** 2026-02-19

---

## File Inventory

| # | File | Action | Bug(s) |
|---|------|--------|--------|
| 1 | `src/components/dashboard/BatteryWidget.vue` | **REPLACE** (full file) | B63 |
| 2 | `src/components/hardware/HardwareView.vue` | **REPLACE** (full file) | B64 |
| 3 | `src/components/logs/LogsView.vue` | **REPLACE** (full file) | B71 |
| 4 | `src/stores/media.js` | **REPLACE** (full file) | B72 |
| 5 | `src/stores/communication.js` | **REPLACE** (full file) | B69, B72 |
| 6 | `src/api/client.js` | **REPLACE** (full file) | B67 |
| 7 | `src/stores/monitoring.js` | **REPLACE** (full file) | B73 |
| 8 | `src/components/network/NetworkOverviewTab.vue` | **REPLACE** (full file) | B75 |

---

## Change Summary

| Bug | Severity | What Changed | Risk |
|-----|----------|-------------|------|
| B63 | P1 | BatteryWidget "Configure" button now routes to `/system?tab=hardware` instead of `/hardware` (dead-end in Standard mode) | Low — navigation change only |
| B64 | P2 | HardwareView charging toggle label is now dynamic: shows "Charging" when charging, "Charge Control" when not | Low — text label only |
| B71 | P2 | LogsView container dropdown now fetches from `/services` (all Docker containers) instead of `/apps` (database only). Falls back to hardcoded system container names if endpoint fails. | Low — additive change with fallback |
| B72 | P2 | Absent-hardware cache in media.js and communication.js changed from 60s TTL to permanent session cache. Hardware doesn't appear mid-session; users reload to retry. | Low — reduces network noise |
| B69 | P2 | Added `isUnavailable()`/`isAbsentHardwareError()` guards to `fetchMeshtasticDevices`, `fetchMeshtasticStatus`, `fetchIridiumDevices`, `fetchIridiumStatus`. Matches existing pattern from cellular/bluetooth/GPS. | Low — additive guards |
| B67 | P3 | `client.js` `requestWithRetry` now shows "HTTP error" instead of "HTTP undefined" when `response.status` is missing | Low — error message improvement |
| B73 | P3 | Removed `fetchWebSocketInfo()` from `monitoring.js` `fetchAll()`. The `/monitoring/websocket` debug endpoint generates 400 errors in console. Still callable explicitly. | Low — reduces console noise |
| B75 | P3 | NAT toggle card hidden in OFFLINE Advanced mode. Added `isOfflineMode` computed. NAT has no meaning without upstream interface. | Low — UI visibility guard |

---

## Deploy Instructions

All files go into the `cubeos-dashboard` repo. Copy each file to its path, commit, and push to main — the CI/CD pipeline handles the rest.

```bash
# From the repo root:
cp BatteryWidget.vue     src/components/dashboard/BatteryWidget.vue
cp HardwareView.vue      src/components/hardware/HardwareView.vue
cp LogsView.vue          src/components/logs/LogsView.vue
cp media.js              src/stores/media.js
cp communication.js      src/stores/communication.js
cp client.js             src/api/client.js
cp monitoring.js         src/stores/monitoring.js
cp NetworkOverviewTab.vue src/components/network/NetworkOverviewTab.vue

git add -A
git commit -m "alpha.22 batch 2: dashboard bug fixes (B63,B64,B67,B69,B71,B72,B73,B75)"
git push origin main
```

---

## Verification After Deploy

### B63 (BatteryWidget Configure navigation)
- Dashboard > Battery widget > click "Configure" (when UPS not configured)
- Expected: navigates to System page, Hardware tab loads with UPS config section
- Should work in BOTH Standard and Advanced mode

### B64 (Charging label)
- System > Hardware tab > UPS section (when UPS is configured and active)
- When charging: label shows "Charging"
- When not charging: label shows "Charge Control"

### B71 (Container logs dropdown)
- Logs page > Container tab > dropdown
- Expected: shows system containers (cubeos-api, cubeos-hal, cubeos-dashboard, cubeos-pihole, cubeos-npm, etc.)
- Select any system container > logs should load

### B72 (Absent hardware polling)
- Open browser console > Network tab
- After 2 minutes with no Bluetooth/GPS/camera hardware:
- Expected: zero repeated 503/404 requests to media/communication endpoints

### B69 (Meshtastic/Iridium guards)
- With no Meshtastic/Iridium hardware connected
- Navigate to Communication tabs
- Expected: initial request returns 404/503, gets cached, no further polling

### B67 (HTTP undefined error)
- Trigger a network error (e.g., disconnect briefly)
- Expected: error message shows "HTTP error" not "HTTP undefined"

### B73 (WebSocket GET noise)
- Open browser console
- Navigate to Monitoring/Dashboard
- Expected: no 400 errors from `/monitoring/websocket`

### B75 (NAT button in OFFLINE mode)
- Set network mode to OFFLINE
- Switch to Advanced mode
- Expected: NAT card is hidden entirely (no contradictory "Internet Sharing: Disabled" + "Disable NAT" button)
- Switch to ONLINE_ETH: NAT card reappears
