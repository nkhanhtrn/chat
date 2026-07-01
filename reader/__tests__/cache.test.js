import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { loadCore } from './helper'

function p(fn) {
  return new Promise(function (resolve) {
    fn(function () { resolve(Array.prototype.slice.call(arguments)); })
  })
}

describe('openCache', () => {
  beforeEach(() => {
    indexedDB = new IDBFactory()
  })

  it('creates a database and object store', async () => {
    const { openCache } = loadCore()
    var result = await p(function (cb) { openCache(cb) })
    expect(result[0]).toBe(null)
    expect(result[1]).toBeTruthy()
    expect(result[1].name).toBe('reader-cache')
    expect(result[1].objectStoreNames.contains('books')).toBe(true)
  })

  it('reuses the same db instance on subsequent calls', async () => {
    const { openCache } = loadCore()
    var r1 = await p(function (cb) { openCache(cb) })
    var r2 = await p(function (cb) { openCache(cb) })
    expect(r2[1]).toBe(r1[1])
  })
})

describe('cacheGet / cacheSet', () => {
  beforeEach(() => {
    indexedDB = new IDBFactory()
  })

  it('returns null for a missing key', async () => {
    const { cacheGet } = loadCore()
    var result = await p(function (cb) { cacheGet('nope', cb) })
    expect(result[0]).toBe(null)
    expect(result[1]).toBe(null)
  })

  it('stores and retrieves an ArrayBuffer', async () => {
    const { cacheSet, cacheGet } = loadCore()
    var buf = new ArrayBuffer(8)
    await p(function (cb) { cacheSet('b1', buf, cb) })
    var result = await p(function (cb) { cacheGet('b1', cb) })
    expect(result[1]).toBeInstanceOf(ArrayBuffer)
    expect(result[1].byteLength).toBe(8)
  })

  it('overwrites existing key on subsequent set', async () => {
    const { cacheSet, cacheGet } = loadCore()
    await p(function (cb) { cacheSet('b1', new ArrayBuffer(4), cb) })
    await p(function (cb) { cacheSet('b1', new ArrayBuffer(16), cb) })
    var result = await p(function (cb) { cacheGet('b1', cb) })
    expect(result[1].byteLength).toBe(16)
  })

  it('handles multiple keys independently', async () => {
    const { cacheSet, cacheGet } = loadCore()
    await p(function (cb) { cacheSet('b1', new ArrayBuffer(4), cb) })
    await p(function (cb) { cacheSet('b2', new ArrayBuffer(8), cb) })
    var r1 = await p(function (cb) { cacheGet('b1', cb) })
    var r2 = await p(function (cb) { cacheGet('b2', cb) })
    expect(r1[1].byteLength).toBe(4)
    expect(r2[1].byteLength).toBe(8)
  })
})

describe('cacheGet when IndexedDB unavailable', () => {
  var origIndexedDB
  beforeEach(() => { origIndexedDB = globalThis.indexedDB })
  afterEach(() => { globalThis.indexedDB = origIndexedDB })

  it('returns null without throwing', async () => {
    globalThis.indexedDB = undefined
    const { cacheGet } = loadCore()
    var result = await p(function (cb) { cacheGet('b1', cb) })
    expect(result[0]).toBe(null)
    expect(result[1]).toBe(null)
  })
})

describe('cacheSet when IndexedDB unavailable', () => {
  var origIndexedDB
  beforeEach(() => { origIndexedDB = globalThis.indexedDB })
  afterEach(() => { globalThis.indexedDB = origIndexedDB })

  it('calls cb without throwing', async () => {
    globalThis.indexedDB = undefined
    const { cacheSet } = loadCore()
    var result = await p(function (cb) { cacheSet('b1', new ArrayBuffer(4), cb) })
    expect(result[0]).toBeUndefined()
  })
})
