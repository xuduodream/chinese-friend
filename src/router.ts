import { createRouter, createWebHistory } from 'vue-router'
import CaptureView from './views/CaptureView.vue'
import ReviewView from './views/ReviewView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'capture', component: CaptureView },
    { path: '/review', name: 'review', component: ReviewView }
  ]
})
