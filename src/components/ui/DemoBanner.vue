<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const toast = ref(null)
let toastTimeout = null

function onDemoToast(event) {
  const message = event.detail?.message || 'This action is disabled in demo mode'
  toast.value = message
  clearTimeout(toastTimeout)
  toastTimeout = setTimeout(() => { toast.value = null }, 3000)
}

onMounted(() => {
  window.addEventListener('cubeos:demo-toast', onDemoToast)
})

onUnmounted(() => {
  window.removeEventListener('cubeos:demo-toast', onDemoToast)
  clearTimeout(toastTimeout)
})
</script>

<template>
  <!-- Fixed demo banner above everything -->
  <div class="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-amber-500 px-4 py-1 text-xs font-medium text-amber-950">
    <span>DEMO</span>
    <span class="hidden sm:inline">&mdash; This is a read-only demo.</span>
    <a
      href="https://get.cubeos.app"
      target="_blank"
      rel="noopener noreferrer"
      class="underline hover:no-underline"
    >Install CubeOS &rarr;</a>
  </div>

  <!-- Toast notification -->
  <Transition name="demo-toast">
    <div
      v-if="toast"
      class="fixed bottom-20 left-1/2 z-[70] -translate-x-1/2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-lg sm:bottom-6"
    >
      {{ toast }}
    </div>
  </Transition>
</template>

<style scoped>
.demo-toast-enter-active,
.demo-toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.demo-toast-enter-from,
.demo-toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}
</style>

<!--
  Unscoped: offset the fixed AppHeader below the demo banner.
  Scoped to .demo-mode parent so production builds are unaffected.
-->
<style>
.demo-mode header.fixed {
  top: 1.75rem !important;
}
</style>
