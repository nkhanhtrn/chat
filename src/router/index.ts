import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/LandingPage.vue')
  },
  {
    path: '/notebooks',
    name: 'notebooks',
    component: () => import('@/views/NotebooksPage.vue')
  },
  {
    path: '/projects',
    name: 'projects',
    component: () => import('@/views/ProjectsPage.vue')
  },
  {
    path: '/projects/:id',
    name: 'project-detail',
    component: () => import('@/views/ProjectDetail.vue')
  },
  {
    path: '/projects/:id/sub/:subId',
    name: 'project-subproject',
    component: () => import('@/views/ProjectDetail.vue')
  },
  {
    path: '/calendar',
    name: 'calendar',
    component: () => import('@/views/CalendarPage.vue')
  },
  {
    path: '/books',
    name: 'books',
    component: () => import('@/views/BooksLibrary.vue')
  },
  {
    path: '/books/:bookId',
    name: 'book-viewer',
    component: () => import('@/views/BookViewer.vue')
  },
  {
    path: '/current/:type/:id',
    name: 'current-content',
    component: () => import('@/views/CurrentContentView.vue')
  },
  {
    path: '/current/:type/:id/q/:questionId',
    name: 'current-content-question',
    component: () => import('@/views/CurrentContentView.vue')
  },
  {
    path: '/notebook/:id',
    name: 'notebook',
    component: () => import('@/views/ChatView.vue')
  },
  {
    path: '/notebook/:id/q/:questionId',
    name: 'question',
    component: () => import('@/views/ChatView.vue')
  }
]

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes
})

export default router
