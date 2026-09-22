// Shared helpers for the build-time data pipeline scripts.
// All network access happens here; scripts stay thin and re-runnable.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export { existsSync, readFileSync, writeFileSync, mkdirSync, resolve, dirname, join }

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const RAW_DIR = resolve(ROOT, 'data/raw')

export const CONTACT_EMAIL = process.env.CONTACT_EMAIL ?? 'you@example.com'
export const USER_AGENT =
  process.env.USER_AGENT ?? `AmnalBuilder/0.1 (mailto:${CONTACT_EMAIL})`

// ---------------------------------------------------------------------------
// Caching
// ---------------------------------------------------------------------------

export function cachePath(source: string, key: string): string {
  return resolve(RAW_DIR, source, `${sanitize(key)}.json`)
}

export function sanitize(s: string): string {
  // Keep ASCII alnum/dots as-is; encode every other code point (incl. Hebrew)
  // as its hex code unit so distinct terms can never collide.
  let out = ''
  for (const ch of s) {
    out += /[A-Za-z0-9.-]/.test(ch) ? ch : ch.codePointAt(0)!.toString(16).padStart(4, '0')
  }
  return out.slice(0, 120)
}

export function readCache<T>(source: string, key: string): T | null {
  const p = cachePath(source, key)
  if (!existsSync(p)) return null
  try {
    return JSON.parse(readFileSync(p, 'utf8')) as T
  } catch {
    return null
  }
}

export function writeCache(source: string, key: string, value: unknown): string {
  const p = cachePath(source, key)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, JSON.stringify(value, null, 2), 'utf8')
  return p
}

export function log(msg: string): void {
  console.log(`[pipeline] ${msg}`)
}

// ---------------------------------------------------------------------------
// HTTP with caching + throttling + retries
// ---------------------------------------------------------------------------

export interface FetchOptions {
  headers?: Record<string, string>
  cacheSource?: string
  cacheKey?: string
  retries?: number
  delayMs?: number // throttle before this request
}

export async function cachedFetch(
  url: string,
  { headers, cacheSource, cacheKey, retries = 2, delayMs = 0 }: FetchOptions = {},
): Promise<unknown> {
  if (cacheSource && cacheKey) {
    const hit = readCache(cacheSource, cacheKey)
    if (hit !== null) return hit
  }
  if (delayMs > 0) await sleep(delayMs)

  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...headers },
        signal: AbortSignal.timeout(60_000),
      })
      if (res.status === 429 || res.status >= 500) {
        const retryAfter = Number(res.headers.get('retry-after') ?? 2)
        await sleep(retryAfter * 1000 + 500)
        throw new Error(`HTTP ${res.status} for ${url}`)
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
      const data = await res.json()
      if (cacheSource && cacheKey) writeCache(cacheSource, cacheKey, data)
      return data
    } catch (err) {
      lastError = err
      const wait = 1000 * 2 ** attempt + Math.random() * 400
      await sleep(wait)
    }
  }
  throw new Error(`fetch failed: ${String(lastError)}`)
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve_) => setTimeout(resolve_, ms))
}

// ---------------------------------------------------------------------------
// Normalisation shared with the browser (kept local to scripts to avoid
// importing src/ into tsx; deliberately duplicated from src/lib/normalizeHe).
// ---------------------------------------------------------------------------

export function normHe(s: string): string {
  let out = s.normalize('NFKC').split('\u05BE').join(' ')
  out = out.replace(/[\u0591-\u05C7]/g, '')
  out = out.replace(/["'`\u05F3\u05F4\u2019\u201D\u201C\u02BC\u02BB]/g, '')
  out = out.replace(
    /[\u05DA\u05DD\u05DF\u05E3\u05E5]/g,
    (c) => ({ '\u05DA': '\u05DB', '\u05DD': '\u05DE', '\u05DF': '\u05E0', '\u05E3': '\u05E4', '\u05E5': '\u05E6' })[c] ?? c,
  )
  out = out.toLowerCase()
  out = out.replace(/[^\p{L}\p{N}]+/gu, ' ')
  return out.replace(/\s+/g, ' ').trim()
}

// Basic Levenshtein for relaxed name matching.
export function lev(a: string, b: string, max = 1): number | null {
  if (Math.abs(a.length - b.length) > max) return null
  const d = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1))
  for (let i = 0; i <= a.length; i++) d[i][0] = i
  for (let j = 0; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
    }
  }
  return d[a.length][b.length] <= max ? d[a.length][b.length] : null
}

export function readJson<T>(rel: string): T {
  return JSON.parse(readFileSync(resolve(ROOT, rel), 'utf8')) as T
}

export function writeJson(rel: string, value: unknown): void {
  const p = resolve(ROOT, rel)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, JSON.stringify(value, null, 2) + '\n', 'utf8')
}