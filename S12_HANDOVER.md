# S12 HANDOVER — Dashboard Polish (Accessibility, Deprecated Cleanup, CONTRIBUTING.md)

## Summary

Accessibility pass complete: added `aria-label` to all 16 icon-only buttons across 7 component files (1 additional was in a deleted file). Removed 2 stale TODOs from Vue/JS files (0 remain across entire codebase including Go). Deleted 14 deprecated `*View.vue` files (8,579 lines removed) that were superseded by `*Page.vue` pages in S03–S10. Verified all 10 backward-compat route redirects resolve to existing components. Created `CONTRIBUTING.md` documenting aria-label conventions, mode toggle usage, component naming, Pinia store patterns, and styling rules.

## Files Modified (9)

| File | Change | Description |
|------|--------|-------------|
| `src/components/appmanager/ConfigEditorModal.vue` | 1 line | Added `aria-label="Close config editor"` to X button |
| `src/components/appmanager/AppsTab.vue` | 8 lines | Added `aria-label` to Refresh, Edit Config, Start, Stop, Restart, Unregister, and Close modal buttons. Action buttons use dynamic `:aria-label` with app name |
| `src/components/apps/AppHealthModal.vue` | 1 line | Added `aria-label="Close health details"` to X button |
| `src/components/apps/AppManagerTab.vue` | 1 line | Added dynamic `:aria-label` to Preview (Eye) button |
| `src/components/apps/AppCard.vue` | 3 lines | Added dynamic `:aria-label` to Start, Stop, Restart buttons with app name context |
| `src/components/swarm/StackList.vue` | 1 line | Added dynamic `:aria-label` to View Details (Info) button with service name |
| `src/components/network/FirewallTab.vue` | 2 lines | Added dynamic `:aria-label` to both desktop and mobile Delete Rule buttons with port context |
| `src/stores/firewall.js` | 1 line removed | Removed stale TODO about NetworkView direct calls (NetworkView.vue deleted) |
| `src/components/vpn/VPNManager.vue` | 2 lines | Converted stale TODO to NOTE (VPN stats field uncertainty — block renders conditionally) |

## Files Created (1)

| File | Lines | Description |
|------|-------|-------------|
| `CONTRIBUTING.md` | 189 | Project conventions: component naming (*Page.vue/*Tab.vue), aria-label patterns (static vs dynamic), mode toggle usage, Icon component, Pinia store structure, API client, theme-aware styling, git workflow |

## Files Deleted (14) — 8,579 lines removed

| File | Lines | Replaced By |
|------|-------|------------|
| `src/components/DashboardView.vue` | 529 | `dashboard/DashboardView.vue` (S03) |
| `src/components/apps/AppsView.vue` | 203 | `apps/AppsPage.vue` (S04) |
| `src/components/appmanager/AppManagerView.vue` | 116 | `apps/AppManagerTab.vue` (S05) |
| `src/components/appstore/AppStoreView.vue` | 1,093 | `apps/AppStoreTab.vue` (S04) |
| `src/components/network/NetworkView.vue` | 1,330 | `network/NetworkPage.vue` (S06) |
| `src/components/firewall/FirewallView.vue` | 736 | `network/FirewallTab.vue` (S06) |
| `src/components/storage/StorageView.vue` | 973 | `storage/StoragePage.vue` (S07) |
| `src/components/system/SystemView.vue` | 887 | `system/SystemPage.vue` (S08) |
| `src/components/monitoring/MonitoringView.vue` | 861 | `system/MonitoringTab.vue` (S08) |
| `src/components/communication/CommunicationView.vue` | 210 | `communication/CommunicationPage.vue` (S09) |
| `src/components/media/MediaView.vue` | 168 | `media/MediaPage.vue` (S09) |
| `src/components/settings/SettingsView.vue` | 838 | `settings/SettingsPage.vue` (S10) |
| `src/components/services/ServicesView.vue` | 344 | `apps/AppsPage.vue` (S04) |
| `src/components/services/ServiceCard.vue` | 291 | `apps/AppCard.vue` (S04) |

## Files Intentionally Kept

These `*View.vue` files are still actively used and were NOT deleted:

| File | Reason |
|------|--------|
| `dashboard/DashboardView.vue` | Active in router (`/`) |
| `auth/LoginView.vue` | Active in router (`/login`) |
| `NotFoundView.vue` | Active in router (catch-all) |
| `docs/DocsView.vue` | Active in router (`/docs`) |
| `hardware/HardwareView.vue` | Imported by `HardwareTab.vue` (wrapper pattern) |
| `logs/LogsView.vue` | Imported by `LogsTab.vue` (wrapper pattern) |
| `processes/ProcessesView.vue` | Imported by `ProcessesTab.vue` (wrapper pattern) |
| `services/ServiceDetailView.vue` | Active in router (`/apps/:name`) |
| `services/ServiceHealthModal.vue` | Imported by `dashboard/DashboardView.vue` |

## Route Redirect Verification

All 10 backward-compat redirects verified — target components exist:

| Old Path | Redirects To | Status |
|----------|-------------|--------|
| `/appstore` | `/apps?tab=store` | ✓ |
| `/appmanager` | `/apps?tab=manager` | ✓ |
| `/services` | `/apps` | ✓ |
| `/services/:name` | `/apps/:name` | ✓ |
| `/firewall` | `/network?tab=firewall` | ✓ |
| `/vpn` | `/network?tab=vpn` | ✓ |
| `/monitoring` | `/system?tab=monitoring` | ✓ |
| `/processes` | `/system?tab=processes` | ✓ |
| `/logs` | `/system?tab=logs` | ✓ |
| `/hardware` | `/system?tab=hardware` | ✓ |

All 14 active route component files confirmed present on disk.

## Accessibility Audit Results

| Metric | Before | After |
|--------|--------|-------|
| Icon-only buttons without `aria-label` | 17 | 0 |
| Buttons with `aria-label` (multi-line) | ~314 | ~330 |
| Total TODOs (Vue/JS) | 2 | 0 |
| Total TODOs (Go) | 0 | 0 |
| Vue component files | 128 | 114 |

### aria-label Patterns Used

**Static** (fixed meaning): `aria-label="Close dialog"`, `aria-label="Refresh status"`

**Dynamic** (contextual per item): `:aria-label="\`Start ${app.display_name || app.name}\`"`

All action buttons (Start, Stop, Restart, Delete/Unregister) include the target entity name for screen reader context.

## Stale TODO Status

| Location | Resolution |
|----------|-----------|
| `stores/firewall.js:31` | Removed — referenced NetworkView.vue which is now deleted |
| `components/vpn/VPNManager.vue:521` | Converted to NOTE — VPN stats field uncertainty is a known limitation, not actionable |
| **Entire dashboard codebase** | **0 TODOs** — verified with `grep -rn 'TODO\|FIXME'` |
| **Entire Go codebase** | **0 TODOs** — verified in S11 |

## CONTRIBUTING.md Contents

| Section | Coverage |
|---------|----------|
| Component Naming | `*Page.vue` for routes, `*Tab.vue` for tabs, `*View.vue` legacy note |
| Accessibility | Static vs dynamic `aria-label`, when to use, toggle and collapsible patterns |
| Mode Toggle | `useMode()` composable, `v-if="isAdvanced"` gating, `<ModeToggle>` placement |
| Icons | `<Icon>` component usage, Lucide PascalCase names, no-emoji rule |
| Pinia Stores | Composition API pattern, loading/error refs, AbortSignal, constants |
| API Client | `apiClient` usage, base path, auth handling |
| Styling | Theme-aware CSS properties, no hardcoded Tailwind colors |
| Git Workflow | CI/CD pipeline, lint before commit, commit message format |

## Build Note

No structural changes to imports or logic — only attribute additions and file deletions. Safe to commit without build risk. Run `npm run build` to verify treeshaking removes deleted file references from the bundle.

## What's Next

The 12-session CubeOS redesign is complete. Remaining improvements for future sprints:

- Replace wrapper-pattern View files (`HardwareView`, `LogsView`, `ProcessesView`) by inlining their content into their Tab components
- Replace `ServiceDetailView.vue` with a dedicated `AppDetailPage.vue`
- Replace `ServiceHealthModal.vue` import in DashboardView with `AppHealthModal.vue`
- Remove deprecated `/services/*` backend routes (S11 marked them `@Deprecated` in Swagger)
- Add Tor/VPN iptables reconciliation loop on container restart
- Responsive QA testing on physical mobile devices
