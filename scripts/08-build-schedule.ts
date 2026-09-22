// 08-build-schedule.ts — deterministic answer order for the daily puzzle.
// Never reshuffles an existing schedule: new answerEligible ids are appended
// at the end (deterministically shuffled among themselves).
import { readJson, writeJson, existsSync, log, ROOT, resolve } from './common.ts'
import { buildSchedule } from '../src/lib/daily.ts'
import { readFileSync } from 'node:fs'
import type { Artist } from '../src/types'

const SCHEDULE_SEED = 'amnal-schedule-2026-10'

export function run(): string[] {
  const artists = readJson<Artist[]>('public/data/artists.json')
  const ids = artists.filter((a) => a.answerEligible).map((a) => a.id)
  const schedulePath = resolve(ROOT, 'public/data/schedule.json')

  const existing = existsSync(schedulePath)
    ? (JSON.parse(readFileSync(schedulePath, 'utf8')) as string[])
    : []

  const known = new Set(existing)
  const fresh = ids.filter((id) => !known.has(id))
  const appended = fresh.length > 0 ? buildSchedule(fresh, SCHEDULE_SEED) : []
  const schedule = [...existing, ...appended]

  writeJson('public/data/schedule.json', schedule)
  log(`08: schedule length ${schedule.length} (appended ${appended.length} new)`)
  return schedule
}

if (process.argv[1]?.endsWith('08-build-schedule.ts')) {
  run()
}