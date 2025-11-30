import { createRouter, createWebHistory } from 'vue-router'
import HomePage from '../views/HomePage.vue'
import ChatView from '../views/ChatView.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomePage
  },
  {
    path: '/notebook/:id',
    name: 'notebook',
    component: ChatView
  }
]

const router = createRouter({
  history: createWebHistory('/chat/'),
  routes
})

export default router
