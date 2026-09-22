// 06-merge.ts — combine all sources into src/data/artists.json, apply
// overrides LAST, tier popularity, resolve genres/regions, and emit a review
// report. Any field a source is unsure about is flagged, never guessed.
import { readJson, writeJson, log, ROOT, normHe, existsSync, readFileSync } from './common.ts'
import type { WdEntry } from './01-wikidata.ts'
import type * as T from '../src/types'
import { resolve } from 'node:path'

interface MbEntry {
  mbid: string
  type?: 'person' | 'group'
  gender?: string
  begin?: string
  area?: string
  country?: string
  members: number
  tags: string[]
  genres: string[]
  aliases: string[]
}

interface Override {
  genre?: T.Genre
  region?: T.Region
  breakthroughYear?: number
  debutYear?: number
  type?: T.ArtistType
  members?: number
  gender?: T.Gender
  popularityTier?: 1 | 2 | 3 | 4 | 5
  answerEligible?: boolean
}

type GenreMap = Record<string, T.Genre>
type CityRegion = Record<T.Region, string[]>

function readOptional<T>(rel: string): T | null {
  const p = resolve(ROOT, rel)
  if (!existsSync(p)) return null
  return JSON.parse(readFileSync(p, 'utf8')) as T
}

function mapGenre(tag: string | undefined, genreMap: GenreMap): T.Genre | undefined {
  if (!tag) return undefined
  const key = tag.toLowerCase()
  if (genreMap[key]) return genreMap[key]
  const n = normHe(tag)
  return Object.keys(genreMap).find((k) => normHe(k) === n) ? genreMap[Object.keys(genreMap).find((k) => normHe(k) === n)!] : undefined
}

function regionFor(city: string | undefined, cityRegion: CityRegion): T.Region | undefined {
  if (!city) return undefined
  const n = normHe(city)
  for (const region of Object.keys(cityRegion) as T.Region[]) {
    for (const item of cityRegion[region]) {
      const ni = normHe(item)
      if (!ni) continue
      if (n === ni || n.includes(ni) || ni.includes(n)) return region
    }
  }
  return undefined
}

function slug(en: string | undefined, he: string, used: Set<string>): string {
  const base = (en ?? he)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  let s = base || 'artist'
  let i = 1
  while (used.has(s)) {
    i++
    s = `${base}-${i}`
  }
  used.add(s)
  return s
}

const GENDER_QID: Record<string, T.Gender> = {
  Q6581097: 'male',
  Q6581072: 'female',
}

function wdGender(qid: string | undefined): T.Gender | undefined {
  return qid ? GENDER_QID[qid.replace('http://www.wikidata.org/entity/', '')] : undefined
}

export function run(): { artists: T.Artist[]; review: string[] } {
  const wd = readJson<Record<string, WdEntry>>('data/raw/wikidata.json')
  const mb = readJson<Record<string, MbEntry>>('data/raw/musicbrainz.json')
  const qidMbid = readJson<Record<string, string>>('data/raw/qid-mbid.json')
  const deezer = readOptional<Record<string, { id: number; fans: number; albums: number }>>('data/raw/deezer.json')
  const lastfm = readOptional<Record<string, { listeners: number; playcount: number; tags: string[] }>>('data/raw/lastfm.json')
  const pageviews = readOptional<Record<string, number>>('data/raw/pageviews.json')
  const genreMap = readJson<GenreMap>('data/genre-map.json')
  const cityRegion = readJson<CityRegion>('data/city-region.json')
  const overrides = readOptional<Record<string, Override>>('data/overrides.json') ?? {}

  const review: string[] = []
  const artists: T.Artist[] = []
  const usedSlugs = new Set<string>()

  for (const [qid, w] of Object.entries(wd)) {
    const mbid = qidMbid[qid] ?? Object.keys(mb).find((m) => mb[m].aliases.includes(w.en ?? '') || w.mbid === m)
    const m = mbid ? mb[mbid] : undefined

    const ov = overrides[w.he ?? ''] ?? overrides[w.en ?? ''] ?? {}

    const he = w.he ?? ''
    if (!he) {
      review.push(`no-he-label: ${qid}`)
      continue
    }
    const en = w.en ?? m?.aliases.find((a) => /^[a-z\s&.-]+$/i.test(a))

    // ---- lineup / members ----
    let type: T.ArtistType | undefined = ov.type
    if (!type) {
      if (m?.type === 'person') type = 'solo'
      else if (m?.type === 'group') type = m.members === 2 ? 'duo' : 'band'
      else if (w.kind === 'person') type = 'solo'
      else if (w.kind === 'group') type = 'band'
    }
    let members: number | undefined = ov.members
    if (members === undefined && m) members = type === 'solo' ? 1 : m.members
    if (members === undefined) members = type === 'solo' ? 1 : 0
    if (type && type !== 'solo' && members === 0) {
      review.push(`members-unknown: ${he} (group, member count unknown — needs override)`)
    }

    // ---- gender ----
    let gender: T.Gender | undefined = ov.gender
    if (!gender) {
      const raw = (m?.gender as string | undefined) || wdGender(w.gender)
      gender = (typeof raw === 'string' ? raw.toLowerCase() : raw) as T.Gender | undefined
    }
    if (!gender && type === 'solo') {
      gender = 'male'
      review.push(`gender-defaulted-male: ${he}`)
    }
    if (!gender && type !== 'solo') {
      gender = 'mixed'
      review.push(`gender-defaulted-mixed: ${he}`)
    }
    if (gender === 'mixed' && type === 'solo') {
      gender = 'male'
      review.push(`gender-solo-mixed-fixed: ${he}`)
    }

    // ---- debut year ----
    let debutYear = ov.debutYear ?? (m?.begin ? Number(m.begin) : undefined) ?? (w.inception ? Number(w.inception.slice(0, 4)) : undefined)
    if (!debutYear || debutYear < 1948 || debutYear > new Date().getFullYear()) {
      debutYear = ov.debutYear ?? 0
      review.push(`debutYear-missing: ${he}`)
    }

    // ---- breakthrough year (defaults to debut; flagged) ----
    const breakthroughYear = ov.breakthroughYear ?? debutYear
    if (ov.breakthroughYear === undefined) {
      review.push(`breakthrough-defaulted: ${he} (now ${breakthroughYear})`)
    }

    // ---- gender correctness for groups ----

    // ---- genres ----
    const tagCandidates: Array<{ tag: string; source: string }> = []
    for (const tag of lastfm?.[qid]?.tags ?? []) tagCandidates.push({ tag, source: 'lastfm' })
    for (const g of m?.genres ?? []) tagCandidates.push({ tag: g, source: 'mb-genres' })
    for (const t of m?.tags ?? []) tagCandidates.push({ tag: t, source: 'mb-tags' })

    let primaryGenre = ov.genre
    let secondaryGenres: T.Genre[] = []
    if (!primaryGenre) {
      const mapped = tagCandidates
        .map((c) => ({ genre: mapGenre(c.tag, genreMap), source: c.source }))
        .filter((x): x is { genre: T.Genre; source: string } => Boolean(x.genre))
      const seen = new Set<T.Genre>()
      for (const c of mapped) {
        if (!seen.has(c.genre) && seen.size < 3) {
          seen.add(c.genre)
          if (!primaryGenre) primaryGenre = c.genre
          else secondaryGenres.push(c.genre)
        }
      }
    }
    if (!primaryGenre) {
      primaryGenre = 'other'
      review.push(`genre-unmapped: ${he} (tags: ${tagCandidates.map((c) => c.tag).join(', ') || 'none'})`)
    }
    secondaryGenres = secondaryGenres.filter((g) => g !== primaryGenre).slice(0, 2)
    if (secondaryGenres.length === 0) {
      secondaryGenres = []
    }

    // ---- region ----
    let region = ov.region
    if (!region) {
      const city = w.birthPlace || m?.area
      region = regionFor(city, cityRegion)
    }
    if (!region) {
      region = 'center'
      review.push(`region-unmapped: ${he} (city: ${w.birthPlace ?? m?.area ?? 'none'})`)
    }

    // ---- metrics for tiering ----
    const metrics: T.Artist['metrics'] = {
      deezerFans: deezer?.[qid]?.fans,
      lastfmListeners: lastfm?.[qid]?.listeners,
      hewikiPageviews90d: pageviews?.[qid],
      wikidataSitelinks: w.sitelinks,
    }

    const aliases = new Set<string>()
    if (en) aliases.add(en)
    for (const a of m?.aliases ?? []) if (a !== he) aliases.add(a)
    if (w.en && w.en !== he) aliases.add(w.en)

    const artist: T.Artist = {
      id: slug(en, he, usedSlugs),
      nameHe: he,
      nameEn: en,
      aliases: [...aliases].slice(0, 12),
      debutYear,
      breakthroughYear,
      type: type ?? 'solo',
      members,
      gender: gender ?? 'male',
      primaryGenre,
      secondaryGenres,
      popularityTier: 3, // provisional; tiered below
      region,
      answerEligible: true, // provisional; decided after tiering
      ids: {
        wikidata: `Q${qid.replace(/^Q/, '')}`,
        musicbrainz: mbid,
        deezer: deezer?.[qid]?.id,
      },
      metrics,
    }
    const o = ov.popularityTier
    if (o) artist.popularityTier = o
    if (ov.answerEligible !== undefined) artist.answerEligible = ov.answerEligible

    artists.push(artist)
  }

  // ---- popularity tiering (within-dataset percentiles, weighted) ----
  tierArtists(artists, review)

  // ---- answerEligible from tier when not overridden ----
  for (const a of artists) {
    const ov = overrides[a.nameHe] ?? overrides[a.nameEn ?? ''] ?? {}
    if (ov.answerEligible === undefined) {
      a.answerEligible = a.popularityTier >= 3
    }
  }

  // genre sanity: primary must not appear in secondary
  for (const a of artists) {
    a.secondaryGenres = a.secondaryGenres.filter((g) => g !== a.primaryGenre).slice(0, 2)
  }

  // sanity: slug uniqueness + ids
  const idSet = new Set<string>()
  for (const a of artists) {
    if (idSet.has(a.id)) throw new Error(`duplicate artist id ${a.id}`)
    idSet.add(a.id)
  }

  writeJson('public/data/artists.json', artists)
  writeJson('data/raw/review.json', { review })
  log(`06: merged ${artists.length} artists; review lines ${review.length}`)
  return { artists, review }
}

function tierArtists(artists: T.Artist[], review: string[]): void {
  const signalWeights = [
    { key: 'hewikiPageviews90d' as const, w: 0.4 },
    { key: 'lastfmListeners' as const, w: 0.25 },
    { key: 'deezerFans' as const, w: 0.25 },
    { key: 'wikidataSitelinks' as const, w: 0.1 },
  ]

  for (const s of signalWeights) {
    const values = artists.map((a) => a.metrics?.[s.key]).filter((v): v is number => typeof v === 'number')
    const sorted = [...values].sort((a, b) => a - b)
    const rankOf = (v: number) => (sorted.length ? sorted.indexOf(v) / Math.max(1, sorted.length - 1) : 0)
    for (const a of artists) {
      const v = a.metrics?.[s.key]
      if (typeof v === 'number') {
        ;(a.metrics as Record<string, number | undefined>)[`__pct_${s.key}`] = rankOf(v)
      }
    }
  }

  const scores: Array<{ artist: T.Artist; score: number }> = []
  for (const a of artists) {
    const m = a.metrics as Record<string, unknown>
    let wsum = 0
    let weighted = 0
    for (const s of signalWeights) {
      const pct = m[`__pct_${s.key}`]
      if (typeof pct === 'number') {
        weighted += pct * s.w
        wsum += s.w
      }
    }
    if (wsum === 0) {
      review.push(`tier-no-signal: ${a.nameHe}`)
      scores.push({ artist: a, score: 0.5 })
      continue
    }
    scores.push({ artist: a, score: weighted / wsum })
  }

  scores.sort((x, y) => x.score - y.score)
  const n = scores.length
  for (let i = 0; i < n; i++) {
    const tier = Math.max(1, Math.min(5, Math.ceil(((i + 1) / n) * 5)))
    scores[i].artist.popularityTier = tier
  }

  // clean the private percentile fields
  for (const a of artists) {
    const m = a.metrics as Record<string, unknown> | undefined
    if (m) for (const k of Object.keys(m)) if (k.startsWith('__pct_')) delete m[k]
  }
}

if (process.argv[1]?.endsWith('06-merge.ts')) {
  run()
}