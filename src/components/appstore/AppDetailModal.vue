<script setup>
import { computed, ref, nextTick, onMounted } from 'vue'
import { useAppStoreStore } from '@/stores/appstore'
import Icon from '@/components/ui/Icon.vue'

const appStore = useAppStoreStore()
const modalRef = ref(null)

// Auto-focus modal when mounted
onMounted(() => nextTick(() => modalRef.value?.focus()))

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

// Install options state
const showInstallOptions = ref(false)
const installPort = ref('')
const installFqdn = ref('')

// Carousel ref
const carouselRef = ref(null)

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

// Screenshots: prefer API-proxied URLs, fall back to raw
const screenshots = computed(() => {
  const count = props.app.screenshot_count || props.app.screenshots?.length || 0
  if (storeId.value && appName.value && count > 0) {
    return Array.from(
      { length: count },
      (_, i) => appStore.getAppScreenshotUrl(storeId.value, appName.value, i)
    )
  }
  return props.app.screenshots || []
})

// Track failed screenshots to hide them
const failedScreenshots = ref(new Set())

function handleScreenshotError(index) {
  // If API-proxied URL fails, try raw fallback
  if (props.app.screenshots && props.app.screenshots[index]) {
    // The raw URL is already available, but since we're using computed screenshots
    // just mark it as failed and hide
    failedScreenshots.value = new Set([...failedScreenshots.value, index])
  } else {
    failedScreenshots.value = new Set([...failedScreenshots.value, index])
  }
}

const visibleScreenshots = computed(() => {
  return screenshots.value
    .map((url, index) => ({ url, index }))
    .filter(s => !failedScreenshots.value.has(s.index))
})

// Carousel scroll
function scrollCarousel(direction) {
  if (!carouselRef.value) return
  const scrollAmount = carouselRef.value.clientWidth * 0.7
  carouselRef.value.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' })
}

// Scroll to specific thumbnail
function scrollToScreenshot(index) {
  if (!carouselRef.value) return
  const children = carouselRef.value.children
  if (children[index]) {
    children[index].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }
}

// ARM64 badge check
function isArmArch(arch) {
  const lower = (arch || '').toLowerCase()
  return lower === 'arm64' || lower === 'aarch64'
}

function handleInstallClick() {
  if (!showInstallOptions.value) {
    showInstallOptions.value = true
    return
  }
  // Confirm install with options
  const options = {}
  if (installPort.value) options.port = parseInt(installPort.value, 10)
  if (installFqdn.value) options.fqdn = installFqdn.value
  emit('install', storeId.value, appName.value, options)
}

function handleSkipInstall() {
  emit('install', storeId.value, appName.value, {})
}

function handleClose() {
  emit('close')
}
</script>

<template>
  <div
    ref="modalRef"
    class="fixed inset-0 z-50 flex items-center justify-center p-4"
    role="dialog"
    aria-modal="true"
    :aria-label="title ? `${title} details` : 'App details'"
    tabindex="-1"
    @keydown.escape="handleClose"
  >
    <!-- Backdrop -->
    <div 
      class="absolute inset-0 bg-black/60 backdrop-blur-sm"
      @click="handleClose"
    ></div>

    <!-- Modal -->
    <div class="relative w-full max-w-lg max-h-[90vh] bg-theme-card rounded-2xl border border-theme-primary shadow-theme-xl overflow-hidden animate-fade-in flex flex-col">
      <!-- Header -->
      <div class="flex items-start gap-4 p-5 border-b border-theme-primary flex-shrink-0">
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
          aria-label="Close"
          class="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
        >
          <Icon name="X" :size="18" />
        </button>
      </div>

      <!-- Scrollable Content -->
      <div class="overflow-y-auto flex-1">
        <!-- Screenshots Carousel -->
        <div v-if="visibleScreenshots.length > 0" class="px-5 pt-4">
          <div class="relative group">
            <!-- Scroll container -->
            <div
              ref="carouselRef"
              class="flex gap-3 overflow-x-auto scroll-smooth pb-3"
              style="-webkit-overflow-scrolling: touch; scroll-snap-type: x mandatory;"
            >
              <div
                v-for="ss in visibleScreenshots"
                :key="ss.index"
                class="shrink-0"
                style="scroll-snap-align: center;"
              >
                <img
                  :src="ss.url"
                  :alt="`Screenshot ${ss.index + 1}`"
                  loading="lazy"
                  class="h-40 sm:h-48 rounded-lg object-cover bg-theme-tertiary"
                  @error="handleScreenshotError(ss.index)"
                />
              </div>
            </div>

            <!-- Left arrow (desktop only) -->
            <button
              v-if="visibleScreenshots.length > 1"
              @click="scrollCarousel(-1)"
              aria-label="Previous screenshot"
              class="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 items-center justify-center rounded-full bg-theme-card/90 border border-theme-primary text-theme-secondary hover:text-theme-primary shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Icon name="ChevronLeft" :size="16" />
            </button>

            <!-- Right arrow (desktop only) -->
            <button
              v-if="visibleScreenshots.length > 1"
              @click="scrollCarousel(1)"
              aria-label="Next screenshot"
              class="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 items-center justify-center rounded-full bg-theme-card/90 border border-theme-primary text-theme-secondary hover:text-theme-primary shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Icon name="ChevronRight" :size="16" />
            </button>
          </div>

          <!-- Thumbnail strip (if >3 screenshots) -->
          <div v-if="visibleScreenshots.length > 3" class="flex gap-1.5 mt-2 overflow-x-auto pb-1">
            <button
              v-for="ss in visibleScreenshots"
              :key="'thumb-' + ss.index"
              @click="scrollToScreenshot(ss.index)"
              :aria-label="'Go to screenshot ' + (ss.index + 1)"
              class="shrink-0 rounded overflow-hidden border border-theme-primary hover:border-accent transition-colors"
            >
              <img
                :src="ss.url"
                :alt="`Thumbnail ${ss.index + 1}`"
                loading="lazy"
                class="h-8 w-12 object-cover bg-theme-tertiary"
              />
            </button>
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

        <!-- Architectures (with ARM64 highlighting) -->
        <div v-if="app.architectures?.length > 0" class="px-5 pb-4">
          <h3 class="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-2">Supported Architectures</h3>
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="arch in app.architectures"
              :key="arch"
              class="px-2 py-0.5 text-[10px] font-medium rounded"
              :class="isArmArch(arch)
                ? 'bg-success-muted text-success'
                : 'bg-theme-tertiary text-theme-secondary'"
            >
              {{ arch }}
            </span>
          </div>
        </div>

        <!-- Install Options (expandable, shown before install) -->
        <div v-if="showInstallOptions && !app.installed" class="px-5 pb-4">
          <div class="p-4 rounded-lg border border-theme-primary bg-theme-secondary">
            <h4 class="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-3">Install Options</h4>
            <div class="flex flex-col sm:flex-row gap-3">
              <div class="flex-1">
                <label for="install-port" class="block text-[10px] text-theme-muted uppercase tracking-wider mb-1">Port (optional)</label>
                <input
                  id="install-port"
                  v-model="installPort"
                  type="text"
                  placeholder="e.g. 6100"
                  class="w-full px-3 py-2 rounded-lg border border-theme-primary bg-theme-input text-theme-primary placeholder-theme-muted text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                />
              </div>
              <div class="flex-1">
                <label for="install-fqdn" class="block text-[10px] text-theme-muted uppercase tracking-wider mb-1">FQDN (optional)</label>
                <input
                  id="install-fqdn"
                  v-model="installFqdn"
                  type="text"
                  placeholder="e.g. myapp.cubeos.cube"
                  class="w-full px-3 py-2 rounded-lg border border-theme-primary bg-theme-input text-theme-primary placeholder-theme-muted text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                />
              </div>
            </div>
            <p class="mt-2 text-[10px] text-theme-muted">Leave blank to use defaults.</p>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-between gap-3 p-5 border-t border-theme-primary bg-theme-secondary flex-shrink-0">
        <button
          @click="handleClose"
          class="px-4 py-2 rounded-lg border border-theme-primary text-sm text-theme-secondary hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
        >
          Cancel
        </button>

        <div v-if="!app.installed" class="flex items-center gap-2">
          <!-- Skip (use defaults) — only when options are shown -->
          <button
            v-if="showInstallOptions"
            @click="handleSkipInstall"
            :disabled="installing"
            class="px-4 py-2 rounded-lg border border-theme-primary text-sm text-theme-secondary hover:text-theme-primary hover:bg-theme-tertiary transition-colors disabled:opacity-50"
          >
            Skip
          </button>

          <!-- Install / Confirm Install -->
          <button
            @click="handleInstallClick"
            :disabled="installing"
            :aria-label="installing ? 'Installing ' + title : (showInstallOptions ? 'Confirm install ' + title : 'Install ' + title)"
            class="flex items-center gap-2 px-5 py-2 rounded-lg btn-accent text-sm font-medium disabled:opacity-50"
          >
            <Icon v-if="installing" name="Loader2" :size="16" class="animate-spin" />
            <Icon v-else name="Download" :size="16" />
            <span v-if="installing">Installing...</span>
            <span v-else-if="showInstallOptions">Confirm Install</span>
            <span v-else>Install</span>
          </button>
        </div>

        <span v-else class="flex items-center gap-2 text-sm text-success">
          <Icon name="CheckCircle" :size="16" />
          Already Installed
        </span>
      </div>
    </div>
  </div>
</template>
