# S10 HANDOVER — Settings + Wizard + Chat

## Summary

Created SettingsPage.vue with mode-aware tabs (Account, Appearance, Profiles, Support). AppearanceTab includes wallpaper picker with preset grid, custom upload, and solid color option. Decomposed FirstBootWizard.vue from 915 lines into a 314-line shell + 6 step components in wizard/steps/. Refactored AskCubeOS.vue with mode awareness (Advanced: model selector, RAG toggle, settings panel). Updated router to use SettingsPage.

## Components Created (12)

| File | Lines | Mode | Description |
|------|-------|------|-------------|
| `SettingsPage.vue` | 113 | Shell | Tab management for Account, Appearance (both) + Profiles, Support (Advanced). `?tab=` query param. ModeToggle in header |
| `AccountTab.vue` | 215 | Both | Auth profile (avatar, username, role, last login, created), password change form, session/logout |
| `AppearanceTab.vue` | 317 | Both | Theme toggle, mode toggle, wallpaper picker (Standard only: preset grid, custom upload, no-wallpaper), preferences reset |
| `ProfilesTab.vue` | 138 | Advanced | Service profile list with apply/active status. Uses consolidated profiles store from S05 |
| `SupportTab.vue` | 497 | Advanced | System config (hostname/timezone), system info grid, support bundle download, setup reset (admin only) |
| `steps/WelcomeStep.vue` | 59 | Wizard | System requirements display, skip wizard option |
| `steps/AdminStep.vue` | 86 | Wizard | Username, email, password + confirm with validation |
| `steps/DeviceStep.vue` | 53 | Wizard | Hostname and display name |
| `steps/WiFiStep.vue` | 67 | Wizard | SSID, password, channel selector |
| `steps/LocaleStep.vue` | 66 | Wizard | Timezone (grouped by region) and language |
| `steps/SummaryStep.vue` | 55 | Wizard | Configuration summary before apply |

## Components Refactored (2)

| File | Change | Description |
|------|--------|-------------|
| `FirstBootWizard.vue` | 915 → 314 lines | Replaced 11 inline step templates with 6 imported step components. Removed theme/purpose/SSL/DNS/NPM/features steps (advanced setup deferred to post-boot Settings) |
| `AskCubeOS.vue` | 508 → 489 lines | Added `useMode`, model selector, RAG toggle. Advanced: settings panel with model dropdown + RAG switch. Sends model/use_rag in stream payload |

## Router Change

```
/settings → SettingsPage.vue (was SettingsView.vue)
```

## Tab Structure

### SettingsPage
**Standard Mode:** Account, Appearance
**Advanced Mode:** Account, Appearance, Profiles, Support

Mode switch auto-resets to 'account' if current tab becomes invalid.

## Wallpaper Picker (AppearanceTab — Standard Mode Only)

Rendered inside `<SectionPanel standard>` so it only appears in Standard mode.

| Feature | Implementation |
|---------|---------------|
| Preset grid | 3x4 responsive grid of WALLPAPER_PRESETS from useWallpaper composable. Each shows SVG thumbnail with theme-appropriate variant |
| Custom upload | File input (hidden), accepts JPG/PNG/WebP, max 5MB. POSTs as FormData to `/api/v1/preferences/wallpaper`. Sets preference to `{ type: 'custom' }` |
| No wallpaper | Button that sets `{ type: 'none', value: null }`. Falls back to theme background |
| Selection state | Active preset/custom/none highlighted with accent border + ring + checkmark |
| Error handling | File type validation, size validation, upload error display |

## Wizard Decomposition

**Before:** 916-line monolith with 11 inline `<template v-else-if>` blocks
**After:** 314-line shell + 6 step components totaling 386 lines (700 total)

### Simplified Steps (11 → 6)
| # | Step ID | Component | Required |
|---|---------|-----------|----------|
| 1 | welcome | WelcomeStep.vue | Yes |
| 2 | admin | AdminStep.vue | Yes |
| 3 | device | DeviceStep.vue | Yes |
| 4 | wifi | WiFiStep.vue | Yes |
| 5 | locale | LocaleStep.vue | Yes |
| 6 | summary | SummaryStep.vue | Yes |

**Removed steps:** Theme, Purpose, SSL, DNS, NPM, Features. These are now accessible post-boot via Settings (Appearance, Profiles, Support tabs).

### Step Component Pattern
All step components use `defineProps` + `defineEmits` with `v-model` pattern:
- `modelValue`: config object (2-way binding with parent)
- `update()` helper emits field-level changes
- No store access — parent shell owns all state

## AskCubeOS Mode Awareness

### Standard Mode
- Simple chat: suggested prompts, message bubbles, source links
- No settings panel

### Advanced Mode
- Settings toggle button in header (gear icon)
- Collapsible settings panel with:
  - Model dropdown (fetched from `GET /chat/models`)
  - RAG toggle switch
- Sends `model` and `use_rag` fields in stream payload
- Model name displayed in footer text

## API Endpoints Wired

| Endpoint | Component | Method |
|----------|-----------|--------|
| `POST /preferences/wallpaper` | AppearanceTab | Custom wallpaper upload (multipart FormData) |
| `GET /preferences/wallpaper` | useWallpaper (existing) | Serves custom wallpaper image |
| `PUT /preferences` | AppearanceTab (via store) | Save wallpaper preference |
| `POST /preferences/reset` | AppearanceTab (via store) | Reset all preferences |
| `POST /setup/apply` | FirstBootWizard | Apply wizard config |
| `POST /setup/skip` | FirstBootWizard | Skip wizard |
| `POST /setup/complete` | setupStore (existing) | Mark setup done |
| `GET /support/bundle.zip` | SupportTab | Download support bundle |
| `GET /chat/models` | AskCubeOS | List available models (Advanced) |

## Stores Used

- `preferences.js` — wallpaper get/set, mode toggle, reset. No changes needed
- `setup.js` — fetchStatus, resetSetup, clearStatus. No changes needed
- `profiles.js` — fetchProfiles, applyProfile, isActive. No changes needed
- `auth.js` — fetchUser, changePassword, logout, isAdmin. No changes needed
- `system.js` — fetchAll, fetchHostname, fetchTimezone, setHostname, setTimezone. No changes needed
- `theme.js` — isDark, setTheme. No changes needed
- `branding.js` — currentBrand.github. No changes needed

## Build Verification

- `vite build` passes cleanly
- SettingsPage chunk: 36.62 KB (9.86 KB gzipped)
- FirstBootWizard chunk: 20.14 KB (5.47 KB gzipped)
- No import errors, all composables and stores resolved

## Files Modified

- `src/router/index.js` — `/settings` → `SettingsPage.vue` (was SettingsView.vue)
- `src/components/wizard/FirstBootWizard.vue` — Rewritten: 916 → 314 lines
- `src/components/chat/AskCubeOS.vue` — Refactored with mode awareness

## Files Created

- `src/components/settings/SettingsPage.vue` (113 lines)
- `src/components/settings/AccountTab.vue` (215 lines)
- `src/components/settings/AppearanceTab.vue` (317 lines)
- `src/components/settings/ProfilesTab.vue` (138 lines)
- `src/components/settings/SupportTab.vue` (497 lines)
- `src/components/wizard/steps/WelcomeStep.vue` (59 lines)
- `src/components/wizard/steps/AdminStep.vue` (86 lines)
- `src/components/wizard/steps/DeviceStep.vue` (53 lines)
- `src/components/wizard/steps/WiFiStep.vue` (67 lines)
- `src/components/wizard/steps/LocaleStep.vue` (66 lines)
- `src/components/wizard/steps/SummaryStep.vue` (55 lines)

## Files That Can Be Removed (After Validation in S12)

- `src/components/settings/SettingsView.vue` — Replaced by SettingsPage.vue
- `src/components/wizard/FirstBootWizard.vue.bak` — Backup of original wizard
- `src/components/chat/AskCubeOS.vue.bak` — Backup of original chat

**Do NOT remove** (still used):
- All wizard step components (steps/*.vue)
- SetupWizard.vue (separate component, not part of S10 scope)

## Architecture Patterns

1. **Shell → Tab**: SettingsPage manages tab state. Tabs self-manage via stores
2. **Mode-aware tabs**: TAB_DEFS computed array for shell-level tab visibility. AppearanceTab uses `<SectionPanel standard>` for section-level gating
3. **Wizard decomposition**: Shell owns state + navigation, steps own UI via v-model pattern
4. **Chat mode awareness**: `useMode` composable conditionally renders settings panel and sends model/RAG config in API payload

## What's Next (S11)

Go backend: Add POST/GET /preferences/wallpaper endpoints (multipart upload, validate+convert to WebP, serve image). Implement Tor proxy config in orchestrator.go. Implement VPN routing. Remove stale system.go TODO. Audit swagger annotations.
