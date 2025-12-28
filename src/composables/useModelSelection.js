import { ref, computed, watch } from 'vue'
import {
  listProviders,
  getCurrentProviderId,
  getProviderConfig,
  setProvider,
  fetchModels,
  fetchAllModels
} from '../services/llm/index.js'
import { findRouterAndExecutorModels } from '../services/llm/taskRouter.js'
import { saveUserSettings, loadUserSettings } from '../services/firestore.js'

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

      // Try to load saved models from cloud first
      const savedSettings = await loadUserSettings()
      const savedRouter = savedSettings?.routerModel
      const savedExecutor = savedSettings?.executorModel

      // Check if saved models exist in the available model list
      const savedRouterExists = savedRouter && modelList.some(m => m.id === savedRouter)
      const savedExecutorExists = savedExecutor && modelList.some(m => m.id === savedExecutor)

      if (savedRouterExists) {
        routerModel.value = savedRouter
      } else if (modelList.length > 0) {
        // Auto-select router model
        const { router } = findRouterAndExecutorModels(modelList)
        routerModel.value = router ? router.id : modelList[0].id
      }

      if (savedExecutorExists) {
        executorModel.value = savedExecutor
      } else if (modelList.length > 0) {
        // Auto-select executor model
        const { executor } = findRouterAndExecutorModels(modelList)
        executorModel.value = executor ? executor.id : (modelList.length > 1 ? modelList[1].id : modelList[0].id)
      }

      // Watch for model changes and save to cloud
      watch(routerModel, (newValue) => {
        if (newValue) {
          saveUserSettings({ routerModel: newValue })
        }
      })

      watch(executorModel, (newValue) => {
        if (newValue) {
          saveUserSettings({ executorModel: newValue })
        }
      })
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
