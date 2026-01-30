<script setup>
import { ref, nextTick, onMounted } from 'vue'
import Icon from '@/components/ui/Icon.vue'

const props = defineProps({
  show: Boolean
})

const emit = defineEmits(['close'])

const messages = ref([])
const inputMessage = ref('')
const isLoading = ref(false)
const isAvailable = ref(false)
const modelReady = ref(false)
const isPullingModel = ref(false)
const chatContainer = ref(null)
const inputRef = ref(null)

const suggestedPrompts = [
  "How do I access Pi-hole?",
  "How do I add a new app?",
  "How do I check system logs?",
  "What's the WiFi password?"
]

async function checkStatus() {
  try {
    const token = localStorage.getItem('cubeos-token')
    const resp = await fetch('/api/v1/chat/status', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const data = await resp.json()
    isAvailable.value = data.available
    modelReady.value = data.model_ready
  } catch (e) {
    isAvailable.value = false
  }
}

async function pullModel() {
  isPullingModel.value = true
  try {
    const token = localStorage.getItem('cubeos-token')
    await fetch('/api/v1/chat/pull-model', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    // Wait and recheck
    setTimeout(() => {
      checkStatus()
      isPullingModel.value = false
    }, 5000)
  } catch (e) {
    isPullingModel.value = false
  }
}

async function sendMessage(text = null) {
  const message = text || inputMessage.value.trim()
  if (!message || isLoading.value) return

  messages.value.push({ role: 'user', content: message })
  inputMessage.value = ''
  isLoading.value = true

  await nextTick()
  scrollToBottom()

  const assistantIndex = messages.value.length
  messages.value.push({ role: 'assistant', content: '', loading: true })

  try {
    const token = localStorage.getItem('cubeos-token')
    const history = messages.value.slice(0, -2).slice(-10)

    const response = await fetch('/api/v1/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ message, history })
    })

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let fullContent = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n')

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            if (data.content) {
              fullContent += data.content
              messages.value[assistantIndex] = { role: 'assistant', content: fullContent, loading: false }
              await nextTick()
              scrollToBottom()
            }
          } catch (e) {}
        }
      }
    }

    if (!fullContent) {
      messages.value[assistantIndex] = { role: 'assistant', content: "Sorry, I couldn't generate a response.", loading: false, error: true }
    }
  } catch (e) {
    messages.value[assistantIndex] = { role: 'assistant', content: "Failed to connect to AI service.", loading: false, error: true }
  } finally {
    isLoading.value = false
  }
}

function scrollToBottom() {
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight
  }
}

function clearChat() {
  messages.value = []
}

function handleKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}

onMounted(() => checkStatus())
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" @click.self="$emit('close')">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="$emit('close')"></div>

        <div class="relative w-full max-w-lg bg-theme-secondary rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] sm:max-h-[600px]">
          <!-- Header -->
          <div class="flex items-center justify-between px-4 py-3 border-b border-theme-primary bg-theme-tertiary">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-accent-muted flex items-center justify-center">
                <Icon name="Bot" :size="18" class="text-accent" />
              </div>
              <div>
                <h3 class="font-medium text-theme-primary text-sm">Ask CubeOS</h3>
                <p class="text-[10px] text-theme-muted">
                  <span v-if="isAvailable && modelReady" class="text-success">● Online</span>
                  <span v-else-if="isAvailable" class="text-warning">● Loading model...</span>
                  <span v-else class="text-error">● Offline</span>
                </p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button v-if="messages.length > 0" @click="clearChat" class="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-theme-primary transition-colors">
                <Icon name="Trash2" :size="16" />
              </button>
              <button @click="$emit('close')" class="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-theme-primary transition-colors">
                <Icon name="X" :size="18" />
              </button>
            </div>
          </div>

          <!-- Messages -->
          <div ref="chatContainer" class="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px]">
            <div v-if="isAvailable && !modelReady && !isPullingModel" class="text-center py-8">
              <Icon name="Download" :size="32" class="text-theme-muted mx-auto mb-3" />
              <p class="text-sm text-theme-secondary mb-3">AI model needs to be downloaded</p>
              <button @click="pullModel" class="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-secondary transition-colors">
                Download Model (~400MB)
              </button>
            </div>

            <div v-else-if="isPullingModel" class="text-center py-8">
              <div class="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p class="text-sm text-theme-secondary">Downloading AI model...</p>
              <p class="text-xs text-theme-muted mt-1">This may take a few minutes</p>
            </div>

            <div v-else-if="!isAvailable" class="text-center py-8">
              <Icon name="WifiOff" :size="32" class="text-theme-muted mx-auto mb-3" />
              <p class="text-sm text-theme-secondary mb-1">AI Assistant is offline</p>
              <p class="text-xs text-theme-muted">Ollama service is not running</p>
            </div>

            <template v-else-if="messages.length === 0">
              <div class="text-center py-4">
                <Icon name="MessageSquare" :size="32" class="text-theme-muted mx-auto mb-3" />
                <p class="text-sm text-theme-secondary mb-4">How can I help you?</p>
              </div>
              <div class="space-y-2">
                <button v-for="prompt in suggestedPrompts" :key="prompt" @click="sendMessage(prompt)" class="w-full text-left px-3 py-2 rounded-lg border border-theme-primary bg-theme-card text-sm text-theme-secondary hover:border-accent/50 hover:bg-theme-tertiary transition-colors">
                  {{ prompt }}
                </button>
              </div>
            </template>

            <template v-else>
              <div v-for="(msg, idx) in messages" :key="idx" class="flex gap-3" :class="msg.role === 'user' ? 'justify-end' : 'justify-start'">
                <div v-if="msg.role === 'assistant'" class="w-7 h-7 rounded-lg bg-accent-muted flex items-center justify-center flex-shrink-0">
                  <Icon name="Bot" :size="14" class="text-accent" />
                </div>
                <div class="max-w-[80%] px-3 py-2 rounded-xl text-sm" :class="[msg.role === 'user' ? 'bg-accent text-white rounded-br-md' : 'bg-theme-tertiary text-theme-primary rounded-bl-md', msg.error ? 'bg-error/20 text-error' : '']">
                  <div v-if="msg.loading" class="flex items-center gap-1.5">
                    <div class="w-1.5 h-1.5 bg-theme-muted rounded-full animate-bounce"></div>
                    <div class="w-1.5 h-1.5 bg-theme-muted rounded-full animate-bounce" style="animation-delay: 150ms"></div>
                    <div class="w-1.5 h-1.5 bg-theme-muted rounded-full animate-bounce" style="animation-delay: 300ms"></div>
                  </div>
                  <div v-else class="whitespace-pre-wrap">{{ msg.content }}</div>
                </div>
                <div v-if="msg.role === 'user'" class="w-7 h-7 rounded-lg bg-theme-tertiary flex items-center justify-center flex-shrink-0">
                  <Icon name="User" :size="14" class="text-theme-secondary" />
                </div>
              </div>
            </template>
          </div>

          <!-- Input -->
          <div class="border-t border-theme-primary p-3 bg-theme-tertiary">
            <div class="flex gap-2">
              <input ref="inputRef" v-model="inputMessage" @keydown="handleKeydown" :disabled="!isAvailable || !modelReady || isLoading" type="text" placeholder="Ask anything about CubeOS..." class="flex-1 px-3 py-2 rounded-xl border border-theme-primary bg-theme-input text-theme-primary placeholder-theme-muted text-sm focus:outline-none focus:border-accent disabled:opacity-50" />
              <button @click="sendMessage()" :disabled="!inputMessage.trim() || !isAvailable || !modelReady || isLoading" class="px-3 py-2 rounded-xl bg-accent text-white hover:bg-accent-secondary transition-colors disabled:opacity-50">
                <Icon :name="isLoading ? 'Loader2' : 'Send'" :size="18" :class="isLoading ? 'animate-spin' : ''" />
              </button>
            </div>
            <p class="text-[10px] text-theme-muted text-center mt-2">Powered by Ollama</p>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active, .modal-leave-active { transition: all 0.2s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
</style>
