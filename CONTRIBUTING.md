# Contributing to CubeOS Dashboard

Guidelines for consistent, accessible, and maintainable dashboard code.

## Component Naming

**Pages** (routed views) use the `*Page.vue` suffix and live in `src/components/{section}/`:

```
apps/AppsPage.vue           # /apps route
network/NetworkPage.vue     # /network route
storage/StoragePage.vue     # /storage route
system/SystemPage.vue       # /system route
settings/SettingsPage.vue   # /settings route
```

**Tabs** within pages use the `*Tab.vue` suffix:

```
network/FirewallTab.vue     # ?tab=firewall inside NetworkPage
storage/BackupsTab.vue      # ?tab=backups inside StoragePage
system/MonitoringTab.vue    # ?tab=monitoring inside SystemPage
```

**Shared UI** components live in `src/components/ui/`: `Icon.vue`, `SectionPanel.vue`, `PageHeader.vue`, `ConfirmDialog.vue`, `ModeToggle.vue`, `ResponsiveTable.vue`, `ErrorBoundary.vue`, `SkeletonLoader.vue`, `DirectoryBrowser.vue`.

**Deprecated `*View.vue` files have been removed.** Do not create new `*View.vue` files for routable pages. The only remaining `*View.vue` files are leaf components wrapped by tabs (e.g. `HardwareView.vue` inside `HardwareTab.vue`) and the active `DashboardView.vue`.

## Accessibility (aria-labels)

Every **icon-only button** (a button whose visible content is only an `<Icon>` or SVG) must have an `aria-label`. Without one, screen readers announce the button as empty.

**Static labels** for buttons with fixed meaning:

```vue
<button @click="close" aria-label="Close dialog">
  <Icon name="X" :size="20" />
</button>

<button @click="refresh" aria-label="Refresh status">
  <Icon name="RefreshCw" :size="14" />
</button>
```

**Dynamic labels** for action buttons inside lists, where context matters:

```vue
<button
  @click="startApp(app)"
  :aria-label="`Start ${app.display_name || app.name}`"
>
  <Icon name="Play" :size="16" />
</button>

<button
  @click="deleteRule(rule)"
  :aria-label="`Delete firewall rule for port ${rule.port || 'any'}`"
>
  <Icon name="Trash2" :size="16" />
</button>
```

**Buttons with visible text** do not need `aria-label` — the text itself is the label. Only add it when the icon is the sole visible content.

**Toggle buttons** should include both `role` and `aria-checked` or `aria-expanded`:

```vue
<div role="radiogroup" aria-label="UI mode">
  <button role="radio" :aria-checked="isStandard">Standard</button>
  <button role="radio" :aria-checked="isAdvanced">Advanced</button>
</div>
```

**Collapsible sections** should use `aria-expanded`:

```vue
<button
  :aria-label="isCollapsed ? 'Expand section' : 'Collapse section'"
  :aria-expanded="!isCollapsed"
>
```

## Mode Toggle (Standard / Advanced)

CubeOS has two UI modes controlled by the `useMode()` composable:

```vue
<script setup>
import { useMode } from '@/composables/useMode'
const { isAdvanced, isStandard, toggleMode } = useMode()
</script>
```

**Standard mode** shows simplified views for everyday users. **Advanced mode** exposes Docker internals, logs, hardware panels, and developer-oriented features.

Use `v-if="isAdvanced"` to gate advanced-only content. Entire tab panels can be conditionally rendered:

```vue
<SectionPanel v-if="isAdvanced" title="Docker Details">
  ...
</SectionPanel>
```

The `<ModeToggle>` component is placed in the header/sidebar. Do not add extra mode toggles elsewhere.

## Icons

Use the `<Icon>` component (wraps `lucide-vue-next`). **Never use emojis.**

```vue
import Icon from '@/components/ui/Icon.vue'

<Icon name="Wifi" :size="20" />
<Icon name="HardDrive" :size="16" :stroke-width="1.5" />
```

Icon names are PascalCase Lucide names: `Play`, `Square`, `RotateCw`, `Trash2`, `Settings`, `ChevronDown`, etc. If the requested icon doesn't exist, `Box` is rendered as fallback.

## Pinia Store Patterns

Stores live in `src/stores/` and follow a consistent structure:

```js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useExampleStore = defineStore('example', () => {
  // --- State ---
  const items = ref([])
  const loading = ref(false)
  const error = ref(null)

  // --- Getters ---
  const activeItems = computed(() => items.value.filter(i => i.active))

  // --- Actions ---
  async function fetchItems(signal) {
    loading.value = true
    error.value = null
    try {
      const res = await apiClient.get('/example', { signal })
      items.value = res.data || []
    } catch (err) {
      if (err.name !== 'AbortError') {
        error.value = err.message
      }
    } finally {
      loading.value = false
    }
  }

  return { items, loading, error, activeItems, fetchItems }
})
```

Key conventions:

- Use the **Composition API** style (`defineStore('name', () => { ... })`)
- Always include `loading` and `error` refs for async operations
- Accept an `AbortSignal` parameter in fetch functions for request cancellation
- Skip `AbortError` in catch blocks (normal cleanup, not a real error)
- Use the `useAppsApi()` composable or `apiClient` for API calls, never raw `fetch`
- Export constants (enums) at the top of the file alongside the store

## API Client

All API calls go through `src/api/client.js`. It handles token refresh, auth headers, and base URL automatically.

```js
import apiClient from '@/api/client'

const data = await apiClient.get('/apps')
const result = await apiClient.post('/apps/my-app/start')
await apiClient.delete('/apps/my-app')
```

The base path is `/api/v1`. All endpoints are relative to this.

## Styling

Use **Tailwind utility classes** exclusively. Use **theme-aware CSS custom properties** for colors:

```
text-theme-primary       # Main text
text-theme-secondary     # Muted text
text-theme-muted         # Disabled/hint text
bg-theme-primary         # Main background
bg-theme-secondary       # Card/elevated background
bg-theme-tertiary        # Hover/active state
border-theme-primary     # Standard borders
text-accent              # Brand accent color
bg-accent                # Accent background
text-on-accent           # Text on accent background
```

Do **not** hardcode Tailwind color classes like `text-gray-500` or `bg-blue-600`. Always use theme tokens so dark/light mode works correctly.

## Git Workflow

All changes deploy automatically via GitLab CI/CD on push to `main`. The pipeline builds a multi-arch Docker image (AMD64 + ARM64) and deploys to the Pi.

- Run `npm run lint` before committing
- Use descriptive commit messages: `fix(a11y): add aria-labels to icon-only buttons`
- No manual deployments to the Pi — everything flows through the pipeline
