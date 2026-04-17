/**
 * Vitest setup file
 * Mocks external services to prevent network requests during tests
 */
import { vi, beforeEach } from 'vitest'
import { config } from '@vue/test-utils'

// Provide a mock router globally
config.global.mocks = {
  ...config.global.mocks,
  $router: {
    push: vi.fn(),
    replace: vi.fn(),
    go: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  },
  $route: {
    path: '/',
    params: {},
    query: {},
  },
}

// Mock useRouter and useRoute for Composition API
vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>
  return {
    ...actual,
    useRouter: () => ({
      push: vi.fn(),
      replace: vi.fn(),
      go: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
    }),
    useRoute: () => ({
      path: '/',
      params: {},
      query: {},
    }),
  }
})

// Mock LLM providers to prevent connection attempts
vi.mock('@/services/llm/providers/lmstudio', () => ({
  lmstudioProvider: {
    id: 'lmstudio',
    name: 'LM Studio',
    category: 'free',
    requiresApiKey: false,
    supportsStreaming: true,
    defaultBaseUrl: 'http://localhost:1234',
    getDefaultModel: () => 'default-model',
    send: vi.fn().mockResolvedValue({ content: 'Mocked response' }),
    sendStream: vi.fn(),
    listModels: vi.fn().mockResolvedValue([]),
  },
}))

vi.mock('@/services/llm/providers/cerebras', () => ({
  cerebrasProvider: {
    id: 'cerebras',
    name: 'Cerebras',
    category: 'quick',
    requiresApiKey: true,
    supportsStreaming: true,
    defaultBaseUrl: 'https://api.cerebras.ai/v1',
    getDefaultModel: () => 'default-model',
    send: vi.fn().mockResolvedValue({ content: 'Mocked response' }),
    sendStream: vi.fn(),
    listModels: vi.fn().mockResolvedValue([]),
  },
}))

vi.mock('@/services/llm/providers/google', () => ({
  googleProvider: {
    id: 'google',
    name: 'Google AI',
    category: 'details',
    requiresApiKey: true,
    supportsStreaming: true,
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    getDefaultModel: () => 'default-model',
    send: vi.fn().mockResolvedValue({ content: 'Mocked response' }),
    sendStream: vi.fn(),
    listModels: vi.fn().mockResolvedValue([]),
  },
}))

vi.mock('@/services/llm/providers/codeapi', () => ({
  codeApiProvider: {
    id: 'codeapi',
    name: 'Code API',
    category: 'reasoning',
    requiresApiKey: false,
    supportsStreaming: true,
    defaultBaseUrl: '',
    getDefaultModel: () => 'default-model',
    send: vi.fn().mockResolvedValue({ content: 'Mocked response' }),
    sendStream: vi.fn(),
    listModels: vi.fn().mockResolvedValue([]),
  },
}))

// Mock Firebase auth
vi.mock('@/services/auth', () => ({
  signInUser: vi.fn(),
  signUpUser: vi.fn(),
  signOutUser: vi.fn(),
  getCurrentUser: vi.fn(() => null),
  onAuthChange: vi.fn(() => () => {}),
}))

// Clear localStorage between tests
beforeEach(() => {
  localStorage.clear()
})
