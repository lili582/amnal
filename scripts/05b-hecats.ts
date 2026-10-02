// 05b-hecats.ts — Hebrew Wikipedia category membership per artist.
//
// Why: Wikidata occupations are too coarse to separate "singer who also acts"
// from "TV actor who sang one song" - both end up with occupation=actor+singer.
// Hebrew Wikipedia categories say how a person is actually recognised, which
// is exactly the distinction the game needs (an answer must be a *music* artist).
//
// Writes data/raw/hecats.json: { [qid]: string[] } (category titles, no prefix).
import { cachedFetch, log, writeJson, readJson } from './common.ts'
import type { WdEntry } from './01-wikidata.ts'

const API = 'https://he.wikipedia.org/w/api.php'
//

interface PageInfo {
  title: string
  categories?: Array<{ title: string }>
  missing?: string
}
interface BatchResponse {
  query?: { pages?: PageInfo[] }
}

export async function run(): Promise<Record<string, string[]>> {
  const wikidata = readJson<Record<string, WdEntry>>('data/raw/wikidata.json')
  const out: Record<string, string[]> = {}

  const titled = Object.entries(wikidata).filter(([, e]) => e.hewiki)
  log(`05b: fetching hewiki categories for ${titled.length} artists`)

  // One title per request: a multi-title query shares a single category budget,
  // so most titles come back empty. Small concurrency keeps the run ~3 min.
  const CONCURRENCY = 4
  let next = 0
  let done = 0
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (next < titled.length) {
      const [qid, entry] = titled[next++]
      const url = `${API}?action=query&prop=categories&titles=${encodeURIComponent(entry.hewiki!)}&cllimit=max&format=json&formatversion=2&redirects=1`
      try {
        const data = (await cachedFetch(url, {
          cacheSource: 'hecats',
          cacheKey: qid,
          retries: 3,
          delayMs: 100,
        })) as BatchResponse
        const cats = (data.query?.pages?.[0]?.categories ?? [])
          .map((c) => c.title)
          .filter((t) => !/^(Template:|תבניות|עמודי צמד|Pages in|Wikipedia:|תבנית:)/.test(t))
        if (cats.length) out[qid] = cats
      } catch {
        // no page / fetch failure: no category evidence for this artist
      }
      if (++done % 300 === 0) log(`05b: ${done}/${titled.length}`)
    }
  })
  await Promise.all(workers)
  writeJson('data/raw/hecats.json', out)
  log(`05b: categories resolved for ${Object.keys(out).length}/${titled.length}`)
  return out
}

if (process.argv[1]?.endsWith('05b-hecats.ts')) {
  run().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}