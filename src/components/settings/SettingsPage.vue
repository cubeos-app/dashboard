<script setup>
/**
 * SettingsPage.vue — S10 Component
 *
 * Shell that renders Account + Appearance tabs (both modes) and
 * Profiles / Support tabs (Advanced only).
 *
 * Pattern: Shell → tab components (following S08 SystemPage pattern)
 *
 * Standard tabs: Account, Appearance
 * Advanced tabs: Account, Appearance, Profiles, Support
 */
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMode } from '@/composables/useMode'
import { usePreferencesStore } from '@/stores/preferences'
import { useAbortOnUnmount } from '@/composables/useAbortOnUnmount'
import PageHeader from '@/components/ui/PageHeader.vue'
import ModeToggle from '@/components/ui/ModeToggle.vue'
import Icon from '@/components/ui/Icon.vue'

import AccountTab from './AccountTab.vue'
import AppearanceTab from './AppearanceTab.vue'
import ProfilesTab from './ProfilesTab.vue'
import SupportTab from './SupportTab.vue'

const route = useRoute()
const router = useRouter()
const preferencesStore = usePreferencesStore()
const { isAdvanced } = useMode()
const { signal } = useAbortOnUnmount()

// ─── Tab Management ──────────────────────────────────────────
const TAB_DEFS = computed(() => {
  const tabs = [
    { key: 'account', label: 'Account', icon: 'User' },
    { key: 'appearance', label: 'Appearance', icon: 'Palette' }
  ]
  if (isAdvanced.value) {
    tabs.push(
      { key: 'profiles', label: 'Profiles', icon: 'Layers' },
      { key: 'support', label: 'Support', icon: 'LifeBuoy' }
    )
  }
  return tabs
})

const activeTab = ref('account')

// Read ?tab= from route
watch(() => route.query.tab, (tab) => {
  if (tab && TAB_DEFS.value.some(t => t.key === tab)) {
    activeTab.value = tab
  }
}, { immediate: true })

// Reset to 'account' if current tab becomes invalid (e.g., mode switch)
watch(TAB_DEFS, (tabs) => {
  if (!tabs.some(t => t.key === activeTab.value)) {
    activeTab.value = 'account'
  }
})

function setTab(key) {
  activeTab.value = key
  router.replace({ query: { ...route.query, tab: key } })
}

// ─── Data Fetch ──────────────────────────────────────────────
onMounted(async () => {
  await preferencesStore.fetchPreferences()
})
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 pb-8">
    <PageHeader
      title="Settings"
      subtitle="Customize your experience"
      icon="Settings"
    >
      <template #actions>
        <ModeToggle compact />
      </template>
    </PageHeader>

    <!-- Tab Navigation -->
    <div class="flex gap-1 mb-6 overflow-x-auto scrollbar-hide border-b border-theme-primary -mx-4 px-4 sm:mx-0 sm:px-0">
      <button
        v-for="tab in TAB_DEFS"
        :key="tab.key"
        @click="setTab(tab.key)"
        :aria-selected="activeTab === tab.key"
        :aria-label="`${tab.label} settings`"
        class="flex items-center gap-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors shrink-0"
        :class="activeTab === tab.key
          ? 'border-accent text-accent'
          : 'border-transparent text-theme-tertiary hover:text-theme-secondary hover:border-theme-secondary'"
      >
        <Icon :name="tab.icon" :size="16" />
        {{ tab.label }}
      </button>
    </div>

    <!-- Tab Content -->
    <KeepAlive>
      <AccountTab v-if="activeTab === 'account'" />
      <AppearanceTab v-else-if="activeTab === 'appearance'" />
      <ProfilesTab v-else-if="activeTab === 'profiles'" />
      <SupportTab v-else-if="activeTab === 'support'" />
    </KeepAlive>
  </div>
</template>
