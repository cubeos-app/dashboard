# S06 HANDOVER — Network Page (Standard + Advanced)

## Summary

Consolidated Network + Firewall + VPN into one tabbed NetworkPage with mode-aware content. Replaced monolithic NetworkView.vue (1346 lines) + standalone FirewallView.vue (736 lines) + standalone VPNManager.vue (748 lines) with 8 focused components totaling 2833 lines.

## Components Created (8)

| Component | Lines | Mode | Description |
|-----------|-------|------|-------------|
| `NetworkPage.vue` | 313 | Shell | Tab management, shared data fetching, polling, ?tab= backward-compat |
| `NetworkOverviewTab.vue` | 368 | Both | Status cards (AP, Internet), mode selector, interfaces, NAT toggle (Adv) |
| `WiFiTab.vue` | 397 | Both | WiFi connection status, scan/connect, saved networks, AP config modal |
| `FirewallTab.vue` | 502 | Advanced | Absorbs FirewallView.vue. Rules CRUD, quick-port/service, HAL status |
| `VPNTab.vue` | 707 | Both | Standard: status + connect/disconnect. Advanced: full CRUD from VPNManager.vue |
| `DNSTab.vue` | 129 | Advanced | Upstream DNS config (primary/secondary) with save indicator |
| `ClientsTab.vue` | 151 | Advanced | Connected AP clients with kick/block/unblock actions |
| `TrafficTab.vue` | 266 | Advanced | Interface selector, download/upload stats, bar chart history (5s poll) |

## Router Change

```
/network → NetworkPage.vue (was NetworkView.vue)
```

Backward-compat redirects preserved:
- `/firewall` → `/network?tab=firewall`
- `/vpn` → `/network?tab=vpn`

## Tab Structure

**Standard Mode:** Overview, WiFi
**Advanced Mode:** Overview, WiFi, Firewall, VPN, DNS, Clients, Traffic

Mode switch auto-resets to 'overview' if current tab becomes invalid.

## Stores Used

- `network.js` — AP status, interfaces, DNS, traffic, connectivity, modes, WiFi management
- `firewall.js` — Rules CRUD, NAT, forwarding, HAL status, port/service allow/block
- `vpn.js` — Configs CRUD, connect/disconnect, auto-connect, public IP
- `clients.js` — Client list, kick, block, unblock

## Architecture Patterns

1. **Shell → Tab**: NetworkPage fetches shared data, passes as props to Overview/WiFi tabs. Other tabs self-manage.
2. **Mode-aware tabs**: TAB_DEFS computed array, tabs filtered by isAdvanced
3. **Emit 'refresh'**: Tabs emit to trigger parent data reload after mutations
4. **Absorb standalone views**: FirewallTab absorbs FirewallView.vue, VPNTab absorbs VPNManager.vue
5. **Polling**: NetworkPage polls shared data every 10s, TrafficTab polls every 5s independently
6. **Backward-compat**: ?tab= query param for /firewall and /vpn redirects

## Props Flow

```
NetworkPage → NetworkOverviewTab:
  loading, apStatus, interfaces, natStatus, internetStatus,
  firewallStatus, networkMode, apHardwarePresent

NetworkPage → WiFiTab:
  apStatus, apHardwarePresent

NetworkPage → TrafficTab:
  interfaces (filtered physical)

FirewallTab, VPNTab, DNSTab, ClientsTab:
  Self-managed (use stores directly)
```

## Build Verification

- `vite build` passes cleanly
- NetworkPage chunk: 111.65 KB (26.11 KB gzipped)
- No import errors, all composables resolved

## Files Modified

- `src/router/index.js` — `/network` route → `NetworkPage.vue`

## Files That Can Be Removed (After Validation)

- `src/components/network/NetworkView.vue` — Replaced by NetworkPage + tabs
- `src/components/firewall/FirewallView.vue` — Absorbed into FirewallTab
- `src/components/vpn/VPNManager.vue` — Absorbed into VPNTab

## What's Next (S07)

Storage Page consolidation — StoragePage.vue shell with Overview, USB, Backups tabs (Standard) + Devices, Network Mounts, SMB Shares (Advanced).
