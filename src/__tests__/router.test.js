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

    it('should have correct number of routes', () => {
      const routes = router.getRoutes()
      expect(routes.length).toBe(2)
    })
  })

  describe('Base Path', () => {
    it('should use /chat as base path', () => {
      // The router history base is set during creation
      // Vue Router normalizes the base path without trailing slash
      expect(router.options.history.base).toBe('/chat')
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
  })
})
