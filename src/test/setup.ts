import { vi, beforeEach } from 'vitest'
import { config } from '@vue/test-utils'

if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {}
  globalThis.localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = String(value) },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { for (const k of Object.keys(store)) delete store[k] },
    get length() { return Object.keys(store).length },
    key: (index: number) => Object.keys(store)[index] ?? null,
  }
}

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

vi.mock('@/services/auth', () => ({
  signInUser: vi.fn(),
  signOutUser: vi.fn(),
  getCurrentUser: vi.fn(() => null),
  onAuthChange: vi.fn(() => () => {}),
}))

vi.mock('@/services/llm/providers/opencode', () => ({
  openCodeProvider: {
    createSession: vi.fn().mockResolvedValue('mock-session-id'),
    deleteSession: vi.fn().mockResolvedValue(undefined),
    send: vi.fn().mockResolvedValue('Mocked response'),
    sendStream: vi.fn(),
    invalidateClient: vi.fn(),
  },
}))

vi.mock('@/services/llm/providers/openrouter', () => ({
  openRouterProvider: {
    isConfigured: vi.fn(() => false),
    send: vi.fn(),
    sendStream: vi.fn(),
  },
}))

beforeEach(() => {
  localStorage?.clear()
})
