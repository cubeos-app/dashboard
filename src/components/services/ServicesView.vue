<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useServicesStore } from '@/stores/services'
import ServiceCard from '@/components/services/ServiceCard.vue'

const route = useRoute()
const servicesStore = useServicesStore()

const searchQuery = ref('')
const showCoreServices = ref(false)
const activeCategory = ref(null)

// Sync search with store
watch(searchQuery, (value) => {
  servicesStore.setSearchQuery(value)
})

// Handle category from URL
watch(() => route.query.category, (category) => {
  activeCategory.value = category || null
}, { immediate: true })

const displayedServices = computed(() => {
  if (activeCategory.value) {
    const category = servicesStore.categorizedServices[activeCategory.value]
    return category?.items || []
  }
  return servicesStore.filteredServices.filter(s => !s.is_core || showCoreServices.value)
})

const categoryTitle = computed(() => {
  if (activeCategory.value) {
    const category = servicesStore.categorizedServices[activeCategory.value]
    return category?.title || 'Services'
  }
  return 'All Services'
})

onMounted(() => {
  servicesStore.fetchServices()
})

function clearCategory() {
  activeCategory.value = null
}

// Refresh services
let refreshInterval = null
onMounted(() => {
  refreshInterval = setInterval(() => servicesStore.fetchServices(), 30000)
})

import { onUnmounted } from 'vue'
onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <div class="flex items-center gap-2">
          <button 
            v-if="activeCategory"
            @click="clearCategory"
            class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ categoryTitle }}</h1>
        </div>
        <p class="text-gray-500 dark:text-gray-400 mt-1">
          {{ displayedServices.length }} service{{ displayedServices.length !== 1 ? 's' : '' }}
          <span v-if="servicesStore.runningCount > 0" class="text-green-600 dark:text-green-400">
            • {{ servicesStore.runningCount }} running
          </span>
        </p>
      </div>

      <!-- Search -->
      <div class="relative w-full sm:w-72">
        <svg 
          class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search services..."
          class="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-cube-500 focus:border-transparent"
        />
      </div>
    </div>

    <!-- Category chips (when not in a category) -->
    <div v-if="!activeCategory" class="flex flex-wrap gap-2">
      <button
        v-for="(category, key) in servicesStore.categorizedServices"
        :key="key"
        @click="activeCategory = key"
        class="px-3 py-1.5 rounded-full text-sm font-medium transition-colors bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
      >
        {{ category.icon }} {{ category.title }}
        <span class="ml-1 text-gray-500">({{ category.items.length }})</span>
      </button>
      <button
        @click="showCoreServices = !showCoreServices"
        :class="[
          'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
          showCoreServices 
            ? 'bg-cube-100 dark:bg-cube-900 text-cube-700 dark:text-cube-300' 
            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
        ]"
      >
        ⚙️ Core Services
        <span class="ml-1 text-gray-500">({{ servicesStore.coreServices.length }})</span>
      </button>
    </div>

    <!-- Loading state -->
    <div v-if="servicesStore.loading && servicesStore.services.length === 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div v-for="i in 9" :key="i" class="bg-white dark:bg-gray-800 rounded-xl p-4 animate-pulse">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          <div class="flex-1">
            <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-2"></div>
            <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Services grid -->
    <div v-else-if="displayedServices.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <ServiceCard
        v-for="service in displayedServices"
        :key="service.id"
        :service="service"
      />
    </div>

    <!-- Empty state -->
    <div v-else class="text-center py-12">
      <div class="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
        <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-1">No services found</h3>
      <p class="text-gray-500 dark:text-gray-400">
        {{ searchQuery ? 'Try a different search term' : 'No services match the current filter' }}
      </p>
    </div>

    <!-- Last updated -->
    <div v-if="servicesStore.lastUpdated" class="text-center text-sm text-gray-400">
      Last updated: {{ new Date(servicesStore.lastUpdated).toLocaleTimeString() }}
      <button 
        @click="servicesStore.fetchServices()"
        class="ml-2 text-cube-600 dark:text-cube-400 hover:underline"
      >
        Refresh
      </button>
    </div>
  </div>
</template>
