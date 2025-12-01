import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('../views/HomePage.vue')
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
