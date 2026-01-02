/**
 * Vitest setup file
 * Mocks external services to prevent network requests during tests
 */
import { vi } from 'vitest'
import { config } from '@vue/test-utils'

// Provide a mock router globally to suppress "injection not found" warnings
config.global.mocks = {
  ...config.global.mocks,
  $router: {
    push: vi.fn(),
    replace: vi.fn(),
    go: vi.fn(),
    back: vi.fn(),
    forward: vi.fn()
  },
  $route: {
    path: '/',
    params: {},
    query: {}
  }
}

// Mock useRouter and useRoute for Composition API
vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useRouter: () => ({
      push: vi.fn(),
      replace: vi.fn(),
      go: vi.fn(),
      back: vi.fn(),
      forward: vi.fn()
    }),
    useRoute: () => ({
      path: '/',
      params: {},
      query: {}
    })
  }
})

// Mock the LLM provider to prevent connection attempts to localhost:1234
vi.mock('./services/llm/providers/lmstudio.js', () => ({
  lmstudioProvider: {
    id: 'lmstudio',
    name: 'LM Studio',
    requiresApiKey: false,
    defaultBaseUrl: 'http://localhost:1234',
    fetchModels: vi.fn().mockResolvedValue([]),
    sendMessage: vi.fn().mockResolvedValue('Mocked response'),
    testConnection: vi.fn().mockResolvedValue(false)
  },
  default: {
    id: 'lmstudio',
    name: 'LM Studio',
    requiresApiKey: false,
    defaultBaseUrl: 'http://localhost:1234',
    fetchModels: vi.fn().mockResolvedValue([]),
    sendMessage: vi.fn().mockResolvedValue('Mocked response'),
    testConnection: vi.fn().mockResolvedValue(false)
  }
}))

// Note: useToolInstanceStore mock removed - the test file tests the real implementation
