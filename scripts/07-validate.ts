// 07-validate.ts - schema check + a review report for the owner.
// Hard failures exit non-zero; warnings are collected into data/review-report.md
// and the raw review lines are re-exported for CI.
import { readJson, writeFileSync, readFileSync, existsSync, mkdirSync, ROOT, resolve } from './common.ts'
import type { Artist } from '../src/types'
import { join } from 'node:path'

interface RawReview {
  review?: string[]
}

export function run(): { artists: Artist[]; hard: string[]; warns: string[] } {
  const hard: string[] = []
  const warns: string[] = []

  function check(cond: boolean, msg: string, fatal = false): void {
    if (cond) return
    if (fatal) hard.push(msg)
    else warns.push(msg)
  }

  const artists = readJson<Artist[]>('public/data/artists.json')

  const ids = new Set<string>()
  const seenEn = new Set<string>()
  for (const a of artists) {
    check(Boolean(a.nameHe), `empty nameHe for ${a.id}`, true)
    check(!ids.has(a.id), `duplicate id ${a.id}`, true)
    ids.add(a.id)
    if (a.nameEn) {
      check(seenEn.has(a.nameEn) === false, `duplicate latin name ${a.nameEn}`, false)
      seenEn.add(a.nameEn)
    }
    const debutOk = a.debutYear === 0 || (a.debutYear >= 1948 && a.debutYear <= new Date().getFullYear())
    if (a.answerEligible) check(debutOk, `invalid debutYear for ${a.nameHe}`, true)
    else check(debutOk, `invalid debutYear for ${a.nameHe} (not eligible)`, false)
    const unknownMembers = a.type !== 'solo' && a.members === 0
    const okMembers =
      unknownMembers ||
      (a.type === 'solo' && a.members === 1) ||
      (a.type === 'duo' && a.members === 2) ||
      (a.type === 'band' && a.members >= 3)
    if (a.answerEligible) check(okMembers, `type/members inconsistent for ${a.nameHe}`, true)
    else check(okMembers, `type/members inconsistent for ${a.nameHe} (not eligible)`, false)
    check(!a.secondaryGenres.includes(a.primaryGenre), `primary genre listed as secondary for ${a.nameHe}`, true)
    if (a.nameEn) {
      const latinAlias = [a.nameEn, ...a.aliases].some((x) => /^[a-z&.\s-]+$/i.test(x ?? ''))
      check(latinAlias, `no latin-script alias for ${a.nameHe}`, false)
    }
  }

  const eligible = artists.filter((a) => a.answerEligible).length
  check(eligible >= 150, `answerEligible count ${eligible} < 150`, false)

  const schedulePath = resolve(ROOT, 'public/data/schedule.json')
  if (existsSync(schedulePath)) {
    const schedule = JSON.parse(readFileSync(schedulePath, 'utf8')) as string[]
    const eligibleIds = new Set(artists.filter((a) => a.answerEligible).map((a) => a.id))
    check(new Set(schedule).size === schedule.length, `schedule has ${schedule.length - new Set(schedule).size} duplicate(s)`, true)
    check(schedule.every((id) => eligibleIds.has(id)), `schedule contains ids not flagged answerEligible`, true)
  }

  // Merge the pipeline review report from 06 (if present).
  const reviewLines: string[] = []
  const reviewPath = resolve(ROOT, 'data/raw/review.json')
  if (existsSync(reviewPath)) {
    const raw = JSON.parse(readFileSync(reviewPath, 'utf8')) as RawReview
    reviewLines.push(...(raw.review ?? []))
  }
  for (const w of warns) reviewLines.push(`validate-warns: ${w}`)

  writeReviewReport(artists, reviewLines, hard)
  return { artists, hard, warns }
}

function writeReviewReport(artists: Artist[], lines: string[], hard: string[]): void {
  const md: string[] = [`# Review report - manual fixes needed`, '', `Generated for ${artists.length} artists.`, '']
  if (hard.length > 0) {
    md.push('## Hard errors', '')
    md.push(...hard.map((h) => `- [ ] ${h}`))
    md.push('')
  }
  md.push('## Flags (from pipeline + validate)', '')
  const grouped = new Map<string, string[]>()
  for (const line of lines) {
    const sep = line.indexOf(':')
    const kind = sep > 0 ? line.slice(0, sep) : 'misc'
    if (!grouped.has(kind)) grouped.set(kind, [])
    grouped.get(kind)!.push(line)
  }
  for (const [kind, items] of [...grouped.entries()].sort()) {
    md.push(`### ${kind} (${items.length})`, '')
    md.push(...items.map((i) => `- [ ] ${i}`))
    md.push('')
  }
  md.push('## All artists', '', '| id | nameHe | debut | breakthrough | type | gender | genre | tier | region |', '|---|--------|-------|--------------|------|--------|-------|------|--------|')
  for (const a of artists) {
    md.push(
      `| ${a.id} | ${a.nameHe} | ${a.debutYear} | ${a.breakthroughYear} | ${a.type}/${a.members} | ${a.gender} | ${a.primaryGenre} | ${a.popularityTier} | ${a.region} |`,
    )
  }
  mkdirSync(join(ROOT, 'data'), { recursive: true })
  writeFileSync(join(ROOT, 'data/review-report.md'), md.join('\n'), 'utf8')
}

const { hard, warns } = run()
if (hard.length > 0) {
  console.error('Validation failed:\n' + hard.map((x) => ' - ' + x).join('\n'))
  process.exit(1)
}

console.log(warns.length === 0 ? 'Validation passed (no warnings).' : `Validation passed with ${warns.length} warnings (see data/review-report.md).`)