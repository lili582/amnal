// 03-deezer.ts — artist fan counts (one popularity signal).
// Writes data/raw/deezer.json keyed by qid.
import { cachedFetch, log, writeJson, readJson, normHe, lev } from './common.ts'
import type { WdEntry } from './01-wikidata.ts'

const DEEZER = 'https://api.deezer.com'

interface DeezerEntry {
  id: number
  fans: number
  albums: number
  names: string[]
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function searchHit(name: string): Promise<{ id: number; nb_fan: number; nb_album: number; name: string } | null> {
  const data = (await cachedFetch(
    `${DEEZER}/search/artist?q=${encodeURIComponent(name)}&limit=5`,
    { cacheSource: 'deezer', cacheKey: `search-${normHe(name).replace(/\s+/g, '-')}`, delayMs: 200 },
  )) as { data?: Array<{ id: number; nb_fan: number; nb_album: number; name: string }> }
  return data.data?.[0] ?? null
}

export async function run(): Promise<Record<string, DeezerEntry>> {
  const wikidata = readJson<Record<string, WdEntry>>('data/raw/wikidata.json')
  const out: Record<string, DeezerEntry> = {}

  for (const [qid, wd] of Object.entries(wikidata)) {
    const candidates = [wd.en, wd.he, Object.values(wd).join(' ')].filter(Boolean)
    let best: { id: number; fans: number; albums: number; names: string[] } | null = null

    for (const name of candidates as string[]) {
      const hit = await searchHit(name)
      if (!hit) continue
      // accept only when the returned name matches closely, else mark unresolved
      if (lev(normHe(hit.name), normHe(name), 2) === null && normHe(hit.name) !== normHe(name)) continue
      best = { id: hit.id, fans: hit.nb_fan, albums: hit.nb_album, names: [hit.name] }
      break
    }
    await delay(180) // deezer throttle (<=8 req/s)
    if (best) out[qid] = best
  }

  writeJson('data/raw/deezer.json', out)
  log(`03: deezer resolved ${Object.keys(out).length}/${Object.keys(wikidata).length}`)
  return out
}

if (process.argv[1]?.endsWith('03-deezer.ts')) {
  run().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}