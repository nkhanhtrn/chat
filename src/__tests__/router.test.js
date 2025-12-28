import { describe, it, expect } from 'vitest'
import router from '../router/index.js'

describe('Router Configuration', () => {
  describe('Routes', () => {
    it('should have home route at root path', () => {
      const homeRoute = router.getRoutes().find(r => r.name === 'home')
      expect(homeRoute).toBeDefined()
      expect(homeRoute.path).toBe('/')
    })

    it('should have notebook route with id parameter', () => {
      const notebookRoute = router.getRoutes().find(r => r.name === 'notebook')
      expect(notebookRoute).toBeDefined()
      expect(notebookRoute.path).toBe('/notebook/:id')
    })

    it('should have question route with notebook and question id parameters', () => {
      const questionRoute = router.getRoutes().find(r => r.name === 'question')
      expect(questionRoute).toBeDefined()
      expect(questionRoute.path).toBe('/notebook/:id/q/:questionId')
    })

    it('should have calendar route', () => {
      const calendarRoute = router.getRoutes().find(r => r.name === 'calendar')
      expect(calendarRoute).toBeDefined()
      expect(calendarRoute.path).toBe('/calendar')
    })

    it('should have studio route', () => {
      const studioRoute = router.getRoutes().find(r => r.name === 'studio')
      expect(studioRoute).toBeDefined()
      expect(studioRoute.path).toBe('/studio')
    })

    it('should have playground route', () => {
      const playgroundRoute = router.getRoutes().find(r => r.name === 'playground')
      expect(playgroundRoute).toBeDefined()
      expect(playgroundRoute.path).toBe('/playground')
    })

    it('should have notebooks route', () => {
      const notebooksRoute = router.getRoutes().find(r => r.name === 'notebooks')
      expect(notebooksRoute).toBeDefined()
      expect(notebooksRoute.path).toBe('/notebooks')
    })

    it('should have correct number of routes', () => {
      const routes = router.getRoutes()
      expect(routes.length).toBe(7)
    })
  })

  describe('Base Path', () => {
    it('should use hash history with base from Vite config', () => {
      // The router uses hash history for GitHub Pages compatibility
      // In test environment, BASE_URL is '/', in production it's '/chat/'
      // Hash history base includes the # symbol
      expect(router.options.history.base).toMatch(/^\/#|^\/chat\/#$/)
    })
  })

  describe('Route Resolution', () => {
    it('should resolve home route correctly', () => {
      const resolved = router.resolve('/')
      expect(resolved.name).toBe('home')
    })

    it('should resolve notebook route with id correctly', () => {
      const resolved = router.resolve('/notebook/test-id')
      expect(resolved.name).toBe('notebook')
      expect(resolved.params.id).toBe('test-id')
    })

    it('should resolve notebook route by name with params', () => {
      const resolved = router.resolve({ name: 'notebook', params: { id: 'my-notebook' } })
      expect(resolved.fullPath).toBe('/notebook/my-notebook')
    })

    it('should resolve home route by name', () => {
      const resolved = router.resolve({ name: 'home' })
      expect(resolved.fullPath).toBe('/')
    })

    it('should resolve question route with notebook and question id', () => {
      const resolved = router.resolve('/notebook/test-notebook/q/test-question')
      expect(resolved.name).toBe('question')
      expect(resolved.params.id).toBe('test-notebook')
      expect(resolved.params.questionId).toBe('test-question')
    })

    it('should resolve question route by name with params', () => {
      const resolved = router.resolve({ name: 'question', params: { id: 'my-notebook', questionId: 'my-question' } })
      expect(resolved.fullPath).toBe('/notebook/my-notebook/q/my-question')
    })

    it('should resolve calendar route correctly', () => {
      const resolved = router.resolve('/calendar')
      expect(resolved.name).toBe('calendar')
    })

    it('should resolve calendar route by name', () => {
      const resolved = router.resolve({ name: 'calendar' })
      expect(resolved.fullPath).toBe('/calendar')
    })

    it('should resolve studio route correctly', () => {
      const resolved = router.resolve('/studio')
      expect(resolved.name).toBe('studio')
    })

    it('should resolve studio route by name', () => {
      const resolved = router.resolve({ name: 'studio' })
      expect(resolved.fullPath).toBe('/studio')
    })
  })
})
