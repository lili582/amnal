import { describe, expect, it } from 'vitest'
import { gamesPlayed, recordResult, winRate } from '../src/lib/stats'
import { emptyStats } from '../src/lib/storage'

describe('stats', () => {
  it('records a loss: increments played, resets streak', () => {
    const base = { ...emptyStats(), played: 5, streak: 3, maxStreak: 4 }
    const s = recordResult(base, 'lost', 10, '2026-10-05')
    expect(s.played).toBe(6)
    expect(s.wins).toBe(0)
    expect(s.streak).toBe(0)
    expect(s.maxStreak).toBe(4)
  })

  it('starts a streak on a first win and fills the distribution', () => {
    const s = recordResult(emptyStats(), 'won', 4, '2026-10-05')
    expect(s.wins).toBe(1)
    expect(s.streak).toBe(1)
    expect(s.maxStreak).toBe(1)
    expect(s.dist[3]).toBe(1)
    expect(s.lastWinDate).toBe('2026-10-05')
  })

  it('extends the streak on a consecutive Israeli day', () => {
    const base = recordResult(emptyStats(), 'won', 3, '2026-10-05')
    const s = recordResult(base, 'won', 5, '2026-10-06')
    expect(s.streak).toBe(2)
    expect(s.maxStreak).toBe(2)
    expect(s.dist[2]).toBe(1)
    expect(s.dist[4]).toBe(1)
  })

  it('does not extend the streak after a missed day', () => {
    const base = recordResult(emptyStats(), 'won', 2, '2026-10-05')
    const s = recordResult(base, 'won', 1, '2026-10-08')
    expect(s.streak).toBe(1)
  })

  it('clamps guess counts into the distribution range', () => {
    const s = recordResult(emptyStats(), 'won', 99, '2026-10-05')
    expect(s.dist[9]).toBe(1)
  })

  it('reports win rate and games played', () => {
    const s = recordResult(emptyStats(), 'won', 2, '2026-10-05')
    expect(gamesPlayed(s)).toBe(1)
    expect(winRate(s)).toBe(100)
    expect(winRate(emptyStats())).toBe(0)
  })
})