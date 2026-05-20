export interface ChatCommand {
  name: string
  aliases?: string[]
  description: string
  usage: string
  requiresArgs: boolean
  execute: (args: string, ctx: CommandContext) => CommandResult | Promise<CommandResult>
}

export type CommandResult =
  | { type: 'handled'; feedback?: string }
  | { type: 'message'; text: string }
  | { type: 'search'; query: string }
  | { type: 'error'; message: string }

export interface CommandContext {
  clearChat: () => void
  compactChat?: () => Promise<void>
}

export interface ParsedCommand {
  name: string
  args: string
}

export interface SuggestionItem {
  key: string
  label: string
  kind: 'command' | 'tool'
  description: string
  replaceText: string
}

export interface ToolRef {
  id: string
  title: string
}

const COMMANDS: ChatCommand[] = [
  {
    name: 'help',
    aliases: ['?'],
    description: 'Show available commands',
    usage: '/help',
    requiresArgs: false,
    execute(_args, _ctx) {
      const lines = COMMANDS.map(c => {
        const aliases = c.aliases ? `, /${c.aliases.join(', /')}` : ''
        return `  /${c.name}${aliases}  —  ${c.description}`
      })
      return { type: 'handled', feedback: `Commands:\n${lines.join('\n')}` }
    },
  },
  {
    name: 'clear',
    description: 'Clear chat history',
    usage: '/clear',
    requiresArgs: false,
    execute(_args, ctx) {
      ctx.clearChat()
      return { type: 'handled', feedback: 'Chat cleared.' }
    },
  },
  {
    name: 'compact',
    description: 'Compact conversation to free context',
    usage: '/compact',
    requiresArgs: false,
    execute(_args, ctx) {
      if (ctx.compactChat) {
        ctx.compactChat()
        return { type: 'handled', feedback: 'Compacting conversation...' }
      }
      return {
        type: 'message',
        text: 'Summarize our entire conversation so far into a concise summary that preserves all key facts, decisions, and context. Then reply with only the summary.',
      }
    },
  },
  {
    name: 'continue',
    description: 'Continue the last response',
    usage: '/continue',
    requiresArgs: false,
    execute() {
      return {
        type: 'message',
        text: 'Continue exactly where you left off. Do not repeat what was already said.',
      }
    },
  },
  {
    name: 'fix',
    description: 'Fix issues in the last response',
    usage: '/fix [description]',
    requiresArgs: false,
    execute(args) {
      const prompt = args.trim()
        ? `There is an issue with your previous response: ${args.trim()}. Please fix it and provide the corrected version.`
        : 'Review your previous response for any errors, inconsistencies, or issues, and provide a corrected version.'
      return { type: 'message', text: prompt }
    },
  },
  {
    name: 'search',
    aliases: ['web'],
    description: 'Search the web and answer with results',
    usage: '/search <query>',
    requiresArgs: true,
    execute(args) {
      const query = args.trim()
      if (!query) return { type: 'error', message: 'Usage: /search <query>' }
      return { type: 'search', query }
    },
  },
]

const commandMap = new Map<string, ChatCommand>()
for (const cmd of COMMANDS) {
  commandMap.set(cmd.name, cmd)
  if (cmd.aliases) {
    for (const alias of cmd.aliases) {
      commandMap.set(alias, cmd)
    }
  }
}

export function parseCommand(input: string): ParsedCommand | null {
  const trimmed = input.trim()
  if (!trimmed.startsWith('/')) return null
  const spaceIdx = trimmed.indexOf(' ')
  if (spaceIdx === -1) {
    return { name: trimmed.slice(1).toLowerCase(), args: '' }
  }
  return {
    name: trimmed.slice(1, spaceIdx).toLowerCase(),
    args: trimmed.slice(spaceIdx + 1),
  }
}

export async function handleCommand(
  input: string,
  ctx: CommandContext,
): Promise<CommandResult | null> {
  const parsed = parseCommand(input)
  if (!parsed) return null

  const cmd = commandMap.get(parsed.name)
  if (!cmd) {
    const available = COMMANDS.map(c => `/${c.name}`).join(', ')
    return { type: 'error', message: `Unknown command: /${parsed.name}. Available: ${available}` }
  }

  if (cmd.requiresArgs && !parsed.args.trim()) {
    return { type: 'error', message: `Usage: ${cmd.usage}` }
  }

  return cmd.execute(parsed.args, ctx)
}

export function matchAll(prefix: string, tools?: ToolRef[]): SuggestionItem[] {
  if (!prefix.startsWith('/')) return []
  const q = prefix.slice(1).toLowerCase()

  const items: SuggestionItem[] = []

  const matchedCmds = COMMANDS.filter(c =>
    c.name.startsWith(q) ||
    (c.aliases && c.aliases.some(a => a.startsWith(q)))
  )
  for (const cmd of matchedCmds) {
    items.push({
      key: `cmd:${cmd.name}`,
      label: `/${cmd.name}`,
      kind: 'command',
      description: cmd.description,
      replaceText: `/${cmd.name} `,
    })
  }

  if (tools?.length) {
    const stripped = q.replace(/[\p{Emoji_Presentation}\p{Emoji}\uFE0F]/gu, '').trim()
    const matchedTools = tools.filter(t => {
      const name = t.title.replace(/[\p{Emoji_Presentation}\p{Emoji}\uFE0F]/gu, '').trim().toLowerCase()
      return name.includes(stripped) || t.title.toLowerCase().includes(q)
    })
    for (const tool of matchedTools) {
      items.push({
        key: `tool:${tool.id}`,
        label: `/${tool.title}`,
        kind: 'tool',
        description: 'Include tool data in message',
        replaceText: `/${tool.title}`,
      })
    }
  }

  return items
}

export function extractToolRefs(text: string, tools: ToolRef[]): ToolRef[] {
  const refs: ToolRef[] = []
  const seen = new Set<string>()
  const lower = text.toLowerCase()
  for (const tool of tools) {
    if (lower.includes(`/${tool.title.toLowerCase()}`) && !seen.has(tool.id)) {
      seen.add(tool.id)
      refs.push(tool)
    }
  }
  return refs
}

export function stripToolRefs(text: string, tools: ToolRef[]): string {
  let result = text
  for (const tool of tools) {
    const escaped = tool.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    result = result.replace(new RegExp(`\\/?${escaped}`, 'g'), '')
  }
  return result.replace(/\s+/g, ' ').trim()
}

export { COMMANDS }
