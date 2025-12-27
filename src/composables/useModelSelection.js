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
 * Handles both single-model and two-model modes
 */
export function useModelSelection() {
  // Providers and models
  const providers = ref([])
  const selectedProvider = ref('')
  const models = ref([])
  const allModels = ref([])
  const selectedModel = ref('')

  // Two-model mode state
  const twoModelMode = ref(true)
  const routerModel = ref('')
  const executorModel = ref('')

  // Computed: check if model selection is ready
  const isModelReady = computed(() => {
    if (twoModelMode.value) {
      return routerModel.value && executorModel.value && allModels.value.length > 0
    }
    return !!selectedModel.value
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
    providers,
    selectedProvider,
    models,
    allModels,
    selectedModel,
    twoModelMode,
    routerModel,
    executorModel,

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
