<script setup>
import { ref, nextTick, onMounted, watch } from 'vue'
import { safeGetRaw } from '@/utils/storage'
import Icon from '@/components/ui/Icon.vue'

const props = defineProps({
  show: {
    type: Boolean,
    required: true
  },
  initialQuery: {
    type: String,
    default: ''
  }
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

// Watch for modal open with initial query
watch(() => props.show, async (newVal) => {
  if (newVal) {
    await checkStatus()
    // Auto-send initial query if provided
    if (props.initialQuery && props.initialQuery.trim()) {
      await nextTick()
      sendMessage(props.initialQuery)
    }
  }
})

// Simple markdown parser for chat messages
function parseMarkdown(text) {
  if (!text) return ''
  
  return text
    // Escape HTML first
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Headers: ### text (must be at start of line)
    .replace(/^### (.+)$/gm, '<strong class="block mt-2 mb-1">$1</strong>')
    .replace(/^## (.+)$/gm, '<strong class="block mt-2 mb-1 text-base">$1</strong>')
    .replace(/^# (.+)$/gm, '<strong class="block mt-2 mb-1 text-lg">$1</strong>')
    // Bold: **text** or __text__
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    // Italic: *text* or _text_ (careful not to match inside words)
    .replace(/(?<![a-zA-Z0-9])\*([^*\n]+)\*(?![a-zA-Z0-9])/g, '<em>$1</em>')
    .replace(/(?<![a-zA-Z0-9])_([^_\n]+)_(?![a-zA-Z0-9])/g, '<em>$1</em>')
    // Inline code: `code`
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
    // Links: [text](url)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="chat-link">$1</a>')
    // Line breaks
    .replace(/\n/g, '<br>')
}

async function checkStatus() {
  try {
    const token = safeGetRaw('cubeos_access_token')
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
    const token = safeGetRaw('cubeos_access_token')
    await fetch('/api/v1/chat/pull-model', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    // Poll status every 5 seconds until ready
    const pollInterval = setInterval(async () => {
      await checkStatus()
      if (modelReady.value) {
        clearInterval(pollInterval)
        isPullingModel.value = false
      }
    }, 5000)
    // Timeout after 10 minutes
    setTimeout(() => {
      clearInterval(pollInterval)
      isPullingModel.value = false
    }, 600000)
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
  messages.value.push({ role: 'assistant', content: '', loading: true, sources: [] })

  try {
    const token = safeGetRaw('cubeos_access_token')
    // Send last 6 messages as history (matches API limit)
    const history = messages.value.slice(0, -2).slice(-6)

    const response = await fetch('/api/v1/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ message, history })
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let fullContent = ''
    let sources = []

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n')

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            // Capture sources (sent as first event)
            if (data.sources && Array.isArray(data.sources)) {
              sources = data.sources
              messages.value[assistantIndex] = { 
                role: 'assistant', 
                content: fullContent, 
                loading: true,
                sources: sources
              }
            }
            if (data.content) {
              fullContent += data.content
              messages.value[assistantIndex] = { 
                role: 'assistant', 
                content: fullContent, 
                loading: false,
                sources: sources
              }
              await nextTick()
              scrollToBottom()
            }
          } catch (e) {
            // Ignore parse errors for incomplete chunks
          }
        }
      }
    }

    if (!fullContent) {
      messages.value[assistantIndex] = { 
        role: 'assistant', 
        content: "I couldn't generate a response. Please try again.", 
        loading: false, 
        error: true,
        sources: []
      }
    }
  } catch (e) {
    messages.value[assistantIndex] = { 
      role: 'assistant', 
      content: "Failed to connect to AI service. Check if Ollama is running.", 
      loading: false, 
      error: true,
      sources: []
    }
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

function handleClose() {
  emit('close')
}

// Extract readable name from docs URL
function getSourceName(url) {
  // Extract filename from URL like /docs/faq/general or https://github.com/.../faq/general.md
  const match = url.match(/\/([^/]+)(?:\.md)?$/)
  if (match) {
    return match[1].replace(/-/g, ' ')
  }
  return url
}

onMounted(() => {
  if (props.show) {
    checkStatus()
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div 
        v-if="show" 
        class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" 
        @click.self="handleClose"
      >
        <!-- Backdrop -->
        <div 
          class="absolute inset-0 bg-black/60 backdrop-blur-sm" 
          @click="handleClose"
        ></div>

        <!-- Modal -->
        <div class="relative w-full max-w-xl bg-theme-secondary rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[680px]">
          
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
              <button 
                v-if="messages.length > 0" 
                @click="clearChat" 
                class="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-theme-primary transition-colors" 
                title="Clear chat"
              >
                <Icon name="Trash2" :size="16" />
              </button>
              <button 
                @click="handleClose" 
                class="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-theme-primary transition-colors"
              >
                <Icon name="X" :size="18" />
              </button>
            </div>
          </div>

          <!-- Messages Area -->
          <div ref="chatContainer" class="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px]">
            
            <!-- Model not downloaded -->
            <div v-if="isAvailable && !modelReady && !isPullingModel" class="text-center py-8">
              <Icon name="Download" :size="32" class="text-theme-muted mx-auto mb-3" />
              <p class="text-sm text-theme-secondary mb-3">AI model needs to be downloaded</p>
              <button 
                @click="pullModel" 
                class="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-secondary transition-colors"
              >
                Download Model (~400MB)
              </button>
            </div>

            <!-- Downloading model -->
            <div v-else-if="isPullingModel" class="text-center py-8">
              <div class="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p class="text-sm text-theme-secondary">Downloading AI model...</p>
              <p class="text-xs text-theme-muted mt-1">This may take a few minutes</p>
            </div>

            <!-- Ollama offline -->
            <div v-else-if="!isAvailable" class="text-center py-8">
              <Icon name="WifiOff" :size="32" class="text-theme-muted mx-auto mb-3" />
              <p class="text-sm text-theme-secondary mb-1">AI Assistant is offline</p>
              <p class="text-xs text-theme-muted">Ollama service is not running</p>
            </div>

            <!-- Empty state with suggestions -->
            <template v-else-if="messages.length === 0">
              <div class="text-center py-4">
                <Icon name="MessageSquare" :size="32" class="text-theme-muted mx-auto mb-3" />
                <p class="text-sm text-theme-secondary mb-4">How can I help you?</p>
              </div>
              <div class="space-y-2">
                <button 
                  v-for="prompt in suggestedPrompts" 
                  :key="prompt" 
                  @click="sendMessage(prompt)" 
                  class="w-full text-left px-3 py-2 rounded-lg border border-theme-primary bg-theme-card text-sm text-theme-secondary hover:border-accent/50 hover:bg-theme-tertiary transition-colors"
                >
                  {{ prompt }}
                </button>
              </div>
            </template>

            <!-- Messages -->
            <template v-else>
              <div 
                v-for="(msg, idx) in messages" 
                :key="idx" 
                class="flex gap-3" 
                :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
              >
                <!-- Assistant avatar -->
                <div 
                  v-if="msg.role === 'assistant'" 
                  class="w-7 h-7 rounded-lg bg-accent-muted flex items-center justify-center flex-shrink-0 mt-1"
                >
                  <Icon name="Bot" :size="14" class="text-accent" />
                </div>
                
                <!-- Message bubble -->
                <div class="flex flex-col">
                  <div 
                    class="max-w-[80%] px-3 py-2 rounded-xl text-sm" 
                    :class="[
                      msg.role === 'user' 
                        ? 'bg-accent text-white rounded-br-md' 
                        : 'bg-theme-tertiary text-theme-primary rounded-bl-md', 
                      msg.error ? 'bg-error/20 text-error' : ''
                    ]"
                  >
                    <!-- Loading dots -->
                    <div v-if="msg.loading" class="flex items-center gap-1.5 py-1">
                      <div class="w-1.5 h-1.5 bg-current opacity-60 rounded-full animate-bounce"></div>
                      <div class="w-1.5 h-1.5 bg-current opacity-60 rounded-full animate-bounce" style="animation-delay: 150ms"></div>
                      <div class="w-1.5 h-1.5 bg-current opacity-60 rounded-full animate-bounce" style="animation-delay: 300ms"></div>
                    </div>
                    <!-- User message (plain text) -->
                    <div v-else-if="msg.role === 'user'" class="whitespace-pre-wrap">{{ msg.content }}</div>
                    <!-- Assistant message (with markdown) -->
                    <div v-else class="chat-content" v-html="parseMarkdown(msg.content)"></div>
                  </div>
                  <!-- Sources links -->
                  <div 
                    v-if="msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && !msg.loading" 
                    class="flex flex-wrap gap-1.5 mt-1.5 ml-1"
                  >
                    <span class="text-[10px] text-theme-muted">📚</span>
                    <a 
                      v-for="(source, sIdx) in msg.sources" 
                      :key="sIdx" 
                      :href="source" 
                      class="text-[10px] text-accent hover:text-accent-secondary hover:underline"
                    >
                      {{ getSourceName(source) }}<span v-if="sIdx < msg.sources.length - 1" class="text-theme-muted">,</span>
                    </a>
                  </div>
                </div>
                
                <!-- User avatar -->
                <div 
                  v-if="msg.role === 'user'" 
                  class="w-7 h-7 rounded-lg bg-theme-tertiary flex items-center justify-center flex-shrink-0 mt-1"
                >
                  <Icon name="User" :size="14" class="text-theme-secondary" />
                </div>
              </div>
            </template>
          </div>

          <!-- Input Area -->
          <div class="border-t border-theme-primary p-3 bg-theme-tertiary">
            <div class="flex gap-2">
              <input 
                ref="inputRef" 
                v-model="inputMessage" 
                @keydown="handleKeydown" 
                :disabled="!isAvailable || !modelReady || isLoading" 
                type="text" 
                placeholder="Ask anything about CubeOS..." 
                class="flex-1 px-3 py-2 rounded-xl border border-theme-primary bg-theme-input text-theme-primary placeholder-theme-muted text-sm focus:outline-none focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed" 
              />
              <button 
                @click="sendMessage()" 
                :disabled="!inputMessage.trim() || !isAvailable || !modelReady || isLoading" 
                class="px-3 py-2 rounded-xl bg-accent text-white hover:bg-accent-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Icon :name="isLoading ? 'Loader2' : 'Send'" :size="18" :class="isLoading ? 'animate-spin' : ''" />
              </button>
            </div>
            <p class="text-[10px] text-theme-muted text-center mt-2">
              Powered by Ollama (qwen2.5:0.5b) & ChromaDB
            </p>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active, 
.modal-leave-active { 
  transition: all 0.2s ease; 
}
.modal-enter-from, 
.modal-leave-to { 
  opacity: 0; 
}

/* Chat content markdown styles */
.chat-content {
  line-height: 1.6;
  word-wrap: break-word;
}

.chat-content :deep(strong) {
  font-weight: 600;
}

.chat-content :deep(em) {
  font-style: italic;
}

.chat-content :deep(.inline-code) {
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
  font-size: 0.85em;
  background: rgba(0, 0, 0, 0.2);
  padding: 0.1em 0.4em;
  border-radius: 4px;
}

.chat-content :deep(.chat-link) {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.chat-content :deep(.chat-link:hover) {
  opacity: 0.8;
}

.chat-content :deep(br) {
  display: block;
  content: "";
  margin-top: 0.4em;
}
</style>
