import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useModelSelection } from '../useModelSelection.js'

// Mock the LLM service
vi.mock('../../services/llm/index.js', () => ({
  listProviders: vi.fn(() => [
    { id: 'openai', name: 'OpenAI' },
    { id: 'anthropic', name: 'Anthropic' }
  ]),
  getCurrentProviderId: vi.fn(() => 'openai'),
  getProviderConfig: vi.fn(() => ({ apiKey: 'test-key' })),
  setProvider: vi.fn(),
  fetchModels: vi.fn(() => Promise.resolve([
    { id: 'gpt-4', name: 'GPT-4' },
    { id: 'gpt-3.5', name: 'GPT-3.5' }
  ])),
  fetchAllModels: vi.fn(() => Promise.resolve([
    { id: 'gpt-4', name: 'GPT-4', providerId: 'openai' },
    { id: 'claude-3', name: 'Claude 3', providerId: 'anthropic' },
    { id: 'mistral-7b', name: 'Mistral 7B', providerId: 'lmstudio' }
  ]))
}))

// Mock the taskRouter
vi.mock('../../services/llm/taskRouter.js', () => ({
  findRouterAndExecutorModels: vi.fn((models) => ({
    router: models.find(m => m.id.includes('mistral')) || models[0],
    executor: models.find(m => m.id.includes('gpt')) || models[1] || models[0]
  }))
}))

describe('useModelSelection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize with default values', () => {
    const modelSelection = useModelSelection()

    expect(modelSelection.providers.value).toEqual([])
    expect(modelSelection.models.value).toEqual([])
    expect(modelSelection.allModels.value).toEqual([])
    expect(modelSelection.twoModelMode.value).toBe(true)
    expect(modelSelection.selectedModel.value).toBe('')
    expect(modelSelection.routerModel.value).toBe('')
    expect(modelSelection.executorModel.value).toBe('')
  })

  it('should load providers and models on initialize', async () => {
    const modelSelection = useModelSelection()
    await modelSelection.initialize()

    expect(modelSelection.providers.value).toHaveLength(2)
    expect(modelSelection.selectedProvider.value).toBe('openai')
    expect(modelSelection.models.value).toHaveLength(2)
    expect(modelSelection.allModels.value).toHaveLength(3)
  })

  it('should auto-select router and executor models', async () => {
    const modelSelection = useModelSelection()
    await modelSelection.initialize()

    expect(modelSelection.routerModel.value).toBe('mistral-7b')
    expect(modelSelection.executorModel.value).toBe('gpt-4')
  })

  it('should compute isModelReady correctly in two-model mode', async () => {
    const modelSelection = useModelSelection()

    // Initially not ready (empty strings are falsy)
    expect(modelSelection.isModelReady.value).toBeFalsy()

    await modelSelection.initialize()

    expect(modelSelection.isModelReady.value).toBe(true)
  })

  it('should compute isModelReady correctly in single-model mode', async () => {
    const modelSelection = useModelSelection()
    await modelSelection.initialize()

    modelSelection.twoModelMode.value = false
    expect(modelSelection.isModelReady.value).toBe(true)

    modelSelection.selectedModel.value = ''
    expect(modelSelection.isModelReady.value).toBe(false)
  })

  it('should provide model data for router and executor', async () => {
    const modelSelection = useModelSelection()
    await modelSelection.initialize()

    expect(modelSelection.routerModelData.value).toBeDefined()
    expect(modelSelection.routerModelData.value.id).toBe('mistral-7b')
    expect(modelSelection.executorModelData.value).toBeDefined()
    expect(modelSelection.executorModelData.value.id).toBe('gpt-4')
  })

  it('should handle provider change', async () => {
    const { setProvider, fetchModels } = await import('../../services/llm/index.js')

    const modelSelection = useModelSelection()
    await modelSelection.initialize()

    modelSelection.selectedProvider.value = 'anthropic'
    await modelSelection.onProviderChange()

    expect(setProvider).toHaveBeenCalledWith('anthropic', { apiKey: 'test-key' })
    expect(fetchModels).toHaveBeenCalled()
  })

  it('should handle empty model list gracefully', async () => {
    const { fetchModels } = await import('../../services/llm/index.js')
    fetchModels.mockResolvedValueOnce([])

    const modelSelection = useModelSelection()
    await modelSelection.loadModels()

    expect(modelSelection.models.value).toEqual([])
    expect(modelSelection.selectedModel.value).toBe('')
  })

  it('should handle fetch errors gracefully', async () => {
    const { fetchModels } = await import('../../services/llm/index.js')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchModels.mockRejectedValueOnce(new Error('Network error'))

    const modelSelection = useModelSelection()
    await modelSelection.loadModels()

    expect(modelSelection.models.value).toEqual([])
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })
})
