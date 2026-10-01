// 08-build-schedule.ts — deterministic answer order for the daily puzzle.
// Re-generates the full schedule from the current answerEligible pool. The
// shuffle is seeded, so the same eligible set always maps to the same order.
import { readJson, writeJson, log } from './common.ts'
import { buildSchedule } from '../src/lib/daily.ts'
import type { Artist } from '../src/types'

const SCHEDULE_SEED = 'amandle-schedule-2026-10'

export function run(): string[] {
  const artists = readJson<Artist[]>('public/data/artists.json')
  const ids = artists.filter((a) => a.answerEligible).map((a) => a.id)
  const schedule = ids.length > 0 ? buildSchedule(ids, SCHEDULE_SEED) : []

  writeJson('public/data/schedule.json', schedule)
  log(`08: schedule length ${schedule.length} (regenerated from ${ids.length} eligible ids)`)
  return schedule
}

if (process.argv[1]?.endsWith('08-build-schedule.ts')) {
  run()
}