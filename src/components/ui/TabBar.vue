<script setup>
/**
 * TabBar.vue — Reusable tab bar component
 *
 * Variants:
 *   - 'underline' (default): Border-bottom style, canonical for page-level tabs
 *   - 'pill': Rounded background style, for nested/secondary tabs
 *
 * Usage:
 *   <TabBar v-model="activeTab" :tabs="tabs" />
 *   <TabBar v-model="activeTab" :tabs="tabs" variant="pill" />
 */
import Icon from '@/components/ui/Icon.vue'

defineProps({
  tabs: {
    type: Array,
    required: true,
    validator: (v) => v.every(t => t.key && t.label)
  },
  modelValue: {
    type: String,
    required: true
  },
  variant: {
    type: String,
    default: 'underline',
    validator: (v) => ['underline', 'pill'].includes(v)
  },
  ariaLabel: {
    type: String,
    default: 'Tabs'
  }
})

const emit = defineEmits(['update:modelValue'])

function selectTab(key) {
  emit('update:modelValue', key)
}
</script>

<template>
  <!-- Underline variant -->
  <div
    v-if="variant === 'underline'"
    class="border-b border-theme-primary overflow-x-auto scrollbar-hide"
  >
    <nav
      class="flex gap-1 sm:gap-4 min-w-max"
      role="tablist"
      :aria-label="ariaLabel"
    >
      <button
        v-for="tab in tabs"
        :key="tab.key"
        @click="selectTab(tab.key)"
        role="tab"
        :aria-selected="modelValue === tab.key"
        class="px-3 sm:px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap flex items-center gap-2"
        :class="modelValue === tab.key
          ? 'border-[color:var(--accent-primary)] text-accent'
          : 'border-transparent text-theme-muted hover:text-theme-primary'"
      >
        <Icon v-if="tab.icon" :name="tab.icon" :size="16" />
        {{ tab.label }}
        <span
          v-if="tab.badge != null"
          class="px-1.5 py-0.5 text-[10px] font-semibold rounded-full"
          :class="tab.badgeVariant === 'alert'
            ? (modelValue === tab.key ? 'bg-accent text-on-accent' : 'bg-error-muted text-error')
            : (modelValue === tab.key ? 'bg-accent text-on-accent' : 'bg-theme-tertiary text-theme-secondary')"
        >
          {{ tab.badge }}
        </span>
      </button>
    </nav>
  </div>

  <!-- Pill variant -->
  <div
    v-else
    class="flex items-center gap-1 p-1 bg-theme-tertiary rounded-lg overflow-x-auto scrollbar-hide"
    role="tablist"
    :aria-label="ariaLabel"
  >
    <button
      v-for="tab in tabs"
      :key="tab.key"
      @click="selectTab(tab.key)"
      role="tab"
      :aria-selected="modelValue === tab.key"
      class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap"
      :class="modelValue === tab.key
        ? 'bg-theme-card text-theme-primary shadow-sm'
        : 'text-theme-muted hover:text-theme-secondary'"
    >
      <Icon v-if="tab.icon" :name="tab.icon" :size="14" />
      {{ tab.label }}
      <span
        v-if="tab.badge != null"
        class="px-1.5 py-0.5 text-[10px] font-semibold rounded"
        :class="tab.badgeVariant === 'alert'
          ? 'bg-error-muted text-error'
          : (modelValue === tab.key ? 'bg-accent text-on-accent' : 'bg-theme-tertiary text-theme-secondary')"
      >
        {{ tab.badge }}
      </span>
    </button>
  </div>
</template>
