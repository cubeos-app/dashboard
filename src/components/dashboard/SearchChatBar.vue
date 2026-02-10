<script setup>
/**
 * SearchChatBar.vue — S13
 *
 * Dual-purpose search + chat input for Standard dashboard.
 * Idle: rounded input bar with rotating placeholder.
 * Focused: command palette overlay with app/page/settings search.
 * No match: falls through to AskCubeOS inline chat.
 *
 * Global shortcut: Ctrl+K / Cmd+K focuses the bar (via provide/inject from DashboardView).
 */
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useAppsStore } from '@/stores/apps'
import { useFavoritesStore } from '@/stores/favorites'
import { useWallpaper } from '@/composables/useWallpaper'
import { safeGetItem } from '@/utils/storage'
import Icon from '@/components/ui/Icon.vue'
import api from '@/api/client'

const router = useRouter()
const appsStore = useAppsStore()
const favoritesStore = useFavoritesStore()
const { isActive: wallpaperActive } = useWallpaper()

const emit = defineEmits(['open-app', 'focus-search'])

// ─── State ───────────────────────────────────────────────────────
const query = ref('')
const isOpen = ref(false)
const selectedIndex = ref(0)
const inputRef = ref(null)
const chatMode = ref(false)
const chatResponse = ref('')
const chatLoading = ref(false)
let chatController = null
let debounceTimer = null

// Platform detection for keyboard shortcut hint
const isMac = typeof window !== 'undefined' && window.navigator?.platform?.includes('Mac')

// ─── Placeholder rotation ────────────────────────────────────────
const placeholders = [
  'Search apps, settings, or ask CubeOS...',
  "Try: 'open Nextcloud' or 'restart Pi-hole'",
  "Ask: 'how do I set up a VPN?'"
]
const placeholderIndex = ref(0)
let placeholderInterval = null

const currentPlaceholder = computed(() => placeholders[placeholderIndex.value])

onMounted(() => {
  placeholderInterval = setInterval(() => {
    placeholderIndex.value = (placeholderIndex.value + 1) % placeholders.length
  }, 4000)
})

onUnmounted(() => {
  clearInterval(placeholderInterval)
  clearTimeout(debounceTimer)
  if (chatController) chatController.abort()
})

// ─── Search Index ────────────────────────────────────────────────
const searchIndex = computed(() => [
  // Apps
  ...appsStore.apps.map(app => ({
    type: 'app',
    label: appsStore.getDisplayName(app),
    icon: appsStore.getAppIcon(app),
    action: () => { emit('open-app', app); close() },
    keywords: [app.name, app.display_name, app.description, app.type].filter(Boolean)
  })),
  // Pages
  { type: 'page', label: 'Dashboard', icon: 'LayoutDashboard', action: () => navigate('/'), keywords: ['dashboard', 'home'] },
  { type: 'page', label: 'Apps', icon: 'Package', action: () => navigate('/apps'), keywords: ['apps', 'my apps', 'installed'] },
  { type: 'page', label: 'App Store', icon: 'Download', action: () => navigate('/apps?tab=store'), keywords: ['store', 'install', 'new app', 'marketplace'] },
  { type: 'page', label: 'Network', icon: 'Globe', action: () => navigate('/network'), keywords: ['network', 'wifi', 'internet', 'firewall', 'vpn', 'dns'] },
  { type: 'page', label: 'Storage', icon: 'HardDrive', action: () => navigate('/storage'), keywords: ['storage', 'disk', 'usb', 'backup', 'smb', 'nfs'] },
  { type: 'page', label: 'System', icon: 'Monitor', action: () => navigate('/system'), keywords: ['system', 'monitoring', 'processes', 'logs', 'hardware', 'temperature'] },
  { type: 'page', label: 'Communication', icon: 'Radio', action: () => navigate('/communication'), keywords: ['communication', 'gps', 'cellular', 'meshtastic', 'iridium', 'bluetooth'] },
  { type: 'page', label: 'Media', icon: 'Camera', action: () => navigate('/media'), keywords: ['media', 'camera', 'audio'] },
  // Settings
  { type: 'setting', label: 'Appearance', icon: 'Palette', action: () => navigate('/settings?tab=appearance'), keywords: ['theme', 'dark', 'light', 'wallpaper', 'appearance'] },
  { type: 'setting', label: 'Account', icon: 'Lock', action: () => navigate('/settings?tab=account'), keywords: ['password', 'security', 'account', 'user'] },
  { type: 'setting', label: 'Profiles', icon: 'Users', action: () => navigate('/settings?tab=profiles'), keywords: ['profiles', 'branding'] },
  { type: 'setting', label: 'Support', icon: 'HelpCircle', action: () => navigate('/settings?tab=support'), keywords: ['support', 'help', 'about', 'version'] },
])

// ─── Filtered results ────────────────────────────────────────────
const results = computed(() => {
  if (!query.value.trim()) return []
  const q = query.value.toLowerCase().trim()
  return searchIndex.value.filter(item => {
    if (item.label.toLowerCase().includes(q)) return true
    return item.keywords.some(k => k.toLowerCase().includes(q))
  }).slice(0, 8)
})

// Recently used apps for quick access when palette opens
const recentApps = computed(() => {
  const names = safeGetItem('cubeos-recent', [])
  if (!Array.isArray(names)) return []
  return names
    .map(name => appsStore.getAppByName(name))
    .filter(Boolean)
    .slice(0, 4)
})

// Group results by type for display
const groupedResults = computed(() => {
  const groups = []
  const apps = results.value.filter(r => r.type === 'app')
  const pages = results.value.filter(r => r.type === 'page')
  const settings = results.value.filter(r => r.type === 'setting')
  if (apps.length) groups.push({ title: 'Apps', items: apps })
  if (pages.length) groups.push({ title: 'Pages', items: pages })
  if (settings.length) groups.push({ title: 'Settings', items: settings })
  return groups
})

// Flat list of all results for keyboard navigation
const flatResults = computed(() => results.value)

// ─── Methods ─────────────────────────────────────────────────────
function navigate(path) {
  router.push(path)
  close()
}

function open() {
  isOpen.value = true
  chatMode.value = false
  chatResponse.value = ''
  selectedIndex.value = 0
  nextTick(() => inputRef.value?.focus())
}

function close() {
  isOpen.value = false
  query.value = ''
  chatMode.value = false
  chatResponse.value = ''
  chatLoading.value = false
  selectedIndex.value = 0
  if (chatController) { chatController.abort(); chatController = null }
}

function focusInput() {
  if (isOpen.value) {
    inputRef.value?.focus()
  } else {
    open()
  }
}

// Expose for parent to call via ref
defineExpose({ focusInput })

function onInput() {
  selectedIndex.value = 0
  chatMode.value = false
  chatResponse.value = ''

  // If query starts with '?', go directly to chat mode
  if (query.value.startsWith('?')) {
    return
  }

  // Debounce: if no results after 500ms, suggest chat
  clearTimeout(debounceTimer)
  if (query.value.trim().length > 2) {
    debounceTimer = setTimeout(() => {
      if (results.value.length === 0 && query.value.trim()) {
        chatMode.value = true
      }
    }, 500)
  }
}

function onKeydown(e) {
  if (e.key === 'Escape') {
    close()
    return
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (flatResults.value.length > 0) {
      selectedIndex.value = Math.min(selectedIndex.value + 1, flatResults.value.length - 1)
    }
    return
  }

  if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
    return
  }

  if (e.key === 'Enter') {
    e.preventDefault()
    if (flatResults.value.length > 0 && !chatMode.value) {
      flatResults.value[selectedIndex.value]?.action()
    } else if (query.value.trim()) {
      sendChat()
    }
  }
}

async function sendChat() {
  const text = query.value.startsWith('?') ? query.value.slice(1).trim() : query.value.trim()
  if (!text) return

  chatMode.value = true
  chatLoading.value = true
  chatResponse.value = ''

  if (chatController) chatController.abort()
  chatController = new AbortController()

  try {
    const response = await fetch('/api/v1/chat/stream', {
      method: 'POST',
      headers: api.getHeaders(),
      body: JSON.stringify({ message: text }),
      signal: chatController.signal
    })

    if (!response.ok) {
      chatResponse.value = response.status === 503
        ? 'CubeOS AI is not available. Check that Ollama is running.'
        : `Chat request failed (HTTP ${response.status})`
      chatLoading.value = false
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue
        const payload = line.slice(6)
        if (payload === '[DONE]') break
        try {
          const parsed = JSON.parse(payload)
          if (parsed.content) chatResponse.value += parsed.content
        } catch { /* skip malformed */ }
      }
    }
  } catch (e) {
    if (e.name !== 'AbortError') {
      chatResponse.value = 'Could not reach CubeOS AI. Check that Ollama is running.'
    }
  } finally {
    chatLoading.value = false
  }
}

function openFullChat() {
  close()
  // Emit to DashboardView to open the chat modal
  emit('open-chat')
}

// ─── Card class helper ───────────────────────────────────────────
function cardClass() {
  return wallpaperActive.value ? 'glass' : 'bg-theme-card border border-theme-primary'
}
</script>

<template>
  <!-- Idle state: search bar trigger -->
  <div v-if="!isOpen" class="animate-fade-in">
    <button
      :class="cardClass()"
      class="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-all hover:ring-2 hover:ring-accent/30"
      @click="open"
    >
      <Icon name="Search" :size="18" class="text-theme-muted shrink-0" />
      <span class="text-sm text-theme-muted truncate">{{ currentPlaceholder }}</span>
      <kbd class="hidden sm:inline-flex items-center gap-0.5 ml-auto px-1.5 py-0.5 rounded text-[10px] font-mono text-theme-muted bg-theme-tertiary border border-theme-primary">
        <span class="text-xs">{{ isMac ? '\u2318' : 'Ctrl' }}</span>
        <span>K</span>
      </kbd>
    </button>
  </div>

  <!-- Command palette overlay -->
  <Teleport to="body">
    <Transition name="palette">
      <div v-if="isOpen" class="fixed inset-0 z-[100]" @click.self="close">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="close" />

        <!-- Palette panel -->
        <div class="relative mx-auto mt-[15vh] w-full max-w-lg px-4">
          <div class="rounded-2xl border border-theme-primary bg-theme-card shadow-2xl overflow-hidden">
            <!-- Search input -->
            <div class="flex items-center gap-3 px-4 py-3 border-b border-theme-primary">
              <Icon name="Search" :size="18" class="text-theme-muted shrink-0" />
              <input
                ref="inputRef"
                v-model="query"
                type="text"
                :placeholder="currentPlaceholder"
                class="flex-1 bg-transparent text-sm text-theme-primary placeholder-theme-muted outline-none"
                @input="onInput"
                @keydown="onKeydown"
              />
              <button
                class="p-1 rounded-md text-theme-muted hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
                @click="close"
              >
                <Icon name="X" :size="16" />
              </button>
            </div>

            <!-- Results / Content area -->
            <div class="max-h-80 overflow-y-auto">
              <!-- No query: show recent apps -->
              <template v-if="!query.trim()">
                <div v-if="recentApps.length" class="p-2">
                  <p class="px-2 py-1 text-[10px] font-semibold text-theme-muted uppercase tracking-wider">Recent</p>
                  <button
                    v-for="app in recentApps"
                    :key="app.name"
                    class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-theme-tertiary transition-colors"
                    @click="emit('open-app', app); close()"
                  >
                    <Icon :name="appsStore.getAppIcon(app)" :size="16" class="text-theme-secondary shrink-0" />
                    <span class="text-sm text-theme-primary">{{ appsStore.getDisplayName(app) }}</span>
                  </button>
                </div>
                <div v-else class="p-6 text-center">
                  <p class="text-sm text-theme-muted">Start typing to search apps, pages, or ask CubeOS</p>
                </div>
              </template>

              <!-- Search results -->
              <template v-else-if="groupedResults.length && !chatMode">
                <div v-for="group in groupedResults" :key="group.title" class="p-2">
                  <p class="px-2 py-1 text-[10px] font-semibold text-theme-muted uppercase tracking-wider">{{ group.title }}</p>
                  <button
                    v-for="(item, idx) in group.items"
                    :key="item.label"
                    class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors"
                    :class="flatResults.indexOf(item) === selectedIndex ? 'bg-accent/10 text-accent' : 'hover:bg-theme-tertiary text-theme-primary'"
                    @click="item.action()"
                    @mouseenter="selectedIndex = flatResults.indexOf(item)"
                  >
                    <Icon :name="item.icon" :size="16" class="shrink-0" :class="flatResults.indexOf(item) === selectedIndex ? 'text-accent' : 'text-theme-secondary'" />
                    <span class="text-sm">{{ item.label }}</span>
                    <span v-if="item.type !== 'app'" class="ml-auto text-[10px] text-theme-muted capitalize">{{ item.type }}</span>
                  </button>
                </div>
              </template>

              <!-- Chat fallback -->
              <template v-else-if="chatMode || query.startsWith('?')">
                <div class="p-4 space-y-3">
                  <div v-if="!chatResponse && !chatLoading" class="space-y-2">
                    <p class="text-xs text-theme-muted">No matching apps or pages found. Ask CubeOS AI instead?</p>
                    <button
                      class="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/10 text-accent text-sm hover:bg-accent/20 transition-colors"
                      @click="sendChat"
                    >
                      <Icon name="MessageSquare" :size="16" />
                      <span>Ask: "{{ query.startsWith('?') ? query.slice(1).trim() : query }}"</span>
                    </button>
                  </div>

                  <!-- Chat loading -->
                  <div v-if="chatLoading && !chatResponse" class="flex items-center gap-2 text-sm text-theme-muted">
                    <div class="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                    <span>Thinking...</span>
                  </div>

                  <!-- Chat response -->
                  <div v-if="chatResponse" class="space-y-2">
                    <div class="p-3 rounded-lg bg-theme-tertiary text-sm text-theme-primary leading-relaxed whitespace-pre-wrap">
                      {{ chatResponse }}
                    </div>
                    <div class="flex items-center gap-2">
                      <button
                        class="text-xs text-accent hover:underline"
                        @click="openFullChat"
                      >
                        Open full chat
                      </button>
                    </div>
                  </div>
                </div>
              </template>

              <!-- Query typed but no results yet (still within debounce) -->
              <template v-else-if="query.trim() && !groupedResults.length">
                <div class="p-6 text-center">
                  <p class="text-sm text-theme-muted">No results for "{{ query }}"</p>
                  <button
                    class="mt-2 text-xs text-accent hover:underline"
                    @click="chatMode = true"
                  >
                    Ask CubeOS AI instead
                  </button>
                </div>
              </template>
            </div>

            <!-- Footer hints -->
            <div class="flex items-center gap-4 px-4 py-2 border-t border-theme-primary text-[10px] text-theme-muted">
              <span class="flex items-center gap-1">
                <Icon name="ArrowUp" :size="10" />
                <Icon name="ArrowDown" :size="10" />
                navigate
              </span>
              <span class="flex items-center gap-1">
                <Icon name="CornerDownLeft" :size="10" />
                select
              </span>
              <span class="flex items-center gap-1">esc close</span>
              <span class="ml-auto flex items-center gap-1">
                <span>?</span> for AI chat
              </span>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.palette-enter-active,
.palette-leave-active {
  transition: opacity 0.15s ease;
}
.palette-enter-from,
.palette-leave-to {
  opacity: 0;
}
</style>
