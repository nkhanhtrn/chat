import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('../views/LandingPage.vue')
  },
  {
    path: '/notebooks',
    name: 'notebooks',
    component: () => import('../views/NotebooksPage.vue')
  },
  {
    path: '/studio',
    name: 'studio',
    component: () => import('../views/StudioChat.vue')
  },
  {
    path: '/playground',
    name: 'playground',
    component: () => import('../views/PlaygroundChat.vue')
  },
  {
    path: '/calendar',
    name: 'calendar',
    component: () => import('../views/CalendarPage.vue')
  },
  {
    path: '/notebook/:id',
    name: 'notebook',
    component: () => import('../views/ChatView.vue')
  },
  {
    path: '/notebook/:id/q/:questionId',
    name: 'question',
    component: () => import('../views/ChatView.vue')
  }
]

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes
})

export default router
