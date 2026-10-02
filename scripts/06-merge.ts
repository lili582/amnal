// 06-merge.ts — combine all sources into src/data/artists.json, apply
// overrides LAST, tier popularity (Spotify listenership dominates), force the
// pool to exactly 1000 artists, resolve genres/regions, and emit a review
// report. Any field a source is unsure about is flagged, never guessed.
import { readJson, writeJson, log, ROOT, normHe, existsSync, readFileSync, resolve, wdGender } from './common.ts'
import type { WdEntry } from './01-wikidata.ts'
import { isActorOccupation, isRecognisedMusician } from './music-cat.ts'
import type * as T from '../src/types'

const POOL_SIZE = 1000

interface MbEntry {
  mbid: string
  type?: 'person' | 'group'
  gender?: string
  begin?: string
  firstRelease?: string
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
  birthYear?: number
  type?: T.ArtistType
  members?: number
  gender?: T.Gender
  popularityTier?: 1 | 2 | 3 | 4 | 5
  answerEligible?: boolean
}

interface SpotifySignal {
  name: string
  spotifyId?: string
  streams: number
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
  const direct = Object.keys(genreMap).find((k) => normHe(k) === n)
  if (direct) return genreMap[direct]
  // Wikidata P136 labels are canonical ("pop music", "hip hop music",
  // "mizrahi music"), which no map key uses verbatim. Retry with the generic
  // " music" suffix dropped, then on the head noun ("hip hop" -> "hip hop").
  const trimmed = n.replace(/\s*music$/, '').trim()
  if (trimmed && trimmed !== n) {
    const t = Object.keys(genreMap).find((k) => normHe(k) === trimmed)
    if (t) return genreMap[t]
  }
  const head = trimmed.split(/\s+/).slice(0, 2).join(' ')
  if (head && head !== trimmed) {
    const h = Object.keys(genreMap).find((k) => normHe(k) === head)
    if (h) return genreMap[h]
  }
  return undefined
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

// A group has no gender of its own, so it inherits the gender of its members:
// all male -> 'male', all female -> 'female', both present -> 'mixed'. When no
// member is resolvable there is no evidence either way, so fall back to 'mixed'
// and let the caller flag it for curation.
function groupGender(memberGenders: Array<'male' | 'female'> | undefined): T.Gender {
  const gs = memberGenders ?? []
  if (gs.length === 0) return 'mixed'
  if (gs.every((g) => g === 'male')) return 'male'
  if (gs.every((g) => g === 'female')) return 'female'
  return 'mixed'
}

export function run(): { artists: T.Artist[]; review: string[] } {
  const wd = readJson<Record<string, WdEntry>>('data/raw/wikidata.json')
  const mb = readJson<Record<string, MbEntry>>('data/raw/musicbrainz.json')
  const qidMbid = readJson<Record<string, string>>('data/raw/qid-mbid.json')
  const deezer = readOptional<Record<string, { id: number; fans: number; albums: number }>>('data/raw/deezer.json')
  const lastfm = readOptional<Record<string, { listeners: number; playcount: number; tags: string[] }>>('data/raw/lastfm.json')
  const pageviews = readOptional<Record<string, number>>('data/raw/pageviews.json')
  const spotify = readOptional<Record<string, SpotifySignal>>('data/raw/spotify.json')
  const imageCache = readOptional<Record<string, string>>('data/raw/images.json')
  const famousSongs = readOptional<Record<string, T.FamousSong>>('data/famous-songs.json')
  const genreMap = readJson<GenreMap>('data/genre-map.json')
  const cityRegion = readJson<CityRegion>('data/city-region.json')
  const overrides = readOptional<Record<string, Override>>('data/overrides.json') ?? {}
  const hecats = readOptional<Record<string, string[]>>('data/raw/hecats.json') ?? {}

  const review: string[] = []
  const artists: T.Artist[] = []
  const usedSlugs = new Set<string>()

  for (const [qid, w] of Object.entries(wd)) {
    // An answer has to be a *music* artist. Wikidata cannot enforce this: it
    // tags a TV actor who sang one guest song with occupation "singer", exactly
    // like a real singer who also acts. So acting occupations are only allowed
    // through when hewiki itself categorises the person as a performer.
    if (isActorOccupation(w.occupations) && !isRecognisedMusician(hecats[qid], true)) {
      review.push(`dropped-nonmusic-actor: ${w.he ?? w.en ?? qid} (${qid})`)
      continue
    }

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
      gender = groupGender(w.memberGenders)
      review.push(
        gender === 'mixed'
          ? `gender-defaulted-mixed: ${he} (no member genders — needs override)`
          : `gender-from-members: ${he} (${w.memberGenders?.length} members, all ${gender})`,
      )
    }
    if (gender === 'mixed' && type === 'solo') {
      gender = 'male'
      review.push(`gender-solo-mixed-fixed: ${he}`)
    }

    // ---- debut year ----
    // MusicBrainz 'begin' is the birth date for persons, not a career start —
    // only use it for groups. Persons fall back to their work-period start
    // (when they first became active) or their first release via inception.
    const mbBeginYear = m?.begin ? Number(m.begin) : undefined
    let debutYear =
      ov.debutYear ??
      (m?.type === 'group' && mbBeginYear ? mbBeginYear : undefined) ??
      (w.activeSince ? Number(w.activeSince) : undefined) ??
      (w.inception ? Number(w.inception.slice(0, 4)) : undefined)
    if (!debutYear || debutYear < 1948 || debutYear > new Date().getFullYear()) {
      debutYear = ov.debutYear ?? 0
      review.push(`debutYear-missing: ${he}`)
    }

    // ---- birth year ----
    const birthYear = ov.birthYear ?? (w.birth ? Number(w.birth) : undefined)
    if (!birthYear || birthYear < 1900 || birthYear > new Date().getFullYear()) {
      review.push(`birthYear-missing: ${he}`)
    }

    // ---- breakthrough year (the year the artist became famous) ----
    // Prefer the curated override, then Wikidata work-period start (when the
    // artist first became active), then their first album release, then debut.
    const breakthroughYear =
      ov.breakthroughYear ??
      (w.activeSince ? Number(w.activeSince) : undefined) ??
      (m?.firstRelease ? Number(m.firstRelease) : undefined) ??
      debutYear
    if (ov.breakthroughYear === undefined) {
      review.push(`breakthrough-defaulted: ${he} (now ${breakthroughYear})`)
    }

    // ---- genres ----
    // Wikidata P136 is hand-curated, so it outranks the free-text MusicBrainz /
    // Last.fm tags; those only fill in what P136 does not state.
    const tagCandidates: Array<{ tag: string; source: string }> = []
    for (const g of w.genres ?? []) tagCandidates.push({ tag: g, source: 'wd-genre' })
    for (const g of m?.genres ?? []) tagCandidates.push({ tag: g, source: 'mb-genres' })
    for (const t of m?.tags ?? []) tagCandidates.push({ tag: t, source: 'mb-tags' })
    for (const tag of lastfm?.[qid]?.tags ?? []) tagCandidates.push({ tag, source: 'lastfm' })

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
      spotifyStreams: spotify?.[qid]?.streams,
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
      birthYear: birthYear && birthYear >= 1900 && birthYear <= new Date().getFullYear() ? birthYear : undefined,
      diedYear: w.died && Number(w.died) >= 1800 && Number(w.died) <= new Date().getFullYear() ? Number(w.died) : undefined,
      breakthroughYear,
      type: type ?? 'solo',
      members,
      gender: gender ?? 'male',
      primaryGenre,
      secondaryGenres,
      popularityTier: 3, // provisional; tiered below
      region,
      answerEligible: true, // provisional; decided after tiering
      famousSong: famousSongs?.[qid] ?? famousSongs?.[w.en ?? ''] ?? famousSongs?.[he],
      imageUrl: imageCache?.[qid],
      ids: {
        wikidata: `Q${qid.replace(/^Q/, '')}`,
        musicbrainz: mbid,
        deezer: deezer?.[qid]?.id,
        spotify: spotify?.[qid]?.spotifyId,
      },
      metrics,
    }
    const o = ov.popularityTier
    if (o) artist.popularityTier = o
    if (ov.answerEligible !== undefined) artist.answerEligible = ov.answerEligible

    artists.push(artist)
  }

  // ---- popularity tiering (within-dataset percentiles, weighted) ----
  // Spotify listenership is now the dominant signal (see tierArtists below).
  tierArtists(artists, review)

  // ---- answerEligible from tier when not overridden ----
  const nowYear = new Date().getFullYear()
  const debutOk = (a: T.Artist): boolean => a.debutYear >= 1948 && a.debutYear <= nowYear
  for (const a of artists) {
    const ov = overrides[a.nameHe] ?? overrides[a.nameEn ?? ''] ?? {}
    if (ov.answerEligible === undefined) {
      a.answerEligible = a.popularityTier >= 3 && debutOk(a)
    }
  }

  // ---- force the pool to exactly POOL_SIZE ----
  // Scheduled ids must never drop out (the daily rotation is append-only), so
  // they are always kept; the remaining slots go to the top Spotify-listened
  // artists first, then to the best of the rest. Dropped artists are removed
  // from the output dataset entirely.
  const schedulePath = resolve(ROOT, 'public/data/schedule.json')
  const existingSchedule = existsSync(schedulePath)
    ? (JSON.parse(readFileSync(schedulePath, 'utf8')) as string[])
    : []
  const { pool, droppedCount } = forcePool(artists, existingSchedule, POOL_SIZE)
  artists.length = 0
  artists.push(...pool)
  if (droppedCount > 0) review.push(`pool-dropped: ${droppedCount} artists removed to cap the pool at ${POOL_SIZE}`)

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
    { key: 'spotifyStreams' as const, w: 0.45 },
    { key: 'hewikiPageviews90d' as const, w: 0.25 },
    { key: 'deezerFans' as const, w: 0.2 },
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

// Select exactly POOL_SIZE artists for the game pool. Artists already in the
// previous schedule are always kept in the pool (so an artist a player already
// guessed never disappears from the guess list); the remaining slots go first to
// the highest-Spotify-listened artists, then to the best of the rest (by
// pageviews, then deezer). Returns the pool and the number of artists dropped.
function forcePool(
  artists: T.Artist[],
  scheduleOrder: string[],
  size: number,
): { pool: T.Artist[]; droppedCount: number } {
  const byId = new Map(artists.map((a) => [a.id, a]))
  const pool: T.Artist[] = []

  for (const id of scheduleOrder) {
    const a = byId.get(id)
    if (a) pool.push(a)
  }

  const rest = artists.filter((a) => !pool.includes(a)).sort((x, y) => {
    const xs = x.metrics?.spotifyStreams ?? 0
    const ys = y.metrics?.spotifyStreams ?? 0
    if (xs || ys) return ys - xs
    const xv = x.metrics?.hewikiPageviews90d ?? 0
    const yv = y.metrics?.hewikiPageviews90d ?? 0
    if (xv !== yv) return yv - xv
    return (y.metrics?.deezerFans ?? 0) - (x.metrics?.deezerFans ?? 0)
  })

  for (const a of rest) {
    if (pool.length >= size) break
    pool.push(a)
  }

  // Assign a Spotify-based rank metric for diagnostics (1 = most streamed).
  const spRanked = [...pool].filter((a) => a.metrics?.spotifyStreams).sort(
    (x, y) => (y.metrics?.spotifyStreams ?? 0) - (x.metrics?.spotifyStreams ?? 0),
  )
  spRanked.forEach((a, i) => {
    a.metrics = { ...a.metrics, spotifyRank: i + 1 }
  })

  return { pool, droppedCount: artists.length - pool.length }
}

if (process.argv[1]?.endsWith('06-merge.ts')) {
  run()
}