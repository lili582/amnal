import { describe, expect, it } from 'vitest'
import { buildSearchIndex, levenshtein, searchArtists } from '../src/lib/search'
import { skeletonOf } from '../src/lib/normalizeHe'
import { fixtures } from './fixtures'

const entries = buildSearchIndex(fixtures)

describe('searchArtists', () => {
  it('matches the normalised full name first (Hebrew)', () => {
    const res = searchArtists('אמן פופ', entries)
    expect(res).not.toHaveLength(0)
    expect(res[0].artist.id).toBe('pop-alpha')
  })

  it('matches any name word', () => {
    const ids = searchArtists('פופ', entries).map((r) => r.artist.id)
    expect(ids).toContain('pop-alpha')
    expect(ids).toContain('pop-beta')
  })

  it('matches aliases', () => {
    const res = searchArtists('אלפא', entries)
    expect(res[0].artist.id).toBe('pop-alpha')
  })

  it('matches Latin names via nameEn', () => {
    const res = searchArtists('pop', entries)
    expect(res.some((r) => r.artist.id === 'pop-alpha')).toBe(true)
  })

  it('ranks startswith-min matches above word matches', () => {
    const res = searchArtists('רוק', entries)
    // "להקת רוק א" contains the word רוק (rank 2); "צמד רוק" same.
    expect(res[0].rank).toBeLessThanOrEqual(res[1].rank)
  })

  it('fuzzy delta matches for queries of length >= 4', () => {
    const ids = searchArtists('popa', entries).map((r) => r.artist.id)
    expect(ids).toContain('pop-alpha')
  })

  it('excludes already-guessed artists', () => {
    const ids = new Set(['pop-alpha'])
    const res = searchArtists('פופ', entries, ids)
    expect(res.every((r) => !ids.has(r.artist.id))).toBe(true)
    expect(res.map((r) => r.artist.id)).toContain('pop-beta')
  })

  it('returns at most 8 suggestions', () => {
    const res = searchArtists('א', entries)
    expect(res.length).toBeLessThanOrEqual(8)
  })

  it('returns nothing for an empty query', () => {
    expect(searchArtists('   ', entries)).toHaveLength(0)
  })
})

describe('skeleton search tolerance', () => {
  it('skeletonOf removes vav/yod so defective spelling matches', () => {
    expect(skeletonOf('כוורת')).toBe('כרת')
    expect(skeletonOf('כורת')).toBe('כרת')
  })
})

describe('levenshtein', () => {
  it('returns null beyond the max distance', () => {
    expect(levenshtein('abc', 'xyz', 1)).toBeNull()
    expect(levenshtein('popa', 'pop', 1)).toBe(1)
    expect(levenshtein('omer', 'omer', 1)).toBe(0)
  })
})