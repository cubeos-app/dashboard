<script setup>
/**
 * PageHeader — Standardized page header component.
 *
 * S01 — Consistent header for every page view with title, subtitle,
 * breadcrumb, and an actions slot for buttons/toggles.
 *
 * Usage:
 *   <PageHeader
 *     title="Network"
 *     subtitle="Configure network interfaces and connectivity"
 *     icon="Globe"
 *   >
 *     <template #actions>
 *       <button class="btn-accent px-3 py-1.5 rounded-lg text-sm">Scan WiFi</button>
 *     </template>
 *   </PageHeader>
 */
import Icon from '@/components/ui/Icon.vue'
import { useBreakpoint } from '@/composables/useBreakpoint'

defineProps({
  /** Page title */
  title: {
    type: String,
    required: true
  },
  /** Optional subtitle / description */
  subtitle: {
    type: String,
    default: ''
  },
  /** Optional Lucide icon name */
  icon: {
    type: String,
    default: ''
  },
  /** Breadcrumb items: [{ label, to? }] */
  breadcrumbs: {
    type: Array,
    default: () => []
  },
  /** Use a smaller header variant */
  compact: {
    type: Boolean,
    default: false
  }
})

const { isMobile } = useBreakpoint()
</script>

<template>
  <div :class="compact ? 'mb-4' : 'mb-6'">
    <!-- Breadcrumbs -->
    <nav
      v-if="breadcrumbs.length > 0"
      class="flex items-center gap-1 text-xs text-theme-tertiary mb-2"
      aria-label="Breadcrumb"
    >
      <template v-for="(crumb, i) in breadcrumbs" :key="i">
        <router-link
          v-if="crumb.to"
          :to="crumb.to"
          class="hover:text-theme-secondary transition-colors"
        >
          {{ crumb.label }}
        </router-link>
        <span v-else>{{ crumb.label }}</span>
        <Icon v-if="i < breadcrumbs.length - 1" name="ChevronRight" :size="12" />
      </template>
    </nav>

    <!-- Title row -->
    <div class="flex items-start justify-between gap-4" :class="isMobile ? 'flex-col' : ''">
      <div class="flex items-center gap-3 min-w-0">
        <!-- Icon -->
        <div
          v-if="icon"
          class="flex items-center justify-center shrink-0 rounded-lg bg-accent-muted"
          :class="compact ? 'w-8 h-8' : 'w-10 h-10'"
        >
          <Icon :name="icon" :size="compact ? 16 : 20" class="text-accent" />
        </div>

        <!-- Text -->
        <div class="min-w-0">
          <h1
            class="font-semibold text-theme-primary truncate"
            :class="compact ? 'text-lg' : 'text-xl'"
          >
            {{ title }}
          </h1>
          <p v-if="subtitle" class="text-sm text-theme-secondary mt-0.5 line-clamp-2">
            {{ subtitle }}
          </p>
        </div>
      </div>

      <!-- Actions slot -->
      <div
        v-if="$slots.actions"
        class="flex items-center gap-2 shrink-0"
        :class="isMobile ? 'w-full' : ''"
      >
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>
