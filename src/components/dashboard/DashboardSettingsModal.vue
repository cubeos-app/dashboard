<script setup>
/**
 * DashboardSettingsModal.vue — Session 2
 *
 * Slide-over settings panel for Standard dashboard customization.
 * Sections: Clock & Date, Widgets, Quick Actions, App Launcher, Widget Order.
 * Auto-saves each change via useDashboardConfig composable.
 * Reset to Defaults uses the global confirm dialog.
 */
import { ref, computed, watch, nextTick } from 'vue'
import { useDashboardConfig } from '@/composables/useDashboardConfig'
import { useFocusTrap } from '@/composables/useFocusTrap'
import { confirm } from '@/utils/confirmDialog'
import Icon from '@/components/ui/Icon.vue'

const props = defineProps({
  show: { type: Boolean, required: true }
})

const emit = defineEmits(['close'])

const { trapFocus } = useFocusTrap()
const config = useDashboardConfig()

const panelRef = ref(null)

// Auto-focus panel on open
watch(() => props.show, (visible) => {
  if (visible) nextTick(() => panelRef.value?.focus())
})

// ─── Date format options with live preview ──────────────────
const DATE_FORMATS = [
  { id: 'long',   label: 'Long' },
  { id: 'medium', label: 'Medium' },
  { id: 'short',  label: 'Short' },
  { id: 'iso',    label: 'ISO' },
  { id: 'us',     label: 'US' },
  { id: 'eu',     label: 'EU' },
]

function formatDatePreview(fmt) {
  const now = new Date()
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const dayShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']
  const monShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const d = now.getDate()
  const m = now.getMonth()
  const y = now.getFullYear()
  const dw = now.getDay()
  const pad = (n) => String(n).padStart(2, '0')

  switch (fmt) {
    case 'long':   return `${days[dw]}, ${months[m]} ${d}, ${y}`
    case 'medium': return `${days[dw]}, ${d} ${months[m]}, ${y}`
    case 'short':  return `${dayShort[dw]} ${d}-${monShort[m]}-${y}`
    case 'iso':    return `${y}-${pad(m + 1)}-${pad(d)}`
    case 'us':     return `${pad(m + 1)}/${pad(d)}/${y}`
    case 'eu':     return `${pad(d)}/${pad(m + 1)}/${y}`
    default:       return `${days[dw]}, ${months[m]} ${d}, ${y}`
  }
}

// ─── Quick Actions pool ─────────────────────────────────────
const ACTIONS_POOL = [
  { id: 'add_app',    label: 'Add App',    icon: 'Plus' },
  { id: 'network',    label: 'Network',    icon: 'Wifi' },
  { id: 'storage',    label: 'Storage',    icon: 'HardDrive' },
  { id: 'ask_cubeos', label: 'Ask CubeOS', icon: 'MessageSquare' },
  { id: 'system',     label: 'System',     icon: 'Settings2' },
  { id: 'settings',   label: 'Settings',   icon: 'SlidersHorizontal' },
  { id: 'monitoring', label: 'Monitoring', icon: 'BarChart3' },
  { id: 'logs',       label: 'Logs',       icon: 'ScrollText' },
  { id: 'docs',       label: 'Docs',       icon: 'BookOpen' },
  { id: 'vpn',        label: 'VPN',        icon: 'Shield' },
]

const enabledActions = computed(() => config.quickActions.value)

const availableActions = computed(() =>
  ACTIONS_POOL.filter(a => !enabledActions.value.includes(a.id))
)

function getActionMeta(id) {
  return ACTIONS_POOL.find(a => a.id === id) || { id, label: id, icon: 'Box' }
}

function moveAction(index, direction) {
  const list = [...enabledActions.value]
  const newIndex = index + direction
  if (newIndex < 0 || newIndex >= list.length) return
  ;[list[index], list[newIndex]] = [list[newIndex], list[index]]
  config.updateConfig('quick_actions', list)
}

function removeAction(id) {
  config.updateConfig('quick_actions', enabledActions.value.filter(a => a !== id))
}

function addAction(id) {
  if (enabledActions.value.length >= 8) return
  config.updateConfig('quick_actions', [...enabledActions.value, id])
}

// ─── Widget Order ───────────────────────────────────────────
const WIDGET_LABELS = {
  clock: 'Clock',
  search: 'Search Bar',
  status: 'Status Pill',
  vitals: 'System Vitals',
  network: 'Network Widget',
  actions: 'Quick Actions',
  launcher: 'App Launcher',
}

const WIDGET_ICONS = {
  clock: 'Clock',
  search: 'Search',
  status: 'Activity',
  vitals: 'Cpu',
  network: 'Wifi',
  actions: 'Zap',
  launcher: 'Grid3x3',
}

function moveWidget(index, direction) {
  const list = [...config.widgetOrder.value]
  const newIndex = index + direction
  if (newIndex < 0 || newIndex >= list.length) return
  ;[list[index], list[newIndex]] = [list[newIndex], list[index]]
  config.updateConfig('widget_order', list)
}

// ─── Toggle helper ──────────────────────────────────────────
function toggle(key, currentValue) {
  config.updateConfig(key, !currentValue)
}

// ─── Reset ──────────────────────────────────────────────────
async function handleReset() {
  if (!await confirm({
    title: 'Reset Dashboard Settings',
    message: 'This will reset all dashboard customizations for the current view to their defaults.',
    confirmText: 'Reset',
    variant: 'warning'
  })) return
  config.resetDefaults()
}

function handleClose() {
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="settings-fade">
      <div
        v-if="show"
        ref="panelRef"
        class="fixed inset-0 z-50 flex justify-end"
        role="dialog"
        aria-modal="true"
        aria-label="Dashboard Settings"
        tabindex="-1"
        @keydown.escape="handleClose"
        @keydown="trapFocus"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-theme-overlay backdrop-blur-sm"
          @click="handleClose"
        ></div>

        <!-- Panel -->
        <div class="relative w-full max-w-md h-full bg-theme-card border-l border-theme-primary shadow-theme-xl flex flex-col animate-settings-slide-in">
          <!-- Header -->
          <div class="flex items-center justify-between p-5 border-b border-theme-primary flex-shrink-0">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl bg-theme-tertiary flex items-center justify-center">
                <Icon name="SlidersHorizontal" :size="18" class="text-theme-secondary" />
              </div>
              <div>
                <h2 class="text-base font-semibold text-theme-primary">Dashboard Settings</h2>
                <p class="text-xs text-theme-muted">Customize your dashboard layout</p>
              </div>
            </div>
            <button
              @click="handleClose"
              class="w-8 h-8 rounded-lg flex items-center justify-center text-theme-muted hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
              aria-label="Close settings"
            >
              <Icon name="X" :size="18" />
            </button>
          </div>

          <!-- Scrollable content -->
          <div class="flex-1 overflow-y-auto p-5 space-y-6">

            <!-- ═══ Section: Clock & Date ═══ -->
            <section>
              <h3 class="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-3">Clock & Date</h3>
              <div class="space-y-3">
                <SettingsToggle label="Show clock" :active="config.showClock.value" @toggle="toggle('show_clock', config.showClock.value)" />
                <SettingsToggle label="Show greeting" :active="config.showGreeting.value" @toggle="toggle('show_greeting', config.showGreeting.value)" />
                <SettingsToggle label="Show seconds" :active="config.showSeconds.value" @toggle="toggle('show_seconds', config.showSeconds.value)" />

                <!-- Time format -->
                <div class="flex items-center justify-between py-1">
                  <span class="text-sm text-theme-secondary">Time format</span>
                  <div class="flex rounded-lg border border-theme-primary overflow-hidden">
                    <button
                      v-for="fmt in ['12h', '24h']"
                      :key="fmt"
                      class="px-3 py-1.5 text-xs font-medium transition-colors"
                      :class="config.clockFormat.value === fmt
                        ? 'bg-accent text-on-accent'
                        : 'text-theme-secondary hover:bg-theme-tertiary'"
                      @click="config.updateConfig('clock_format', fmt)"
                    >
                      {{ fmt }}
                    </button>
                  </div>
                </div>

                <!-- Date format -->
                <div class="space-y-2">
                  <span class="text-sm text-theme-secondary">Date format</span>
                  <div class="space-y-1">
                    <button
                      v-for="fmt in DATE_FORMATS"
                      :key="fmt.id"
                      class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors"
                      :class="config.dateFormat.value === fmt.id
                        ? 'bg-accent/10 text-accent border border-accent/20'
                        : 'text-theme-secondary hover:bg-theme-tertiary border border-transparent'"
                      @click="config.updateConfig('date_format', fmt.id)"
                    >
                      <span class="font-medium">{{ fmt.label }}</span>
                      <span class="text-xs opacity-70">{{ formatDatePreview(fmt.id) }}</span>
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <!-- ═══ Section: Widgets ═══ -->
            <section>
              <h3 class="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-3">Widgets</h3>
              <div class="space-y-3">
                <SettingsToggle label="System Vitals" :active="config.showSystemVitals.value" @toggle="toggle('show_system_vitals', config.showSystemVitals.value)" />
                <SettingsToggle label="Network" :active="config.showNetwork.value" @toggle="toggle('show_network_widget', config.showNetwork.value)" />
                <SettingsToggle label="Disk Usage" :active="config.showDisk.value" @toggle="toggle('show_disk_widget', config.showDisk.value)" />
                <SettingsToggle label="Signals" :active="config.showSignals.value" @toggle="toggle('show_signals_widget', config.showSignals.value)" />
                <SettingsToggle label="Status Pill" :active="config.showStatusPill.value" @toggle="toggle('show_status_pill', config.showStatusPill.value)" />
                <SettingsToggle label="Search / Chat Bar" :active="config.showSearch.value" @toggle="toggle('show_search', config.showSearch.value)" />
                <SettingsToggle label="Alert Banner" :active="config.showAlerts.value" @toggle="toggle('show_alerts', config.showAlerts.value)" />
              </div>
            </section>

            <!-- ═══ Section: Quick Actions ═══ -->
            <section>
              <h3 class="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-3">
                Quick Actions
                <span class="text-theme-muted font-normal normal-case tracking-normal ml-1">({{ enabledActions.length }}/8)</span>
              </h3>

              <!-- Enabled list (reorderable) -->
              <div v-if="enabledActions.length" class="space-y-1 mb-3">
                <div
                  v-for="(id, index) in enabledActions"
                  :key="id"
                  class="flex items-center gap-2 px-3 py-2 rounded-lg bg-theme-tertiary"
                >
                  <Icon :name="getActionMeta(id).icon" :size="16" class="text-theme-secondary flex-shrink-0" />
                  <span class="text-sm text-theme-primary flex-1">{{ getActionMeta(id).label }}</span>
                  <button
                    :disabled="index === 0"
                    class="w-6 h-6 rounded flex items-center justify-center text-theme-muted hover:text-theme-primary hover:bg-theme-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Move up"
                    @click="moveAction(index, -1)"
                  >
                    <Icon name="ChevronUp" :size="14" />
                  </button>
                  <button
                    :disabled="index === enabledActions.length - 1"
                    class="w-6 h-6 rounded flex items-center justify-center text-theme-muted hover:text-theme-primary hover:bg-theme-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Move down"
                    @click="moveAction(index, 1)"
                  >
                    <Icon name="ChevronDown" :size="14" />
                  </button>
                  <button
                    class="w-6 h-6 rounded flex items-center justify-center text-theme-muted hover:text-error hover:bg-error-muted transition-colors"
                    aria-label="Remove action"
                    @click="removeAction(id)"
                  >
                    <Icon name="X" :size="14" />
                  </button>
                </div>
              </div>
              <p v-else class="text-xs text-theme-muted italic mb-3">No quick actions enabled</p>

              <!-- Available pool -->
              <div v-if="availableActions.length" class="space-y-1">
                <p class="text-xs text-theme-muted mb-1">Available</p>
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="action in availableActions"
                    :key="action.id"
                    :disabled="enabledActions.length >= 8"
                    class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-theme-primary text-xs text-theme-secondary
                           hover:bg-theme-tertiary hover:text-theme-primary transition-colors
                           disabled:opacity-40 disabled:cursor-not-allowed"
                    @click="addAction(action.id)"
                  >
                    <Icon :name="action.icon" :size="12" />
                    {{ action.label }}
                  </button>
                </div>
              </div>
            </section>

            <!-- ═══ Section: App Launcher ═══ -->
            <section>
              <h3 class="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-3">App Launcher</h3>
              <div class="space-y-3">
                <SettingsToggle label="Favorites section" :active="config.showFavorites.value" @toggle="toggle('show_favorites', config.showFavorites.value)" />
                <SettingsToggle label="Recently Used section" :active="config.showRecent.value" @toggle="toggle('show_recent', config.showRecent.value)" />
                <SettingsToggle label="My Apps section" :active="config.showMyApps.value" @toggle="toggle('show_my_apps', config.showMyApps.value)" />

                <!-- My Apps rows -->
                <div class="flex items-center justify-between py-1">
                  <span class="text-sm text-theme-secondary">My Apps rows</span>
                  <div class="flex items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max="5"
                      :value="config.myAppsRows.value"
                      class="w-24 accent-accent"
                      @input="config.updateConfig('my_apps_rows', parseInt($event.target.value))"
                    />
                    <span class="text-xs font-mono text-theme-muted w-8 text-right">
                      {{ config.myAppsRows.value === 0 ? 'All' : config.myAppsRows.value }}
                    </span>
                  </div>
                </div>

                <!-- Favorites columns -->
                <div class="flex items-center justify-between py-1">
                  <span class="text-sm text-theme-secondary">Favorites columns</span>
                  <div class="flex rounded-lg border border-theme-primary overflow-hidden">
                    <button
                      v-for="n in [2, 3, 4, 5, 6]"
                      :key="n"
                      class="px-2.5 py-1.5 text-xs font-medium transition-colors"
                      :class="config.favoriteCols.value === n
                        ? 'bg-accent text-on-accent'
                        : 'text-theme-secondary hover:bg-theme-tertiary'"
                      @click="config.updateConfig('favorite_cols', n)"
                    >
                      {{ n }}
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <!-- ═══ Section: Widget Order ═══ -->
            <section>
              <h3 class="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-3">Widget Order</h3>
              <div class="space-y-1">
                <div
                  v-for="(id, index) in config.widgetOrder.value"
                  :key="id"
                  class="flex items-center gap-2 px-3 py-2 rounded-lg bg-theme-tertiary"
                >
                  <Icon :name="WIDGET_ICONS[id] || 'Box'" :size="16" class="text-theme-secondary flex-shrink-0" />
                  <span class="text-sm text-theme-primary flex-1">{{ WIDGET_LABELS[id] || id }}</span>
                  <button
                    :disabled="index === 0"
                    class="w-6 h-6 rounded flex items-center justify-center text-theme-muted hover:text-theme-primary hover:bg-theme-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Move up"
                    @click="moveWidget(index, -1)"
                  >
                    <Icon name="ChevronUp" :size="14" />
                  </button>
                  <button
                    :disabled="index === config.widgetOrder.value.length - 1"
                    class="w-6 h-6 rounded flex items-center justify-center text-theme-muted hover:text-theme-primary hover:bg-theme-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Move down"
                    @click="moveWidget(index, 1)"
                  >
                    <Icon name="ChevronDown" :size="14" />
                  </button>
                </div>
              </div>
            </section>

          </div>

          <!-- Footer -->
          <div class="flex items-center justify-between p-5 border-t border-theme-primary flex-shrink-0">
            <button
              @click="handleReset"
              class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-warning hover:bg-warning/10 transition-colors"
            >
              <Icon name="RotateCcw" :size="14" />
              Reset to Defaults
            </button>
            <button
              @click="handleClose"
              class="px-4 py-2 rounded-lg bg-theme-tertiary text-sm text-theme-secondary hover:text-theme-primary transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<!-- ─── SettingsToggle inline component ───────────────────── -->
<script>
/**
 * Tiny inline toggle row used only by this modal.
 * Not extracted to a separate file since it's a settings-specific pattern.
 */
import { defineComponent, h } from 'vue'

const SettingsToggle = defineComponent({
  name: 'SettingsToggle',
  props: {
    label: { type: String, required: true },
    active: { type: Boolean, required: true },
  },
  emits: ['toggle'],
  setup(props, { emit }) {
    return () =>
      h('div', { class: 'flex items-center justify-between py-1' }, [
        h('span', { class: 'text-sm text-theme-secondary' }, props.label),
        h('button', {
          class: [
            'relative w-10 h-[22px] rounded-full transition-colors duration-200 flex-shrink-0',
            props.active ? 'bg-accent' : 'bg-theme-tertiary border border-theme-primary'
          ],
          role: 'switch',
          'aria-checked': String(props.active),
          'aria-label': `Toggle ${props.label}`,
          onClick: () => emit('toggle'),
        }, [
          h('span', {
            class: [
              'absolute top-0.5 w-[18px] h-[18px] rounded-full transition-transform duration-200 shadow-sm',
              props.active
                ? 'translate-x-[22px] bg-on-accent'
                : 'translate-x-0.5 bg-theme-muted'
            ]
          })
        ])
      ])
  }
})

export { SettingsToggle }
</script>

<style scoped>
/* Slide-in animation for the settings panel */
@keyframes settings-slide-in {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}
.animate-settings-slide-in {
  animation: settings-slide-in 0.25s ease-out;
}

/* Fade transition for backdrop */
.settings-fade-enter-active,
.settings-fade-leave-active {
  transition: opacity 0.2s ease;
}
.settings-fade-enter-from,
.settings-fade-leave-to {
  opacity: 0;
}
</style>
