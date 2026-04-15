/**
 * Shared API key rotation utility
 *
 * Replaces identical copies in cerebras and google providers.
 * Round-robin load balancing across multiple API keys.
 */

let currentKeyIndex = 0

export function getNextApiKey(apiKeyOrKeys: string | string[] | undefined | null): string | null {
  if (!apiKeyOrKeys) return null

  if (typeof apiKeyOrKeys === 'string') {
    return apiKeyOrKeys
  }

  if (Array.isArray(apiKeyOrKeys) && apiKeyOrKeys.length > 0) {
    const key = apiKeyOrKeys[currentKeyIndex % apiKeyOrKeys.length]!
    currentKeyIndex = (currentKeyIndex + 1) % apiKeyOrKeys.length
    return key
  }

  return null
}
