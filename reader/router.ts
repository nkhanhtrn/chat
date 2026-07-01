import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'library',
    component: () => import('./views/ReaderLibrary.vue'),
  },
  {
    path: '/:bookId',
    name: 'reader',
    component: () => import('./views/ReaderViewer.vue'),
  },
]

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,
})

export default router
