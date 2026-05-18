import { toast } from 'vue-sonner'

export function useToast() {
  return { showToast: toast }
}
