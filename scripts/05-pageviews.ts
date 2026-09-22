// 05-pageviews.ts — 90-day he.wikipedia pageviews (local Israeli popularity).
// Requires the hewiki title from Wikidata. Writes data/raw/pageviews.json.
import { cachedFetch, log, writeJson, readJson } from './common.ts'
import type { WdEntry } from './01-wikidata.ts'

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

function range90(): { start: string; end: string } {
  const now = new Date()
  const end = now.toISOString().slice(0, 10).replace(/-/g, '')
  const start = new Date(now.getTime() - 90 * 86_400_000).toISOString().slice(0, 10).replace(/-/g, '')
  return { start, end }
}

export async function run(): Promise<Record<string, number>> {
  const wd = readJson<Record<string, WdEntry>>('data/raw/wikidata.json')
  const { start, end } = range90()
  const out: Record<string, number> = {}

  for (const [qid, entry] of Object.entries(wd)) {
    const title = entry.hewiki
    if (!title) continue
    const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/he.wikipedia/all-access/user/${encodeURIComponent(title)}/daily/${start}/${end}`
    try {
      const data = (await cachedFetch(url, {
        cacheSource: 'pageviews',
        cacheKey: qid,
        delayMs: 220,
      })) as { items?: Array<{ views?: number }> }
      const total = (data.items ?? []).reduce((sum, it) => sum + (it.views ?? 0), 0)
      out[qid] = total
    } catch {
      // some artists have no he.wikipedia article; excluded from this signal
    }
    await delay(150)
  }

  writeJson('data/raw/pageviews.json', out)
  log(`05: pageviews resolved ${Object.keys(out).length}`)
  return out
}

if (process.argv[1]?.endsWith('05-pageviews.ts')) {
  run().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}