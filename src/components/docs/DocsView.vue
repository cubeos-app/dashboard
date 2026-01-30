<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Icon from '@/components/ui/Icon.vue'

const route = useRoute()
const router = useRouter()

const docsTree = ref([])
const currentDoc = ref(null)
const searchQuery = ref('')
const searchResults = ref([])
const isLoading = ref(false)
const isSidebarOpen = ref(true)
const error = ref(null)

// Get current doc path from route
const currentPath = computed(() => {
  return route.params.pathMatch?.join('/') || 'README'
})

// Fetch docs tree structure
async function fetchDocsTree() {
  try {
    const token = localStorage.getItem('cubeos_access_token')
    const resp = await fetch('/api/v1/documentation/tree', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (resp.ok) {
      docsTree.value = await resp.json()
    }
  } catch (e) {
    console.error('Failed to load docs tree:', e)
  }
}

// Fetch a specific document
async function fetchDoc(path) {
  isLoading.value = true
  error.value = null
  
  try {
    const token = localStorage.getItem('cubeos_access_token')
    const resp = await fetch(`/api/v1/documentation/${path}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    
    if (resp.ok) {
      currentDoc.value = await resp.json()
    } else if (resp.status === 404) {
      error.value = 'Document not found'
      currentDoc.value = null
    } else {
      error.value = 'Failed to load document'
      currentDoc.value = null
    }
  } catch (e) {
    error.value = 'Failed to connect to API'
    currentDoc.value = null
  } finally {
    isLoading.value = false
  }
}

// Search docs
async function searchDocs() {
  if (!searchQuery.value.trim()) {
    searchResults.value = []
    return
  }
  
  try {
    const token = localStorage.getItem('cubeos_access_token')
    const resp = await fetch(`/api/v1/documentation/search?q=${encodeURIComponent(searchQuery.value)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (resp.ok) {
      searchResults.value = await resp.json()
    }
  } catch (e) {
    console.error('Search failed:', e)
  }
}

// Navigate to a doc
function navigateTo(path) {
  router.push(`/docs/${path}`)
  searchQuery.value = ''
  searchResults.value = []
}

// Render markdown to HTML
function renderMarkdown(content) {
  if (!content) return ''
  
  return content
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Code blocks (must be before inline code)
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="code-block"><code>$2</code></pre>')
    // Headers
    .replace(/^#### (.+)$/gm, '<h4 class="doc-h4">$1</h4>')
    .replace(/^### (.+)$/gm, '<h3 class="doc-h3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="doc-h2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="doc-h1">$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/_([^_\n]+)_/g, '<em>$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="doc-link">$1</a>')
    // Unordered lists
    .replace(/^- (.+)$/gm, '<li class="doc-li">$1</li>')
    .replace(/(<li.*<\/li>\n?)+/g, '<ul class="doc-ul">$&</ul>')
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li class="doc-li-ordered">$1</li>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr class="doc-hr">')
    // Paragraphs (line breaks)
    .replace(/\n\n/g, '</p><p class="doc-p">')
    .replace(/\n/g, '<br>')
}

// Watch for route changes
watch(currentPath, (newPath) => {
  fetchDoc(newPath)
}, { immediate: true })

// Debounced search
let searchTimeout = null
watch(searchQuery, (val) => {
  clearTimeout(searchTimeout)
  if (val.trim()) {
    searchTimeout = setTimeout(searchDocs, 300)
  } else {
    searchResults.value = []
  }
})

onMounted(() => {
  fetchDocsTree()
})

// Recursive tree item component
function isActive(path) {
  return currentPath.value === path
}
</script>

<template>
  <div class="flex h-full bg-theme-primary">
    <!-- Sidebar -->
    <aside 
      class="w-64 flex-shrink-0 border-r border-theme-primary bg-theme-secondary overflow-y-auto transition-all duration-300"
      :class="{ '-ml-64': !isSidebarOpen }"
    >
      <div class="p-4">
        <!-- Search -->
        <div class="relative mb-4">
          <Icon name="Search" :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search docs..."
            class="w-full pl-9 pr-3 py-2 rounded-lg border border-theme-primary bg-theme-input text-theme-primary placeholder-theme-muted text-sm focus:outline-none focus:border-accent"
          />
        </div>

        <!-- Search Results -->
        <div v-if="searchResults.length > 0" class="mb-4 space-y-1">
          <p class="text-xs text-theme-muted mb-2">Search Results</p>
          <button
            v-for="result in searchResults"
            :key="result.path"
            @click="navigateTo(result.path)"
            class="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-theme-tertiary transition-colors"
            :class="isActive(result.path) ? 'bg-accent-muted text-accent' : 'text-theme-secondary'"
          >
            {{ result.title }}
          </button>
        </div>

        <!-- Tree Navigation -->
        <nav v-else class="space-y-1">
          <template v-for="item in docsTree" :key="item.path">
            <!-- Directory -->
            <div v-if="item.is_dir" class="mb-2">
              <p class="px-3 py-1 text-xs font-medium text-theme-muted uppercase tracking-wide">
                {{ item.title }}
              </p>
              <div class="space-y-0.5">
                <button
                  v-for="child in item.children"
                  :key="child.path"
                  @click="navigateTo(child.path)"
                  class="w-full text-left px-3 py-1.5 rounded-lg text-sm hover:bg-theme-tertiary transition-colors"
                  :class="isActive(child.path) ? 'bg-accent-muted text-accent font-medium' : 'text-theme-secondary'"
                >
                  {{ child.title }}
                </button>
              </div>
            </div>
            <!-- File at root level -->
            <button
              v-else
              @click="navigateTo(item.path)"
              class="w-full text-left px-3 py-1.5 rounded-lg text-sm hover:bg-theme-tertiary transition-colors"
              :class="isActive(item.path) ? 'bg-accent-muted text-accent font-medium' : 'text-theme-secondary'"
            >
              {{ item.title }}
            </button>
          </template>
        </nav>
      </div>
    </aside>

    <!-- Toggle sidebar button (mobile) -->
    <button
      @click="isSidebarOpen = !isSidebarOpen"
      class="fixed bottom-4 left-4 z-10 p-2 rounded-full bg-accent text-white shadow-lg md:hidden"
    >
      <Icon :name="isSidebarOpen ? 'PanelLeftClose' : 'PanelLeft'" :size="20" />
    </button>

    <!-- Content -->
    <main class="flex-1 overflow-y-auto">
      <div class="max-w-4xl mx-auto px-6 py-8">
        <!-- Loading -->
        <div v-if="isLoading" class="flex items-center justify-center py-12">
          <div class="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
        </div>

        <!-- Error -->
        <div v-else-if="error" class="text-center py-12">
          <Icon name="FileX" :size="48" class="text-theme-muted mx-auto mb-4" />
          <p class="text-theme-secondary">{{ error }}</p>
          <button
            @click="navigateTo('README')"
            class="mt-4 px-4 py-2 rounded-lg bg-accent text-white text-sm hover:bg-accent-secondary transition-colors"
          >
            Go to Home
          </button>
        </div>

        <!-- Document content -->
        <article v-else-if="currentDoc" class="doc-content">
          <div v-html="renderMarkdown(currentDoc.content)"></div>
        </article>

        <!-- Empty state -->
        <div v-else class="text-center py-12">
          <Icon name="BookOpen" :size="48" class="text-theme-muted mx-auto mb-4" />
          <p class="text-theme-secondary">Select a document from the sidebar</p>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
/* Document styles */
.doc-content {
  @apply text-theme-primary leading-relaxed;
}

.doc-content :deep(.doc-h1) {
  @apply text-3xl font-bold mb-6 pb-2 border-b border-theme-primary;
}

.doc-content :deep(.doc-h2) {
  @apply text-2xl font-semibold mt-8 mb-4;
}

.doc-content :deep(.doc-h3) {
  @apply text-xl font-semibold mt-6 mb-3;
}

.doc-content :deep(.doc-h4) {
  @apply text-lg font-medium mt-4 mb-2;
}

.doc-content :deep(.doc-p) {
  @apply mb-4;
}

.doc-content :deep(.doc-ul) {
  @apply list-disc list-inside mb-4 space-y-1;
}

.doc-content :deep(.doc-li) {
  @apply text-theme-secondary;
}

.doc-content :deep(.doc-li-ordered) {
  @apply text-theme-secondary;
}

.doc-content :deep(.doc-hr) {
  @apply my-8 border-theme-primary;
}

.doc-content :deep(.doc-link) {
  @apply text-accent hover:text-accent-secondary underline underline-offset-2;
}

.doc-content :deep(.inline-code) {
  @apply font-mono text-sm bg-theme-tertiary px-1.5 py-0.5 rounded;
}

.doc-content :deep(.code-block) {
  @apply bg-theme-tertiary rounded-lg p-4 mb-4 overflow-x-auto;
}

.doc-content :deep(.code-block code) {
  @apply font-mono text-sm text-theme-primary;
}

.doc-content :deep(strong) {
  @apply font-semibold;
}

.doc-content :deep(em) {
  @apply italic;
}
</style>
