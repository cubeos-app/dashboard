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
import TabBar from '@/components/ui/TabBar.vue'

import AccountTab from './AccountTab.vue'
import AppearanceTab from './AppearanceTab.vue'
import UpdatesTab from './UpdatesTab.vue'
import ProfilesTab from './ProfilesTab.vue'
import RegistryTab from './RegistryTab.vue'
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
    { key: 'appearance', label: 'Appearance', icon: 'Palette' },
    { key: 'updates', label: 'Updates', icon: 'Download' }
  ]
  if (isAdvanced.value) {
    tabs.push(
      { key: 'profiles', label: 'Profiles', icon: 'Layers' },
      { key: 'registry', label: 'Registry', icon: 'Archive' },
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
    <div class="mb-6">
      <TabBar
        :model-value="activeTab"
        @update:model-value="setTab"
        :tabs="TAB_DEFS"
        aria-label="Settings sections"
      />
    </div>

    <!-- Tab Content -->
    <KeepAlive>
      <AccountTab v-if="activeTab === 'account'" />
      <AppearanceTab v-else-if="activeTab === 'appearance'" />
      <UpdatesTab v-else-if="activeTab === 'updates'" />
      <ProfilesTab v-else-if="activeTab === 'profiles'" />
      <RegistryTab v-else-if="activeTab === 'registry'" />
      <SupportTab v-else-if="activeTab === 'support'" />
    </KeepAlive>
  </div>
</template>
