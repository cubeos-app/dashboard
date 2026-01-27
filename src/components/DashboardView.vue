<script setup>
import { onMounted, computed } from 'vue'
import { useServicesStore } from '@/stores/services'
import { useSystemStore } from '@/stores/system'
import ServiceCard from '@/components/services/ServiceCard.vue'
import SystemStatsCard from '@/components/system/SystemStatsCard.vue'

const servicesStore = useServicesStore()
const systemStore = useSystemStore()

// Featured services to show on dashboard
const featuredServices = computed(() => {
  const featured = ['kiwix', 'open-webui', 'filebrowser', 'vaultwarden', 'calibre-web', 'syncthing']
  return servicesStore.services.filter(s => 
    featured.includes(s.name) && s.state === 'running'
  ).slice(0, 6)
})

// Recently started services
const recentServices = computed(() => {
  return [...servicesStore.services]
    .filter(s => s.state === 'running' && !s.is_core)
    .sort((a, b) => new Date(b.started_at) - new Date(a.started_at))
    .slice(0, 4)
})

onMounted(async () => {
  await Promise.all([
    servicesStore.fetchServices(),
    systemStore.fetchAll()
  ])
})
</script>

<template>
  <div class="space-y-8">
    <!-- Page header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
      <p class="text-gray-500 dark:text-gray-400 mt-1">Welcome to your offline services hub</p>
    </div>

    <!-- System stats row -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <SystemStatsCard 
        title="Services"
        :value="servicesStore.runningCount"
        :subtitle="`of ${servicesStore.serviceCount} running`"
        icon="grid"
        color="cube"
      />
      <SystemStatsCard 
        title="Uptime"
        :value="systemStore.uptime"
        subtitle="since last boot"
        icon="clock"
        color="green"
      />
      <SystemStatsCard 
        title="CPU"
        :value="`${systemStore.cpuUsage}%`"
        subtitle="current load"
        icon="cpu"
        color="blue"
      />
      <SystemStatsCard 
        title="Memory"
        :value="`${systemStore.memoryUsage}%`"
        :subtitle="systemStore.memoryFormatted"
        icon="memory"
        color="purple"
      />
    </div>

    <!-- Featured Services -->
    <section>
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Quick Access</h2>
        <router-link 
          to="/services" 
          class="text-sm text-cube-600 dark:text-cube-400 hover:underline"
        >
          View all →
        </router-link>
      </div>

      <div v-if="servicesStore.loading" class="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div v-for="i in 6" :key="i" class="bg-white dark:bg-gray-800 rounded-xl p-4 animate-pulse">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            <div class="flex-1">
              <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2"></div>
              <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="featuredServices.length > 0" class="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <ServiceCard 
          v-for="service in featuredServices" 
          :key="service.id" 
          :service="service"
          compact
        />
      </div>

      <div v-else class="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-8 text-center">
        <p class="text-gray-500 dark:text-gray-400">No services running yet</p>
        <router-link 
          to="/services" 
          class="inline-block mt-4 px-4 py-2 bg-cube-600 text-white rounded-lg hover:bg-cube-700 transition-colors"
        >
          Manage Services
        </router-link>
      </div>
    </section>

    <!-- Service Categories Preview -->
    <section>
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Service Categories</h2>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <router-link
          v-for="(category, key) in servicesStore.categorizedServices"
          :key="key"
          :to="`/services?category=${key}`"
          class="bg-white dark:bg-gray-800 rounded-xl p-4 hover:shadow-lg transition-shadow"
        >
          <div class="flex items-center gap-3">
            <span class="text-2xl">{{ category.icon }}</span>
            <div>
              <h3 class="font-medium text-gray-900 dark:text-white">{{ category.title }}</h3>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                {{ category.items.length }} service{{ category.items.length !== 1 ? 's' : '' }}
              </p>
            </div>
          </div>
        </router-link>
      </div>
    </section>

    <!-- Recently Started -->
    <section v-if="recentServices.length > 0">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recently Started</h2>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <ServiceCard 
          v-for="service in recentServices" 
          :key="service.id" 
          :service="service"
          compact
        />
      </div>
    </section>
  </div>
</template>
