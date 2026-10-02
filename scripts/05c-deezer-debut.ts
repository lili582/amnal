// 05c-deezer-debut.ts — first album release year per artist.
//
// 177 of the 1000 pool artists have no P2031 (work period start), no P571
// (inception) and no MusicBrainz first release, so 06-merge cannot derive a
// debut year and, because answerEligible requires one, they cannot be daily
// answers. Deezer exposes each artist's discography with release dates, and we
// already hold the artist id from stage 03, so the earliest album date is a
// real, citable debut signal rather than a guess from birth year.
//
// Only artists with no other debut source are looked up, which keeps this to a
// few hundred requests. Writes data/raw/deezer-debut.json: { [qid]: year }.
import { cachedFetch, log, writeJson, readJson } from './common.ts'
import type { WdEntry } from './01-wikidata.ts'
import type { MbEntry } from './02-musicbrainz.ts'

const DEEZER = 'https://api.deezer.com'

interface DeezerEntry {
  id: number
  fans: number
  albums: number
}
interface AlbumPage {
  data?: Array<{ release_date?: string }>
}

export async function run(): Promise<Record<string, number>> {
  const wikidata = readJson<Record<string, WdEntry>>('data/raw/wikidata.json')
  const deezer = readJson<Record<string, DeezerEntry>>('data/raw/deezer.json')
  const mb = readJson<Record<string, MbEntry>>('data/raw/musicbrainz.json')
  const qidMbid = readJson<Record<string, string>>('data/raw/qid-mbid.json')
  const out: Record<string, number> = {}

  const needs: Array<[string, number]> = []
  for (const [qid, entry] of Object.entries(wikidata)) {
    const d = deezer[qid]
    if (!d?.id) continue
    if (entry.activeSince || entry.inception) continue
    const mbid = qidMbid[qid]
    const m = mbid ? mb[mbid] : undefined
    if (m?.type === 'group' && m.begin) continue
    if (m?.firstRelease) continue
    needs.push([qid, d.id])
  }
  log(`05c: looking up first album year for ${needs.length} artists`)

  let next = 0
  let done = 0
  const CONCURRENCY = 4
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (next < needs.length) {
      const [qid, id] = needs[next++]
      const url = `${DEEZER}/artist/${id}/albums?limit=100`
      try {
        const page = (await cachedFetch(url, {
          cacheSource: 'deezer',
          cacheKey: `albums-${id}`,
          retries: 2,
          delayMs: 150,
        })) as AlbumPage
        const years = (page.data ?? [])
          .map((a) => (a.release_date ? Number(a.release_date.slice(0, 4)) : NaN))
          .filter((y) => Number.isInteger(y) && y >= 1948 && y <= new Date().getFullYear())
        if (years.length) out[qid] = Math.min(...years)
      } catch {
        // no discography or fetch failure: leave the debut year unknown
      }
      if (++done % 100 === 0) log(`05c: ${done}/${needs.length}`)
    }
  })
  await Promise.all(workers)

  writeJson('data/raw/deezer-debut.json', out)
  log(`05c: debut year resolved for ${Object.keys(out).length}/${needs.length}`)
  return out
}

if (process.argv[1]?.endsWith('05c-deezer-debut.ts')) {
  run().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}