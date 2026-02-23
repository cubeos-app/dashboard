<script setup>
/**
 * SystemImagesPanel.vue — Batch 6 Component
 *
 * Lists all system images (core, curated, user) with:
 *   - Running indicator (green dot + service name)
 *   - Type badge (Core / Curated / User)
 *   - Tag display
 *   - Pinned indicator
 *
 * Used inside RegistryTab.vue in settings.
 */
import { computed } from 'vue'
import { useRegistryStore } from '@/stores/registry'
import Icon from '@/components/ui/Icon.vue'

const registry = useRegistryStore()

const typeConfig = {
  core: { label: 'Core', classes: 'bg-accent-muted text-accent' },
  curated: { label: 'Curated', classes: 'bg-purple-500/20 text-purple-400' },
  user: { label: 'User', classes: 'bg-theme-tertiary text-theme-muted' },
}

function getTypeConfig(type) {
  return typeConfig[type] || typeConfig.user
}

const sortedImages = computed(() => {
  const order = { core: 0, curated: 1, user: 2 }
  return [...registry.systemImages].sort((a, b) => {
    const oa = order[a.type] ?? 2
    const ob = order[b.type] ?? 2
    if (oa !== ob) return oa - ob
    return a.name.localeCompare(b.name)
  })
})
</script>

<template>
  <div>
    <div class="flex items-center gap-2.5 mb-3">
      <div class="w-8 h-8 rounded-lg bg-theme-tertiary flex items-center justify-center">
        <Icon name="Layers" :size="16" class="text-theme-secondary" />
      </div>
      <div class="flex-1">
        <h2 class="text-sm font-semibold text-theme-primary">System Images</h2>
        <p class="text-xs text-theme-tertiary">
          {{ registry.systemImageCount }} images across all types
        </p>
      </div>
      <button
        @click="registry.fetchSystemImages()"
        :disabled="registry.loading"
        class="p-2 rounded-lg text-theme-tertiary hover:text-theme-primary hover:bg-theme-tertiary transition-colors disabled:opacity-50"
        aria-label="Refresh system images"
      >
        <Icon name="RefreshCw" :size="16" :class="{ 'animate-spin': registry.loading }" />
      </button>
    </div>

    <div class="rounded-xl border border-theme-primary bg-theme-card overflow-hidden">
      <!-- Loading -->
      <div v-if="registry.loading && registry.systemImages.length === 0" class="p-8 flex items-center justify-center">
        <Icon name="Loader2" :size="20" class="animate-spin text-theme-muted" />
        <span class="ml-2 text-sm text-theme-muted">Loading images...</span>
      </div>

      <!-- Empty state -->
      <div v-else-if="registry.systemImages.length === 0" class="p-8 text-center">
        <Icon name="Layers" :size="32" class="mx-auto text-theme-muted mb-3" />
        <h4 class="text-sm font-medium text-theme-primary mb-1">No System Images</h4>
        <p class="text-xs text-theme-muted">System images will appear here once the registry is synced.</p>
      </div>

      <!-- Image list -->
      <div v-else class="divide-y divide-theme-primary/50">
        <div
          v-for="image in sortedImages"
          :key="image.name"
          class="px-4 py-3 flex items-center gap-3 hover:bg-theme-tertiary/30 transition-colors"
        >
          <!-- Running indicator -->
          <span
            class="w-2 h-2 rounded-full flex-shrink-0"
            :class="image.running ? 'bg-success' : 'bg-theme-muted/30'"
            :title="image.running ? `Running as ${image.service_name}` : 'Not running'"
          />

          <!-- Image info -->
          <div class="flex-1 min-w-0">
            <p class="text-sm text-theme-primary font-mono truncate">{{ image.name }}</p>
            <p v-if="image.service_name" class="text-xs text-theme-tertiary truncate">
              {{ image.service_name }}
            </p>
          </div>

          <!-- Tags -->
          <div class="hidden sm:flex flex-wrap gap-1 max-w-xs flex-shrink-0">
            <span
              v-for="tag in (image.tags || []).slice(0, 3)"
              :key="tag"
              class="px-2 py-0.5 text-[10px] font-semibold rounded bg-theme-tertiary text-theme-secondary"
            >{{ tag }}</span>
            <span
              v-if="(image.tags || []).length > 3"
              class="px-2 py-0.5 text-[10px] font-semibold rounded bg-theme-tertiary text-theme-muted"
            >+{{ image.tags.length - 3 }}</span>
            <span
              v-if="!image.tags || image.tags.length === 0"
              class="text-xs text-theme-muted"
            >no tags</span>
          </div>

          <!-- Type badge -->
          <span
            class="text-[10px] font-semibold px-2 py-0.5 rounded flex-shrink-0"
            :class="getTypeConfig(image.type).classes"
          >
            {{ getTypeConfig(image.type).label }}
          </span>

          <!-- Pinned indicator -->
          <Icon
            v-if="image.pinned"
            name="Pin"
            :size="14"
            class="text-theme-muted flex-shrink-0"
            title="Pinned — managed by CubeOS"
          />
        </div>
      </div>
    </div>
  </div>
</template>
