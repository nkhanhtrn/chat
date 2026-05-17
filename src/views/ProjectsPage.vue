<template>
  <AppLayout storage-key="projects-layout">
    <template #side>
      <div class="side-playground-wrapper"><SideChatPlayground /></div>
    </template>
    <div class="projects-page">
      <div class="projects-header">
        <h1>Projects</h1>
        <div class="header-actions">
          <Button variant="primary" @click="createNewProject">+ New Project</Button>
        </div>
      </div>
      <div class="search-container">
        <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
        </svg>
        <input v-model="searchQuery" type="text" class="search-input" placeholder="Search projects..." />
      </div>
      <SlideTransition appear direction="vertical">
        <div class="projects-grid">
          <div
            v-for="project in filteredProjects"
            :key="project.id"
            class="project-card"
            @click="openProject(project.id)"
          >
            <div class="project-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
              </svg>
            </div>
            <div class="project-info">
              <InlineEdit
                class="project-title"
                textClass="project-title-text"
                inputClass="project-title-input"
                :modelValue="project.name"
                @save="(newName: string) => renameProject(project.id, newName)"
              />
              <div class="project-meta">
                <span>{{ project.subprojects.length }} subproject{{ project.subprojects.length === 1 ? '' : 's' }}</span>
                <span class="separator">•</span>
                <span>{{ formatDate(project.updatedAt) }}</span>
              </div>
            </div>
            <button class="delete-btn" @click.stop="deleteProject(project.id)" title="Delete">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
          <div v-if="filteredProjects.length === 0" class="empty-state">
            <div class="empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
              </svg>
            </div>
            <p v-if="searchQuery">No projects match your search</p>
            <template v-else>
              <p>No projects yet</p>
              <p class="empty-hint">Create your first project to get started</p>
            </template>
          </div>
        </div>
      </SlideTransition>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useProjectStore } from '@/stores/project'
import AppLayout from '@/components/AppLayout.vue'
import Button from '@/components/Button.vue'
import SideChatPlayground from '@/components/SideChatPlayground.vue'
import SlideTransition from '@/components/SlideTransition.vue'
import InlineEdit from '@/components/InlineEdit.vue'

const router = useRouter()
const projectStore = useProjectStore()
const searchQuery = ref('')

const filteredProjects = computed(() => {
  if (!searchQuery.value.trim()) return projectStore.projectList
  const query = searchQuery.value.toLowerCase()
  return projectStore.projectList.filter(p => p.name.toLowerCase().includes(query))
})

function formatDate(timestamp: number): string {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function createNewProject() {
  const project = projectStore.createProject()
  projectStore.switchToProject(project.id)
  const subId = project.activeSubprojectId
  router.push({ name: 'project-subproject', params: { id: project.id, subId } })
}

function openProject(id: string) {
  const project = projectStore.projects.find(p => p.id === id)
  if (!project) return
  projectStore.switchToProject(id)
  const subId = project.activeSubprojectId
  router.push({ name: 'project-subproject', params: { id, subId } })
}

function deleteProject(id: string) {
  if (confirm('Are you sure you want to delete this project?')) {
    projectStore.deleteProject(id)
  }
}

function renameProject(id: string, newName: string) {
  if (newName.trim()) {
    projectStore.renameProject(id, newName.trim())
  }
}
</script>

<style scoped>
.side-playground-wrapper { height: 100%; }
.projects-page { height: 100%; overflow-y: auto; background-color: var(--color-bg-base); padding: 2rem; }
.projects-header { display: flex; justify-content: space-between; align-items: center; max-width: 1200px; margin: 0 auto 2rem; padding-bottom: 1rem; border-bottom: 1px solid var(--color-border-base); }
.header-actions { display: flex; gap: 0.5rem; align-items: center; }
.projects-header h1 { font-family: Georgia, serif; font-size: 2rem; font-weight: 400; color: var(--color-text-message); margin: 0; }
.search-container { display: flex; align-items: center; gap: 0.75rem; max-width: 1200px; margin: 0 auto 1.5rem; padding: 0.75rem 1rem; background: var(--color-bg-page); border: 1px solid var(--color-border-base); border-radius: 8px; }
.search-icon { width: 18px; height: 18px; color: var(--color-text-muted); flex-shrink: 0; }
.search-input { flex: 1; border: none; background: transparent; font-family: inherit; font-size: 0.95rem; color: var(--color-text-base); outline: none; }
.search-input::placeholder { color: var(--color-text-muted); }
.projects-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1rem; max-width: 1200px; margin: 0 auto; }
.project-card { display: flex; align-items: center; gap: 1rem; padding: 1.25rem; background: var(--color-bg-page); border: 1px solid var(--color-border-base); border-radius: 8px; cursor: pointer; transition: all 0.2s; position: relative; }
.project-card:hover { border-color: var(--color-border-accent); box-shadow: 0 4px 12px var(--shadow-primary); transform: translateY(-2px); }
.project-icon { color: var(--color-text-muted); flex-shrink: 0; opacity: 0.6; }
.project-title { font-family: Georgia, serif; font-size: 1.05rem; font-weight: 500; color: var(--color-text-message); margin: 0 0 0.35rem; }
.project-title :deep(.project-title-text) { font-family: Georgia, serif; font-size: 1.05rem; font-weight: 500; cursor: inherit; }
.project-title :deep(.project-title-input) { font-family: Georgia, serif; font-size: 1.05rem; font-weight: 500; width: 100%; padding: 2px 4px; }
.project-title :deep(.inline-edit-wrapper) { width: 100%; }
.project-meta { font-size: 0.8rem; color: var(--color-text-muted); display: flex; align-items: center; gap: 0.4rem; }
.separator { opacity: 0.5; }
.project-info { flex: 1; min-width: 0; }
.delete-btn { position: absolute; top: 0.5rem; right: 0.5rem; display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border: none; background: transparent; color: var(--color-text-muted); cursor: pointer; border-radius: 4px; opacity: 0; transition: opacity 0.2s; }
.project-card:hover .delete-btn { opacity: 0.6; }
.delete-btn:hover { opacity: 1 !important; background: var(--color-error-bg); color: var(--color-error-text); }
.empty-state { grid-column: 1 / -1; text-align: center; padding: 4rem 2rem; color: var(--color-text-muted); }
.empty-icon { opacity: 0.3; margin-bottom: 1rem; }
.empty-hint { font-size: 0.9rem; font-style: italic; }
@media (max-width: 768px) { .projects-page { padding: 1rem; } .projects-grid { grid-template-columns: 1fr; } .delete-btn { opacity: 1; } }
</style>
