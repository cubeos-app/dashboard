<script setup>
/**
 * NetworkMountsTab.vue — S07 Component (Advanced only)
 *
 * NFS/SMB network mount management.
 * Wraps the existing NetworkMounts component which is already fully featured
 * with mount/unmount, add/edit/delete, test connection, detail expansion.
 *
 * Self-managed — NetworkMounts uses stores directly.
 */
import NetworkMounts from '@/components/storage/NetworkMounts.vue'
</script>

<template>
  <div class="space-y-6">
    <NetworkMounts />
  </div>
</template>
