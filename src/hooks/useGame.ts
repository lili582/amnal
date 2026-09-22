import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Artist, GameStatus, GuessRecord, Match, SaveState } from '../types'
import { MAX_GUESSES } from '../config'
import type { GameData } from '../lib/dataLoader'
import { answerForDay, dayNumberFor, israelDateString } from '../lib/daily'
import { compareArtist } from '../lib/compare'
import {
  loadGame,
  saveGame,
  cleanupOldGames,
  loadStats,
  saveStats,
  statsRecorded,
  markStatsRecorded,
} from '../lib/storage'
import { recordResult } from '../lib/stats'

const GAME_STATUSES: readonly string[] = ['playing', 'won', 'lost']

function parseSaved(raw: SaveState | null, date: string): SaveState {
  if (
    raw &&
    raw.date === date &&
    Array.isArray(raw.guesses) &&
    GAME_STATUSES.includes(raw.status)
  ) {
    return { guesses: raw.guesses, status: raw.status, date }
  }
  return { guesses: [], status: 'playing', date }
}

// Dev preview: ?day=N overrides the current date for testing any day of the
// schedule. Gated behind DEV so a production build ignores the query string.
function resolveDayNumber(today: string, isDev: boolean): number {
  if (isDev) {
    try {
      const day = new URLSearchParams(window.location.search).get('day')
      const n = Number(day)
      if (Number.isFinite(n) && n >= 0) return Math.floor(n)
    } catch {
      // ignore malformed / blocked window access
    }
  }
  return dayNumberFor(today)
}

export interface UseGame {
  today: string
  dayNumber: number
  target: Artist | null
  guesses: GuessRecord[]
  status: GameStatus
  maxGuesses: number
  artistsById: ReadonlyMap<string, Artist>
  guessedIds: ReadonlySet<string>
  shareRows: Match[][]
  notice: string | null
  submitGuess: (artist: Artist) => void
  clearNotice: () => void
}

export function useGame(data: GameData): UseGame {
  const artistsById = useMemo(() => new Map(data.artists.map((a) => [a.id, a])), [data])
  const today = useMemo(() => israelDateString(new Date()), [])
  const isDev = (import.meta as { env?: { DEV?: boolean } }).env?.DEV === true
  const dayNumber = useMemo(() => resolveDayNumber(today, isDev), [today, isDev])
  const targetId = answerForDay(data.schedule, dayNumber)
  const target = artistsById.get(targetId) ?? null

  const [game, setGame] = useState<SaveState>(() => parseSaved(loadGame(today), today))
  const [notice, setNotice] = useState<string | null>(null)
  const statsDoneRef = useRef(statsRecorded(today))

  // Persist every change. Reloading mid-game restores exactly this state.
  useEffect(() => {
    saveGame(today, game)
  }, [today, game])

  // Housekeeping: drop games older than a month, once per mount.
  useEffect(() => {
    try {
      cleanupOldGames(30)
    } catch {
      // blocked storage — nothing to clean
    }
  }, [])

  // Record a finished day's result exactly once, even across reloads.
  useEffect(() => {
    if (game.status === 'playing' || statsDoneRef.current) return
    statsDoneRef.current = true
    const stats = recordResult(loadStats(), game.status, game.guesses.length, today)
    saveStats(stats)
    markStatsRecorded(today)
  }, [game.status, game.guesses.length, today])

const submitGuess = useCallback(
    (artist: Artist) => {
      if (game.status !== 'playing' || !target) return
      if (game.guesses.some((g) => g.artistId === artist.id)) {
        setNotice('alreadyGuessed')
        return
      }
      setNotice(null)
      const tiles = compareArtist(artist, target)
      const won = artist.id === target.id
      const guesses: GuessRecord[] = [...game.guesses, { artistId: artist.id, tiles }]
      const status: GameStatus =
        won ? 'won' : guesses.length >= MAX_GUESSES ? 'lost' : 'playing'
      setGame({ guesses, status, date: today })
    },
    [game, target, today],
  )

  const clearNotice = useCallback(() => setNotice(null), [])

  const guessedIds = useMemo(() => new Set(game.guesses.map((g) => g.artistId)), [game])
  // Share grid is chronological (first guess first); the screen shows newest on top.
  const shareRows = useMemo(
    () => game.guesses.map((g) => g.tiles.map((t) => t.match)),
    [game],
  )

  return {
    today,
    dayNumber,
    target,
    guesses: game.guesses,
    status: game.status,
    maxGuesses: MAX_GUESSES,
    artistsById,
    guessedIds,
    shareRows,
    notice,
    submitGuess,
    clearNotice,
  }
}