<script setup>
const props = defineProps({
  title: String,
  value: [String, Number],
  subtitle: String,
  icon: String,
  color: {
    type: String,
    default: 'cube'
  }
})

const colorClasses = {
  cube: 'bg-teal-100 dark:bg-teal-900/30 text-teal-500 dark:text-teal-400',
  green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
  blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  yellow: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
  red: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
}

const icons = {
  grid: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />`,
  clock: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />`,
  cpu: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />`,
  memory: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 19v-3M10 19v-3M14 19v-3M18 19v-3M3 7h18v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7zM3 7V5a2 2 0 012-2h14a2 2 0 012 2v2" />`,
  disk: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />`,
  temperature: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 4v10.54a4 4 0 11-4 0V4a2 2 0 114 0z" />`,
  wifi: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />`,
  battery: `<rect x="2" y="7" width="18" height="10" rx="1" stroke-width="2" /><path d="M22 10v4" stroke-linecap="round" stroke-width="2" />`
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
    <div class="flex items-center gap-3">
      <!-- Icon -->
      <div 
        class="w-10 h-10 rounded-lg flex items-center justify-center"
        :class="colorClasses[color]"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" v-html="icons[icon]" />
      </div>

      <!-- Content -->
      <div class="flex-1 min-w-0">
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ title }}</p>
        <p class="text-lg font-semibold text-gray-900 dark:text-white truncate">{{ value }}</p>
        <p v-if="subtitle" class="text-xs text-gray-400 dark:text-gray-500 truncate">{{ subtitle }}</p>
      </div>
    </div>
  </div>
</template>
