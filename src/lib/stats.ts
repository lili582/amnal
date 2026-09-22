import type { GameStatus, StatsState } from '../types'
import { MAX_GUESSES } from '../config'
import { emptyStats } from './storage'
import { yesterdayIsraelDateString } from './daily'

// Record a finished game exactly once into the stats object (returns a new
// copy). Streak: consecutive Israeli calendar days with a win.
export function recordResult(
  prev: StatsState,
  status: GameStatus,
  guessesUsed: number,
  dateStr: string,
): StatsState {
  const stats: StatsState = {
    ...prev,
    dist: [...prev.dist],
  }

  stats.played += 1

  if (status !== 'won') {
    stats.streak = 0
    return stats
  }

  const count = Math.min(Math.max(guessesUsed, 1), MAX_GUESSES)
  stats.wins += 1
  stats.dist[count - 1] += 1
  stats.streak = prev.lastWinDate === yesterdayIsraelDateString(dateStr) ? prev.streak + 1 : 1
  if (stats.streak > stats.maxStreak) stats.maxStreak = stats.streak
  stats.lastWinDate = dateStr
  return stats
}

export function winRate(stats: StatsState): number {
  if (stats.played === 0) return 0
  return Math.round((stats.wins / stats.played) * 100)
}

export function gamesPlayed(stats: StatsState): number {
  return stats.played
}

export function freshStats(): StatsState {
  return emptyStats()
}