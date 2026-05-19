import { toast } from 'vue-sonner'

const STORAGE_KEY = 'app-build-id'

export function checkAppUpdate() {
  const currentBuildId = __APP_BUILD_ID__
  const previousBuildId = localStorage.getItem(STORAGE_KEY)

  if (previousBuildId && previousBuildId !== currentBuildId) {
    toast.success('App updated', {
      description: 'A new version has been loaded.',
      duration: 5000,
    })
  }

  localStorage.setItem(STORAGE_KEY, currentBuildId)
}
