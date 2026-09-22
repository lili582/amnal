import { describe, it, expect, beforeEach } from 'vitest'
import {
  validateGameData,
  isDataFresh,
  loadGameData,
  _resetDataLoaderCache,
} from '../src/lib/dataLoader'
import { DATA_CACHE_TTL_MS } from '../src/config'
import type { Artist } from '../src/types'

const artistA: Artist = {
  id: 'omer-adam',
  nameHe: 'עומר אדם',
  aliases: ['Omer Adam'],
  debutYear: 2009,
  breakthroughYear: 2009,
  type: 'solo',
  members: 1,
  gender: 'male',
  primaryGenre: 'mizrahi',
  secondaryGenres: [],
  popularityTier: 4,
  region: 'center',
  answerEligible: true,
  ids: {},
}

const goodJson = {
  artists: [artistA, { ...artistA, id: 'rita', nameHe: 'ריטה' }],
  schedule: ['omer-adam', 'rita'],
}

function jsonOk(data: unknown) {
  return { ok: true, json: async () => data } as Response
}

// Endpoint whose /artists.json and /schedule.json each return their bare array.
function serverOf(payload: typeof goodJson): typeof fetch {
  return ((url: string) =>
    String(url).endsWith('/artists.json')
      ? Promise.resolve(jsonOk(payload.artists))
      : Promise.resolve(jsonOk(payload.schedule))) as typeof fetch
}

const loaderCache = () => loadGameData({ fetchImpl: serverOf(goodJson) })

beforeEach(() => {
  window.localStorage.clear()
  _resetDataLoaderCache()
})

describe('validateGameData', () => {
  it('accepts a well-formed dataset', () => {
    const result = validateGameData(goodJson)
    expect(result).not.toBeNull()
    expect(result?.artists).toHaveLength(2)
    expect(result?.schedule).toEqual(goodJson.schedule)
  })

  it('rejects non-objects and empty/missing arrays', () => {
    expect(validateGameData(null)).toBeNull()
    expect(validateGameData('x')).toBeNull()
    expect(validateGameData({})).toBeNull()
    expect(validateGameData({ artists: [], schedule: [] })).toBeNull()
    expect(validateGameData({ ...goodJson, artists: [] })).toBeNull()
    expect(validateGameData({ ...goodJson, schedule: [] })).toBeNull()
  })

  it('rejects artists missing required fields', () => {
    expect(validateGameData({ ...goodJson, artists: [{ id: 'x' }] })).toBeNull()
    expect(
      validateGameData({ ...goodJson, artists: [{ ...artistA, nameHe: '' }] }),
    ).toBeNull()
    expect(
      validateGameData({ ...goodJson, artists: [{ ...artistA, debutYear: '2005' }] }),
    ).toBeNull()
  })

  it('rejects schedules referencing unknown artist ids', () => {
    expect(validateGameData({ ...goodJson, schedule: ['does-not-exist'] })).toBeNull()
  })
})

describe('isDataFresh', () => {
  const now = 1_700_000_000_000
  it('is fresh within the TTL window', () => {
    expect(isDataFresh(now, now)).toBe(true)
    expect(isDataFresh(now - DATA_CACHE_TTL_MS + 1, now)).toBe(true)
  })
  it('is stale at/after the TTL window', () => {
    expect(isDataFresh(now - DATA_CACHE_TTL_MS, now)).toBe(false)
    expect(isDataFresh(now - 3 * DATA_CACHE_TTL_MS, now)).toBe(false)
    expect(isDataFresh(Number.NaN, now)).toBe(false)
  })
})

describe('loadGameData', () => {
  it('loads from the network on first call', async () => {
    const calls: string[] = []
    const result = await loadGameData({
      fetchImpl: ((url: string) => {
        calls.push(String(url))
        return String(url).endsWith('/artists.json')
          ? Promise.resolve(jsonOk(goodJson.artists))
          : Promise.resolve(jsonOk(goodJson.schedule))
      }) as typeof fetch,
    })
    expect(result.source).toBe('network')
    expect(calls).toHaveLength(2)
    expect(calls.every((u: string) => u.endsWith('.json'))).toBe(true)
  })

  it('serves the in-memory copy without another fetch', async () => {
    await loaderCache()
    let fetched = false
    const second = await loadGameData({
      fetchImpl: (() => {
        fetched = true
        return Promise.resolve(jsonOk(goodJson))
      }) as typeof fetch,
    })
    expect(fetched).toBe(false)
    expect(second.source).toBe('cache')
  })

  it('rejects a downloaded dataset that fails validation', async () => {
    await expect(
      loadGameData({
        fetchImpl: (() => Promise.resolve(jsonOk({ artists: [], schedule: [] }))) as typeof fetch,
      }),
    ).rejects.toThrow()
  })

  it('falls back to stale local data when the network is down', async () => {
    const fresh = await loaderCache()
    expect(fresh.source).toBe('network')

    _resetDataLoaderCache()

    const now = Date.now() + DATA_CACHE_TTL_MS + 1000
    const stale = await loadGameData({
      now,
      fetchImpl: (() => Promise.reject(new Error('offline'))) as typeof fetch,
    })
    expect(stale.source).toBe('stale-cache')
    expect(stale.data.artists).toHaveLength(2)
  })

  it('rejects when there is no cache and the network fails', async () => {
    await expect(
      loadGameData({
        fetchImpl: (() => Promise.reject(new Error('offline'))) as typeof fetch,
      }),
    ).rejects.toThrow('offline')
  })
})