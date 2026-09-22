import { describe, expect, it } from 'vitest'
import {
  answerForDay,
  buildSchedule,
  dayNumberFor,
  hashString,
  israelDateString,
  israelMidnightEpoch,
  tomorrowIsraelDateString,
  yesterdayIsraelDateString,
} from '../src/lib/daily'

describe('israelDateString', () => {
  it('returns the Israeli calendar date for UTC instants', () => {
    expect(israelDateString(new Date('2026-10-01T00:00:00Z'))).toBe('2026-10-01')
    expect(israelDateString(new Date('2026-10-01T22:30:00Z'))).toBe('2026-10-02')
  })
})

describe('dayNumberFor', () => {
  it('counts whole calendar days from launch', () => {
    expect(dayNumberFor('2026-10-01')).toBe(0)
    expect(dayNumberFor('2026-10-02')).toBe(1)
    expect(dayNumberFor('2026-09-30')).toBe(-1)
    expect(dayNumberFor('2027-10-01')).toBe(365)
  })

  it('is invariant across the spring DST shift (Israel 2026)', () => {
    // DST begins 2026-03-27 02:00 IL; both instants are 2026-03-27 in Israel.
    const before = israelDateString(new Date('2026-03-26T23:59:00Z'))
    const after = israelDateString(new Date('2026-03-27T00:30:00Z'))
    expect(before).toBe('2026-03-27')
    expect(after).toBe('2026-03-27')
    expect(dayNumberFor(before)).toBe(dayNumberFor(after))
  })

  it('increments by exactly one per weekday across fall-back DST', () => {
    // DST ends 2026-10-25 (clocks back at 03:00 IL -> 02:00 IL).
    const start = Date.parse('2026-10-22T00:00:00Z')
    const previous = dayNumberFor(israelDateString(new Date(start)))
    for (let i = 1; i <= 5; i++) {
      const nextMs = start + i * 86_400_000
      const next = dayNumberFor(israelDateString(new Date(nextMs)))
      expect(next).toBe(previous + i)
    }
  })
})

describe('hashString / schedule', () => {
  it('is deterministic and stable', () => {
    const a = hashString('אמנל-schedule')
    expect(a).toBe(hashString('אמנל-schedule'))
    expect(a).toBeGreaterThan(0)
  })

  it('buildSchedule shuffles deterministically, uses every id once per cycle', () => {
    const ids = ['a', 'b', 'c', 'd', 'e']
    const s1 = buildSchedule(ids, 'seed-x')
    const s2 = buildSchedule(ids, 'seed-x')
    expect(s1).toEqual(s2)
    expect(s1.sort()).toEqual(ids.sort())
  })

  it('different seeds give different orders (with enough ids)', () => {
    const ids = Array.from({ length: 50 }, (_, i) => `id-${i}`)
    const s1 = buildSchedule(ids, 'one')
    const s2 = buildSchedule(ids, 'two')
    expect(s1).not.toEqual(s2)
  })

  it('answerForDay cycles without repeats until the cycle completes', () => {
    const schedule = buildSchedule(Array.from({ length: 10 }, (_, i) => `a${i}`), 's')
    const seen = new Set<string>()
    for (let day = 0; day < 10; day++) {
      const id = answerForDay(schedule, day)
      expect(seen.has(id)).toBe(false)
      seen.add(id)
    }
    // day 10 restarts the cycle
    expect(answerForDay(schedule, 10)).toBe(schedule[0])
  })
})

describe('day arithmetic helpers', () => {
  it('tomorrow/yesterday stay on the same calendar grid', () => {
    expect(tomorrowIsraelDateString('2026-10-31')).toBe('2026-11-01')
    expect(yesterdayIsraelDateString('2026-03-01')).toBe('2026-02-28')
  })
})

describe('israelMidnightEpoch', () => {
  it('returns the exact start instant of an Israeli calendar day', () => {
    const e = israelMidnightEpoch('2026-10-01')
    expect(israelDateString(new Date(e))).toBe('2026-10-01')
    expect(israelDateString(new Date(e - 60_000))).toBe('2026-09-30')
  })
})