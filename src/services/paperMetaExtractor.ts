import { getDocument } from 'pdfjs-dist'
import type { PaperMeta } from '@/types/book'

const DOI_REGEX = /\b(10\.\d{4,9}\/[^\s\]>}"',;]+[^\s\]>}"',;.])/i
const ABSTRACT_REGEX = /\babstract[\s]*[:\-—]\s*([\s\S]+?)(?=(?:\n\s*){2,}|\n\s*(?:introduction|1[\s\.]|section)|\s(?:keywords|1\s|introduction)[\s:])/im
const KEYWORDS_REGEX = /keywords[\s]*[:\-—]\s*([^\n]+)/i
const YEAR_REGEX = /\b((?:19|20)\d{2})\b/

export interface ExtractedPaperMeta extends Partial<PaperMeta> {
  title: string | null
  author: string | null
}

async function extractTextFromPages(fileData: ArrayBuffer, maxPages = 3): Promise<string> {
  const loadingTask = getDocument({ data: new Uint8Array(fileData).slice() })
  const pdf = await loadingTask.promise

  try {
    const pagesToRead = Math.min(maxPages, pdf.numPages)
    const texts: string[] = []

    for (let i = 1; i <= pagesToRead; i++) {
      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()
      let lastY: number | null = null
      const lines: string[] = []
      let currentLine = ''

      for (const item of textContent.items as any[]) {
        if (!item.str) continue
        const y = item.transform?.[5]
        if (lastY !== null && y !== undefined && Math.abs(y - lastY) > 2) {
          lines.push(currentLine)
          currentLine = item.str
        } else {
          currentLine += item.str
        }
        lastY = y ?? lastY
      }
      if (currentLine) lines.push(currentLine)

      texts.push(lines.join('\n'))
    }

    return texts.join('\n\n')
  } finally {
    pdf.destroy()
  }
}

function parseDoi(text: string): string | null {
  const match = text.match(DOI_REGEX)
  if (!match) return null
  let doi = match[1].trim()
  if (doi.endsWith('.')) doi = doi.slice(0, -1)
  return doi
}

function parseAbstract(text: string): string | null {
  const match = text.match(ABSTRACT_REGEX)
  if (!match) return null
  return match[1].replace(/\s+/g, ' ').trim()
}

function parseKeywords(text: string): string[] {
  const match = text.match(KEYWORDS_REGEX)
  if (!match) return []
  return match[1]
    .split(/[;,]/)
    .map(k => k.trim())
    .filter(k => k.length > 0)
}

function parseYear(text: string): number | null {
  const years = [...text.matchAll(new RegExp(YEAR_REGEX, 'g'))].map(m => parseInt(m[1], 10))
  const current = new Date().getFullYear()
  const valid = years.filter(y => y >= 1900 && y <= current)
  if (valid.length === 0) return null
  return valid[0]
}

interface CrossRefResult {
  title?: string[]
  author?: Array<{ given?: string; family?: string }>
  'container-title'?: string[]
  'published-print'?: { 'date-parts': number[][] }
  'published-online'?: { 'date-parts': number[][] }
  created?: { 'date-parts': number[][] }
  abstract?: string
  subject?: string[]
  DOI?: string
  'is-referenced-by-count'?: number
  type?: string
}

async function lookupCrossRef(doi: string): Promise<Partial<PaperMeta> & { title?: string; author?: string } | null> {
  try {
    const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
      headers: { 'Accept': 'application/json' },
    })
    if (!res.ok) return null

    const body = await res.json()
    const item: CrossRefResult = body.message

    const title = item.title?.[0] ?? null
    const author = item.author?.map(a => [a.given, a.family].filter(Boolean).join(' ')).join(', ') ?? null

    const dateParts = item['published-print']?.['date-parts']?.[0]
      ?? item['published-online']?.['date-parts']?.[0]
      ?? item.created?.['date-parts']?.[0]
    const year = dateParts?.[0] ?? null

    const journal = item['container-title']?.[0] ?? null
    const abstract = item.abstract?.replace(/<[^>]+>/g, '').trim() || null
    const keywords = item.subject ?? []
    const citationCount = item['is-referenced-by-count'] ?? null

    return { title, author, doi, journal, year, abstract, keywords, citationCount, bibtex: null }
  } catch {
    return null
  }
}

export async function extractPaperMeta(fileData: ArrayBuffer): Promise<ExtractedPaperMeta> {
  const text = await extractTextFromPages(fileData, 3)

  let doi = parseDoi(text)
  let abstract = parseAbstract(text)
  let keywords = parseKeywords(text)
  let year = parseYear(text)
  let journal: string | null = null
  let citationCount: number | null = null
  let bibtex: string | null = null

  if (doi) {
    const crossRef = await lookupCrossRef(doi)
    if (crossRef) {
      if (crossRef.journal) journal = crossRef.journal
      if (crossRef.year) year = crossRef.year
      if (crossRef.abstract) abstract = crossRef.abstract
      if (crossRef.keywords?.length) keywords = crossRef.keywords
      if (crossRef.citationCount != null) citationCount = crossRef.citationCount
    }
  }

  return {
    title: null,
    author: null,
    doi,
    journal,
    year,
    abstract,
    keywords,
    bibtex,
    citationCount,
  }
}

export { parseDoi, parseAbstract, parseKeywords, parseYear, lookupCrossRef }
