import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('pdfjs-dist', () => ({
  getDocument: vi.fn(),
  GlobalWorkerOptions: { workerSrc: '' },
}))

import { parseDoi, parseAbstract, parseKeywords, parseYear, lookupCrossRef, extractPaperMeta } from '../paperMetaExtractor'

describe('parseDoi', () => {
  it('extracts DOI from text', () => {
    expect(parseDoi('see https://doi.org/10.1038/s41586-023-12345-6 for details')).toBe('10.1038/s41586-023-12345-6')
  })

  it('extracts DOI with trailing dot stripped', () => {
    expect(parseDoi('refer to 10.1000/xyz123.')).toBe('10.1000/xyz123')
  })

  it('returns null when no DOI', () => {
    expect(parseDoi('no doi here')).toBeNull()
  })

  it('extracts DOI from raw text without url', () => {
    expect(parseDoi('DOI: 10.1109/5.771073')).toBe('10.1109/5.771073')
  })
})

describe('parseAbstract', () => {
  it('extracts abstract between label and introduction', () => {
    const text = 'Some header\nAbstract: This paper presents a novel approach to machine learning.\nWe show that...\n\nIntroduction'
    expect(parseAbstract(text)).toBe('This paper presents a novel approach to machine learning. We show that...')
  })

  it('extracts abstract with dash separator', () => {
    const text = 'Abstract — We propose a method for testing.\nResults are good.\n\n1. Introduction'
    expect(parseAbstract(text)).toBe('We propose a method for testing. Results are good.')
  })

  it('returns null when no abstract found', () => {
    expect(parseAbstract('Just some random text')).toBeNull()
  })
})

describe('parseKeywords', () => {
  it('extracts comma-separated keywords', () => {
    expect(parseKeywords('Keywords: machine learning, NLP, transformers')).toEqual(['machine learning', 'NLP', 'transformers'])
  })

  it('extracts semicolon-separated keywords', () => {
    expect(parseKeywords('Keywords: physics; quantum; entanglement')).toEqual(['physics', 'quantum', 'entanglement'])
  })

  it('returns empty array when no keywords', () => {
    expect(parseKeywords('no keywords here')).toEqual([])
  })
})

describe('parseYear', () => {
  it('extracts a valid year', () => {
    expect(parseYear('Published in 2023 by Springer')).toBe(2023)
  })

  it('returns the first valid year', () => {
    expect(parseYear('Received 2021, Accepted 2023')).toBe(2021)
  })

  it('ignores years outside valid range', () => {
    expect(parseYear('year 1899 or 2099')).toBeNull()
  })

  it('returns null when no year found', () => {
    expect(parseYear('no year')).toBeNull()
  })
})

describe('lookupCrossRef', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns enriched metadata from CrossRef', async () => {
    const mockResponse = {
      message: {
        title: ['Quantum Entanglement Theory'],
        author: [{ given: 'Alice', family: 'Smith' }, { family: 'Chen' }],
        'container-title': ['Nature Physics'],
        'published-print': { 'date-parts': [[2024, 3, 15]] },
        abstract: '<p>A study on <b>entanglement</b>.</p>',
        subject: ['Physics', 'Quantum'],
        DOI: '10.1038/s41586-023-12345-6',
        'is-referenced-by-count': 42,
      },
    }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response)

    const result = await lookupCrossRef('10.1038/s41586-023-12345-6')

    expect(result).toEqual({
      title: 'Quantum Entanglement Theory',
      author: 'Alice Smith, Chen',
      doi: '10.1038/s41586-023-12345-6',
      journal: 'Nature Physics',
      year: 2024,
      abstract: 'A study on entanglement.',
      keywords: ['Physics', 'Quantum'],
      citationCount: 42,
      bibtex: null,
    })
  })

  it('returns null on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
    } as Response)

    const result = await lookupCrossRef('10.1234/nonexistent')
    expect(result).toBeNull()
  })

  it('returns null on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'))

    const result = await lookupCrossRef('10.1234/error')
    expect(result).toBeNull()
  })

  it('falls back to created date when published date missing', async () => {
    const mockResponse = {
      message: {
        title: ['Test'],
        created: { 'date-parts': [[2022, 6, 1]] },
        DOI: '10.1234/test',
      },
    }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response)

    const result = await lookupCrossRef('10.1234/test')
    expect(result!.year).toBe(2022)
  })
})

describe('extractPaperMeta', () => {
  it('extracts metadata from PDF text and enriches via CrossRef', async () => {
    const { getDocument } = await import('pdfjs-dist')

    const mockPage = {
      getTextContent: vi.fn().mockResolvedValue({
        items: [
          { str: 'Deep Learning for NLP', transform: [0, 0, 0, 0, 0, 100] },
          { str: 'Abstract: A survey of deep learning methods.', transform: [0, 0, 0, 0, 0, 80] },
          { str: 'Keywords: deep learning, NLP', transform: [0, 0, 0, 0, 0, 60] },
          { str: 'DOI: 10.1234/dlnlp2023', transform: [0, 0, 0, 0, 0, 40] },
          { str: 'Published 2023', transform: [0, 0, 0, 0, 0, 20] },
        ],
      }),
    }

    vi.mocked(getDocument).mockReturnValue({
      promise: Promise.resolve({
        numPages: 2,
        getPage: vi.fn().mockResolvedValue(mockPage),
        destroy: vi.fn(),
      }),
    } as any)

    const crossRefResponse = {
      message: {
        title: ['Deep Learning for NLP'],
        'container-title': ['ACL'],
        'published-print': { 'date-parts': [[2023]] },
        subject: ['NLP'],
        DOI: '10.1234/dlnlp2023',
        'is-referenced-by-count': 15,
      },
    }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(crossRefResponse),
    } as Response)

    const result = await extractPaperMeta(new ArrayBuffer(8))

    expect(result.doi).toBe('10.1234/dlnlp2023')
    expect(result.journal).toBe('ACL')
    expect(result.year).toBe(2023)
    expect(result.abstract).toBe('A survey of deep learning methods.')
    expect(result.keywords).toEqual(['NLP'])
    expect(result.citationCount).toBe(15)
  })

  it('works without DOI (no CrossRef call)', async () => {
    const { getDocument } = await import('pdfjs-dist')

    const mockPage = {
      getTextContent: vi.fn().mockResolvedValue({
        items: [
          { str: 'Some paper without a DOI', transform: [0, 0, 0, 0, 0, 100] },
          { str: 'Abstract: Testing without DOI.', transform: [0, 0, 0, 0, 0, 80] },
          { str: 'Keywords: test, experiment', transform: [0, 0, 0, 0, 0, 60] },
          { str: 'Published 2022', transform: [0, 0, 0, 0, 0, 40] },
        ],
      }),
    }

    vi.mocked(getDocument).mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getPage: vi.fn().mockResolvedValue(mockPage),
        destroy: vi.fn(),
      }),
    } as any)

    const result = await extractPaperMeta(new ArrayBuffer(8))

    expect(result.doi).toBeNull()
    expect(result.abstract).toBe('Testing without DOI.')
    expect(result.keywords).toEqual(['test', 'experiment'])
    expect(result.year).toBe(2022)
    expect(result.journal).toBeNull()
  })
})
