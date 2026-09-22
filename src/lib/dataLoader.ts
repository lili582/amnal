import type { Artist } from '../types'
import { DATA_URL, DATA_CACHE_TTL_MS, DATA_SCHEMA_VERSION } from '../config'

// The app loads its artist roster and daily schedule over the network at
// runtime instead of bundling them. Downloading once per player means the
// pipeline output can be hosted on any static origin (GitHub Pages, S3, ...)
// and updated without a rebuild of the app itself.

export interface GameData {
  artists: Artist[]
  // Ordered artist ids; index = day number (see src/lib/daily.ts).
  schedule: string[]
}

export type DataSource = 'network' | 'cache' | 'stale-cache'

export interface LoadResult {
  data: GameData
  source: DataSource
}

const PREFIX = 'amnal:v1:data'
const cacheKey = `${PREFIX}:${DATA_SCHEMA_VERSION}`

interface CacheRecord {
  ts: number
  data: GameData
}

// Session in-memory copy, so a page doesn't do work when switching tabs/views.
let memoryData: GameData | null = null

// ---- pure logic (unit-tested) ----------------------------------------------

// Minimal structural validation of a downloaded dataset. Full schema checks
// live at build time in scripts/07-validate.ts; this only guards against a
// wrong/partial deploy or a shape change slipping through.
export function validateGameData(json: unknown): GameData | null {
  if (!json || typeof json !== 'object') return null
  const d = json as { artists?: unknown; schedule?: unknown }
  if (!Array.isArray(d.artists) || d.artists.length === 0) return null
  if (!Array.isArray(d.schedule) || d.schedule.length === 0) return null

  const ids = new Set<string>()
  for (const a of d.artists) {
    if (!a || typeof a !== 'object') return null
    const x = a as Partial<Artist>
    if (typeof x.id !== 'string' || !x.id) return null
    if (typeof x.nameHe !== 'string' || !x.nameHe) return null
    if (typeof x.debutYear !== 'number' || !Number.isFinite(x.debutYear)) return null
    if (typeof x.type !== 'string') return null
    ids.add(x.id)
  }

  for (const id of d.schedule) {
    if (typeof id !== 'string' || !ids.has(id)) return null
  }

  return { artists: d.artists as Artist[], schedule: d.schedule }
}

export function isDataFresh(ts: number, now: number = Date.now()): boolean {
  return Number.isFinite(ts) && now - ts < DATA_CACHE_TTL_MS
}

// ---- persistence (defensive around localStorage) ---------------------------

function readCacheRecord(): CacheRecord | null {
  try {
    const raw = window.localStorage.getItem(cacheKey)
    if (!raw) return null
    const rec = JSON.parse(raw) as CacheRecord
    return rec && Array.isArray(rec.data?.artists) && Array.isArray(rec.data?.schedule) ? rec : null
  } catch {
    return null
  }
}

function writeCacheRecord(rec: CacheRecord): void {
  try {
    window.localStorage.setItem(cacheKey, JSON.stringify(rec))
  } catch {
    // storage blocked / full — memory cache still works for this session
  }
}

// ---- loader ----------------------------------------------------------------

export interface LoadGameDataOptions {
  fetchImpl?: typeof fetch
  now?: number // clock injection for tests
}

export async function loadGameData(opts: LoadGameDataOptions = {}): Promise<LoadResult> {
  const { fetchImpl = fetch, now = Date.now() } = opts

  // 1. Fresh local copy (this session or a recent download) — no network.
  if (memoryData) return { data: memoryData, source: 'cache' }

  const cached = readCacheRecord()
  if (cached && isDataFresh(cached.ts, now)) {
    memoryData = cached.data
    return { data: cached.data, source: 'cache' }
  }

  // 2. Try the network (small retry; failing fast matters on mobile).
  let lastError: unknown
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const [artistsRes, scheduleRes] = await Promise.all([
        fetchImpl(`${DATA_URL}/artists.json`),
        fetchImpl(`${DATA_URL}/schedule.json`),
      ])
      if (!artistsRes.ok || !scheduleRes.ok) {
        throw new Error(`HTTP ${artistsRes.status}/${scheduleRes.status} for ${DATA_URL}`)
      }
      const [artistsJson, scheduleJson] = await Promise.all([
        artistsRes.json(),
        scheduleRes.json(),
      ])
      const data = validateGameData({ artists: artistsJson, schedule: scheduleJson })
      if (!data) throw new Error('dataset failed validation')
      writeCacheRecord({ ts: now, data })
      memoryData = data
      return { data, source: 'network' }
    } catch (err) {
      lastError = err
      await new Promise((r) => setTimeout(r, 300 * 2 ** attempt))
    }
  }

  // 3. Network failed — serve yesterday's copy if we have one. The daily
  //    schedule is stable, so a stale roster is perfectly playable.
  if (cached) {
    memoryData = cached.data
    return { data: cached.data, source: 'stale-cache' }
  }

  throw lastError
}

// Test hook — clears the session copy so tests exercise the full load path.
export function _resetDataLoaderCache(): void {
  memoryData = null
}