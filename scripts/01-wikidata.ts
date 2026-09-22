// 01-wikidata.ts — resolve seed names to validated Wikidata QIDs and enrich
// facts using only the reliable MediaWiki APIs (wbsearchentities +
// wbgetentities). SPARQL is used solely for the optional stage-1 pool-growth
// query and failures there are non-fatal.
import { cachedFetch, log, writeJson, readJson, existsSync, resolve, ROOT } from './common.ts'

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
const P_INCEPTION = 'P571'
const P_BIRTH_PLACE = 'P19'
const P_GENRE = 'P136'
const P_MBID = 'P434'

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
  inception?: string
  birthPlace?: string
  genres: string[]
  source: 'seed' | 'candidate'
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function fetchEntities(qids: string[]): Promise<Record<string, Entity>> {
  const out: Record<string, Entity> = {}
  for (let i = 0; i < qids.length; i += 50) {
    const chunk = qids.slice(i, i + 50)
    const url = `${WIKIBASE_API}?action=wbgetentities&ids=${chunk.join('|')}&props=labels|claims|sitelinks&languages=he|en&format=json`
    const data = (await cachedFetch(url, {
      cacheSource: 'wikidata',
      cacheKey: `entities-${chunk.slice(0, 2).map((q) => q.replace(/^Q/, '')).join('-')}-${chunk.length}`,
      delayMs: 120,
    })) as { entities?: Record<string, Entity> }
    Object.assign(out, data.entities ?? {})
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

// Search + validate: returns the best QID whose entity matches a singer/band
// with Israeli citizenship. Rejects impostors with the same name.
async function resolveName(
  he: string,
  en: string,
  entities: Record<string, Entity>,
): Promise<string | null> {
  let best: { qid: string; score: number } | null = null
  for (const [term, lang] of [
    [he, 'he'],
    [en, 'en'],
  ] as const) {
    const url = `${WIKIBASE_API}?action=wbsearchentities&search=${encodeURIComponent(term)}&language=${lang}&uselang=${lang}&format=json&limit=10`
    const data = (await cachedFetch(url, {
      cacheSource: 'wikidata',
      cacheKey: `search-${lang}-${term}-n10`,
      delayMs: 150,
    })) as { search?: Array<{ id: string }> }

    for (const hit of data.search ?? []) {
      if (!entities[hit.id]) {
        const fetched = await fetchEntities([hit.id])
        Object.assign(entities, fetched)
      }
      const e = entities[hit.id]
      if (!e) continue
      const { kind, isIsraeliScore } = classify(e)
      if (!kind || isIsraeliScore === 0) continue
      if (!best || isIsraeliScore > best.score) best = { qid: hit.id, score: isIsraeliScore }
    }
  }
  return best?.qid ?? null
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
    inception: valueText(claimValues(e, P_INCEPTION)[0]),
    birthPlace: birthPlaceId,
    genres: claimValues(e, P_GENRE).map((g) => g ?? '').filter(Boolean),
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
    const query = `SELECT ?item ?c WHERE { ${branch} ?item wikibase:sitelinks ?c . FILTER(?c >= 5) } ORDER BY DESC(?c) LIMIT 300`
    try {
      const res = await fetch(`${SPARQL}?query=${encodeURIComponent(query)}&format=json`, {
        headers: { 'User-Agent': 'AmnalBuilder/0.1 (mailto:you@example.com)', Accept: 'application/sparql-results+json' },
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
  const entries: Record<string, WdEntry> = {}
  const entityCache: Record<string, Entity> = {}
  const resolvedQids = new Set<string>()

  // 1) Resolve seeds with validation.
  for (const seed of seeds) {
    const qid = await resolveName(seed.he, seed.en, entityCache)
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

  // 2) Batch-enrich every resolved seed (+ as many notability candidates as we
  //    have) in one pass.
  const candidatesToKeep: Record<string, string> = {}
  for (const [qid] of Object.entries(candidates)) {
    if (!resolvedQids.has(qid)) candidatesToKeep[qid] = qid
  }
  const allQids = [...resolvedQids, ...Object.keys(candidatesToKeep)].slice(0, 500)
  const enriched = await fetchEntities(allQids)
  Object.assign(entityCache, enriched)

  for (const qid of allQids) {
    const e = entityCache[qid]
    if (!e) continue
    if (resolvedQids.has(qid)) {
      // Refresh the entry with the fully enriched entity.
      entries[qid] = toEntry(qid, e, entries[qid].he, entries[qid].en)
      entries[qid].source = 'seed'
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

  // Normalise birth year: keep the year only.
  for (const entry of Object.values(entries)) {
    if (entry.birth) entry.birth = entry.birth.slice(1, 5)
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
  log(`01: entries written: ${Object.keys(entries).length} (${Object.values(entries).filter((e) => e.source === 'seed').length} seed)`)
  return { entries }
}

if (process.argv[1]?.endsWith('01-wikidata.ts')) {
  run().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}