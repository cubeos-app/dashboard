<script setup>
/**
 * DocsView.vue
 * 
 * Documentation browser for CubeOS built-in docs.
 * 
 * Fetches docs from the cubeos-docsindex service via same-origin
 * NPM location routing: /api/v1/docs/* → port 6032 (docsindex)
 */
import { ref, onMounted, watch, computed, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/api/client'
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
const docsAvailable = ref(true)

// Detect if on mobile
const isMobile = ref(window.innerWidth < 768)

function handleResize() {
  const wasMobile = isMobile.value
  isMobile.value = window.innerWidth < 768
  
  if (isMobile.value && !wasMobile) {
    isSidebarOpen.value = false
  } else if (!isMobile.value && wasMobile) {
    isSidebarOpen.value = true
  }
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
  if (isMobile.value) {
    isSidebarOpen.value = false
  }
  fetchDocsTree()
  fetchDoc(currentPath.value)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (searchTimeout) clearTimeout(searchTimeout)
})

// Get current doc path from route
const currentPath = computed(() => {
  const pathMatch = route.params.pathMatch
  if (!pathMatch || pathMatch.length === 0) {
    return 'README'
  }
  return Array.isArray(pathMatch) ? pathMatch.join('/') : pathMatch
})

// Fetch docs tree structure
async function fetchDocsTree() {
  try {
    const data = await api.get('/documentation/tree')
    docsTree.value = data || []
    docsAvailable.value = docsTree.value.length > 0
  } catch (e) {
    docsAvailable.value = false
    docsTree.value = []
  }
}

// Fetch a specific document
async function fetchDoc(path) {
  isLoading.value = true
  error.value = null
  
  try {
    currentDoc.value = await api.get(`/documentation/${path}`)
  } catch (e) {
    if (e.message && e.message.includes('404')) {
      error.value = 'not_found'
    } else {
      error.value = 'load_failed'
    }
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
    const data = await api.get('/documentation/search', { q: searchQuery.value })
    searchResults.value = data || []
  } catch (e) {
    // Search failed silently
  }
}

// Navigate to a doc
function navigateTo(path) {
  router.push(`/docs/${path}`)
  searchQuery.value = ''
  searchResults.value = []
  if (isMobile.value) {
    isSidebarOpen.value = false
  }
}

// Render markdown to HTML
function renderMarkdown(content) {
  if (!content) return ''
  
  // Extract tables first, replace with placeholders
  const tablePlaceholders = []
  content = content.replace(
    /((?:^\|.+\|[ \t]*\n)+)/gm,
    (tableBlock) => {
      const rows = tableBlock.trim().split('\n').filter(r => r.trim())
      if (rows.length < 2) return tableBlock
      
      const isSeparator = /^\|[\s:]*-+[\s:]*(\|[\s:]*-+[\s:]*)*\|?$/.test(rows[1].trim())
      if (!isSeparator) return tableBlock
      
      const parseRow = (row) => row.replace(/^\||\|$/g, '').split('|').map(c => c.trim())
      const escapeCell = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      
      const headers = parseRow(rows[0])
      const dataRows = rows.slice(2)
      
      let html = '<div class="table-wrapper"><table class="doc-table"><thead><tr>'
      headers.forEach(h => { html += `<th>${escapeCell(h)}</th>` })
      html += '</tr></thead><tbody>'
      dataRows.forEach(row => {
        const cells = parseRow(row)
        html += '<tr>'
        cells.forEach(c => { html += `<td>${escapeCell(c)}</td>` })
        html += '</tr>'
      })
      html += '</tbody></table></div>'
      
      const placeholder = `%%TABLE_${tablePlaceholders.length}%%`
      tablePlaceholders.push(html)
      return placeholder
    }
  )
  
  let result = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="code-block"><code>$2</code></pre>')
    .replace(/^#### (.+)$/gm, '<h4 class="doc-h4">$1</h4>')
    .replace(/^### (.+)$/gm, '<h3 class="doc-h3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="doc-h2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="doc-h1">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/_([^_\n]+)_/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => {
      const isSafe = /^(https?:\/\/|\/|#|mailto:)/.test(url.trim())
      return isSafe
        ? `<a href="${url}" target="_blank" rel="noopener" class="doc-link">${text}</a>`
        : `<span class="doc-link">${text}</span>`
    })
    .replace(/^- (.+)$/gm, '<li class="doc-li">$1</li>')
    .replace(/(<li.*<\/li>\n?)+/g, '<ul class="doc-ul">$&</ul>')
    .replace(/^\d+\. (.+)$/gm, '<li class="doc-li-ordered">$1</li>')
    .replace(/^---$/gm, '<hr class="doc-hr">')
    .replace(/\n\n/g, '</p><p class="doc-p">')
    .replace(/\n/g, '<br>')
  
  // Restore table placeholders
  tablePlaceholders.forEach((html, i) => {
    result = result.replace(`%%TABLE_${i}%%`, html)
  })
  
  return result
}

// Watch for route changes
watch(currentPath, (newPath) => {
  if (docsAvailable.value) {
    fetchDoc(newPath)
  }
})

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

function isActive(path) {
  return currentPath.value === path
}

function toggleSidebar() {
  isSidebarOpen.value = !isSidebarOpen.value
}

function closeSidebar() {
  if (isMobile.value) {
    isSidebarOpen.value = false
  }
}
</script>

<template>
  <div class="relative bg-theme-primary">
    <!-- Mobile overlay -->
    <Transition name="fade">
      <div 
        v-if="isSidebarOpen && isMobile"
        class="fixed inset-0 bg-theme-overlay z-40"
        @click="closeSidebar"
      ></div>
    </Transition>

    <div class="flex min-h-[calc(100vh-3.5rem)]">
      <!-- Sidebar -->
      <aside 
        class="fixed md:relative z-50 md:z-auto w-72 md:w-64 h-[calc(100vh-3.5rem)] bg-theme-secondary border-r border-theme-primary overflow-y-auto flex-shrink-0 transition-transform duration-200"
        :class="[
          isMobile && !isSidebarOpen ? '-translate-x-full' : 'translate-x-0'
        ]"
      >
        <div class="p-4">
          <!-- Mobile close button -->
          <div class="flex items-center justify-between mb-4 md:hidden">
            <h2 class="font-semibold text-theme-primary">Documentation</h2>
            <button 
              @click="closeSidebar"
              class="p-2 rounded-lg hover:bg-theme-tertiary text-theme-muted"
              aria-label="Close documentation sidebar"
            >
              <Icon name="X" :size="20" />
            </button>
          </div>

          <!-- Search -->
          <div class="relative mb-4">
            <Icon name="Search" :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search docs..."
              aria-label="Search documentation"
              class="w-full pl-9 pr-3 py-2.5 rounded-lg border border-theme-primary bg-theme-input text-theme-primary placeholder-theme-muted text-sm focus:outline-none focus:border-accent"
              :disabled="!docsAvailable"
            />
          </div>

          <!-- Search Results -->
          <div v-if="searchResults.length > 0" class="mb-4 space-y-1">
            <p class="text-xs text-theme-muted mb-2">Search Results</p>
            <button
              v-for="result in searchResults"
              :key="result.path"
              @click="navigateTo(result.path)"
              class="w-full text-left px-3 py-2.5 rounded-lg text-sm hover:bg-theme-tertiary transition-colors"
              :class="isActive(result.path) ? 'bg-accent-muted text-accent' : 'text-theme-secondary'"
              :aria-label="'Go to ' + result.title"
              :aria-current="isActive(result.path) ? 'page' : undefined"
            >
              {{ result.title }}
            </button>
          </div>

          <!-- Tree Navigation -->
          <nav v-else-if="docsAvailable && docsTree.length > 0" class="space-y-1" aria-label="Documentation navigation">
            <template v-for="item in docsTree" :key="item.path">
              <div v-if="item.is_dir" class="mb-3">
                <p class="px-3 py-1 text-xs font-medium text-theme-muted uppercase tracking-wide">
                  {{ item.title }}
                </p>
                <div class="space-y-0.5 mt-1">
                  <button
                    v-for="child in item.children"
                    :key="child.path"
                    @click="navigateTo(child.path)"
                    class="w-full text-left px-3 py-2.5 rounded-lg text-sm hover:bg-theme-tertiary transition-colors"
                    :class="isActive(child.path) ? 'bg-accent-muted text-accent font-medium' : 'text-theme-secondary'"
                    :aria-label="child.title"
                    :aria-current="isActive(child.path) ? 'page' : undefined"
                  >
                    {{ child.title }}
                  </button>
                </div>
              </div>
              <button
                v-else
                @click="navigateTo(item.path)"
                class="w-full text-left px-3 py-2.5 rounded-lg text-sm hover:bg-theme-tertiary transition-colors"
                :class="isActive(item.path) ? 'bg-accent-muted text-accent font-medium' : 'text-theme-secondary'"
                :aria-label="item.title"
                :aria-current="isActive(item.path) ? 'page' : undefined"
              >
                {{ item.title }}
              </button>
            </template>
          </nav>

          <!-- No docs available message -->
          <div v-else class="text-center py-8">
            <Icon name="BookOpen" :size="32" class="text-theme-muted mx-auto mb-2" />
            <p class="text-sm text-theme-muted">No documentation available</p>
          </div>
        </div>
      </aside>

      <!-- Content -->
      <main class="flex-1 min-w-0 overflow-y-auto">
        <!-- Mobile header with menu button -->
        <div class="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-theme-secondary/95 backdrop-blur border-b border-theme-primary md:hidden">
          <button 
            @click="toggleSidebar"
            class="p-2 -ml-2 rounded-lg hover:bg-theme-tertiary text-theme-secondary"
            aria-label="Open documentation sidebar"
          >
            <Icon name="Menu" :size="20" />
          </button>
          <h1 class="font-medium text-theme-primary truncate">
            {{ currentDoc?.title || 'Documentation' }}
          </h1>
        </div>

        <div class="px-4 md:px-8 py-6 md:py-8 max-w-4xl">
          <!-- Loading -->
          <div v-if="isLoading" class="flex items-center justify-center py-12">
            <div class="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
          </div>

          <!-- Docs not available (API doesn't have docs endpoint) -->
          <div v-else-if="!docsAvailable" class="text-center py-12">
            <Icon name="BookX" :size="48" class="text-theme-muted mx-auto mb-4" />
            <h2 class="text-lg font-semibold text-theme-primary mb-2">Documentation Not Available</h2>
            <p class="text-theme-secondary text-sm mb-4 max-w-md mx-auto">
              Built-in documentation is not configured for this CubeOS installation. 
              You can access API documentation directly.
            </p>
            <div class="flex items-center justify-center gap-3">
              <a
                href="/api/v1/swagger/index.html"
                target="_blank"
                rel="noopener"
                class="px-4 py-2 rounded-lg bg-accent text-on-accent text-sm hover:bg-accent-secondary transition-colors"
              >
                View API Docs
              </a>
              <router-link
                to="/"
                class="px-4 py-2 rounded-lg border border-theme-primary text-theme-secondary text-sm hover:bg-theme-tertiary transition-colors"
              >
                Go to Dashboard
              </router-link>
            </div>
          </div>

          <!-- Document not found -->
          <div v-else-if="error === 'not_found'" class="text-center py-12">
            <Icon name="FileX" :size="48" class="text-theme-muted mx-auto mb-4" />
            <p class="text-theme-secondary mb-4">Document not found</p>
            <button
              @click="navigateTo('README')"
              class="px-4 py-2 rounded-lg bg-accent text-on-accent text-sm hover:bg-accent-secondary transition-colors"
            >
              Go to Home
            </button>
          </div>

          <!-- Other errors -->
          <div v-else-if="error" class="text-center py-12">
            <Icon name="AlertCircle" :size="48" class="text-theme-muted mx-auto mb-4" />
            <p class="text-theme-secondary">Failed to load document</p>
            <button
              @click="fetchDoc(currentPath)"
              class="mt-4 px-4 py-2 rounded-lg bg-accent text-on-accent text-sm hover:bg-accent-secondary transition-colors"
            >
              Try Again
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
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.doc-content {
  @apply text-theme-primary leading-relaxed text-sm md:text-base;
}

.doc-content :deep(.doc-h1) {
  @apply text-2xl md:text-3xl font-bold mb-4 md:mb-6 pb-2 border-b border-theme-primary;
}

.doc-content :deep(.doc-h2) {
  @apply text-xl md:text-2xl font-semibold mt-6 md:mt-8 mb-3 md:mb-4;
}

.doc-content :deep(.doc-h3) {
  @apply text-lg md:text-xl font-semibold mt-4 md:mt-6 mb-2 md:mb-3;
}

.doc-content :deep(.doc-h4) {
  @apply text-base md:text-lg font-medium mt-3 md:mt-4 mb-2;
}

.doc-content :deep(.doc-p) {
  @apply mb-3 md:mb-4;
}

.doc-content :deep(.doc-ul) {
  @apply list-disc list-inside mb-3 md:mb-4 space-y-1;
}

.doc-content :deep(.doc-li) {
  @apply text-theme-secondary;
}

.doc-content :deep(.doc-li-ordered) {
  @apply text-theme-secondary;
}

.doc-content :deep(.doc-hr) {
  @apply my-6 md:my-8 border-theme-primary;
}

.doc-content :deep(.doc-link) {
  @apply text-accent hover:text-accent-secondary underline underline-offset-2;
}

.doc-content :deep(.inline-code) {
  @apply font-mono text-xs md:text-sm bg-theme-tertiary px-1.5 py-0.5 rounded break-all;
}

.doc-content :deep(.code-block) {
  @apply bg-theme-tertiary rounded-lg p-3 md:p-4 mb-3 md:mb-4 overflow-x-auto text-xs md:text-sm;
}

.doc-content :deep(.code-block code) {
  @apply font-mono text-theme-primary;
}

.doc-content :deep(strong) {
  @apply font-semibold;
}

.doc-content :deep(em) {
  @apply italic;
}

.doc-content :deep(.table-wrapper) {
  @apply overflow-x-auto mb-4 rounded-lg border border-theme-primary;
}

.doc-content :deep(.doc-table) {
  @apply w-full text-sm border-collapse;
}

.doc-content :deep(.doc-table th) {
  @apply px-3 py-2 text-left font-semibold bg-theme-tertiary border-b border-theme-primary text-theme-primary whitespace-nowrap;
}

.doc-content :deep(.doc-table td) {
  @apply px-3 py-2 border-b border-theme-primary text-theme-secondary;
}

.doc-content :deep(.doc-table tbody tr:last-child td) {
  @apply border-b-0;
}

.doc-content :deep(.doc-table tbody tr:hover) {
  @apply bg-theme-tertiary;
}
</style>
