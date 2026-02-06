<script setup>
import { computed } from 'vue'
import Icon from '@/components/ui/Icon.vue'

const props = defineProps({
  app: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['click'])

const title = computed(() => {
  return props.app.title?.en_us || props.app.title?.en_US || props.app.name || ''
})

const tagline = computed(() => {
  return props.app.tagline?.en_us || props.app.tagline?.en_US || props.app.category || ''
})
</script>

<template>
  <button
    @click="emit('click', app)"
    class="group relative flex flex-col items-center p-3 rounded-xl border border-theme-primary bg-theme-card transition-all duration-150 hover:border-accent/40 hover:shadow-theme-md hover:-translate-y-0.5 text-left"
  >
    <!-- Installed badge -->
    <div v-if="app.installed" class="absolute top-2 right-2">
      <Icon name="CheckCircle" :size="14" class="text-success" />
    </div>

    <!-- Icon -->
    <div class="w-12 h-12 rounded-xl bg-theme-tertiary flex items-center justify-center mb-2 group-hover:bg-accent-muted transition-colors">
      <img 
        v-if="app.icon" 
        :src="app.icon" 
        :alt="title"
        class="w-8 h-8 rounded-lg object-contain"
        loading="lazy"
        @error="(e) => e.target.style.display = 'none'"
      />
      <Icon v-else name="Package" :size="24" class="text-theme-muted group-hover:text-accent transition-colors" />
    </div>

    <!-- Title -->
    <h3 class="text-xs font-medium text-theme-primary text-center leading-tight truncate w-full">
      {{ title }}
    </h3>

    <!-- Category/Tagline -->
    <p class="text-[10px] text-theme-muted text-center truncate w-full mt-0.5">
      {{ tagline }}
    </p>
  </button>
</template>
