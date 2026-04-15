import type { TokenUsage } from '@/types/llm'

export function createEmptyUsage(): TokenUsage {
  return { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
}

export function parseOpenAIUsage(response: Record<string, any>): TokenUsage | null {
  const usage = response?.usage
  if (!usage) return null
  return {
    promptTokens: usage.prompt_tokens ?? 0,
    completionTokens: usage.completion_tokens ?? 0,
    totalTokens: usage.total_tokens ?? (usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0)
  }
}

export function parseGeminiUsage(response: Record<string, any>): TokenUsage | null {
  const metadata = response?.usageMetadata
  if (!metadata) return null
  return {
    promptTokens: metadata.promptTokenCount ?? 0,
    completionTokens: metadata.candidatesTokenCount ?? 0,
    totalTokens: metadata.totalTokenCount ??
      (metadata.promptTokenCount ?? 0) + (metadata.candidatesTokenCount ?? 0)
  }
}

export function mergeUsage(...usages: (TokenUsage | null | undefined)[]): TokenUsage {
  return usages.reduce((acc, usage) => {
    if (!usage) return acc
    return {
      promptTokens: acc.promptTokens + (usage.promptTokens ?? 0),
      completionTokens: acc.completionTokens + (usage.completionTokens ?? 0),
      totalTokens: acc.totalTokens + (usage.totalTokens ?? 0)
    }
  }, createEmptyUsage())
}

export function formatTokenCount(count: number): string {
  return count >= 1000 ? `${(count / 1000).toFixed(1)}k` : String(count)
}

export function formatUsage(usage: TokenUsage | null, options: { showBreakdown?: boolean } = {}): string {
  if (!usage || usage.totalTokens === 0) return ''
  if (options.showBreakdown) {
    return `${formatTokenCount(usage.promptTokens)} in / ${formatTokenCount(usage.completionTokens)} out`
  }
  return formatTokenCount(usage.totalTokens)
}

export function estimateTokens(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length / 4)
}
