// 01-wikidata.ts — resolve seed names to validated Wikidata QIDs and enrich
// facts using only the reliable MediaWiki APIs (wbsearchentities +
// wbgetentities). SPARQL is used solely for the optional stage-1 pool-growth
// query and failures there are non-fatal.
import { cachedFetch, log, writeJson, readJson, existsSync, resolve, ROOT, wdGender } from './common.ts'
import type { KworbSnapshot } from './00-kworb.ts'

const WIKIBASE_API = 'https://www.wikidata.org/w/api.php'
const SPARQL = 'https://query.wikidata.org/sparql'

const Q_ISRAEL = 'Q801'
const Q_BAND_INSTANCES = new Set([
  'Q215380', // musical group (superclass)
  'Q2088357', // musical ensemble
  'Q5741069', // rock band
  'Q641066', // girl group
  'Q9212979', // musical duo
])
const Q_MUSICIAN_OCC = new Set([
  'Q177220', // singer
  'Q639669', // musician
  'Q488205', // singer-songwriter
  'Q2252262', // rapper
  'Q130857', // DJ
  'Q36834', // composer
  'Q753110', // songwriter
])
const P_CITIZENSHIP = 'P27'
const P_COUNTRY_OF_ORIGIN = 'P495'
const P_OCCUPATION = 'P106'
const P_INSTANCE_OF = 'P31'
const P_GENDER = 'P21'
const P_BIRTH = 'P569'
const P_DEATH = 'P570'
const P_INCEPTION = 'P571'
const P_BIRTH_PLACE = 'P19'
const P_GENRE = 'P136'
const P_MBID = 'P434'
const P_WORK_PERIOD_START = 'P2031'
const P_HAS_PART = 'P527' // group -> its members

interface Datavalue {
  value?: { id?: string; time?: string; precision?: number } | string
}

interface Snak {
  mainsnak?: { datavalue?: Datavalue }
}

interface Entity {
  id: string
  labels?: Record<string, { value: string }>
  claims?: Record<string, Snak[]>
  sitelinks?: Record<string, { title: string }>
}

export interface WdEntry {
  qid: string
  he?: string
  en?: string
  kind?: 'person' | 'group'
  sitelinks: number
  mbid?: string
  hewiki?: string
  gender?: string
  birth?: string
  died?: string
  activeSince?: string
  inception?: string
  birthPlace?: string
  memberQids?: string[] // groups: P527 members
  memberGenders?: Array<'male' | 'female'> // gender of each resolvable member
  genres: string[]
  source: 'seed' | 'candidate' | 'spotify'
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Run an async task for each item with at most `limit` tasks in flight.
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i])
    }
  })
  await Promise.all(workers)
  return out
}

function readOptionalKworb(): KworbSnapshot {
  try {
    if (existsSync(resolve(ROOT, 'data/raw/kworb.json'))) {
      return readJson<KworbSnapshot>('data/raw/kworb.json')
    }
  } catch {
    // ignore malformed snapshot
  }
  return { fetchedAt: 'none', artists: [] }
}

// The cache key is derived from the chunk's first QIDs, so distinct callers must
// pass distinct prefixes or a chunk can collide with an unrelated cached one.
async function fetchEntities(qids: string[], prefix = 'entities'): Promise<Record<string, Entity>> {
  const out: Record<string, Entity> = {}
  const total = Math.ceil(qids.length / 50)
  for (let i = 0; i < qids.length; i += 50) {
    const chunk = qids.slice(i, i + 50)
    const url = `${WIKIBASE_API}?action=wbgetentities&ids=${chunk.join('|')}&props=labels|claims|sitelinks&languages=he|en&format=json`
    const data = (await cachedFetch(url, {
      cacheSource: 'wikidata',
      cacheKey: `${prefix}-${chunk.slice(0, 2).map((q) => q.replace(/^Q/, '')).join('-')}-${chunk.length}`,
      delayMs: 120,
    })) as { entities?: Record<string, Entity> }
    Object.assign(out, data.entities ?? {})
    if (prefix === 'entities' && total > 20 && (i / 50 + 1) % 10 === 0) {
      log(`01: entities ${i / 50 + 1}/${total} chunks`)
    }
  }
  return out
}

function claimValues(e: Entity, prop: string): unknown[] {
  return (e.claims?.[prop] ?? []).map((s) => s.mainsnak?.datavalue?.value).filter(Boolean)
}

function valueText(v: unknown): string | undefined {
  if (typeof v === 'string') return v
  if (v && typeof v === 'object') {
    const o = v as { id?: string; time?: string }
    return o.id ?? o.time ?? undefined
  }
  return undefined
}

// Classify an entity. Returns a suggestion score: 2 = explicitly Israeli
// (citizenship / country of origin), 1 = lenient (Hebrew Wikipedia + Hebrew
// label, virtually certain for the exact-name search this is called with).
export function classify(e: Entity): { kind?: 'person' | 'group'; isIsraeliScore: number } {
  const instance = claimValues(e, P_INSTANCE_OF).map(valueText)
  const occ = claimValues(e, P_OCCUPATION).map(valueText)
  const citizenships = claimValues(e, P_CITIZENSHIP).map(valueText)
  const origin = claimValues(e, P_COUNTRY_OF_ORIGIN).map(valueText)

  const explicit = citizenships.includes(Q_ISRAEL) || origin.includes(Q_ISRAEL)
  const lenient = Boolean(e.labels?.he?.value) && Boolean(e.sitelinks?.hewiki)
  const isIsraeliScore = explicit ? 2 : lenient ? 1 : 0

  const isBand = instance.some((i) => Q_BAND_INSTANCES.has(i ?? ''))
  const musicianOccup = occ.some((o) => Q_MUSICIAN_OCC.has(o ?? ''))

  let kind: 'person' | 'group' | undefined
  if (isBand) kind = 'group'
  else if (musicianOccup) kind = 'person'
  return { kind, isIsraeliScore }
}

// Search wikidata for a term under a language; returns hit QIDs in API order.
async function searchNamesFor(
  he: string,
  en: string,
): Promise<Array<{ term: string; lang: string; hits: string[] }>> {
  const terms: Array<[string, string]> = []
  // Same term for he and en (kworb chart names) → single search under the
  // term's own script locale.
  if (he && en && he === en) {
    terms.push([he, /[\u0590-\u05FF]/.test(he) ? 'he' : 'en'])
  } else {
    if (he) terms.push([he, 'he'])
    if (en) terms.push([en, 'en'])
  }
  const out: Array<{ term: string; lang: string; hits: string[] }> = []
  for (const [term, lang] of terms) {
    const url = `${WIKIBASE_API}?action=wbsearchentities&search=${encodeURIComponent(term)}&language=${lang}&uselang=${lang}&format=json&limit=10`
    const data = (await cachedFetch(url, {
      cacheSource: 'wikidata',
      cacheKey: `search-${lang}-${term}-n10`,
      delayMs: 80,
    })) as { search?: Array<{ id: string }> }
    out.push({ term, lang, hits: (data.search ?? []).map((s) => s.id) })
  }
  return out
}

// Resolve a list of names to validated QIDs in bulk: search every name first,
// then fetch the union of candidate entities in batched wbgetentities calls
// (instead of one round-trip per hit), then classify and pick the best hit per
// name. Returns an array aligned with `items`.
async function resolveBatch(
  items: Array<{ he: string; en: string }>,
  entityCache: Record<string, Entity>,
  requireIsraeli = true,
): Promise<Array<string | null>> {
  const searchResults = await mapLimit(items, 8, (item) => searchNamesFor(item.he, item.en))
  const hitLists = searchResults.map((rs) => {
    const seen = new Set<string>()
    const hits: string[] = []
    for (const r of rs) for (const id of r.hits) if (!seen.has(id)) { seen.add(id); hits.push(id) }
    return hits.slice(0, 25)
  })

  const uniqueHits = [...new Set(hitLists.flat())]
  const fetched = await fetchEntities(uniqueHits)
  Object.assign(entityCache, fetched)

  const out = hitLists.map((hits) => {
    let best: { qid: string; score: number } | null = null
    for (const id of hits) {
      const e = entityCache[id]
      if (!e) continue
      const { kind, isIsraeliScore } = classify(e)
      if (!kind) continue
      if (requireIsraeli && isIsraeliScore === 0) continue
      if (!best || isIsraeliScore > best.score) best = { qid: id, score: isIsraeliScore }
    }
    return best?.qid ?? null
  })
  return out
}

function toEntry(qid: string, e: Entity, he?: string, en?: string): WdEntry {
  const birthPlaceId = valueText(claimValues(e, P_BIRTH_PLACE)[0])
  return {
    qid,
    he: he ?? e.labels?.he?.value ?? e.labels?.en?.value,
    en: en ?? e.labels?.en?.value ?? e.labels?.he?.value,
    kind: classify(e).kind,
    sitelinks: e.sitelinks ? Object.keys(e.sitelinks).length : 1,
    mbid: valueText(claimValues(e, P_MBID)[0]),
    hewiki: e.sitelinks?.hewiki?.title,
    gender: valueText(claimValues(e, P_GENDER)[0]),
    birth: valueText(claimValues(e, P_BIRTH)[0]), // full ISO timestamp; year is extracted downstream
    died: valueText(claimValues(e, P_DEATH)[0]),
    activeSince: valueText(claimValues(e, P_WORK_PERIOD_START)[0]),
    inception: valueText(claimValues(e, P_INCEPTION)[0]),
    birthPlace: birthPlaceId,
    memberQids: claimValues(e, P_HAS_PART)
      .map(valueText)
      .filter((q): q is string => Boolean(q)),
    genres: claimValues(e, P_GENRE)
      .map(valueText)
      .filter((g): g is string => Boolean(g)),
  }
}

// Optional pool growth via SPARQL. Kept separate so failures never block the
// seed resolution path. Currently best-effort.
async function stage1Candidates(): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const branch of [
    '?item wdt:P27 wd:Q801 ; wdt:P106 wd:Q177220 .',
    '?item wdt:P31 wd:Q215380 ; wdt:P495 wd:Q801 .',
  ]) {
    const query = `SELECT ?item ?c WHERE { ${branch} ?item wikibase:sitelinks ?c . FILTER(?c >= 3) } ORDER BY DESC(?c) LIMIT 800`
    try {
      const res = await fetch(`${SPARQL}?query=${encodeURIComponent(query)}&format=json`, {
        headers: { 'User-Agent': 'AmandleBuilder/0.1 (mailto:you@example.com)', Accept: 'application/sparql-results+json' },
        signal: AbortSignal.timeout(30_000),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { results: { bindings: Array<{ item: { value: string } }> } }
      for (const b of data.results.bindings) out[b.item.value.split('/').pop()!] = b.item.value
    } catch (err) {
      log(`01: stage-1 SPARQL unavailable (${(err as Error).message}) — skipping pool growth`)
      break
    }
    await delay(1500)
  }
  return out
}

export async function run(): Promise<{ entries: Record<string, WdEntry> }> {
  const candidates = await stage1Candidates()
  log(`01: stage-1 candidates (best effort): ${Object.keys(candidates).length}`)

  const seeds = readJson<Array<{ he: string; en: string }>>('data/seed-names.json')
  const kworb = readOptionalKworb()
  const entries: Record<string, WdEntry> = {}
  const entityCache: Record<string, Entity> = {}
  const resolvedQids = new Set<string>()
  const spotifyByQid: Record<string, { name: string; spotifyId?: string; streams: number }> = {}

  // 0) Kworb discovery first: every name from the Spotify Israel chart is
  //    resolved (they are the listenership-ranked universe), then seeds get a
  //    chance to fill gaps, then SPARQL notability candidates pad the rest.
  const kworbQids = await resolveBatch(
    kworb.artists.map((a) => ({ he: a.name, en: a.name })),
    entityCache,
  )
  let kworbResolved = 0
  kworb.artists.forEach((artist, i) => {
    const qid = kworbQids[i]
    if (!qid) return
    kworbResolved++
    resolvedQids.add(qid)
    const e = entityCache[qid]
    const latin = /^[a-z0-9\s&.'\u2019-]+$/i.test(artist.name)
    entries[qid] = toEntry(qid, e, latin ? undefined : artist.name, latin ? artist.name : undefined)
    if (entries[qid].source !== 'seed') entries[qid].source = 'spotify'
    spotifyByQid[qid] = { name: artist.name, spotifyId: artist.spotifyId, streams: artist.streams }
  })
  log(`01: kworb names resolved: ${kworbResolved}/${kworb.artists.length}`)

  // 1) Resolve seeds with validation (only the ones not already found).
  const seedQids = await resolveBatch(seeds, entityCache)
  for (let i = 0; i < seeds.length; i++) {
    const seed = seeds[i]
    const qid = seedQids[i]
    if (!qid) {
      log(`01: NO VALID MATCH -> ${seed.he}`)
      continue
    }
    if (entries[qid]) {
      log(`01: REUSED ${qid} for ${seed.he} (already ${entries[qid].he ?? entries[qid].en})`)
    }
    resolvedQids.add(qid)
    const e = entityCache[qid]
    entries[qid] = toEntry(qid, e, seed.he, seed.en)
    entries[qid].source = 'seed'
  }
  log(`01: seeds resolved & validated: ${resolvedQids.size}/${seeds.length}`)

  // 2) Batch-enrich every resolved QID (+ extra notability candidates) in one pass.
  const candidatesToKeep: Record<string, string> = {}
  for (const [qid] of Object.entries(candidates)) {
    if (!resolvedQids.has(qid)) candidatesToKeep[qid] = qid
  }
  const allQids = [...resolvedQids, ...Object.keys(candidatesToKeep)].slice(0, 1500)
  const enriched = await fetchEntities(allQids)
  Object.assign(entityCache, enriched)

  for (const qid of allQids) {
    const e = entityCache[qid]
    if (!e) continue
    if (resolvedQids.has(qid)) {
      // Refresh the entry with the fully enriched entity, preserving the
      // discovery source (kworb 'spotify' vs curated 'seed').
      const prevSource = entries[qid].source
      entries[qid] = toEntry(qid, e, entries[qid].he, entries[qid].en)
      entries[qid].source = prevSource ?? 'seed'
    } else {
      const { kind, isIsraeliScore } = classify(e)
      if (!kind || isIsraeliScore === 0) continue
      entries[qid] = toEntry(qid, e)
      entries[qid].source = 'candidate'
    }
  }

  // 3) Resolve birthPlace entity IDs to Hebrew names.
  const placeIds = [
    ...new Set(Object.values(entries).map((x) => x.birthPlace).filter((x): x is string => Boolean(x))),
  ]
  if (placeIds.length > 0) {
    const placeEntities = await fetchEntities(placeIds)
    for (const entry of Object.values(entries)) {
      if (entry.birthPlace) entry.birthPlace = placeEntities[entry.birthPlace]?.labels?.he?.value ?? placeEntities[entry.birthPlace]?.labels?.en?.value ?? entry.birthPlace
    }
  }

  // 3b) Resolve Wikidata genre (P136) QIDs to labels. The English label is
  // preferred because data/genre-map.json is keyed by English tag names.
  const genreIds = [
    ...new Set(Object.values(entries).flatMap((x) => x.genres)),
  ]
  if (genreIds.length > 0) {
    const genreEntities = await fetchEntities(genreIds, 'genres')
    for (const entry of Object.values(entries)) {
      if (!entry.genres.length) continue
      entry.genres = entry.genres
        .map((gid) => genreEntities[gid]?.labels?.en?.value ?? genreEntities[gid]?.labels?.he?.value)
        .filter((g): g is string => Boolean(g))
    }
    log(`01: resolved ${genreIds.length} genre QIDs to labels`)
  }

  // 4) Resolve each group's member genders. A group has no P21 of its own, so
  //    P527 members are the only way to tell an all-male or all-female band
  //    apart from a genuinely mixed one.
  const memberQids = [
    ...new Set(Object.values(entries).flatMap((x) => x.memberQids ?? [])),
  ]
  if (memberQids.length > 0) {
    const memberEntities = await fetchEntities(memberQids, 'members')
    for (const entry of Object.values(entries)) {
      if (!entry.memberQids?.length) continue
      const genders: Array<'male' | 'female'> = []
      for (const id of entry.memberQids) {
        const member = memberEntities[id]
        if (!member) continue
        const g = wdGender(valueText(claimValues(member, P_GENDER)[0]))
        if (g) genders.push(g)
      }
      entry.memberGenders = genders
    }
    log(`01: member genders resolved for groups with P527 members`)
  }

  // Normalise birth year: keep the year only.
  for (const entry of Object.values(entries)) {
    if (entry.birth) entry.birth = entry.birth.slice(1, 5)
    if (entry.died) entry.died = entry.died.slice(1, 5)
    if (entry.activeSince) entry.activeSince = entry.activeSince.slice(1, 5)
    if (entry.inception) entry.inception = entry.inception.slice(1, 5)
  }

  // Keep previously-discovered candidates if this run's SPARQL probe failed —
  // otherwise a transient outage would silently shrink the artist pool.
  if (Object.keys(candidates).length === 0 && existsSync(resolve(ROOT, 'data/raw/wikidata-candidates.json'))) {
    log('01: stage-1 failed; keeping previous candidates file')
    Object.assign(candidates, readJson<Record<string, string>>('data/raw/wikidata-candidates.json'))
  }

  writeJson('data/raw/wikidata.json', entries)
  writeJson('data/raw/wikidata-candidates.json', candidates)
  writeJson('data/raw/spotify.json', spotifyByQid)
  log(`01: entries written: ${Object.keys(entries).length} (${Object.values(entries).filter((e) => e.source === 'seed').length} seed, ${kworbResolved} spotify)`)
  return { entries }
}

if (process.argv[1]?.endsWith('01-wikidata.ts')) {
  run().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}