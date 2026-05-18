# Changelog — dashboard

All notable changes to this project. Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) + [Conventional Commits](https://www.conventionalcommits.org/).

Generated from git history + tags by `scripts/sdd-generate-changelog.py` on 2026-05-18.


## [v0.2.0-beta.05] - 2026-03-01

### Added

- add pre-configuration adoption to first-boot wizard (6f41a492)
- add DHCP status to network overview, remove dead SetupWizard (ec924a03)
- add WiFi interfaces panel in settings (5989da09)
- add AP teardown dialog for All-in-One to Standard transition (765a4dc2)
- Standard profile Ethernet gate and AP teardown in wizard (4a7b6812)

### Changed

- bump version to 0.2.0-beta.05 (f461dfaf)


## [v0.2.0-beta.04] - 2026-02-28

### Added

- phase 3 — profile switch progress modal (dffbfffa)
- phase 2 — wizard step + settings UI + app access URLs (f3026595)
- skip AP step when no WiFi or container tier (72b0b3a7)

### Changed

- bump version to v0.2.0-beta.04 (cbe7ce91)

### Fixed

- remove verbose explanation banners (41ae476d)
- correct SBD limits, add routing explanation, signal guard (d648ea06)
- connecting screen, i18n collision, AP status, install URL (715b1694)
- app URLs use IP:port, wizard shows real host, UPS banner filter (9c475abf)
- use API_URL env var for nginx upstream instead of hardcoded Pi IP (3c7fc7ac)


## [v0.2.0-beta.03] - 2026-02-27

_No commits within window._


## [v0.2.0-beta.02] - 2026-02-27

### Added

- i18n extraction — AppDetailSheet, AppHealthModal, DockerTab (1a85cf25)
- i18n extraction — MyAppsTab, AppStoreTab, AppManagerTab (413a6ac8)
- i18n extraction — VPNTab, VPNManager (929d5319)
- i18n extraction — NetworkConfigDialog, WiFiClientTransition, IPConfigStep (fe89bc7d)
- i18n extraction — DNSTab, ClientsTab, TrafficTab (1305eeb0)
- i18n extraction — NetworkOverviewTab, WiFiTab, FirewallTab (90e669ed)
- i18n extraction — AppCard, InstallFlow, NetworkModeSelector, WiFiConnector (6bf272f3)
- i18n extraction — SystemPage, SettingsPage (3985a774)
- i18n extraction — DashboardView, AppsPage, NetworkPage (5b5ab7de)
- Phase 8.2 frontend polish — ResponsiveTable, TabBar, i18n, Lighthouse fixes (3b1aa259)
- add full CasaOS app catalogue snapshot to demo App Store (6fcdc23b)
- Lighthouse audit fixes and vue-i18n setup [Phase 8.2c] (e70aadb5)
- unified TabBar component and polling optimization [Phase 8.2b] (a34cb452)
- adopt ResponsiveTable across all pages [Phase 8.2a] (438d2afe)
- interface assignment wizard + hardware-aware mode selector (Phase 6c) (0d01650e)
- Phase 6b — WiFiClientTransition overlay + Pi Imager WiFi pre-fill (2c716535)
- Phase 6a — rename network mode constants to v2 names (T6a-07, T6a-08) (10569151)

### Changed

- add Apache 2.0 LICENSE (fa7a7d3d)

### Fixed

- compact demo banner, fix recent_logs demo data format (ab975d9d)
- replace VITE_DEMO_MODE with __CUBEOS_DEMO__ compile-time constant (1e082db2)
- use define to inject VITE_DEMO_MODE as compile-time constant (71d2d4a4)


## [v0.2.0-beta.01] - 2026-02-24

### Added

- add backup management UI with scope, schedule, restore wizard (13a69677)
- add system updates UI — badge, review panel, history (60f1a1fe)
- add update notification badge to Settings nav item (e822413d)
- add Open button for installed apps in App Store (U1) (474ee720)
- offline-first batch 3 — dual install/cache buttons, manifest-based offline apps (1e0de1ae)
- registry-first batch 6 — dashboard registry settings + system images UI (14aea9d7)

### Changed

- bump version to 0.2.0-beta.01 (1b799c9e)
- fix cachedApps response key (cached_apps not apps) — fixes App Store crash (aeb197e5)
- Reapply "fix: hide system images from offline apps, protect from delete" (fe084c71)
- Reapply "feat: registry-first batch 6 — dashboard registry settings + system images UI" (21f4b37b)
- Revert "feat: registry-first batch 6 — dashboard registry settings + system images UI" (96deacca)
- Revert "fix: hide system images from offline apps, protect from delete" (e34cd33e)

### Fixed

- registry-first deploy — push to localhost:5000 and deploy from compose (47055a3b)
- increase image refresh delays for Docker catalog propagation (B2) (01d06d9c)
- installed label on store cards + registry refresh after caching (8c5e99ee)
- cache offline button in detail sheet + persistent caching progress (ee906dc3)
- visible Cache Offline button + green checkmarks on install progress steps (32eb5dc6)
- hide critical images from offline apps, lock system images in registry (9dcbcb0d)
- hide system images from offline apps, protect from delete (f474106e)


## [v0.2.0-alpha.01] - 2026-02-22

### Added

- reorder default dashboard widgets — apps-first, stats-second, pair compact widgets (93451f3e)

### Changed

- bump version to 0.2.0-alpha.01 (bcbd3649)
- fix false reconnect - reboot must see server go down first (aaa0f94e)
- reboot transition shows SSID reconnect guidance + health polling (2f42ab25)
- alpha.26 batch 4: F1 WiFi reconnect + F2 reboot/shutdown transition screens (6a86fe7e)
- alpha.26 batch 1: B4 server URL for Open App, B6 dashboard marker (15ddaa53)

### Fixed

- dashboard recents/battery/quick-actions bugs (b0285c9c)
- defensive isCore by name, hide Danger Zone for all coreapps, add Info to installed list (cf57fe5d)
- pin Info icon rightmost on all app tiles, reorder hover actions left (67953e9d)
- docs opens dashboard Docs page; import getCubeDomain (1855e293)
- complete WEB_UI_SERVICES map; info icon for non-web-UI apps; detail sheet button guards (d8fdb6d7)
- show restart for all apps, stop gated for core only (48b93c4f)
- filter nameless apps in appstore installed; StatusPill ethernet label (d97f7204)
- B2 uninstall in standard mode, B5 nameless filter, B8 label fix; add kiwix/terminal/filebrowser/docsindex to store mappings (88c85877)
- B1 card click opens app, B3 all apps chip, B4b port footer, IA star toggle, IB opacity fix, IC empty category CTA (32072578)


## [v0.1.0-alpha.25] - 2026-02-21

### Added

- unified install parity — same confirm dialog for all app sources (b5ca13f0)
- online_tether mode in UI — Smartphone icon, 4-col AP grid (41b19d9f)

### Changed

- Batch 4: remove deploy modal from RegistryTab, add registry app handling in AppDetailSheet (225f6553)
- unified install flow for registry apps (90f48e92)
- B113,B114: add online_tether to mode label and internet sharing detection (9258aaac)

### Fixed

- install UX — success state, duplicate logic, port config, terminal shortcut (b47a68a3)
- default date format to medium (21 February) instead of long (February 21) (ebc9e148)
- B111 show Up (no IP) for interfaces with link but no address (030883e0)


## [v0.1.0-alpha.24] - 2026-02-20

### Changed

- alpha.24: version bump (932d6467)
- registry images appear as installable apps in App Store Browse (dc1cce01)
- duplicate app warning + store filter in App Store (34e89754)
- fix deploy modal tag selection — fetch tags on open (6271fb0c)
- registry deploy refreshes My Apps, shows FQDN link (9ada0002)
- Remove HAL Services tab from Hardware page (0c1a7241)
- Clamp battery percentage to 0-100 (66fbf944)
- B105+B106: Fix error banner and hardware detection endpoints (1699c168)
- alpha.24 batch 4: B97 HAL services, B98 logs race, B101 registry disk, B102 deploy button (a0e4c651)


## [v0.1.0-alpha.23] - 2026-02-19

### Added

- migrate deploy to SSH from GPU VM (no Pi runner needed) (089e74bd)

### Changed

- version bump to 0.1.0-alpha.23 (31f9b51c)
- repo cleanup (ef0239b6)


## [v0.1.0-alpha.22] - 2026-02-19

### Changed

- alpha.22 batch 2: dashboard fixes (B63,B64,B67,B69,B71,B72,B73,B75) (5f807cf6)
- T17-T20: network config dialog with static IP support (9fa2e2a5)


## [v0.1.0-alpha.21] - 2026-02-18

### Fixed

- B60 GPS store uses query param for port (98aa681c)
- B60 GPS null dereference + FR01 country_code guard (411d8cab)


## [v0.1.0-alpha.20] - 2026-02-17

### Added

- Batch 3 — Dashboard UPS configuration UI (7037435e)

### Changed

- bump version to 0.1.0-alpha.20 (71c8830d)

### Fixed

- Change UPS button now switches to config form (State A) (f6a4be43)
- conditional WebSocket Connection header (B58) (0907ad3a)
- batch 2 dashboard frontend fixes (B53, B49, FR01) (958ca91f)


## [v0.1.0-alpha.19] - 2026-02-17

### Added

- Available Offline badge in app store, checkImage API (5f26b65a)

### Changed

- Enforce single-adapter constraint: block WiFi station when AP active (327e9005)
- Fix container logs dropdown - show all enabled apps (4054f367)
- Fix port allocation page field name mismatches (4100ba8b)
- 60s TTL cache for absent-hardware endpoints (faf4e50e)
- Suppress expected hardware errors (501/503) in store (45a93d32)

### Fixed

- Fix Registry status: check 'online' field from API response (002a53df)
- Fix NPM status: check 'online' field from API response (4741f674)
- B43 B46 B36 — version, placeholders, wizard order (20db6af6)


## [v0.1.0-alpha.18] - 2026-02-16

### Changed

- alpha.18 batch 2: B17 poll dedup, B18 hw cache, B19 Ollama detect, B23 WiFi adapter, B29 NPM status, B30 error filter, B27 profile names, B31 version, B33 fullscreen (272b78e7)


## [v0.1.0-alpha.17] - 2026-02-16

### Changed

- alpha.17: fix B13 ConnectingView stuck + boot log panel (c2b1c2c2)

### Fixed

- wizard swap fallback, swagger links, docs error text (17399e15)
- health proxy for version display + GPIO graceful degradation (a02ce4a5)


## [v0.1.0-alpha.16] - 2026-02-16

### Changed

- alpha.16: B07 connecting screen instead of wizard on reboot (a712b886)


## [v0.1.0-alpha.15] - 2026-02-16

### Migration notes

- - All components now use unified apps.js store

### Added

- add Connect button to saved networks, show Saved badge on scanned networks (06f628e4)
- add username/password fields for OpenVPN configs (aa60a1a8)
- Session 6 — Presets, Undo/Redo, Layout Lock (6ef73f86)
- Session 5 — WebSocket live updates + per-widget auto-refresh (f4160f19)
- Session 4 — touch DnD for mobile (ac312a7d)
- Session 3 — add 4 new dashboard widgets (68e664fe)
- Session 2 — widget resize + error isolation (be684b59)
- Session 1 — widget independence + multi-column DnD (6702b6e2)
- Session C — drag-and-drop edit mode (cce48c31)
- Session A - grid layout engine + ClockWidget card mode (e867b5ae)
- add settings modal + gear button (Session 2/5) (36b430c6)
- accessibility pass, deprecated cleanup, CONTRIBUTING.md (c775d1e0)
- respect webui_type for click behavior + DirectoryBrowser fallback (c106511a)
- add post-install volume settings modal (Session 3) (4097ffbf)
- pre-install volume preview flow (Session 2) (c2b030bd)
- Session 1 — store actions, DirectoryBrowser, BUG-2 fix (e1355af7)
- install/uninstall progress modal with SSE (ffefd5a2)
- auto-refresh installed apps status (1b804723)
- add delete-data checkbox to uninstall confirmation (8be2e89a)
- flip /services → /apps, add credentials warning banner (6ebdd71d)
- lifecycle UI for Meshtastic + Iridium tabs (2a341680)
- replace heuristic YAML validation with js-yaml parser (4c94f25a)
- Add FirewallView.vue placeholder (G3 stub) — fixes build (5eb66b63)
- Add /api/v1/docs/ proxy route to docs service on port 6032 (8e05e1c3)
- complete Sprint 4 dashboard migration to apps.js (2bb5fec3)
- add Swarm UI components and fix API docs link (8376969a)
- migrate dashboard to /api/v1/* endpoints (Sprint 4) (8b6b6f61)
- add running state display and conditional button logic (0867c124)
- Add Config Editor modal + enhanced AppManager store (6a63a199)
- Add AppManager UI components and store (fbb16df7)
- Add AppManager UI components and store (7dfa7f6e)
- mobile-responsive layout with slide-out sidebar (5736beed)
- add offline docs viewer + local RAG links (8744904b)
- display RAG sources as clickable GitHub links (3c549f32)
- improve Ask CubeOS UX with search input (008630b4)
- add Ask CubeOS chat modal (de38e44d)
- dashboard overhaul - CubeOS branding, FQDN URLs, new layout (1a40dbc8)
- sync dashboard from device - latest v12 (50cc7767)
- CubeOS Dashboard v12 - full sync from device (fa7745e9)
- Add CubeOS official branding and fix API proxy (4b466bd8)

### Changed

- Alpha.15: login version from /health, hostname reboot note, version bump (3edfdefa)
- alpha.14: B39 wizard fix, B38 swap retry, B57 polling 5s, T17 chatbot UX (67476fca)
- alpha.12: dashboard fixes (B37, B34r, B38, B39, B40, B41, B42) (d8a4f754)
- alpha.10: fix wizard device model, add ZRAM display, fix internet sharing status, add country code (B3, B18, B20) (fccb6838)
- alpha.9: wizard skip auto-login with default creds (B9) (57c36b97)
- Session 10: Presets v2 — user presets CRUD, unified built-in presets, v1→v2 migration (61d2971d)
- Session 9: Cross-mode widget parity + settings overhaul (6eff103b)
- Session 8: Unified WidgetWrapper architecture for Advanced mode (99094690)
- Session 7: decompose widget groups + unified WIDGET_REGISTRY (dfd8442b)
- Session B: per-widget transparency system (f0909107)
- remove static dot from hostname, add pipe between LIVE and hostname (c400af1c)
- Session 5/5: Advanced view customization + settings polish (6adf9268)
- Session 4: DiskWidget + SignalsWidget + signals store (1ec79088)
- Session 3: Apply dashboard config to Standard view (ed41dceb)
- network widget + 6 quick actions layout (393a61c4)
- S13 v2: clock widget, brand app icons, atmospheric wallpapers (beccbb66)
- S13 visual upgrade: per-app colors, system vitals widget, card elevation, staggered animations (5f92611a)
- fix chat auth in SearchChatBar - use api.getHeaders() for SSE stream (0425935e)
- S13 hotfix: fix navigator crash, default to Standard mode, fix prod version (88507cae)
- Dashboard Standard redesign - search/chat bar, status pill, alert banner, app launcher (9961a416)
- Settings page, wizard decomposition, chat mode awareness (1d900740)
- Communication + Media pages with mode-aware tabs and hardware-conditional nav (98dacf99)
- System page consolidation — tabbed SystemPage with mode-aware Overview/Monitoring/Processes/Logs/Hardware, fix processes stats endpoint (2421644d)
- Storage Page — Standard + Advanced with backup management (b4742102)
- Network page — consolidate Network/Firewall/VPN into tabbed NetworkPage (e412b830)
- Advanced-only tabs (Manager/Docker/Registry/Ports/Profiles), profiles store consolidation, /appmanager redirect (71c4e56e)
- Apps page with Standard/Advanced views, detail sheet, install flow (c7229527)
- Dashboard — Standard + Advanced dual-mode views (85ad870e)
- Layout shell — sidebar 7+2, mobile nav, router redirects (7ed0fad3)
- Foundation — design system + mode infrastructure (0c284f6f)
- extract shared apps API composable, add kick button + thermal zones (659dc485)
- Session 3: Power monitor, HAL firewall, support bundle dashboard coverage (926539e6)
- trigger rebuild with current nav items (a50c0834)
- migrate NetworkView api calls to stores, unify LogsView state (e40c9ea9)
- add focus trap, dialog role, aria attrs to WiFi modals (1bc10b4d)
- FS-14B: UX polish — clipboard fallbacks, VPN polling, reactive volume, tab refresh, dead code cleanup (3cf898d5)
- FS-14A: validation + responsive fixes (10 files) (edbdc675)
- FS-13C: hardcoded colors batch 2 + console cleanup (e38635b8)
- FS-13B: replace hardcoded colors with theme tokens (bd9a67c4)
- FS-13A: replace hardcoded URLs, versions, ports, and username (b4632b1e)
- FS-12G: aria labels for utilities (DocsView, AskCubeOS, LogsView, ProcessesView, MonitoringView) (25204314)
- FS-12E: Aria labels for Media views (MeshtasticTab, IridiumTab, MediaView, AudioTab, CameraTab) (c2780e4f)
- FS-12D: aria labels for Communication tabs (Bluetooth, Cellular, GPS) (31e73678)
- FS-12C: aria labels for hardware panels (25 fixes across 6 files) (04fac919)
- FS-12B: aria labels for AppManager tabs (53 edits across 6 files) (dabce708)
- FS-12A: aria labels for AppStore, AppDetailModal, ConfigEditor, AppManagerView (892cae87)
- FS-11D: Aria labels for USB + Services (29 edits across 5 files) (c7477e69)
- FS-11C: aria labels for storage views (85f6c533)
- FS-11B: aria labels for System + Settings views (39ed1262)
- FS-11 SG1: Aria-labels for network, firewall, VPN components (b20d345c)
- FS-10B: Aria-labels for layout + core views (bb9cbc9a)
- FS-10A: Modal accessibility — ARIA attrs, escape handlers, focus traps (3d343480)
- FS-09: AbortSignal passthrough — 25 files, 32 edits (e368c354)
- FS-08: timer/interval cleanup across 17 components (ea52579a)
- FS-07: component error handling, store mutations & refactoring (b2d5a79c)
- FS-06: ConfirmDialog & native alert sweep (17 fixes) (60124193)
- FS-04: Critical logic, data loss & broken flows (17 fixes + 2 piggyback) (436ad48d)
- FS-03a: API contract & field name fixes (15/19 items) (dfa6e363)
- Sprint 8 G4: MediaView + Audio + Camera tabs (8a8379f0)
- Sprint 8 G3: GPS + Meshtastic + Iridium tabs (ef43c033)
- Sprint 8 G2: CommunicationView + Bluetooth + Cellular tabs (b56fe4a8)
- Sprint 8 G1: communication + media stores, router, sidebar (0999df03)
- Sprint 7 G4: RTC, Watchdog panels + LogsView extension (3c93c7b0)
- Sprint 7 G3: GPIO, I2C, Sensors panels (f1a854ab)
- Sprint 7 G2: HardwareView with overview, power, throttle, boot config, HAL services (4c6f9bee)
- Sprint 7 G2: HardwareView with overview, power, throttle, boot config, HAL services (be7e7e53)
- Sprint 7 G1: add HardwareView stub for build (e428b61f)
- Sprint 7 G1: hardware + logs stores, router, sidebar (a990d3a1)
- Sprint 6 G3: wizard store consolidation, estimate/recommendations, router guard (f2be2557)
- Sprint 6 G2: quick backup, backup detail, auth profile, prefs/setup reset (af353a3b)
- Sprint 6 G1: preferences + setup stores, backup extensions (cf35d08b)
- Sprint 5 G3: reserved ports + stats + FQDN detail/edit (e64c8fab)
- Sprint 5 G2: store detail + screenshot carousel + installed detail (36721c27)
- Sprint 5 G1: services store + appstore/appmanager extensions (08a501ce)
- Sprint 4 G4: WS monitoring integration + QA polish (bd121382)
- Sprint 4 G3: ProcessesView + favorites API migration (05fee10a)
- Sprint 4 G2: MonitoringView with charts, alerts, thresholds (5063c4ee)
- Sprint 4 G1: monitoring/processes/favorites stores + routing + nav (2d2b46f9)
- Sprint 3 G4: RegistryTab rewrite + NPMTab + AppManager NPM tab (436ae20d)
- Sprint 3 G3: USBDevices + NetworkMounts components (74131090)
- Sprint 3 G2: StorageView 5-tab rewrite + DeviceHealth (3db46921)
- Sprint 3 G1: Storage HAL + registry + SMB + NPM + mounts stores (11d70bd6)
- Sprint 2 Group 4 (cc15ab00)
- Sprint 2 Group 3 (ba421777)
- Sprint 2 Group 2 (067192b8)
- Sprint 2 G1: Stores & routing foundation — firewall, clients, network/system/vpn extensions, sidebar + router (9e0988cd)
- S1-04b: SetupWizard theme migration (127 hardcoded colors) (656d1bca)
- S1-07: WebSocket real-time stats with HTTP fallback (696ff8a6)
- S1-04: Migrate hardcoded Tailwind colors to theme system (Group 4a) (90113642)
- remove accidental src/src/ duplicate directory (c8d27b81)
- S1-03: Replace 20 native confirm() with themed ConfirmDialog (617f0a45)
- S1-G2: consolidate polling + AbortController on all views (217505c3)
- S1-G1: ErrorBoundary + safe localStorage wrapper (f7a1e5c3)
- Revert docs to same-origin via NPM location routing (10730098)
- Route docs API calls to docs.cubeos.cube subdomain (04ad92a9)
- swarm shitttT (b59d8210)
- swarm shitttT (7b72f44b)
- swarm shittt (21f856e9)
- swarm shit (a16fb3be)
- swarm shit (c06812d7)
- increase health check attempts to 45 for slower drains (c2e330b7)
- Theme migration: Network, Storage, Logs, SystemStats (7b327293)
- Dashboard sprint: fix API calls, cleanup themes, wire appstore (0bd2a5d7)
- add allApps alias to fix search crash (05292d93)
- Sprint 4: Add unified apps store and new components (c9f11949)
- Sprint 0: Remove MuleCube references, delete src.bak (8222f911)
- remove base-image stage (manual rebuilds on GPU VM) (d7a31a2d)
- trigger rebuild with base image (9ebf9dc8)
- add pre-built base image for faster builds (19f33a3b)
- add pre-built base image for faster builds (208975b1)
- use multiarch runner on gpu01 for multi-arch builds (44f243f6)
- use multiarch runner for multi-arch builds (337b7641)
- add GitLab CI/CD pipeline for dashboard (9aca1438)
- Replace emojis with monochrome SVG icons (42d3420d)
- Initial Vue 3 dashboard (0fda9b94)

### Fixed

- remove duplicate script close tag in WelcomeStep (e298f3ae)
- B37-B39,B46-B50 — wizard, header, power, auth, version fixes (5bf3d982)
- dashboard B34 temp decimals, B16 version, B23 IPs, B36 DNS offline (75400042)
- nginx proxy_pass to API — 10.42.24.1:6010 instead of 127.0.0.1:9009 (66188a79)
- force rebuild after image cleanup (10a9dad4)
- send local_path from mount form to API (f4e1af9e)
- construct remote_path for mount save, handle full UNC in share field (5a36d258)
- backup download with auth, network mount test builds remote_path (4f42a52a)
- fix System Storage 0% (HAL container mount), replace apt samba message (9f5c9916)
- fix System Storage 0% and partition display field mappings (525f9c6f)
- default traffic widget to wlan0 (AP) instead of eth0 (3ba053d7)
- rewrite traffic widget with client-side rate computation (c81a346a)
- show 'Not connected' instead of 'No IP' for idle interfaces (cfbb3153)
- correct mode Active badge, add 5 modes with connection-aware safety warnings (8a07d14d)
- correct connect/disconnect label swap, refresh config list on state change (e62b72f0)
- suppress transient public IP errors, add delay for route stabilization (2a16ee8b)
- increase connection poll timeout to 90s for slow OpenVPN handshakes (1a35164f)
- add connecting state, prevent duplicate clicks, poll for connection (303d32a4)
- add h-full to chart columns so percentage bar heights resolve (6af3de00)
- derive system rule count from HAL total, show toggle in empty state (4c705da7)
- accumulate synthetic history, stop repeated failed API calls (7ede44a0)
- firewall status + HAL field name mismatches (d36ed52b)
- NAT/firewall display, interface filters, traffic history (68089c0b)
- firewall rule display with normalized fields, traffic data pipeline with rate calc (0911ec1f)
- Session 1 — frontend data mapping & display fixes (b501d047)
- fix TDZ crash when switching to Advanced mode (e5411790)
- DnD edit mode — remove overlay, row-reorder only, deep merge prefs (b6b3a5a2)
- DnD index mismatch, drag overlay for interactive children, Apps search alignment (a62eddbd)
- move SettingsToggle into script setup scope (2e0572a2)
- SettingsToggle scope + silence Vite dynamic import warning (d88fbc89)
- useDashboardConfig reads per-mode config, adds all 12 visibility + 4 clock getters (a74a0128)
- WS JWT auth, remove adv PageHeader, add dashboard config composable, move hostname to AppHeader (1928c823)
- Fix volumes.filter crash: ensure volumes is always an array (3277372f)
- Fix install from detail sheet: startInstall before closeDetail (2f12719d)
- Fix App Store install crash: 6-layer null defense for app prop (d21bab34)
- Fix App Store install crash (null app race condition), hide PageHeader in Standard mode (9fd07a6d)
- correct GitHub URL, sidebar link text, swagger path, add markdown table rendering (e9001eed)
- fallback to parent when initial path doesn't exist (4f6d8583)
- remove duplicate handleRemoveStore from bad str_replace (cd0d0d6d)
- SSE closeSSE Pinia ref-unwrapping crash on tab switch (17df612c)
- skip retry on 503 hardware absent responses (BUG-08) (bcc8cd95)
- fetch hostname on init, display real host OS (BUG-04) (5e386ad4)
- install error visibility, firewall data shape, hostname fallback (BUG-03,04,06) (f5e21c03)
- P0 crashes + store safety + cosmetic fixes (BUG-01,02,09,11,12) (9b9d18a3)
- session1 audit — storage/mounts and docs API paths (8e36ba1e)
- remove port-keyed state from Meshtastic/Iridium tabs (2c7d7368)
- rewrite Meshtastic + Iridium store for lifecycle API pattern (1975f13e)
- add npm install delta step to Dockerfile (a1774331)
- remove redundant setTimeout refreshes and dead button (7165112d)
- Sprint 2 Group 2E — replace hardcoded colors in large views + toggle knobs (644aa6f4)
- replace hardcoded colors in monitoring, firewall, docs, chat (cc366a80)
- replace text-white with text-on-accent in communication + media tabs (ad038dd6)
- replace hardcoded colors in network/services/system (Sprint 2B) (58842967)
- replace hardcoded colors with theme tokens (Sprint 2A) (ffd8b1a8)
- wire error handling in ProfilesTab and AppStoreView catch blocks (23e1ae2e)
- FS-12F aria labels for wizard components (a3b9bb44)
- FS-05 loading state architecture — skipLoading pattern + per-section refs (857a984d)
- FS-03b API contract fixes — appstore fallback, firewall endpoints, VPN stats guard (09629102)
- FS-02 — missing store methods & broken components (42b2716c)
- add placeholder stubs for MonitoringView + ProcessesView (f009c2f1)
- replace 15 hardcoded dark: classes with theme system (8ca9f5aa)
- wire useAbortOnUnmount into NetworkView and StorageView (1afa445a)
- broken quick action routes, remove duplicate stats polling, delete .bak file (d7854b63)
- dashboard batch 1-4 — dedupe routes, resource leaks, UX polish, retry logic (5d6d6d01)
- stop watchdog during deploy, increase convergence timeout (9ae13a8d)
- use local image tags to prevent Swarm GHCR resolution hang (231ea49a)
- dashboard bugfix sprint - 10 fixes (ef8dd83b)
- dashboard bug fixes from audit (79c0d8ee)
- working dashboard search, SystemView HAL battery, docs search endpoint (90bb61f0)
- comprehensive dashboard fixes - battery, uptime, docs, system info (25838083)
- use correct HAL endpoints for battery and hardware info (596eaf50)
- remove MuleCube, fix themes/signout/version/API docs (e6e3b7a2)
- add getDisplayName alias to apps.js store (ebade295)
- align dashboard API endpoints with Swagger spec (d02825e0)
- restore missing methods for DashboardView compatibility (99efb7fa)
- handle non-string status in AppsTab to prevent charAt error (0db41f0f)
- update appmanager store to use correct API paths (remove /appmanager prefix) (a997d39c)
- update appmanager store to use /apps and /profiles endpoints (844e55b7)
- rename HAL to CubeOS HAL (f4faf0fb)
- extract clean names from Swarm task IDs (05f10b12)
- treat 'running' health status as healthy for Compose services (340ab035)
- escape characters in template literals (4a756245)
- FQDN-only URLs, remove all IP:port references, hardcode pihole /admin path (469c1708)
- Deploy dashboard as Swarm stack instead of compose (4c760659)
- update deploy to use cubeos-dashboard path and add down before up (3a2c5d8e)
- Use correct API client response format (not axios-style) (fa38a4d3)
- Correct API import path in appmanager store (31b46c40)
- proper sidebar layout for desktop - sidebar takes space in flow (24dad5fb)
- handle empty pathMatch for /docs route, add debugging (a47bc0d4)
- render markdown headers, enlarge modal 10% (2534a390)
- add systemInfo/fetchSystemInfo aliases for DashboardView (6f7b4511)
- render markdown in AI assistant responses (cc489b4b)
- use correct localStorage key for auth token (dc3d403d)
- correct compose service name to 'dashboard' (e1d1cc44)
- correct service names, remove duplicate footer, filter exited containers (b61347ff)
- correct compose file path for deploy (b4ad552c)
- use correct health check port 8087 (f100e634)
- use shell executor for package stage (ARM64) (ebbf52aa)
- use QEMU for multi-arch buildx (49b69339)
- Fix uptime display and temperature icon (0948ac22)
- Fix system stats to handle flat API response format (56f21000)
- Fix login redirect and system stats display (6e7c4e20)

### Removed

- remove empty Advanced Settings section from overview (51d06a32)

### Security

- show IP, gateway, DNS, signal, channel, security in WiFi tab (3e63f8d1)
- Sprint 1B — APN form, password security, DEV guard (77a01452)
- FS-01 security & auth — XSS sanitization, token desync, wizard validation (bc176d4b)

