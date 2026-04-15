import type { CapabilityDescription, ProcessResult, PipeData, CapabilityContext, CapabilityOutput } from '@/types/capabilities'

export { createPipeData } from '@/types/capabilities'

export abstract class BaseCapability {
  abstract readonly name: string
  abstract readonly priority: number

  abstract getRouterDescription(): CapabilityDescription
  abstract canHandle(analysis: Record<string, unknown>): boolean
  abstract process(input: Record<string, unknown>): Promise<ProcessResult>
  abstract getSystemPrompt(context: CapabilityContext): string

  receiveInput(pipeInput: PipeData | null, context: CapabilityContext): Record<string, unknown> {
    return {
      data: pipeInput?.data ?? null,
      source: pipeInput?.source ?? null,
      context
    }
  }

  produceOutput(processResult: ProcessResult): PipeData {
    return {
      data: processResult.success ? processResult.result : { error: processResult.error },
      source: this.name
    }
  }

  getChainTo(_processResult: ProcessResult, _context: CapabilityContext): string | null {
    return null
  }

  async execute(context: CapabilityContext, pipeInput: PipeData | null = null): Promise<ProcessResult> {
    const input = this.receiveInput(pipeInput, context)
    const processResult = await this.process(input)
    const pipeOutput = this.produceOutput(processResult)
    const chainTo = this.getChainTo(processResult, context)

    return {
      ...processResult,
      pipe: pipeOutput,
      chainTo
    }
  }

  formatOutput(result: unknown, _metadata: Record<string, unknown> = {}): CapabilityOutput {
    return { type: 'text', content: String(result), displayHint: 'plain' }
  }

  cleanOutput(rawOutput: string): string {
    let cleaned = rawOutput.trim()
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '')
    }
    return cleaned.trim()
  }
}
