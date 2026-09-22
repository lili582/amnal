// 02-musicbrainz.ts — resolve MBIDs and enrich type, members, begin date,
// area, tags/genres. Writes data/raw/musicbrainz.json keyed by MBID.
import { cachedFetch, log, writeJson, readJson, normHe } from './common.ts'
import type { WdEntry } from './01-wikidata.ts'

const MB = 'https://musicbrainz.org/ws/2'
const LOOKUP_DELAY = 1150 // hard-throttle to ~1 req/s

interface MbEntry {
  mbid: string
  type?: string
  gender?: string
  begin?: string
  area?: string
  country?: string
  members: number
  tags: string[]
  genres: string[]
  aliases: string[]
}

const CACHE: Record<string, MbEntry> = {}
let lastLookup = 0

function normalizeType(t?: string): 'person' | 'group' | undefined {
  if (t === 'Person') return 'person'
  if (t === 'Group') return 'group'
  return undefined
}

async function lookup(mbid: string): Promise<MbEntry> {
  if (CACHE[mbid]) return CACHE[mbid]
  const wait = LOOKUP_DELAY - (Date.now() - lastLookup)
  await new Promise((r) => setTimeout(r, Math.max(0, wait)))
  lastLookup = Date.now()

  const data = (await cachedFetch(
    `${MB}/artist/${mbid}?inc=tags+genres+aliases+artist-rels&fmt=json`,
    { cacheSource: 'musicbrainz', cacheKey: mbid, retries: 3 },
  )) as Record<string, unknown> & {
    type?: string
    gender?: string
    'life-span'?: { begin?: string }
    area?: { name?: string }
    country?: string
    tags?: Array<{ name: string; count: number }>
    genres?: Array<{ name: string; count: number }>
    aliases?: Array<{ name: string; locale?: string; primary?: boolean }>
  }

  const members = (data['artist-rels'] as Array<{ type?: string }> | undefined)?.filter(
    (r) => r.type === 'member of band',
  ).length ?? 0

  const tagNames = (data.tags ?? [])
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((t) => t.name)
  const genreNames = (data.genres ?? [])
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((g) => g.name)
  const hebyaliases = (data.aliases ?? [])
    .filter((a) => a.locale === 'he')
    .map((a) => a.name)

  const entry: MbEntry = {
    mbid,
    type: normalizeType(data.type),
    gender: data.gender ?? undefined,
    begin: data['life-span']?.begin?.slice(0, 4) ?? undefined,
    area: data.area?.name ?? undefined,
    country: data.country ?? undefined,
    members,
    tags: tagNames,
    genres: genreNames,
    aliases: hebyaliases,
  }
  CACHE[mbid] = entry
  return entry
}

async function searchByQuery(query: string): Promise<MbEntry | null> {
  const wait = LOOKUP_DELAY - (Date.now() - lastLookup)
  await new Promise((r) => setTimeout(r, Math.max(0, wait)))
  lastLookup = Date.now()
  const data = (await cachedFetch(
    `${MB}/artist/?query=${encodeURIComponent(query)}&limit=5&fmt=json`,
    { cacheSource: 'musicbrainz', cacheKey: `search-${normHe(query).replace(/\s+/g, '-')}`, retries: 3 },
  )) as { artists?: Array<{ id: string }> }
  if (!data.artists?.length) return null
  return lookup(data.artists[0].id)
}

export async function run(): Promise<{ entries: Record<string, MbEntry> }> {
  const wikidata = readJson<Record<string, WdEntry>>('data/raw/wikidata.json')
  const entries: Record<string, MbEntry> = {}

  const candidates =
    process.argv.includes('--all')
      ? readJson<Record<string, WdEntry>>('data/raw/wikidata-candidates.json')
      : wikidata

  const names = new Set<string>()
  for (const [qid, wd] of Object.entries(candidates)) {
    const key = wd.en ?? wd.he ?? qid
    if (names.has(key)) continue
    names.add(key)

    let entry: MbEntry | null = null
    if (wd.mbid) {
      try {
        entry = await lookup(wd.mbid)
      } catch {
        entry = null
      }
    }
    if (!entry && wd.en) {
      try {
        const q = `artist:"${wd.en}" AND country:IL`
        entry = await searchByQuery(q)
      } catch {
        entry = null
      }
    }
    if (entry) entries[entry.mbid] = entry
    if (Object.keys(entries).length % 25 === 0) {
      log(`02: ${Object.keys(entries).length} resolved so far`)
    }
  }

  writeJson('data/raw/musicbrainz.json', entries)

  // primary resolve: qid -> mbid for candidates too
  const qidToMbid: Record<string, string> = {}
  for (const [qid, wd] of Object.entries(candidates)) {
    if (wd.mbid) {
      qidToMbid[qid] = wd.mbid
      continue
    }
    // match resolved entries by English or Hebrew name
    const hit = Object.values(entries).find(
      (e) => normHe(e.aliases.join(' ')) === normHe(wd.en ?? '') || normHe(e.aliases.join(' ')) === normHe(wd.he ?? ''),
    )
    if (hit) qidToMbid[qid] = hit.mbid
  }
  writeJson('data/raw/qid-mbid.json', qidToMbid)
  log(`02: musicbrainz entries ${Object.keys(entries).length}, qid->mbid ${Object.keys(qidToMbid).length}`)
  return { entries }
}

if (process.argv[1]?.endsWith('02-musicbrainz.ts')) {
  run().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}