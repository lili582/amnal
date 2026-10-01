// 00-kworb.ts — fetch kworb.net's Israel Spotify chart (weekly totals since
// 2018), aggregate all-time streams per artist, and write data/raw/kworb.json.
//
// kworb.net mirrors Spotify's official country charts. Spotify's own Web API
// no longer exposes artist "popularity"/"followers" (dev-mode apps, Feb 2026),
// so this scrape is the practical source for a real listenership signal.
// The output drives both the artist pool (top ~1000 Israeli/Hebrew acts by
// total plays) and the popularity ranking used for answerEligible.
import { writeJson, writeFileSync, readFileSync, existsSync, log, ROOT, resolve } from './common.ts'

const URL = 'https://kworb.net/spotify/country/il_weekly_totals.html'
const RAW_HTML = resolve(ROOT, 'data/raw/kworb-page.html')

export interface KworbArtist {
  name: string // display name from the chart (Hebrew or Latin)
  spotifyId?: string // Spotify artist ID from the chart link (when present)
  streams: number // all-time total streams on the Israel chart since 2018
  songs: number // number of charted songs aggregated
}

export interface KworbSnapshot {
  fetchedAt: string
  artists: KworbArtist[]
}

function strip(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

function parseRows(html: string): KworbArtist[] {
  const rows = html.match(/<tr>[\s\S]*?<\/tr>/g) ?? []
  const byId = new Map<string, KworbArtist>()

  for (const row of rows) {
    // artist link: ../artist/{spotifyId}.html and the display name
    const artistAnchor = row.match(/<a href="\.\.\/artist\/([A-Za-z0-9]+)\.html">([^<]*)<\/a>/)
    if (!artistAnchor) continue
    const spotifyId = artistAnchor[1]
    const name = strip(artistAnchor[2])
    if (!name) continue

    // Total = the last numeric cell of the row (may contain thousands sep).
    const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/g) ?? []
    if (cells.length < 2) continue
    let total = 0
    allCells: for (let i = cells.length - 1; i >= 0; i--) {
      const raw = strip(cells[i]).replace(/,/g, '')
      if (/^\d+$/.test(raw)) {
        total = Number(raw)
        break allCells
      }
    }

    const key = spotifyId || name
    const existing = byId.get(key)
    if (existing) {
      existing.streams += total
      existing.songs += 1
    } else {
      byId.set(key, { name, spotifyId: spotifyId || undefined, streams: total, songs: 1 })
    }
  }

  const artists = [...byId.values()].sort((a, b) => b.streams - a.streams)
  return artists
}

export async function run(): Promise<KworbSnapshot> {
  try {
    const res = await fetch(URL, {
      headers: { 'User-Agent': 'AmandleBuilder/0.1 (mailto:you@example.com)' },
      signal: AbortSignal.timeout(60_000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const html = await res.text()
    writeFileSync(RAW_HTML, html, 'utf8')
    const artists = parseRows(html)
    const snapshot: KworbSnapshot = { fetchedAt: new Date().toISOString(), artists }
    writeJson('data/raw/kworb.json', snapshot)
    log(
      `00: parsed ${artists.length} artists from ${html.length.toLocaleString()} bytes (top: ${artists[0]?.name} ${(artists[0]?.streams ?? 0).toLocaleString()} streams)`,
    )
    return snapshot
  } catch (err) {
    // Offline/rate-limited fallback: keep the previous snapshot if we have one.
    if (existsSync(RAW_HTML)) {
      const html = readFileSync(RAW_HTML, 'utf8')
      const artists = parseRows(html)
      const snapshot: KworbSnapshot = { fetchedAt: 'cached', artists }
      writeJson('data/raw/kworb.json', snapshot)
      log(`00: network failed (${(err as Error).message}) — reused cached chart with ${artists.length} artists`)
      return snapshot
    }
    throw err
  }
}

if (process.argv[1]?.endsWith('00-kworb.ts')) {
  run().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}