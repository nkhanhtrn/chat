/**
 * Debug logging utility - only logs when Vue DevTools is open
 * @param {...any} args - Arguments to log
 */
export function debugLog(...args) {
  // Only log when Vue DevTools is open
  const isDevtoolsOpen = !!window.__VUE_DEVTOOLS_GLOBAL_HOOK__
  if (isDevtoolsOpen) {
    console.log(...args)
  }
}
