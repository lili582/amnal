import type { Artist } from '../types'
import { normalizeHe, skeletonOf } from './normalizeHe'

export interface SearchEntry {
  artist: Artist
  forms: string[] // normalised searchable forms of nameHe/nameEn/aliases
  skeletons: string[]
}

export interface SearchResult {
  artist: Artist
  rank: number
}

const MAX_SUGGESTIONS = 8

// Build a search index over the artist pool. Called once at load time.
export function buildSearchIndex(artists: Artist[]): SearchEntry[] {
  return artists.map((artist) => {
    const names = [artist.nameHe, artist.nameEn, ...artist.aliases].filter(
      (n): n is string => Boolean(n),
    )
    const forms = names.map(normalizeHe).filter(Boolean)
    const skeletons = forms.map(skeletonOf)
    return { artist, forms, skeletons }
  })
}

// Levenshtein distance (bounded) for fuzzy matches on short Latin queries.
export function levenshtein(a: string, b: string, max = 1): number | null {
  if (Math.abs(a.length - b.length) > max) return null
  const rows = a.length + 1
  const cols = b.length + 1
  const d = Array.from({ length: rows }, () => new Array<number>(cols))
  for (let i = 0; i < rows; i++) d[i][0] = i
  for (let j = 0; j < cols; j++) d[0][j] = j
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
    }
  }
  const dist = d[a.length][b.length]
  return dist <= max ? dist : null
}

// Search the pool for up to 8 artist suggestions matching the query.
// Ranks: 1) full normalised name starts with the query, 2) any name word
// starts with it, 3) skeleton containment, 4) fuzzy per-token distance.
export function searchArtists(
  query: string,
  entries: SearchEntry[],
  alreadyGuessedIds: ReadonlySet<string> = new Set(),
): SearchResult[] {
  const q = normalizeHe(query)
  if (!q) return []

  const qTokens = q.split(' ')
  const qSkeleton = skeletonOf(q)

  const scored: { artist: Artist; rank: number }[] = []

  for (const entry of entries) {
    if (alreadyGuessedIds.has(entry.artist.id)) continue

    let rank = Infinity
    const words = [...new Set(entry.forms.flatMap((f) => f.split(' ')))]

    for (const form of entry.forms) {
      if (form.startsWith(q)) {
        rank = Math.min(rank, 1)
        break
      }
    }
    if (rank === Infinity) {
      for (const w of words) {
        if (w.startsWith(q)) {
          rank = Math.min(rank, 2)
          break
        }
      }
    }
    if (rank === Infinity) {
      for (const s of entry.skeletons) {
        if (s.includes(qSkeleton)) {
          rank = Math.min(rank, 3)
          break
        }
      }
    }
    if (rank === Infinity && q.length >= 4) {
      // Per-token fuzzy: every query token must be near <some token> of a form.
      outer: for (const form of entry.forms) {
        const formTokens = form.split(' ')
        for (const qt of qTokens) {
          let matched = false
          for (const ft of formTokens) {
            if (levenshtein(qt, ft, 1) !== null) {
              matched = true
              break
            }
          }
          if (!matched) continue outer
        }
        rank = Math.min(rank, 4)
        break
      }
    }

    if (rank !== Infinity) {
      scored.push({ artist: entry.artist, rank })
    }
  }

  // Stable order: rank asc, then popularityTier desc, then name (locale he).
  scored.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank
    if (a.artist.popularityTier !== b.artist.popularityTier) {
      return b.artist.popularityTier - a.artist.popularityTier
    }
    return a.artist.nameHe.localeCompare(b.artist.nameHe, 'he')
  })

  return scored.slice(0, MAX_SUGGESTIONS).map(({ artist, rank }) => ({ artist, rank }))
}