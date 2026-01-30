<script setup>
import { computed, ref } from 'vue'
import Icon from '@/components/ui/Icon.vue'

const props = defineProps({
  app: {
    type: Object,
    required: true
  },
  installing: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'install'])

const title = computed(() => {
  return props.app.title?.en_us || props.app.title?.en_US || props.app.name || ''
})

const description = computed(() => {
  return props.app.description?.en_us || props.app.description?.en_US || ''
})

const tagline = computed(() => {
  return props.app.tagline?.en_us || props.app.tagline?.en_US || ''
})

const tips = computed(() => {
  return props.app.tips?.en_us || props.app.tips?.en_US || ''
})

// Parse store_id and app name from app.id (format: "storeId/appName")
const storeId = computed(() => {
  return props.app.store_id || props.app.id?.split('/')[0] || ''
})

const appName = computed(() => {
  return props.app.name || props.app.id?.split('/')[1] || ''
})

function handleInstall() {
  emit('install', storeId.value, appName.value)
}

function handleClose() {
  emit('close')
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <!-- Backdrop -->
    <div 
      class="absolute inset-0 bg-black/60 backdrop-blur-sm"
      @click="handleClose"
    ></div>

    <!-- Modal -->
    <div class="relative w-full max-w-lg bg-theme-card rounded-2xl border border-theme-primary shadow-theme-xl overflow-hidden animate-fade-in">
      <!-- Header -->
      <div class="flex items-start gap-4 p-5 border-b border-theme-primary">
        <!-- App Icon -->
        <div class="w-16 h-16 rounded-xl bg-theme-tertiary flex items-center justify-center flex-shrink-0">
          <img 
            v-if="app.icon" 
            :src="app.icon" 
            :alt="title"
            class="w-12 h-12 rounded-lg object-contain"
          />
          <Icon v-else name="Package" :size="32" class="text-theme-muted" />
        </div>

        <!-- App Info -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <h2 class="text-lg font-semibold text-theme-primary truncate">{{ title }}</h2>
            <span 
              v-if="app.installed" 
              class="px-2 py-0.5 text-[10px] font-medium rounded bg-success-muted text-success"
            >
              Installed
            </span>
          </div>
          <p v-if="tagline" class="text-sm text-theme-secondary mt-0.5">{{ tagline }}</p>
          <div class="flex items-center gap-3 mt-2 text-xs text-theme-muted">
            <span v-if="app.category" class="flex items-center gap-1">
              <Icon name="Folder" :size="12" />
              {{ app.category }}
            </span>
            <span v-if="app.version" class="flex items-center gap-1">
              <Icon name="Tag" :size="12" />
              v{{ app.version }}
            </span>
            <span v-if="app.author" class="flex items-center gap-1">
              <Icon name="User" :size="12" />
              {{ app.author }}
            </span>
          </div>
        </div>

        <!-- Close button -->
        <button
          @click="handleClose"
          class="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
        >
          <Icon name="X" :size="18" />
        </button>
      </div>

      <!-- Screenshots (if available) -->
      <div v-if="app.screenshots?.length > 0" class="px-5 pt-4">
        <div class="flex gap-2 overflow-x-auto pb-2">
          <img
            v-for="(ss, index) in app.screenshots"
            :key="index"
            :src="ss"
            :alt="`Screenshot ${index + 1}`"
            class="h-32 rounded-lg object-cover flex-shrink-0"
          />
        </div>
      </div>

      <!-- Description -->
      <div class="p-5">
        <h3 class="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-2">Description</h3>
        <p class="text-sm text-theme-secondary leading-relaxed">
          {{ description || 'No description available.' }}
        </p>
      </div>

      <!-- Tips -->
      <div v-if="tips" class="px-5 pb-4">
        <div class="p-3 rounded-lg bg-warning-muted border border-warning/20">
          <div class="flex items-start gap-2">
            <Icon name="AlertTriangle" :size="14" class="text-warning mt-0.5 flex-shrink-0" />
            <p class="text-xs text-warning">{{ tips }}</p>
          </div>
        </div>
      </div>

      <!-- Architectures -->
      <div v-if="app.architectures?.length > 0" class="px-5 pb-4">
        <h3 class="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-2">Supported Architectures</h3>
        <div class="flex flex-wrap gap-1.5">
          <span
            v-for="arch in app.architectures"
            :key="arch"
            class="px-2 py-0.5 text-[10px] font-medium rounded bg-theme-tertiary text-theme-secondary"
          >
            {{ arch }}
          </span>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-between gap-3 p-5 border-t border-theme-primary bg-theme-secondary">
        <button
          @click="handleClose"
          class="px-4 py-2 rounded-lg border border-theme-primary text-sm text-theme-secondary hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
        >
          Cancel
        </button>

        <button
          v-if="!app.installed"
          @click="handleInstall"
          :disabled="installing"
          class="flex items-center gap-2 px-5 py-2 rounded-lg btn-accent text-sm font-medium disabled:opacity-50"
        >
          <Icon v-if="installing" name="Loader2" :size="16" class="animate-spin" />
          <Icon v-else name="Download" :size="16" />
          <span>{{ installing ? 'Installing...' : 'Install' }}</span>
        </button>

        <span v-else class="flex items-center gap-2 text-sm text-success">
          <Icon name="CheckCircle" :size="16" />
          Already Installed
        </span>
      </div>
    </div>
  </div>
</template>
