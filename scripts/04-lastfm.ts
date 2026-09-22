// 04-lastfm.ts — listeners/playcount + top tags. Requires LASTFM_API_KEY in
// .env; without it the script only writes a "skipped" marker.
import { log, writeJson, readJson, cachedFetch } from './common.ts'
import type { WdEntry } from './01-wikidata.ts'

interface LastfmEntry {
  listeners: number
  playcount: number
  tags: string[]
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function run(): Promise<Record<string, LastfmEntry>> {
  const key = process.env.LASTFM_API_KEY
  if (!key) {
    log('04: LASTFM_API_KEY not set — skipping (no lastfm data)')
    writeJson('data/raw/lastfm.json', { skipped: true })
    return {}
  }

  const qidToMbid = readJson<Record<string, string>>('data/raw/qid-mbid.json')
  const wd = readJson<Record<string, WdEntry>>('data/raw/wikidata.json')
  const out: Record<string, LastfmEntry> = {}

  for (const [qid, entry] of Object.entries(wd)) {
    const mbid = qidToMbid[qid]
    const query = mbid ? `mbid=${mbid}` : `artist=${encodeURIComponent(entry.en ?? entry.he ?? '')}`
    const url = `https://ws.audioscrobbler.com/2.0/?method=artist.getinfo&${query}&api_key=${key}&format=json`

    try {
      const data = (await cachedFetch(url, {
        cacheSource: 'lastfm',
        cacheKey: qid,
        delayMs: 1550, // ~1 req/s
      })) as {
        artist?: {
          stats?: { listeners: string; playcount: string }
          tags?: { tag: Array<{ name: string }> }
        }
      }
      const a = data.artist
      if (!a) continue
      out[qid] = {
        listeners: Number(a.stats?.listeners ?? 0),
        playcount: Number(a.stats?.playcount ?? 0),
        tags: (a.tags?.tag ?? []).map((t) => t.name.toLowerCase()),
      }
    } catch {
      // keep going; unresolved artists are listed in the review report
    }
    await delay(300)
  }

  writeJson('data/raw/lastfm.json', out)
  log(`04: lastfm resolved ${Object.keys(out).length}`)
  return out
}

if (process.argv[1]?.endsWith('04-lastfm.ts')) {
  run().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}