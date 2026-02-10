<script setup>
/**
 * ResponsiveTable — Table ↔ Card stack transformer.
 *
 * S01 — Renders data as a table on desktop (≥768px) and as stacked cards
 * on mobile (<768px). Supports sortable columns, row actions, and
 * empty states.
 *
 * Usage:
 *   <ResponsiveTable
 *     :columns="[
 *       { key: 'name', label: 'Name', sortable: true },
 *       { key: 'status', label: 'Status' },
 *       { key: 'port', label: 'Port', align: 'right' }
 *     ]"
 *     :rows="apps"
 *     row-key="id"
 *     empty-text="No apps installed"
 *   >
 *     <template #cell-name="{ row }">{{ row.name }}</template>
 *     <template #cell-status="{ row }">
 *       <StatusBadge :status="row.status" />
 *     </template>
 *     <template #cell-port="{ row }">{{ row.port }}</template>
 *     <template #row-actions="{ row }">
 *       <button @click="restart(row)">Restart</button>
 *     </template>
 *   </ResponsiveTable>
 */
import { ref, computed } from 'vue'
import { useBreakpoint } from '@/composables/useBreakpoint'
import Icon from '@/components/ui/Icon.vue'

const props = defineProps({
  /** Column definitions */
  columns: {
    type: Array,
    required: true,
    validator: (cols) => cols.every(c => c.key && c.label)
  },
  /** Row data array */
  rows: {
    type: Array,
    default: () => []
  },
  /** Unique key field on each row object */
  rowKey: {
    type: String,
    default: 'id'
  },
  /** Text shown when rows is empty */
  emptyText: {
    type: String,
    default: 'No data'
  },
  /** Show loading skeleton */
  loading: {
    type: Boolean,
    default: false
  },
  /** Number of skeleton rows to show while loading */
  skeletonRows: {
    type: Number,
    default: 3
  },
  /** Compact row height */
  compact: {
    type: Boolean,
    default: false
  }
})

defineEmits(['row-click'])

const { isMobile } = useBreakpoint()

// Sorting
const sortKey = ref('')
const sortDir = ref('asc')

function toggleSort(col) {
  if (!col.sortable) return
  if (sortKey.value === col.key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = col.key
    sortDir.value = 'asc'
  }
}

const sortedRows = computed(() => {
  if (!sortKey.value) return props.rows

  return [...props.rows].sort((a, b) => {
    const aVal = a[sortKey.value]
    const bVal = b[sortKey.value]

    if (aVal == null) return 1
    if (bVal == null) return -1

    const cmp = typeof aVal === 'string'
      ? aVal.localeCompare(bVal)
      : aVal - bVal

    return sortDir.value === 'asc' ? cmp : -cmp
  })
})
</script>

<template>
  <!-- Desktop: Traditional table -->
  <div v-if="!isMobile" class="overflow-x-auto">
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-theme-primary">
          <th
            v-for="col in columns"
            :key="col.key"
            class="px-3 py-2 text-xs font-medium text-theme-tertiary uppercase tracking-wider"
            :class="[
              col.align === 'right' ? 'text-right' : 'text-left',
              col.sortable ? 'cursor-pointer select-none hover:text-theme-secondary transition-colors' : ''
            ]"
            @click="toggleSort(col)"
          >
            <span class="inline-flex items-center gap-1">
              {{ col.label }}
              <Icon
                v-if="col.sortable && sortKey === col.key"
                :name="sortDir === 'asc' ? 'ChevronUp' : 'ChevronDown'"
                :size="12"
                class="text-accent"
              />
            </span>
          </th>
          <th v-if="$slots['row-actions']" class="w-10" />
        </tr>
      </thead>

      <!-- Loading skeleton -->
      <tbody v-if="loading">
        <tr v-for="n in skeletonRows" :key="`skeleton-${n}`" class="border-b border-theme-primary">
          <td v-for="col in columns" :key="col.key" class="px-3" :class="compact ? 'py-2' : 'py-3'">
            <div class="h-4 bg-theme-tertiary rounded animate-pulse" :style="{ width: `${40 + Math.random() * 40}%` }" />
          </td>
          <td v-if="$slots['row-actions']" />
        </tr>
      </tbody>

      <!-- Data rows -->
      <tbody v-else-if="sortedRows.length > 0">
        <tr
          v-for="row in sortedRows"
          :key="row[rowKey]"
          class="border-b border-theme-primary hover:bg-theme-secondary/50 transition-colors"
          :class="$attrs['onRow-click'] ? 'cursor-pointer' : ''"
          @click="$emit('row-click', row)"
        >
          <td
            v-for="col in columns"
            :key="col.key"
            class="px-3"
            :class="[
              compact ? 'py-2' : 'py-3',
              col.align === 'right' ? 'text-right' : ''
            ]"
          >
            <slot :name="`cell-${col.key}`" :row="row" :value="row[col.key]">
              {{ row[col.key] ?? '-' }}
            </slot>
          </td>
          <td v-if="$slots['row-actions']" class="px-2 text-right">
            <slot name="row-actions" :row="row" />
          </td>
        </tr>
      </tbody>

      <!-- Empty state -->
      <tbody v-else>
        <tr>
          <td :colspan="columns.length + ($slots['row-actions'] ? 1 : 0)" class="px-3 py-8 text-center">
            <p class="text-sm text-theme-tertiary">{{ emptyText }}</p>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Mobile: Card stack -->
  <div v-else class="space-y-2">
    <!-- Loading skeleton -->
    <template v-if="loading">
      <div
        v-for="n in skeletonRows"
        :key="`skeleton-${n}`"
        class="bg-theme-card border border-theme-primary rounded-lg p-3 space-y-2"
      >
        <div class="h-4 bg-theme-tertiary rounded animate-pulse w-2/3" />
        <div class="h-3 bg-theme-tertiary rounded animate-pulse w-1/2" />
        <div class="h-3 bg-theme-tertiary rounded animate-pulse w-1/3" />
      </div>
    </template>

    <!-- Data cards -->
    <template v-else-if="sortedRows.length > 0">
      <div
        v-for="row in sortedRows"
        :key="row[rowKey]"
        class="bg-theme-card border border-theme-primary rounded-lg p-3"
        :class="$attrs['onRow-click'] ? 'cursor-pointer active:bg-theme-secondary/50' : ''"
        @click="$emit('row-click', row)"
      >
        <div class="space-y-1.5">
          <div
            v-for="col in columns"
            :key="col.key"
            class="flex items-center justify-between gap-2"
          >
            <span class="text-xs text-theme-tertiary shrink-0">{{ col.label }}</span>
            <span class="text-sm text-theme-primary text-right truncate">
              <slot :name="`cell-${col.key}`" :row="row" :value="row[col.key]">
                {{ row[col.key] ?? '-' }}
              </slot>
            </span>
          </div>
        </div>

        <div v-if="$slots['row-actions']" class="mt-2 pt-2 border-t border-theme-primary flex justify-end gap-2">
          <slot name="row-actions" :row="row" />
        </div>
      </div>
    </template>

    <!-- Empty state -->
    <div v-else class="py-8 text-center">
      <p class="text-sm text-theme-tertiary">{{ emptyText }}</p>
    </div>
  </div>
</template>
