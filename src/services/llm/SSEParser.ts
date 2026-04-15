/**
 * Shared SSE (Server-Sent Events) stream parser
 *
 * Replaces 6 duplicated SSE loops across providers.
 * Takes an `extractContent` callback for format differences (OpenAI vs Gemini).
 */

export interface SSEParseOptions {
  /** Extract text content from a parsed SSE data object. Returns string or null. */
  extractContent: (data: Record<string, unknown>) => string | null
  /** Extract usage metadata from a parsed SSE data object. */
  extractUsage?: (data: Record<string, unknown>) => Record<string, unknown> | null
  /** Called for each content chunk */
  onChunk: (chunk: string) => void
  /** Optional abort signal */
  signal?: AbortSignal | null
}

export interface SSEParseResult {
  content: string
  usage: Record<string, unknown> | null
}

export async function parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  options: SSEParseOptions
): Promise<SSEParseResult> {
  const { extractContent, extractUsage, onChunk, signal } = options
  const decoder = new TextDecoder()
  let buffer = ''
  let fullContent = ''
  let usage: Record<string, unknown> | null = null

  try {
    while (true) {
      if (signal?.aborted) break

      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmedLine = line.trim()
        if (trimmedLine === '' || trimmedLine === 'data: [DONE]') continue

        if (trimmedLine.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmedLine.slice(6)) as Record<string, unknown>

            if (data.error) {
              const errMsg = (data.error as Record<string, unknown>)?.message ?? `API Error: ${(data.error as Record<string, unknown>)?.code ?? 'Unknown'}`
              throw new Error(errMsg as string)
            }

            const content = extractContent(data)
            if (content) {
              fullContent += content
              onChunk(content)
            }

            if (extractUsage) {
              const extracted = extractUsage(data)
              if (extracted) usage = extracted
            }
          } catch (e) {
            const msg = (e as Error).message ?? ''
            if (msg.includes('API Error') || msg.includes('Rate') || msg.includes('limit') || msg.includes('quota')) {
              throw e
            }
          }
        }
      }
    }
  } finally {
    try {
      await reader.cancel()
    } catch {
      // Ignore cancel errors
    }
  }

  return { content: fullContent, usage }
}
