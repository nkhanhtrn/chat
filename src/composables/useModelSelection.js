import { ref, computed } from 'vue'
import {
  listProviders,
  getCurrentProviderId,
  getProviderConfig,
  setProvider,
  fetchModels,
  fetchAllModels
} from '../services/llm/index.js'
import { findRouterAndExecutorModels } from '../services/llm/taskRouter.js'

/**
 * Composable for managing model selection state
 * Always uses 2-model mode (router + executor)
 */
export function useModelSelection() {
  // All available models
  const allModels = ref([])

  // Router and executor model selection
  const routerModel = ref('')
  const executorModel = ref('')

  // Legacy compatibility (kept for PlaygroundChat)
  const providers = ref([])
  const selectedProvider = ref('')
  const models = ref([])
  const selectedModel = ref('')
  const twoModelMode = ref(true) // Always true, kept for compatibility

  // Computed: check if model selection is ready
  const isModelReady = computed(() => {
    return routerModel.value && executorModel.value && allModels.value.length > 0
  })

  // Get model data for selected models
  const routerModelData = computed(() =>
    allModels.value.find(m => m.id === routerModel.value)
  )

  const executorModelData = computed(() =>
    allModels.value.find(m => m.id === executorModel.value)
  )

  /**
   * Initialize providers and load models
   */
  async function initialize() {
    providers.value = listProviders()
    selectedProvider.value = getCurrentProviderId()
    await Promise.all([loadModels(), loadAllModels()])
  }

  /**
   * Load models from all providers (for 2-model mode)
   */
  async function loadAllModels() {
    try {
      const modelList = await fetchAllModels()
      allModels.value = modelList

      // Auto-select router and executor models
      if (modelList.length > 0) {
        const { router, executor } = findRouterAndExecutorModels(modelList)
        if (router) {
          routerModel.value = router.id
        } else {
          routerModel.value = modelList[0].id
        }
        if (executor) {
          executorModel.value = executor.id
        } else {
          executorModel.value = modelList.length > 1 ? modelList[1].id : modelList[0].id
        }
      }
    } catch (error) {
      console.error('Failed to load all models:', error)
    }
  }

  /**
   * Load models for current provider (single-model mode)
   */
  async function loadModels() {
    try {
      models.value = []
      const modelList = await fetchModels()
      models.value = modelList
      if (modelList.length > 0) {
        selectedModel.value = modelList[0].id
      }
    } catch (error) {
      console.error('Failed to load models:', error)
      models.value = []
    }
  }

  /**
   * Handle provider change
   */
  async function onProviderChange() {
    const provider = providers.value.find(p => p.id === selectedProvider.value)
    if (provider) {
      const config = getProviderConfig(selectedProvider.value)
      setProvider(selectedProvider.value, config)
      await loadModels()
    }
  }

  return {
    // State
    allModels,
    routerModel,
    executorModel,

    // Legacy compatibility (for PlaygroundChat)
    providers,
    selectedProvider,
    models,
    selectedModel,
    twoModelMode,

    // Computed
    isModelReady,
    routerModelData,
    executorModelData,

    // Actions
    initialize,
    loadModels,
    loadAllModels,
    onProviderChange
  }
}
