<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useServicesStore } from '@/stores/services'
import { useSystemStore } from '@/stores/system'
import { useThemeStore } from '@/stores/theme'
import { useBrandingStore } from '@/stores/branding'
import Icon from '@/components/ui/Icon.vue'

const servicesStore = useServicesStore()
const systemStore = useSystemStore()
const themeStore = useThemeStore()
const brandingStore = useBrandingStore()

// Version info
const appVersion = ref('2.0.0')
const apiVersion = ref('v1')

// All running services (excluding core)
const runningServices = computed(() => {
  return servicesStore.services
    .filter(s => s.state === 'running' && !s.is_core)
    .slice(0, 24)
})

// Get display name for service
function getServiceName(name) {
  return servicesStore.getServiceName(name)
}

// Get icon for service
function getServiceIcon(name) {
  return servicesStore.getServiceIcon(name)
}

// Get service URL
function getServiceUrl(service) {
  const ports = service.ports || []
  const webPort = ports.find(p => p.public_port)
  if (webPort) {
    return `http://192.168.42.1:${webPort.public_port}`
  }
  return null
}

onMounted(async () => {
  await Promise.all([
    servicesStore.fetchServices(),
    servicesStore.fetchFavorites(),
    systemStore.fetchAll()
  ])
})

// Poll stats every 5 seconds
let statsInterval = null
onMounted(() => {
  statsInterval = setInterval(() => {
    systemStore.fetchStats()
    systemStore.fetchPower()
  }, 5000)
})

onUnmounted(() => {
  if (statsInterval) clearInterval(statsInterval)
})
</script>

<template>
  <div class="relative min-h-full">
    <!-- Watermark Logo -->
    <div class="fixed inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-0">
      <img 
        :src="brandingStore.brandLogo" 
        alt="" 
        class="w-[400px] h-[400px]"
        :class="themeStore.isDark ? 'opacity-[0.03]' : 'opacity-[0.02]'"
        :style="{ filter: themeStore.isDark ? 'grayscale(100%) brightness(1.5)' : 'grayscale(100%) brightness(0.5)' }"
      />
    </div>

    <!-- Content -->
    <div class="relative z-10 space-y-6 pb-8">
      <!-- Page header -->
      <div>
        <h1 class="text-xl font-semibold text-theme-primary tracking-tight">Dashboard</h1>
        <p class="text-theme-tertiary text-sm">Your offline services at a glance</p>
      </div>

      <!-- Favorite Services -->
      <section v-if="servicesStore.favoriteServices.length > 0" class="animate-fade-in">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-xs font-semibold text-theme-tertiary uppercase tracking-wider flex items-center gap-2">
            <Icon name="Star" :size="12" class="text-warning" />
            Favorites
          </h2>
        </div>

        <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
          <a
            v-for="service in servicesStore.favoriteServices"
            :key="service.id"
            :href="getServiceUrl(service)"
            target="_blank"
            rel="noopener"
            class="group relative flex flex-col items-center p-3 rounded-xl border border-theme-primary bg-theme-card transition-all duration-150 hover:border-warning/40 hover:shadow-theme-md hover:-translate-y-0.5"
          >
            <!-- Star badge -->
            <div class="absolute top-2 right-2">
              <Icon name="Star" :size="10" class="text-warning fill-warning" />
            </div>
            
            <!-- Icon -->
            <div class="w-10 h-10 rounded-xl bg-warning-muted flex items-center justify-center mb-2 group-hover:scale-105 transition-transform duration-150">
              <Icon :name="getServiceIcon(service.name)" :size="20" class="text-warning" :stroke-width="1.5" />
            </div>
            
            <!-- Name -->
            <span class="text-xs font-medium text-theme-primary text-center leading-tight truncate w-full">
              {{ getServiceName(service.name) }}
            </span>
            
            <!-- Status -->
            <div class="flex items-center gap-1 mt-1">
              <span class="w-1.5 h-1.5 rounded-full bg-success"></span>
              <span class="text-[10px] text-success">Running</span>
            </div>
          </a>
        </div>
      </section>

      <!-- Running Services -->
      <section v-if="runningServices.length > 0" class="animate-fade-in" style="animation-delay: 50ms">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-xs font-semibold text-theme-tertiary uppercase tracking-wider">Running Services</h2>
          <router-link 
            to="/services" 
            class="text-xs text-accent hover:text-accent-secondary font-medium flex items-center gap-1 transition-colors"
          >
            View All
            <Icon name="ChevronRight" :size="14" />
          </router-link>
        </div>

        <!-- Service Grid - Compact -->
        <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
          <a
            v-for="service in runningServices"
            :key="service.id"
            :href="getServiceUrl(service)"
            target="_blank"
            rel="noopener"
            class="group flex flex-col items-center p-3 rounded-xl border border-theme-primary bg-theme-card transition-all duration-150 hover:border-accent/40 hover:shadow-theme-md hover:-translate-y-0.5"
          >
            <!-- Icon -->
            <div class="w-10 h-10 rounded-xl bg-theme-tertiary flex items-center justify-center mb-2 group-hover:bg-accent-muted group-hover:scale-105 transition-all duration-150">
              <Icon :name="getServiceIcon(service.name)" :size="20" class="text-theme-secondary group-hover:text-accent transition-colors duration-150" :stroke-width="1.5" />
            </div>
            
            <!-- Name -->
            <span class="text-xs font-medium text-theme-primary text-center leading-tight truncate w-full">
              {{ getServiceName(service.name) }}
            </span>
            
            <!-- Status -->
            <div class="flex items-center gap-1 mt-1">
              <span class="w-1.5 h-1.5 rounded-full bg-success"></span>
              <span class="text-[10px] text-success">Running</span>
            </div>
          </a>
        </div>
      </section>

      <!-- Empty State -->
      <section v-else class="pt-12 animate-fade-in">
        <div class="text-center max-w-sm mx-auto">
          <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-theme-tertiary flex items-center justify-center">
            <Icon name="Package" :size="28" class="text-theme-muted" :stroke-width="1.5" />
          </div>
          <h3 class="text-base font-semibold text-theme-primary mb-1">No Services Running</h3>
          <p class="text-theme-tertiary mb-4 text-sm">Start some services to see them here.</p>
          <router-link 
            to="/services" 
            class="inline-flex items-center gap-2 px-4 py-2 rounded-lg btn-accent text-sm font-medium shadow-theme-sm hover:shadow-theme-md transition-all"
          >
            Browse Services
            <Icon name="ArrowRight" :size="14" />
          </router-link>
        </div>
      </section>

      <!-- Categories -->
      <section v-if="Object.keys(servicesStore.categorizedServices).length > 0" class="animate-fade-in" style="animation-delay: 100ms">
        <h2 class="text-xs font-semibold text-theme-tertiary uppercase tracking-wider mb-3">Categories</h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
          <router-link
            v-for="(category, key) in servicesStore.categorizedServices"
            :key="key"
            :to="`/services?category=${key}`"
            class="group flex items-center gap-2 p-2.5 rounded-lg border border-theme-primary bg-theme-card hover:border-theme-secondary hover:shadow-theme-sm transition-all duration-150"
          >
            <div class="w-8 h-8 rounded-lg bg-theme-tertiary flex items-center justify-center group-hover:bg-accent-muted transition-colors duration-150">
              <Icon :name="category.icon" :size="16" class="text-theme-secondary group-hover:text-accent transition-colors duration-150" :stroke-width="1.5" />
            </div>
            <div class="min-w-0 flex-1">
              <h3 class="font-medium text-theme-primary text-xs truncate">{{ category.title }}</h3>
              <p class="text-[10px] text-theme-muted">{{ category.items.length }} services</p>
            </div>
          </router-link>
        </div>
      </section>

      <!-- Stats Footer -->
      <section class="pt-4">
        <div class="flex items-center justify-center gap-3 text-[10px] text-theme-muted">
          <span>{{ servicesStore.runningCount }} of {{ servicesStore.serviceCount }} services running</span>
          <span class="w-1 h-1 rounded-full bg-theme-tertiary"></span>
          <span>{{ systemStore.hostname || brandingStore.brandName }}</span>
        </div>
      </section>
    </div>

    <!-- Version Footer - Fixed bottom left -->
    <div class="fixed bottom-3 left-3 z-20 flex flex-col gap-1 lg:left-[252px]">
      <a 
        :href="brandingStore.currentBrand.github" 
        target="_blank" 
        rel="noopener"
        class="flex items-center gap-1.5 px-2.5 py-1.5 glass rounded-md text-[10px] text-theme-secondary hover:text-theme-primary transition-colors group"
      >
        <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
          <path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
        </svg>
        <span class="font-mono">{{ brandingStore.brandName }} v{{ appVersion }}</span>
      </a>
      <a 
        href="/api/v1/docs" 
        target="_blank" 
        rel="noopener"
        class="flex items-center gap-1.5 px-2.5 py-1.5 glass rounded-md text-[10px] text-theme-muted hover:text-accent transition-colors group"
      >
        <Icon name="Code2" :size="12" />
        <span>API Docs <span class="text-theme-muted">({{ apiVersion }})</span></span>
      </a>
    </div>
  </div>
</template>
