# S07 HANDOVER — Storage Page (Standard + Advanced)

## Summary

Consolidated Storage + Mounts + SMB + Backups into one tabbed StoragePage with mode-aware content. Replaced monolithic StorageView.vue (974 lines) with 7 focused components + 1 new Pinia store totaling 1968 lines. Added full backup management (8 endpoints) that was previously unwired.

## Components Created (7) + Store (1)

| File | Lines | Mode | Description |
|------|-------|------|-------------|
| `StoragePage.vue` | 240 | Shell | Tab management, shared data fetching, polling, ?tab= query param |
| `StorageOverviewTab.vue` | 357 | Both | Disk usage, health cards, backup status (Std); + Docker storage, partitions, mounts (Adv) |
| `USBTab.vue` | 21 | Both | Wraps existing USBDevices.vue — detect, mount/unmount/eject, rescan |
| `BackupsTab.vue` | 464 | Both | Backup list, quick backup, restore, download, delete. Adv: + custom create modal, stats |
| `DevicesTab.vue` | 200 | Advanced | Block device list + SMART data expansion (desktop table + mobile cards) |
| `NetworkMountsTab.vue` | 18 | Advanced | Wraps existing NetworkMounts.vue — NFS/SMB mount CRUD |
| `SMBSharesTab.vue` | 386 | Advanced | Absorbed from StorageView. Share CRUD modal, detail expansion, status card |
| `stores/backups.js` | 282 | Store | **NEW** — Wires all 8 backup endpoints (list, create, quick, stats, detail, delete, download, restore) |

## Router Change

```
/storage → StoragePage.vue (was StorageView.vue)
```

## Tab Structure

**Standard Mode:** Overview, USB, Backups
**Advanced Mode:** Overview, USB, Backups, Devices, Network Mounts, SMB Shares

Mode switch auto-resets to 'overview' if current tab becomes invalid.

## Stores Used

- `storage-hal.js` — HAL devices, usage, SMART, USB management, network mounts
- `storage.js` — Storage overview, health, mounts
- `smb.js` — SMB status, shares CRUD
- `backups.js` — **NEW** — Backup management (8 endpoints)
- `mounts.js` — Mount CRUD, status, test connection (via NetworkMounts component)

## API Endpoints Newly Wired

| Endpoint | Method | Store |
|----------|--------|-------|
| `/backups` | GET | backups.js |
| `/backups` | POST | backups.js |
| `/backups/stats` | GET | backups.js |
| `/backups/quick` | POST | backups.js |
| `/backups/{id}` | GET | backups.js |
| `/backups/{id}` | DELETE | backups.js |
| `/backups/{id}/download` | GET | backups.js |
| `/backups/{id}/restore` | POST | backups.js |

All SMB (6) and mount endpoints were already wired in existing stores from Sprint 3.

## Architecture Patterns

1. **Shell → Tab**: StoragePage fetches shared data (usage, health, docker, backups), passes as props to OverviewTab. Other tabs self-manage.
2. **Mode-aware tabs**: TAB_DEFS computed array, tabs filtered by `isAdvanced`
3. **Emit 'navigate-tab'**: OverviewTab can switch to Backups/Devices tabs
4. **Absorb + Wrap**: SMBSharesTab absorbs SMB section from StorageView. USBTab/NetworkMountsTab wrap existing standalone components.
5. **Polling**: StoragePage polls shared data every 15s (matching original StorageView). Visibility-aware (pauses when tab hidden).

## Props Flow

```
StoragePage → StorageOverviewTab:
  loading, dockerUsage, lastBackup

StoragePage → USBTab, BackupsTab, DevicesTab,
              NetworkMountsTab, SMBSharesTab:
  Self-managed (use stores directly)
```

## Build Verification

- `vite build` passes cleanly
- StoragePage chunk: 116.47 KB (26.08 KB gzipped)
- No import errors, all composables resolved

## Files Modified

- `src/router/index.js` — `/storage` route → `StoragePage.vue`

## Files That Can Be Removed (After Validation)

- `src/components/storage/StorageView.vue` — Replaced by StoragePage + tabs

**Do NOT remove** (still used by tab wrappers):
- `src/components/storage/USBDevices.vue` — Used by USBTab
- `src/components/storage/NetworkMounts.vue` — Used by NetworkMountsTab
- `src/components/storage/DeviceHealth.vue` — Used by DevicesTab + StorageOverviewTab

## What's Next (S08)

System Page consolidation — SystemPage.vue shell with Overview (Standard) + Monitoring, Processes, Logs, Hardware tabs (Advanced).
