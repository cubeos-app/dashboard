<script setup>
/**
 * AppearanceTab.vue — S10 Component
 *
 * Both modes: theme toggle (light/dark), mode toggle (Standard/Advanced), preferences reset.
 * Standard mode section: wallpaper picker — preset thumbnail grid, custom upload, solid color option.
 *
 * Wires:
 * - POST /preferences/wallpaper — custom wallpaper upload (multipart, max 5MB)
 * - GET  /preferences/wallpaper — retrieve custom wallpaper image
 * - PUT  /preferences            — save wallpaper preference
 * - POST /preferences/reset      — reset all preferences
 */
import { ref, computed } from 'vue'
import { useThemeStore } from '@/stores/theme'
import { usePreferencesStore } from '@/stores/preferences'
import { useMode } from '@/composables/useMode'
import { useWallpaper, WALLPAPER_PRESETS } from '@/composables/useWallpaper'
import ModeToggle from '@/components/ui/ModeToggle.vue'
import SectionPanel from '@/components/ui/SectionPanel.vue'
import Icon from '@/components/ui/Icon.vue'
import api from '@/api/client'

const themeStore = useThemeStore()
const preferencesStore = usePreferencesStore()
const { isStandard } = useMode()
const { wallpaperUrl, isActive } = useWallpaper()

// ─── Wallpaper Management ────────────────────────────────────
const currentWallpaper = computed(() => preferencesStore.wallpaper)
const uploadLoading = ref(false)
const uploadError = ref('')
const wallpaperSaving = ref(false)

/** Select a preset wallpaper */
async function selectPreset(presetId) {
  wallpaperSaving.value = true
  await preferencesStore.setWallpaper({ type: 'preset', value: presetId })
  wallpaperSaving.value = false
}

/** Select 'no wallpaper' (solid color) */
async function selectNone() {
  wallpaperSaving.value = true
  await preferencesStore.setWallpaper({ type: 'none', value: null })
  wallpaperSaving.value = false
}

/** Handle custom wallpaper upload */
async function handleWallpaperUpload(event) {
  const file = event.target.files?.[0]
  if (!file) return

  // Validate file type
  const validTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!validTypes.includes(file.type)) {
    uploadError.value = 'Please select a JPG, PNG, or WebP image'
    return
  }

  // Validate file size (5MB max)
  if (file.size > 5 * 1024 * 1024) {
    uploadError.value = 'Image must be under 5MB'
    return
  }

  uploadLoading.value = true
  uploadError.value = ''

  try {
    const formData = new FormData()
    formData.append('wallpaper', file)

    const response = await fetch('/api/v1/preferences/wallpaper', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${api.accessToken}`
      },
      body: formData
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Upload failed' }))
      throw new Error(err.error || err.message || 'Upload failed')
    }

    // Set wallpaper preference to custom
    await preferencesStore.setWallpaper({ type: 'custom', value: '/api/v1/preferences/wallpaper' })
  } catch (e) {
    uploadError.value = e.message || 'Failed to upload wallpaper'
  } finally {
    uploadLoading.value = false
    // Reset file input
    event.target.value = ''
  }
}

/** Get SVG thumbnail URL for a preset wallpaper */
function getPresetThumbUrl(presetId) {
  const variant = themeStore.isDark ? 'dark' : 'light'
  return `/wallpapers/${presetId}-${variant}.svg`
}

/** Check if preset is currently selected */
function isPresetSelected(presetId) {
  return currentWallpaper.value?.type === 'preset' && currentWallpaper.value?.value === presetId
}

// ─── Preferences Reset ───────────────────────────────────────
const prefsResetSuccess = ref(false)
const prefsResetError = ref('')

async function handleResetPreferences() {
  prefsResetError.value = ''
  prefsResetSuccess.value = false
  const result = await preferencesStore.resetPreferences()
  if (result) {
    prefsResetSuccess.value = true
    setTimeout(() => { prefsResetSuccess.value = false }, 3000)
  } else if (preferencesStore.error) {
    prefsResetError.value = preferencesStore.error
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Theme Toggle -->
    <section class="animate-fade-in">
      <div class="flex items-center gap-2.5 mb-3">
        <div class="w-8 h-8 rounded-lg bg-accent-muted flex items-center justify-center">
          <Icon name="Sun" :size="16" class="text-accent" />
        </div>
        <div>
          <h2 class="text-sm font-semibold text-theme-primary">Theme</h2>
          <p class="text-xs text-theme-tertiary">Light or dark appearance</p>
        </div>
      </div>

      <div class="p-4 rounded-xl border border-theme-primary bg-theme-card">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <Icon :name="themeStore.isDark ? 'Moon' : 'Sun'" :size="20" class="text-accent" />
            <div>
              <p class="text-sm font-medium text-theme-primary">{{ themeStore.isDark ? 'Dark Mode' : 'Light Mode' }}</p>
              <p class="text-xs text-theme-muted">{{ themeStore.currentTheme.description }}</p>
            </div>
          </div>
          <button
            @click="themeStore.setTheme(themeStore.isDark ? 'light' : 'dark')"
            role="switch"
            :aria-checked="themeStore.isDark"
            aria-label="Toggle dark mode"
            class="relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200"
            :class="themeStore.isDark ? 'bg-accent' : 'bg-theme-tertiary border border-theme-secondary'"
          >
            <span
              class="inline-flex h-5 w-5 items-center justify-center rounded-full bg-theme-primary shadow transform transition-transform duration-200"
              :class="themeStore.isDark ? 'translate-x-6' : 'translate-x-1'"
            >
              <Icon :name="themeStore.isDark ? 'Moon' : 'Sun'" :size="12" class="text-theme-secondary" />
            </span>
          </button>
        </div>
      </div>
    </section>

    <!-- Mode Toggle -->
    <section class="animate-fade-in" style="animation-delay: 50ms">
      <div class="flex items-center gap-2.5 mb-3">
        <div class="w-8 h-8 rounded-lg bg-accent-muted flex items-center justify-center">
          <Icon name="ToggleLeft" :size="16" class="text-accent" />
        </div>
        <div>
          <h2 class="text-sm font-semibold text-theme-primary">Interface Mode</h2>
          <p class="text-xs text-theme-tertiary">Choose between simplified or full control</p>
        </div>
      </div>

      <div class="p-4 rounded-xl border border-theme-primary bg-theme-card">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-theme-primary">UI Mode</p>
            <p class="text-xs text-theme-muted">Standard mode hides advanced options for a simpler experience</p>
          </div>
          <ModeToggle />
        </div>
      </div>
    </section>

    <!-- Wallpaper Picker (Standard mode only) -->
    <SectionPanel standard>
      <section class="animate-fade-in" style="animation-delay: 75ms">
        <div class="flex items-center gap-2.5 mb-3">
          <div class="w-8 h-8 rounded-lg bg-accent-muted flex items-center justify-center">
            <Icon name="Image" :size="16" class="text-accent" />
          </div>
          <div>
            <h2 class="text-sm font-semibold text-theme-primary">Wallpaper</h2>
            <p class="text-xs text-theme-tertiary">Background image for Standard mode</p>
          </div>
        </div>

        <div class="p-4 rounded-xl border border-theme-primary bg-theme-card space-y-4">
          <!-- Preset Grid -->
          <div>
            <p class="text-xs font-medium text-theme-secondary mb-2">Presets</p>
            <div class="grid grid-cols-3 sm:grid-cols-4 gap-2">
              <button
                v-for="preset in WALLPAPER_PRESETS"
                :key="preset.id"
                @click="selectPreset(preset.id)"
                :aria-label="`Select ${preset.name} wallpaper`"
                :aria-pressed="isPresetSelected(preset.id)"
                class="relative aspect-video rounded-lg overflow-hidden border-2 transition-all group"
                :class="isPresetSelected(preset.id)
                  ? 'border-accent ring-2 ring-accent/30'
                  : 'border-theme-primary hover:border-theme-secondary'"
              >
                <img
                  :src="getPresetThumbUrl(preset.id)"
                  :alt="preset.name"
                  class="w-full h-full object-cover"
                />
                <div class="absolute inset-0 bg-black/30 flex items-end p-1.5">
                  <span class="text-[10px] text-white font-medium truncate">{{ preset.name }}</span>
                </div>
                <div
                  v-if="isPresetSelected(preset.id)"
                  class="absolute top-1 right-1 w-5 h-5 rounded-full bg-accent flex items-center justify-center"
                >
                  <Icon name="Check" :size="12" class="text-on-accent" />
                </div>
              </button>
            </div>
          </div>

          <!-- Solid Color / No Wallpaper -->
          <div class="flex items-center gap-3 pt-3 border-t border-theme-primary">
            <button
              @click="selectNone"
              :aria-pressed="currentWallpaper?.type === 'none'"
              class="flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-xs font-medium transition-all"
              :class="currentWallpaper?.type === 'none'
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-theme-primary text-theme-secondary hover:border-theme-secondary'"
            >
              <Icon name="Ban" :size="14" />
              No Wallpaper
            </button>

            <!-- Custom Upload -->
            <label
              class="flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-xs font-medium transition-all cursor-pointer"
              :class="[
                currentWallpaper?.type === 'custom'
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-theme-primary text-theme-secondary hover:border-theme-secondary',
                uploadLoading ? 'opacity-50 pointer-events-none' : ''
              ]"
            >
              <Icon :name="uploadLoading ? 'Loader2' : 'Upload'" :size="14" :class="uploadLoading ? 'animate-spin' : ''" />
              {{ uploadLoading ? 'Uploading...' : 'Custom Image' }}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                class="hidden"
                :disabled="uploadLoading"
                @change="handleWallpaperUpload"
              />
            </label>
          </div>

          <p v-if="uploadError" class="text-xs text-error">{{ uploadError }}</p>
          <p class="text-xs text-theme-muted">JPG, PNG, or WebP. Max 5MB.</p>
        </div>
      </section>
    </SectionPanel>

    <!-- Preferences Reset -->
    <section class="animate-fade-in" style="animation-delay: 100ms">
      <div class="flex items-center gap-2.5 mb-3">
        <div class="w-8 h-8 rounded-lg bg-warning-muted flex items-center justify-center">
          <Icon name="RotateCcw" :size="16" class="text-warning" />
        </div>
        <div>
          <h2 class="text-sm font-semibold text-theme-primary">Reset</h2>
          <p class="text-xs text-theme-tertiary">Restore defaults</p>
        </div>
      </div>

      <div class="p-4 rounded-xl border border-theme-primary bg-theme-card">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-theme-primary">Reset Preferences</p>
            <p class="text-xs text-theme-muted">Restore all preferences to their default values</p>
          </div>
          <button
            @click="handleResetPreferences"
            :disabled="preferencesStore.loading"
            aria-label="Reset preferences to defaults"
            class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
            :class="prefsResetSuccess
              ? 'bg-success text-on-accent'
              : 'bg-theme-tertiary text-theme-secondary hover:bg-theme-elevated'"
          >
            <Icon v-if="preferencesStore.loading" name="Loader2" :size="12" class="animate-spin" />
            <Icon v-else-if="prefsResetSuccess" name="Check" :size="12" />
            <Icon v-else name="RotateCcw" :size="12" />
            {{ prefsResetSuccess ? 'Done' : 'Reset' }}
          </button>
        </div>
        <p v-if="prefsResetError" class="text-xs text-error mt-2">{{ prefsResetError }}</p>
      </div>
    </section>
  </div>
</template>
