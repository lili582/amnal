import type { SaveState, StatsState } from '../types'
import { MAX_GUESSES } from '../config'

const PREFIX = 'amnal:v1'

// Every access is wrapped so the game keeps working (without persistence)
// when localStorage is blocked or the quota is exceeded.

function readJSON<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeJSON(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function gameKey(date: string): string {
  return `${PREFIX}:game:${date}`
}

export function loadGame(date: string): SaveState | null {
  return readJSON<SaveState>(gameKey(date))
}

export function saveGame(date: string, state: SaveState): boolean {
  return writeJSON(gameKey(date), state)
}

export interface Settings {
  theme: 'dark' | 'light'
  colorblind: boolean
}

export const DEFAULT_SETTINGS: Settings = { theme: 'dark', colorblind: false }

export function loadSettings(): Settings {
  const saved = readJSON<Partial<Settings>>(`${PREFIX}:settings`)
  return { ...DEFAULT_SETTINGS, ...saved }
}

export function saveSettings(s: Settings): boolean {
  return writeJSON(`${PREFIX}:settings`, s)
}

export function emptyStats(): StatsState {
  return {
    played: 0,
    wins: 0,
    streak: 0,
    maxStreak: 0,
    dist: new Array<number>(MAX_GUESSES).fill(0),
    lastWinDate: null,
  }
}

export function loadStats(): StatsState {
  const saved = readJSON<StatsState>(`${PREFIX}:stats`)
  if (!saved) return emptyStats()
  return {
    ...emptyStats(),
    ...saved,
    dist: Array.isArray(saved.dist) ? saved.dist : emptyStats().dist,
  }
}

export function saveStats(s: StatsState): boolean {
  return writeJSON(`${PREFIX}:stats`, s)
}

// Records a finished day's result into the stats exactly once. The daily game
// is also idempotent for reloads: a reloaded 'won' day must never double-count.
export function statsRecorded(date: string): boolean {
  return readJSON<string>(`${PREFIX}:stats-done:${date}`) === '1'
}

export function markStatsRecorded(date: string): void {
  writeJSON(`${PREFIX}:stats-done:${date}`, '1')
}

// Delete saved games older than `maxDays` days. Returns number removed.
export function cleanupOldGames(maxDays = 30): number {
  try {
    const cutoff = Date.now() - maxDays * 86_400_000
    let removed = 0
    const keys = Object.keys(window.localStorage)
    for (const key of keys) {
      if (!key.startsWith(`${PREFIX}:game:`)) continue
      const date = key.slice(PREFIX.length + 6) // after ":game:"
      const ms = new Date(`${date}T00:00:00Z`).getTime()
      if (!Number.isNaN(ms) && ms < cutoff) {
        window.localStorage.removeItem(key)
        removed++
      }
    }
    return removed
  } catch {
    return 0
  }
}