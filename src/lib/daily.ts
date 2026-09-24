import { LAUNCH_DATE, TZ } from '../config'

// Israeli calendar date as YYYY-MM-DD. Uses calendar-date formatting (with the
// Asia/Jerusalem timezone) so DST transitions can never shift the day.
export function israelDateString(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d)
}

function parseYmd(s: string): number {
  const [y, m, day] = s.split('-').map(Number)
  return Date.UTC(y, m - 1, day)
}

// Whole days between YYYY-MM-DD strings (calendar arithmetic, DST-proof).
export function dayNumberFor(dateStr: string, launch = LAUNCH_DATE): number {
  return Math.round((parseYmd(dateStr) - parseYmd(launch)) / 86_400_000)
}

// FNV-1a 32-bit string hash -> unsigned int, used to seed the PRNG.
export function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

// mulberry32: tiny deterministic PRNG.
export function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface Schedulable {
  id: string
}

// Deterministic Fisher-Yates shuffle. Same input (ids + seed) -> same output.
export function seededShuffle<T extends Schedulable>(items: T[], seed: string): T[] {
  const rng = mulberry32(hashString(seed))
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = out[i]
    out[i] = out[j]
    out[j] = tmp
  }
  return out
}

// Build the daily answer schedule. Never re-randomise after launch: append new
// artists to the end of the existing order instead.
export function buildSchedule(ids: string[], seed: string): string[] {
  return seededShuffle(ids.map((id) => ({ id })), seed).map((x) => x.id)
}

export function answerForDay(schedule: string[], dayNumber: number): string {
  if (schedule.length === 0) throw new Error('schedule is empty')
  // Non-negative modulus: a day before launch (negative dayNumber) must still
  // map into the schedule instead of producing an undefined array element.
  const idx = ((dayNumber % schedule.length) + schedule.length) % schedule.length
  return schedule[idx]
}

function toYmd(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

export function tomorrowIsraelDateString(dateStr: string): string {
  return toYmd(parseYmd(dateStr) + 86_400_000)
}

export function yesterdayIsraelDateString(dateStr: string): string {
  return toYmd(parseYmd(dateStr) - 86_400_000)
}

// Epoch milliseconds of 00:00 (start) of an Israeli calendar day. Found with a
// monotonic binary search over the israelDateString predicate, so DST shifts
// cannot break it. Used for the "next game in..." countdown.
export function israelMidnightEpoch(ymd: string): number {
  const naive = parseYmd(ymd)
  let lo = naive - 24 * 3_600_000
  let hi = naive + 24 * 3_600_000
  for (let i = 0; i < 48; i++) {
    const mid = Math.floor((lo + hi) / 2)
    if (israelDateString(new Date(mid)) < ymd) lo = mid + 1
    else hi = mid
  }
  return lo
}