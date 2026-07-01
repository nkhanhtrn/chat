import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockGetIdToken = vi.fn()

vi.mock('@/services/firebase', () => ({
  getFirebaseAuth: vi.fn(() => ({
    currentUser: { uid: 'user-1', getIdToken: mockGetIdToken },
  })),
}))

import { downloadEpubFile } from '../bookDownload'

function mockResponse(
  body: string,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  const { status = 200, headers = {} } = init
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => headers[name] ?? null },
    arrayBuffer: async () => new TextEncoder().encode(body).buffer as ArrayBuffer,
    body: null,
  } as unknown as Response
}

describe('downloadEpubFile', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_FIREBASE_STORAGE_BUCKET', 'test-bucket')
    mockGetIdToken.mockResolvedValue('token-abc')
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('throws when the bucket env var is missing', async () => {
    vi.stubEnv('VITE_FIREBASE_STORAGE_BUCKET', '')
    await expect(downloadEpubFile('book-1', 'user-1')).rejects.toThrow(
      'Missing VITE_FIREBASE_STORAGE_BUCKET',
    )
  })

  it('returns null when there is no current user', async () => {
    const { getFirebaseAuth } = await import('@/services/firebase')
    vi.mocked(getFirebaseAuth).mockReturnValueOnce({ currentUser: null } as never)

    const result = await downloadEpubFile('book-1', 'user-1')
    expect(result).toBeNull()
  })

  it('sends the auth bearer token with the request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse('data'))

    await downloadEpubFile('book-1', 'user-1')

    expect(fetchSpy).toHaveBeenCalledOnce()
    const init = fetchSpy.mock.calls[0]![1] as RequestInit
    expect(init.headers).toEqual({ Authorization: 'Bearer token-abc' })
  })

  it('routes through the dev proxy and encodes the storage path', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse('data'))

    await downloadEpubFile('book-1', 'user-1')

    const url = fetchSpy.mock.calls[0]![0] as string
    // import.meta.env.DEV is true under vitest → same-origin proxy path
    expect(url).toContain('/fs-proxy/')
    expect(url).toContain('test-bucket')
    expect(url).toContain(encodeURIComponent('users/user-1/books/book-1/book.epub'))
  })

  it('returns null on 404', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse('', { status: 404 }))

    const result = await downloadEpubFile('book-1', 'user-1')
    expect(result).toBeNull()
  })

  it('throws on a non-ok status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse('', { status: 500 }))

    await expect(downloadEpubFile('book-1', 'user-1')).rejects.toThrow('Download failed (500)')
  })

  it('returns an ArrayBuffer on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse('data'))

    const result = await downloadEpubFile('book-1', 'user-1')
    expect(result).toBeInstanceOf(ArrayBuffer)
    expect(result!.byteLength).toBe(4)
  })

  it('reports download progress when Content-Length is known', async () => {
    const chunks = ['ab', 'cd']
    const stream = new ReadableStream({
      start(controller) {
        for (const c of chunks) controller.enqueue(new TextEncoder().encode(c))
        controller.close()
      },
    })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: (n: string) => (n === 'Content-Length' ? '4' : null) },
      body: stream,
    } as unknown as Response)

    const onProgress = vi.fn()
    await downloadEpubFile('book-1', 'user-1', onProgress)

    expect(onProgress).toHaveBeenCalled()
    expect(onProgress).toHaveBeenLastCalledWith(1)
  })
})
