import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  cleanupOldGames,
  emptyStats,
  gameKey,
  loadGame,
  loadSettings,
  loadStats,
  saveGame,
  saveSettings,
  saveStats,
  statsRecorded,
  markStatsRecorded,
} from '../src/lib/storage'
import type { SaveState } from '../src/types'

const date = '2026-10-01'

// Simulate localStorage being disabled entirely (private mode / blocked).
function blockLocalStorage() {
  const thrower = () => {
    throw new Error('Storage disabled')
  }
  const original = window.localStorage
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get: () =>
      ({
        getItem: thrower,
        setItem: thrower,
        removeItem: thrower,
        key: thrower,
        get length() {
          return 0
        },
        clear: thrower,
      }) as Storage,
  })
  return () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () => original,
    })
  }
}

describe('storage', () => {
  it('round-trips a game state', () => {
    const state: SaveState = {
      date,
      status: 'playing',
      guesses: [],
    }
    expect(saveGame(date, state)).toBe(true)
    expect(loadGame(date)).toEqual(state)
    expect(gameKey(date)).toBe(`amnal:v1:game:${date}`)
  })

  it('returns null for a missing game', () => {
    expect(loadGame('1999-01-01')).toBeNull()
  })

  it('round-trips stats and settings with defaults', () => {
    const stats = emptyStats()
    expect(loadStats()).toEqual(stats)
    stats.played = 3
    expect(saveStats(stats)).toBe(true)
    expect(loadStats().played).toBe(3)

    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
    expect(saveSettings({ theme: 'light', colorblind: true })).toBe(true)
    expect(loadSettings()).toEqual({ theme: 'light', colorblind: true })
  })

  it('cleans up only stale saved games', () => {
    const old = gameKey('2000-01-01')
    const fresh = gameKey('2026-10-01')
    window.localStorage.setItem(old, '{}')
    window.localStorage.setItem(fresh, '{}')
    const removed = cleanupOldGames(30)
    expect(removed).toBeGreaterThanOrEqual(1)
    expect(window.localStorage.getItem(old)).toBeNull()
    expect(window.localStorage.getItem(fresh)).not.toBeNull()
  })

  it('never throws when localStorage is blocked — the game keeps working', () => {
    const restore = blockLocalStorage()
    try {
      const state: SaveState = { date, status: 'won', guesses: [] }
      expect(saveGame(date, state)).toBe(false)
      expect(loadGame(date)).toBeNull()
      expect(saveSettings({ theme: 'light', colorblind: false })).toBe(false)
      expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
      expect(saveStats(emptyStats())).toBe(false)
      expect(loadStats()).toEqual(emptyStats())
      expect(statsRecorded(date)).toBe(false)
      expect(() => markStatsRecorded(date)).not.toThrow()
      expect(cleanupOldGames(30)).toBe(0)
      expect(gameKey(date)).toBe(`amnal:v1:game:${date}`)
    } finally {
      restore()
    }
  })
})