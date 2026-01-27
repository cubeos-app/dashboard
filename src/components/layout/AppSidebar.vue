<script setup>
import { useRoute } from 'vue-router'
import { useServicesStore } from '@/stores/services'

const route = useRoute()
const servicesStore = useServicesStore()

const navItems = [
  { path: '/', name: 'Dashboard', icon: 'home' },
  { path: '/services', name: 'Services', icon: 'grid', badge: () => servicesStore.runningCount },
  { path: '/system', name: 'System', icon: 'settings' }
]

function isActive(path) {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}

const icons = {
  home: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />`,
  grid: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />`,
  settings: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />`,
  container: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />`,
  chart: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />`,
  shield: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />`,
  external: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />`
}
</script>

<template>
  <aside class="hidden lg:block fixed left-0 top-16 bottom-0 w-64 bg-[#0d1117] border-r border-gray-800 overflow-y-auto">
    <nav class="p-4 space-y-1">
      <router-link
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        :class="[
          'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
          isActive(item.path)
            ? 'bg-[#2dd4bf]/10 text-[#2dd4bf]'
            : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
        ]"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" v-html="icons[item.icon]" />
        <span class="font-medium">{{ item.name }}</span>
        <span 
          v-if="item.badge"
          class="ml-auto px-2 py-0.5 text-xs font-medium bg-[#2dd4bf]/20 text-[#2dd4bf] rounded-full"
        >
          {{ item.badge() }}
        </span>
      </router-link>
    </nav>

    <!-- Quick links -->
    <div class="p-4 border-t border-gray-800">
      <h3 class="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Quick Links</h3>
      <div class="space-y-1">
        <a 
          href="http://dockge.mulecube.net" 
          target="_blank"
          class="flex items-center gap-3 px-4 py-2 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-gray-200 transition-colors text-sm"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" v-html="icons.container" />
          <span>Dockge</span>
          <svg class="w-3 h-3 ml-auto opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24" v-html="icons.external" />
        </a>
        <a 
          href="http://uptimekuma.mulecube.net" 
          target="_blank"
          class="flex items-center gap-3 px-4 py-2 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-gray-200 transition-colors text-sm"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" v-html="icons.chart" />
          <span>Uptime Kuma</span>
          <svg class="w-3 h-3 ml-auto opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24" v-html="icons.external" />
        </a>
        <a 
          href="http://pihole.mulecube.net/admin" 
          target="_blank"
          class="flex items-center gap-3 px-4 py-2 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-gray-200 transition-colors text-sm"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" v-html="icons.shield" />
          <span>Pi-hole</span>
          <svg class="w-3 h-3 ml-auto opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24" v-html="icons.external" />
        </a>
      </div>
    </div>

    <!-- Version -->
    <div class="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-800">
      <div class="flex items-center gap-2 px-4">
        <img src="/images/cubeos-icon.svg" alt="" class="w-4 h-4 opacity-40" />
        <span class="text-xs text-gray-500">CubeOS v0.1.0</span>
      </div>
    </div>
  </aside>
</template>
