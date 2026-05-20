import { describe, it, expect, vi } from 'vitest'
import {
  parseCommand,
  handleCommand,
  matchAll,
  extractToolRefs,
  stripToolRefs,
  resolveToolMessage,
  COMMANDS,
  type CommandContext,
  type ToolRef,
  type ToolDataResolver,
} from '../chatCommands'

const mockCtx: CommandContext = {
  clearChat: vi.fn(),
}

describe('parseCommand', () => {
  it('parses a simple command', () => {
    expect(parseCommand('/help')).toEqual({ name: 'help', args: '' })
  })

  it('parses a command with args', () => {
    expect(parseCommand('/fix the layout')).toEqual({ name: 'fix', args: 'the layout' })
  })

  it('returns null for non-commands', () => {
    expect(parseCommand('hello')).toBeNull()
    expect(parseCommand('')).toBeNull()
  })

  it('returns null for text not starting with /', () => {
    expect(parseCommand('use /help')).toBeNull()
  })

  it('is case-insensitive for command name', () => {
    expect(parseCommand('/HELP')).toEqual({ name: 'help', args: '' })
    expect(parseCommand('/Compact')).toEqual({ name: 'compact', args: '' })
  })

  it('handles trailing whitespace', () => {
    expect(parseCommand('  /clear  ')).toEqual({ name: 'clear', args: '' })
  })
})

describe('handleCommand', () => {
  it('returns null for non-commands', async () => {
    expect(await handleCommand('hello', mockCtx)).toBeNull()
  })

  it('returns error for unknown commands', async () => {
    const result = await handleCommand('/unknown', mockCtx)
    expect(result?.type).toBe('error')
    expect((result as { message: string }).message).toContain('Unknown command: /unknown')
  })

  describe('/help', () => {
    it('returns handled with all commands listed', async () => {
      const result = await handleCommand('/help', mockCtx)
      expect(result?.type).toBe('handled')
      const feedback = (result as { feedback: string }).feedback
      expect(feedback).toContain('/help')
      expect(feedback).toContain('/clear')
      expect(feedback).toContain('/compact')
      expect(feedback).toContain('/continue')
      expect(feedback).toContain('/fix')
    })

    it('works with alias /?', async () => {
      const result = await handleCommand('/?', mockCtx)
      expect(result?.type).toBe('handled')
    })
  })

  describe('/clear', () => {
    it('calls clearChat and returns handled', async () => {
      const clearFn = vi.fn()
      const ctx: CommandContext = { clearChat: clearFn }
      const result = await handleCommand('/clear', ctx)
      expect(result).toEqual({ type: 'handled', feedback: 'Chat cleared.' })
      expect(clearFn).toHaveBeenCalledOnce()
    })
  })

  describe('/compact', () => {
    it('calls compactChat when available', async () => {
      const compactFn = vi.fn().mockResolvedValue(undefined)
      const ctx: CommandContext = { clearChat: vi.fn(), compactChat: compactFn }
      const result = await handleCommand('/compact', ctx)
      expect(result).toEqual({ type: 'handled', feedback: 'Compacting conversation...' })
      expect(compactFn).toHaveBeenCalledOnce()
    })

    it('returns a message when compactChat is not available', async () => {
      const result = await handleCommand('/compact', mockCtx)
      expect(result?.type).toBe('message')
      expect((result as { text: string }).text).toContain('Summarize')
    })
  })

  describe('/continue', () => {
    it('returns a continue message', async () => {
      const result = await handleCommand('/continue', mockCtx)
      expect(result?.type).toBe('message')
      expect((result as { text: string }).text).toContain('Continue')
    })
  })

  describe('/fix', () => {
    it('returns generic fix prompt without args', async () => {
      const result = await handleCommand('/fix', mockCtx)
      expect(result?.type).toBe('message')
      expect((result as { text: string }).text).toContain('Review your previous response')
    })

    it('includes issue description in prompt', async () => {
      const result = await handleCommand('/fix the button is broken', mockCtx)
      expect(result?.type).toBe('message')
      expect((result as { text: string }).text).toContain('the button is broken')
    })
  })

  describe('/search', () => {
    it('delegates to ctx.searchWeb', async () => {
      const searchFn = vi.fn().mockResolvedValue({ type: 'handled' })
      const ctx: CommandContext = { clearChat: vi.fn(), searchWeb: searchFn }
      const result = await handleCommand('/search latest Vue.js features', ctx)
      expect(result?.type).toBe('handled')
      expect(searchFn).toHaveBeenCalledWith('latest Vue.js features')
    })

    it('works with alias /web', async () => {
      const searchFn = vi.fn().mockResolvedValue({ type: 'handled' })
      const ctx: CommandContext = { clearChat: vi.fn(), searchWeb: searchFn }
      const result = await handleCommand('/web react vs vue', ctx)
      expect(searchFn).toHaveBeenCalledWith('react vs vue')
    })

    it('returns error without query', async () => {
      const result = await handleCommand('/search', mockCtx)
      expect(result?.type).toBe('error')
      expect((result as { message: string }).message).toContain('Usage: /search <query>')
    })

    it('returns error when searchWeb is not available', async () => {
      const result = await handleCommand('/search something', mockCtx)
      expect(result?.type).toBe('error')
      expect((result as { message: string }).message).toContain('only available in project chat')
    })
  })
})

describe('matchAll', () => {
  const tools: ToolRef[] = [
    { id: '1', title: 'Chart' },
    { id: '2', title: 'Counter' },
    { id: '3', title: '📝 Notes' },
  ]

  it('returns empty for non-/ input', () => {
    expect(matchAll('hello')).toEqual([])
  })

  it('returns all commands when prefix is just /', () => {
    const results = matchAll('/')
    expect(results.length).toBe(COMMANDS.length)
    expect(results.every(r => r.kind === 'command')).toBe(true)
  })

  it('filters commands by prefix', () => {
    const results = matchAll('/c')
    const names = results.map(r => r.label)
    expect(names).toContain('/clear')
    expect(names).toContain('/compact')
    expect(names).toContain('/continue')
  })

  it('matches aliases', () => {
    const results = matchAll('/?')
    expect(results).toHaveLength(1)
    expect(results[0].label).toBe('/help')
  })

  it('includes matching tools', () => {
    const results = matchAll('/ch', tools)
    const labels = results.map(r => r.label)
    expect(labels).toContain('/Chart')
  })

  it('matches tools by partial name', () => {
    const results = matchAll('/co', tools)
    const labels = results.map(r => r.label)
    expect(labels).toContain('/Counter')
  })

  it('strips emojis from tool names for matching', () => {
    const results = matchAll('/no', tools)
    const labels = results.map(r => r.label)
    expect(labels).toContain('/📝 Notes')
  })

  it('returns empty when no commands or tools match', () => {
    const results = matchAll('/zzz', tools)
    expect(results).toEqual([])
  })

  it('returns only commands when no tools provided', () => {
    const results = matchAll('/h')
    expect(results).toHaveLength(1)
    expect(results[0].label).toBe('/help')
  })

  it('sets correct replaceText for commands', () => {
    const results = matchAll('/help')
    expect(results[0].replaceText).toBe('/help ')
  })

  it('sets correct replaceText for tools', () => {
    const results = matchAll('/ch', tools)
    const tool = results.find(r => r.kind === 'tool')
    expect(tool?.replaceText).toBe('/Chart')
  })
})

describe('extractToolRefs', () => {
  const tools: ToolRef[] = [
    { id: '1', title: 'Chart' },
    { id: '2', title: 'Counter' },
    { id: '3', title: '📝 Notes' },
  ]

  it('extracts a single tool reference', () => {
    const refs = extractToolRefs('fix the /Chart', tools)
    expect(refs).toEqual([{ id: '1', title: 'Chart' }])
  })

  it('extracts multiple tool references', () => {
    const refs = extractToolRefs('update /Chart and /Counter', tools)
    expect(refs).toEqual([
      { id: '1', title: 'Chart' },
      { id: '2', title: 'Counter' },
    ])
  })

  it('deduplicates tool references', () => {
    const refs = extractToolRefs('/Chart and /Chart again', tools)
    expect(refs).toEqual([{ id: '1', title: 'Chart' }])
  })

  it('returns empty when no tools match', () => {
    const refs = extractToolRefs('no refs here', tools)
    expect(refs).toEqual([])
  })

  it('matches emoji tool names by stripped name', () => {
    const refs = extractToolRefs('check /📝 Notes', tools)
    expect(refs).toEqual([{ id: '3', title: '📝 Notes' }])
  })

  it('is case-insensitive', () => {
    const refs = extractToolRefs('/chart', tools)
    expect(refs).toEqual([{ id: '1', title: 'Chart' }])
  })
})

describe('stripToolRefs', () => {
  const tools: ToolRef[] = [
    { id: '1', title: 'Chart' },
    { id: '2', title: '📝 Notes' },
  ]

  it('removes tool references from text', () => {
    expect(stripToolRefs('fix /Chart', tools)).toBe('fix')
  })

  it('removes multiple tool references', () => {
    expect(stripToolRefs('fix /Chart and /📝 Notes', tools)).toBe('fix and')
  })

  it('returns clean text when no refs present', () => {
    expect(stripToolRefs('hello world', tools)).toBe('hello world')
  })

  it('collapses whitespace', () => {
    expect(stripToolRefs('fix /Chart  now', tools)).toBe('fix now')
  })
})

describe('resolveToolMessage', () => {
  const tools: ToolRef[] = [
    { id: '1', title: 'Chart' },
    { id: '2', title: 'Counter' },
  ]

  const resolver: ToolDataResolver = {
    getCode: (id) => id === '1' ? '<template>chart</template>' : id === '2' ? '<template>counter</template>' : undefined,
    getData: (id) => id === '1' ? { count: 5 } : {},
  }

  it('returns original text when no tool refs', () => {
    const r = resolveToolMessage('hello world', tools, resolver)
    expect(r.displayText).toBe('hello world')
    expect(r.promptText).toBe('hello world')
    expect(r.toolNames).toEqual([])
  })

  it('injects tool code and data into promptText', () => {
    const r = resolveToolMessage('fix the /Chart', tools, resolver)
    expect(r.promptText).toContain('[Referenced tools]')
    expect(r.promptText).toContain('Tool "Chart"')
    expect(r.promptText).toContain('<template>chart</template>')
    expect(r.promptText).toContain('"count": 5')
  })

  it('strips the tool ref from displayText', () => {
    const r = resolveToolMessage('fix the /Chart', tools, resolver)
    expect(r.displayText).toBe('fix the')
  })

  it('returns tool names', () => {
    const r = resolveToolMessage('fix /Chart and /Counter', tools, resolver)
    expect(r.toolNames).toEqual(['Chart', 'Counter'])
  })

  it('handles multiple tool refs in promptText', () => {
    const r = resolveToolMessage('fix /Chart and /Counter', tools, resolver)
    expect(r.promptText).toContain('Tool "Chart"')
    expect(r.promptText).toContain('Tool "Counter"')
  })

  it('strips ref from displayText even when tools have no code', () => {
    const noCodeResolver: ToolDataResolver = {
      getCode: () => undefined,
      getData: () => ({}),
    }
    const r = resolveToolMessage('fix /Chart', tools, noCodeResolver)
    expect(r.displayText).toBe('fix')
    expect(r.promptText).toBe('fix')
    expect(r.toolNames).toEqual(['Chart'])
  })
})
