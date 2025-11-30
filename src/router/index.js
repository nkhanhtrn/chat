import { createRouter, createWebHashHistory } from 'vue-router'
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
  },
  {
    path: '/notebook/:id/q/:questionId',
    name: 'question',
    component: ChatView
  }
]

const router = createRouter({
  history: createWebHashHistory('/chat/'),
  routes
})

export default router
