<script setup>
import { computed } from 'vue'
import * as icons from 'lucide-vue-next'

const props = defineProps({
  name: {
    type: String,
    required: true
  },
  size: {
    type: [Number, String],
    default: 20
  },
  strokeWidth: {
    type: [Number, String],
    default: 1.5
  }
})

const iconComponent = computed(() => {
  return icons[props.name] || icons.Box
})
</script>

<template>
  <component 
    :is="iconComponent" 
    :size="size" 
    :stroke-width="strokeWidth"
    class="inline-block"
  />
</template>
