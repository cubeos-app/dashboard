<script setup>
import { ref, watch, nextTick } from 'vue'
import Icon from '@/components/ui/Icon.vue'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  appName: {
    type: String,
    required: true
  },
  compose: {
    type: String,
    default: ''
  },
  env: {
    type: String,
    default: ''
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'save'])

const localCompose = ref('')
const localEnv = ref('')
const activeTab = ref('compose')
const recreateOnSave = ref(true)
const modalRef = ref(null)

watch(() => props.compose, (val) => {
  localCompose.value = val || ''
})

watch(() => props.env, (val) => {
  localEnv.value = val || ''
})

watch(() => props.show, (val) => {
  if (val) {
    localCompose.value = props.compose || ''
    localEnv.value = props.env || ''
    activeTab.value = 'compose'
    nextTick(() => modalRef.value?.focus())
  }
})

function handleSave() {
  emit('save', {
    compose: localCompose.value,
    env: localEnv.value,
    recreate: recreateOnSave.value
  })
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="show"
      ref="modalRef"
      class="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      :aria-label="`Edit configuration — ${appName}`"
      tabindex="-1"
      @keydown.escape="$emit('close')"
    >
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/60" @click="$emit('close')"></div>
      
      <!-- Modal -->
      <div class="relative bg-theme-secondary rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col m-4">
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-theme-primary">
          <div class="flex items-center gap-3">
            <Icon name="FileCode" :size="24" class="text-accent" />
            <div>
              <h2 class="text-lg font-semibold text-theme-primary">Edit Configuration</h2>
              <p class="text-sm text-theme-muted">{{ appName }}</p>
            </div>
          </div>
          <button @click="$emit('close')" class="p-2 rounded-lg hover:bg-theme-tertiary text-theme-secondary">
            <Icon name="X" :size="20" />
          </button>
        </div>
        
        <!-- Tabs -->
        <div class="flex border-b border-theme-primary px-6">
          <button
            @click="activeTab = 'compose'"
            :class="[
              'px-4 py-3 text-sm font-medium border-b-2 -mb-px',
              activeTab === 'compose' 
                ? 'border-accent text-accent' 
                : 'border-transparent text-theme-secondary hover:text-theme-primary'
            ]"
          >
            <div class="flex items-center gap-2">
              <Icon name="FileCode" :size="16" />
              docker-compose.yml
            </div>
          </button>
          <button
            @click="activeTab = 'env'"
            :class="[
              'px-4 py-3 text-sm font-medium border-b-2 -mb-px',
              activeTab === 'env' 
                ? 'border-accent text-accent' 
                : 'border-transparent text-theme-secondary hover:text-theme-primary'
            ]"
          >
            <div class="flex items-center gap-2">
              <Icon name="Settings" :size="16" />
              .env
            </div>
          </button>
        </div>
        
        <!-- Content -->
        <div class="flex-1 overflow-hidden p-6">
          <div v-show="activeTab === 'compose'" class="h-full">
            <textarea
              v-model="localCompose"
              class="w-full h-[400px] bg-theme-primary border border-theme-primary rounded-lg p-4 font-mono text-sm text-theme-primary resize-none focus:outline-none focus:border-accent"
              placeholder="# docker-compose.yml content"
              spellcheck="false"
            ></textarea>
          </div>
          <div v-show="activeTab === 'env'" class="h-full">
            <textarea
              v-model="localEnv"
              class="w-full h-[400px] bg-theme-primary border border-theme-primary rounded-lg p-4 font-mono text-sm text-theme-primary resize-none focus:outline-none focus:border-accent"
              placeholder="# Environment variables (KEY=value)"
              spellcheck="false"
            ></textarea>
          </div>
        </div>
        
        <!-- Footer -->
        <div class="flex items-center justify-between px-6 py-4 border-t border-theme-primary bg-theme-tertiary rounded-b-lg">
          <label class="flex items-center gap-2 text-sm text-theme-secondary cursor-pointer">
            <input
              type="checkbox"
              v-model="recreateOnSave"
              class="w-4 h-4 rounded border-theme-primary bg-theme-primary text-accent focus:ring-accent"
            />
            Recreate container after save
          </label>
          
          <div class="flex items-center gap-3">
            <button
              @click="$emit('close')"
              class="px-4 py-2 text-sm font-medium text-theme-secondary hover:text-theme-primary rounded-lg hover:bg-theme-secondary"
            >
              Cancel
            </button>
            <button
              @click="handleSave"
              :disabled="loading"
              class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-lg disabled:opacity-50"
            >
              <Icon v-if="loading" name="Loader2" :size="16" class="animate-spin" />
              <Icon v-else name="Save" :size="16" />
              {{ recreateOnSave ? 'Save & Recreate' : 'Save' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
