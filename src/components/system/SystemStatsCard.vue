<script setup>
const props = defineProps({
  title: String,
  value: [String, Number],
  subtitle: String,
  icon: String,
  color: {
    type: String,
    default: 'teal'
  }
})

const colorClasses = {
  teal: 'text-[#2dd4bf]',
  green: 'text-emerald-400',
  blue: 'text-blue-400',
  purple: 'text-purple-400',
  amber: 'text-amber-400',
  red: 'text-red-400'
}

const icons = {
  grid: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />`,
  clock: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />`,
  cpu: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />`,
  memory: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />`,
  disk: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />`
}
</script>

<template>
  <div class="bg-[#161b22] rounded-xl p-4 border border-gray-800">
    <div class="flex items-center gap-3">
      <!-- Icon -->
      <div class="w-10 h-10 rounded-lg bg-[#0d1117] border border-gray-800 flex items-center justify-center">
        <svg 
          class="w-5 h-5" 
          :class="colorClasses[color]"
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24" 
          v-html="icons[icon]" 
        />
      </div>

      <!-- Content -->
      <div class="flex-1 min-w-0">
        <p class="text-sm text-gray-500">{{ title }}</p>
        <p class="text-lg font-semibold text-white truncate">{{ value }}</p>
        <p v-if="subtitle" class="text-xs text-gray-600 truncate">{{ subtitle }}</p>
      </div>
    </div>
  </div>
</template>
