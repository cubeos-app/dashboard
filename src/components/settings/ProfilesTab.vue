<script setup>
/**
 * ProfilesTab.vue — S10 Settings Component
 *
 * Advanced only. Service profiles management in the Settings context.
 * Lists system and custom profiles, allows switching active profile.
 * Uses profiles store (consolidated in S05).
 */
import { ref, onMounted } from 'vue'
import { useProfilesStore, PROFILE_DESCRIPTIONS } from '@/stores/profiles'
import { useAbortOnUnmount } from '@/composables/useAbortOnUnmount'
import Icon from '@/components/ui/Icon.vue'

const profilesStore = useProfilesStore()
const { signal } = useAbortOnUnmount()

const applyLoading = ref('')
const applySuccess = ref('')

const profileIcons = {
  full: 'Maximize2',
  minimal: 'Minimize2',
  offline: 'WifiOff'
}

async function handleApply(name) {
  applyLoading.value = name
  applySuccess.value = ''
  const result = await profilesStore.applyProfile(name)
  applyLoading.value = ''
  if (result) {
    applySuccess.value = name
    setTimeout(() => { applySuccess.value = '' }, 3000)
  }
}

onMounted(async () => {
  await profilesStore.fetchProfiles()
})
</script>

<template>
  <div class="space-y-6">
    <section class="animate-fade-in">
      <div class="flex items-center gap-2.5 mb-3">
        <div class="w-8 h-8 rounded-lg bg-accent-muted flex items-center justify-center">
          <Icon name="Layers" :size="16" class="text-accent" />
        </div>
        <div>
          <h2 class="text-sm font-semibold text-theme-primary">Service Profiles</h2>
          <p class="text-xs text-theme-tertiary">Switch between pre-configured service sets</p>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="profilesStore.loading && profilesStore.profiles.length === 0" class="p-6 text-center">
        <Icon name="Loader2" :size="24" class="animate-spin text-theme-muted mx-auto mb-2" />
        <p class="text-sm text-theme-muted">Loading profiles...</p>
      </div>

      <!-- Error -->
      <div v-else-if="profilesStore.error && profilesStore.profiles.length === 0" class="p-4 rounded-xl border border-error/20 bg-error-muted/30">
        <p class="text-sm text-error">{{ profilesStore.error }}</p>
      </div>

      <!-- Profile List -->
      <div v-else class="space-y-3">
        <div
          v-for="profile in profilesStore.profiles"
          :key="profile.name"
          class="p-4 rounded-xl border transition-colors"
          :class="profilesStore.isActive(profile.name)
            ? 'border-accent bg-accent/5'
            : 'border-theme-primary bg-theme-card'"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-start gap-3 min-w-0">
              <div class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                :class="profilesStore.isActive(profile.name) ? 'bg-accent-muted' : 'bg-theme-tertiary'"
              >
                <Icon
                  :name="profileIcons[profile.name] || 'Box'"
                  :size="18"
                  :class="profilesStore.isActive(profile.name) ? 'text-accent' : 'text-theme-secondary'"
                />
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <h3 class="text-sm font-semibold text-theme-primary">
                    {{ profilesStore.getDisplayName(profile) }}
                  </h3>
                  <span
                    v-if="profilesStore.isActive(profile.name)"
                    class="px-1.5 py-0.5 text-[10px] font-medium rounded bg-accent text-on-accent uppercase tracking-wider"
                  >
                    Active
                  </span>
                  <span
                    v-if="profile.is_system"
                    class="px-1.5 py-0.5 text-[10px] font-medium rounded bg-theme-tertiary text-theme-muted uppercase tracking-wider"
                  >
                    System
                  </span>
                </div>
                <p class="text-xs text-theme-muted mt-0.5">
                  {{ profilesStore.getDescription(profile) }}
                </p>
                <p v-if="profile.apps" class="text-xs text-theme-tertiary mt-1">
                  {{ profile.apps.filter(a => a.enabled !== false).length }} services enabled
                </p>
              </div>
            </div>

            <button
              v-if="!profilesStore.isActive(profile.name)"
              @click="handleApply(profile.name)"
              :disabled="applyLoading === profile.name"
              :aria-label="`Apply ${profilesStore.getDisplayName(profile)} profile`"
              class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0"
              :class="applySuccess === profile.name
                ? 'bg-success text-on-accent'
                : 'btn-accent'"
            >
              <Icon v-if="applyLoading === profile.name" name="Loader2" :size="12" class="animate-spin" />
              <Icon v-else-if="applySuccess === profile.name" name="Check" :size="12" />
              {{ applySuccess === profile.name ? 'Applied' : 'Apply' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Info -->
      <p class="text-xs text-theme-muted mt-3">
        Profiles control which services are enabled. Switching profiles will start and stop services accordingly.
      </p>
    </section>
  </div>
</template>
