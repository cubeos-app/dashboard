<script setup>
/**
 * SectionPanel — Mode-aware conditional content wrapper.
 *
 * S01 — Renders children only when the current UI mode matches.
 * Supports both "show only in advanced" and "show only in standard" patterns.
 *
 * Usage:
 *   <!-- Show only in Advanced mode -->
 *   <SectionPanel advanced>
 *     <DockerCompose />
 *   </SectionPanel>
 *
 *   <!-- Show only in Standard mode -->
 *   <SectionPanel standard>
 *     <SimpleAppGrid />
 *   </SectionPanel>
 *
 *   <!-- Always visible (both modes) — optional card wrapper -->
 *   <SectionPanel title="System Info">
 *     <SystemStats />
 *   </SectionPanel>
 *
 *   <!-- Collapsible in Advanced mode -->
 *   <SectionPanel advanced collapsible title="Raw Docker Output">
 *     <pre>{{ dockerOutput }}</pre>
 *   </SectionPanel>
 */
import { ref, computed } from 'vue'
import { useMode } from '@/composables/useMode'
import Icon from '@/components/ui/Icon.vue'

const props = defineProps({
  /** Show only in Advanced mode */
  advanced: {
    type: Boolean,
    default: false
  },
  /** Show only in Standard mode */
  standard: {
    type: Boolean,
    default: false
  },
  /** Optional section title */
  title: {
    type: String,
    default: ''
  },
  /** Optional section subtitle */
  subtitle: {
    type: String,
    default: ''
  },
  /** Make the section collapsible (Advanced mode pattern) */
  collapsible: {
    type: Boolean,
    default: false
  },
  /** Initial collapsed state (only when collapsible) */
  collapsed: {
    type: Boolean,
    default: true
  },
  /** Wrap content in a card-style container */
  card: {
    type: Boolean,
    default: false
  },
  /** Remove padding from content area */
  flush: {
    type: Boolean,
    default: false
  }
})

const { isAdvanced, isStandard } = useMode()

const isCollapsed = ref(props.collapsed)

/** Whether this section should be visible given the current mode */
const isVisible = computed(() => {
  if (props.advanced && !isAdvanced.value) return false
  if (props.standard && !isStandard.value) return false
  return true
})

function toggleCollapse() {
  if (props.collapsible) {
    isCollapsed.value = !isCollapsed.value
  }
}
</script>

<template>
  <section v-if="isVisible" class="animate-fade-in">
    <!-- Card wrapper (optional) -->
    <div :class="card ? 'bg-theme-card border border-theme-primary rounded-xl' : ''">
      <!-- Header (if title provided) -->
      <div
        v-if="title"
        class="flex items-center justify-between"
        :class="[
          card ? 'px-4 py-3' : 'mb-3',
          collapsible ? 'cursor-pointer select-none' : ''
        ]"
        @click="toggleCollapse"
      >
        <div>
          <h3 class="text-sm font-semibold text-theme-primary">{{ title }}</h3>
          <p v-if="subtitle" class="text-xs text-theme-secondary mt-0.5">{{ subtitle }}</p>
        </div>

        <div class="flex items-center gap-2">
          <!-- Advanced mode badge -->
          <span
            v-if="advanced"
            class="px-1.5 py-0.5 text-[10px] font-medium rounded bg-accent-muted text-accent uppercase tracking-wider"
          >
            Advanced
          </span>

          <!-- Collapse chevron -->
          <button
            v-if="collapsible"
            class="p-1 rounded text-theme-tertiary hover:text-theme-primary transition-colors"
            :aria-label="isCollapsed ? 'Expand section' : 'Collapse section'"
            :aria-expanded="!isCollapsed"
          >
            <Icon
              name="ChevronDown"
              :size="16"
              class="transition-transform duration-200"
              :class="isCollapsed ? '' : 'rotate-180'"
            />
          </button>
        </div>
      </div>

      <!-- Divider between header and content (card mode) -->
      <div v-if="title && card && (!collapsible || !isCollapsed)" class="border-t border-theme-primary" />

      <!-- Content -->
      <div
        v-if="!collapsible || !isCollapsed"
        :class="[
          flush ? '' : (card ? 'p-4' : ''),
        ]"
      >
        <slot />
      </div>
    </div>
  </section>
</template>
