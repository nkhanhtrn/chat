/**
 * Vitest setup file
 * Mocks external services to prevent network requests during tests
 */
import { vi, beforeEach } from 'vitest'
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

// Mock the idb package to avoid IndexedDB in Node.js test environment
// Use in-memory storage to simulate IndexedDB behavior
const idbStores = new Map() // dbName -> storeName -> key -> value

// Clear stores before each test to avoid data leakage between tests
beforeEach(() => {
  idbStores.clear()
})

vi.mock('idb', () => ({
  openDB: vi.fn((dbName, version, options) => {
    // Initialize store if not exists
    if (!idbStores.has(dbName)) {
      idbStores.set(dbName, new Map())
    }
    const db = idbStores.get(dbName)

    // Call upgrade callback if provided
    if (options?.upgrade) {
      // Mock database object for upgrade callback
      const mockDb = {
        objectStoreNames: {
          contains: vi.fn((name) => db.has(name)),
          get length() { return Array.from(db.keys()).length }
        },
        createObjectStore: vi.fn((name) => {
          if (!db.has(name)) {
            db.set(name, new Map())
          }
          // Return mock object store with createIndex method
          return {
            createIndex: vi.fn(),
            transaction: vi.fn()
          }
        })
      }
      options.upgrade(mockDb, 0, version)
    }

    return Promise.resolve({
      get: vi.fn((storeName, key) => {
        return Promise.resolve(db.get(storeName)?.get(key))
      }),
      put: vi.fn((storeName, value, key) => {
        if (!db.has(storeName)) {
          db.set(storeName, new Map())
        }
        db.get(storeName).set(key, value)
        return Promise.resolve()
      }),
      delete: vi.fn((storeName, key) => {
        db.get(storeName)?.delete(key)
        return Promise.resolve()
      }),
      getAll: vi.fn((storeName) => {
        return Promise.resolve(Array.from(db.get(storeName)?.values() || []))
      }),
      getAllKeys: vi.fn((storeName) => {
        return Promise.resolve(Array.from(db.get(storeName)?.keys() || []))
      }),
      close: vi.fn()
    })
  })
}))
