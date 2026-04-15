import type { LLMMessage, SendMessageResult } from '@/types/llm'
import { ProviderBase } from '../ProviderBase'

// Stub - codeApi service will be imported when implemented
async function generateCode(_opts: Record<string, unknown>): Promise<{ stdout: string; code: string }> {
  return { stdout: '', code: '' }
}

export class CodeApiProvider extends ProviderBase {
  readonly id = 'codeapi'
  readonly name = 'Code API'
  readonly category = 'reasoning' as const
  readonly requiresApiKey = false
  readonly supportsStreaming = true
  readonly defaultBaseUrl = ''

  getDefaultModel(): string { return 'codeapi-model' }

  async listModels(): Promise<Array<{ id: string; name: string }>> {
    return [{ id: 'codeapi-model', name: 'Reasoning AI' }]
  }

  async send(messages: LLMMessage[]): Promise<SendMessageResult> {
    const lastMessage = [...messages].reverse().find(m => m.role === 'user')
    if (!lastMessage) throw new Error('No user message found')

    const config = this.getResolvedConfig()
    const result = await generateCode({
      initial_code: '',
      edit_prompt: lastMessage.content,
      output_path: 'chat.txt',
      codeApiUrl: config.codeApiUrl ?? ''
    })

    return { content: result.stdout || result.code || 'Done' }
  }

  async *sendStream(messages: LLMMessage[]): AsyncIterable<string> {
    const lastMessage = [...messages].reverse().find(m => m.role === 'user')
    if (!lastMessage) throw new Error('No user message found')

    const config = this.getResolvedConfig()
    const chunks: string[] = []

    const result = await generateCode({
      initial_code: '',
      edit_prompt: lastMessage.content,
      output_path: 'chat.txt',
      onStdoutChunk: (chunk: string) => { chunks.push(chunk) },
      codeApiUrl: config.codeApiUrl ?? ''
    })

    if (chunks.length > 0) {
      for (const chunk of chunks) yield chunk
    } else {
      yield result.stdout || result.code || 'Done'
    }
  }
}

export const codeApiProvider = new CodeApiProvider()
export default codeApiProvider
