/**
 * DataExtractionCapability - Extracts structured data from content
 *
 * Pipe interface:
 * - Input: Accepts text, search-results (content to extract from)
 * - Process: Extracts structured data using LLM
 * - Output: Produces 'json' type with extracted data
 *
 * This capability:
 * 1. Analyzes provided content (text, HTML, documents, etc.)
 * 2. Extracts specified data according to user requirements
 * 3. Returns structured output (JSON, CSV, or formatted text)
 */

import { BaseCapability, createPipeData } from './BaseCapability.js'

const EXTRACTOR_SYSTEM_PROMPT = `You are a data extraction specialist. Given content and extraction requirements, extract relevant data and return it in structured JSON format.

CRITICAL RULES:
1. Extract ONLY what is explicitly requested
2. Return valid JSON - no markdown, no explanations, no code blocks
3. Handle missing fields gracefully (use null)
4. Preserve data types (numbers as numbers, dates as ISO strings)
5. For lists/arrays of items, return as array
6. For single items, return as object

OUTPUT FORMAT:
Return ONLY a JSON object with this structure:
{
  "data": [extracted items array] or {single extracted object},
  "count": number of items extracted
}

EXAMPLES:

Content: "John Smith, john@email.com, 555-1234. Jane Doe, jane@email.com, 555-5678"
Task: Extract name, email, phone
Output:
{"data":[{"name":"John Smith","email":"john@email.com","phone":"555-1234"},{"name":"Jane Doe","email":"jane@email.com","phone":"555-5678"}],"count":2}

Content: "The meeting is on March 15, 2024 at 2pm with Bob and Alice"
Task: Extract date, time, attendees
Output:
{"data":{"date":"2024-03-15","time":"14:00","attendees":["Bob","Alice"]},"count":1}`

export class DataExtractionCapability extends BaseCapability {
  name = 'extraction'
  priority = 45

  getRouterDescription() {
    return {
      name: 'extraction',
      description: 'EXTRACTS structured data from unstructured content. Use when the user wants to pull specific fields or entities from text or documents.',
      conditions: [
        'Extract specific fields from text or documents',
        'Entity extraction (names, dates, emails, phones, prices)',
        'Parse data from tables or lists',
        'Convert unstructured text to structured JSON'
      ],
      examples: [
        { input: 'Extract all emails and names from this text' },
        { input: 'Pull the product name and price from this page' },
        { input: 'Get all the dates and events mentioned' },
        { input: 'Parse the contact information from this document' }
      ]
    }
  }

  canHandle(analysis) {
    return analysis.capability === 'extraction' ||
           analysis.isExtraction === true ||
           analysis.extractionType !== undefined
  }

  // ===========================================================================
  // PIPE INTERFACE
  // ===========================================================================

  receiveInput(pipeInput, context) {
    if (!pipeInput?.data) {
      return { data: null, pipedContent: null, context }
    }

    const data = pipeInput.data

    // Convert raw data to text for extraction
    let pipedContent = ''
    if (typeof data === 'string') {
      pipedContent = data
    } else if (Array.isArray(data) && data[0]?.content) {
      // Looks like search results
      pipedContent = data.map((r, i) =>
        `--- Source ${i + 1}: ${r.title || 'Untitled'} ---\n${r.content}\n`
      ).join('\n')
    } else {
      // Let LLM handle it - just stringify
      pipedContent = String(data)
    }

    return { data, pipedContent, context }
  }

  async process(input) {
    const { pipedContent, context } = input
    const {
      analysis,
      fullContext,
      models,
      config,
      provider,
      signal,
      callbacks = {}
    } = context

    const { onExtractionStart, onExtractionComplete } = callbacks

    if (onExtractionStart) {
      onExtractionStart(analysis.taskDescription)
    }

    // Use piped content if available, otherwise use full context
    const contentToExtract = pipedContent || fullContext

    const messages = [
      { role: 'system', content: this.getSystemPrompt() },
      { role: 'user', content: this.buildExecutorPrompt({ analysis, fullContext: contentToExtract }) }
    ]

    const response = await provider.sendMessage(
      models.executorId,
      messages,
      null,
      signal,
      config
    )

    const cleanedOutput = this.cleanOutput(response)

    let extractedData
    try {
      extractedData = JSON.parse(cleanedOutput)
    } catch (e) {
      const jsonMatch = cleanedOutput.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          extractedData = JSON.parse(jsonMatch[0])
        } catch (e2) {
          return {
            success: false,
            result: null,
            error: 'Failed to parse extraction result as JSON',
            metadata: { rawOutput: response }
          }
        }
      } else {
        return {
          success: false,
          result: null,
          error: 'No valid JSON in extraction result',
          metadata: { rawOutput: response }
        }
      }
    }

    if (onExtractionComplete) {
      onExtractionComplete(extractedData)
    }

    return {
      success: true,
      result: extractedData,
      error: null,
      metadata: {
        extractionType: analysis.extractionType || 'fields',
        outputFormat: analysis.outputFormat || 'json',
        fields: analysis.fields,
        hasPipedInput: !!pipedContent
      }
    }
  }

  produceOutput(processResult) {
    const { success, result, error } = processResult
    return createPipeData(success ? result : { error }, this.name)
  }

  async execute(context, pipeInput = null) {
    const transformedInput = this.receiveInput(pipeInput, context)
    const processResult = await this.process(transformedInput)
    const pipeOutput = this.produceOutput(processResult)

    return {
      ...processResult,
      pipe: pipeOutput
    }
  }

  // ===========================================================================
  // LEGACY INTERFACE
  // ===========================================================================

  getSystemPrompt() {
    return EXTRACTOR_SYSTEM_PROMPT
  }

  buildExecutorPrompt(context) {
    const { analysis, fullContext } = context

    const fields = analysis.fields?.length > 0
      ? `Fields to extract: ${analysis.fields.join(', ')}`
      : 'Extract all relevant data based on the task'

    return `Task: ${analysis.taskDescription}
Extraction type: ${analysis.extractionType || 'fields'}
${fields}

CONTENT TO EXTRACT FROM:
---
${fullContext}
---

Extract the data and return ONLY valid JSON:`
  }

  formatOutput(result, metadata = {}) {
    const format = metadata.outputFormat || 'json'

    let content
    if (format === 'csv' && result.data) {
      content = this._convertToCSV(result.data)
    } else if (format === 'text') {
      content = this._convertToText(result.data)
    } else {
      content = JSON.stringify(result, null, 2)
    }

    return {
      type: 'extraction',
      content,
      displayHint: format === 'json' ? 'code' : format,
      metadata: {
        extractionType: metadata.extractionType,
        count: result.count,
        format
      }
    }
  }

  cleanOutput(rawOutput) {
    let cleaned = rawOutput.trim()

    // Remove markdown code blocks
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    return cleaned.trim()
  }

  _convertToCSV(data) {
    const items = Array.isArray(data) ? data : [data]
    if (items.length === 0) return ''

    const headers = Object.keys(items[0])
    const csvLines = [
      headers.join(','),
      ...items.map(row =>
        headers.map(h => {
          const val = row[h]
          if (val === null || val === undefined) return ''
          const str = String(val)
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`
          }
          return str
        }).join(',')
      )
    ]
    return csvLines.join('\n')
  }

  _convertToText(data) {
    const items = Array.isArray(data) ? data : [data]
    return items.map((item, i) => {
      const lines = Object.entries(item)
        .map(([k, v]) => `  ${k}: ${v}`)
        .join('\n')
      return items.length > 1 ? `Item ${i + 1}:\n${lines}` : lines
    }).join('\n\n')
  }
}

export default DataExtractionCapability
