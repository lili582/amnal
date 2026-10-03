import type { Artist, TileField } from '../types'
import { strings } from '../strings.he'
import { artistAge } from './age'

// Display text for a tile's value (pure; kept out of the component file so
// fast-refresh can hot-reload components safely).
export function tileValue(artist: Artist, field: TileField, refYear = new Date().getFullYear()): string {
  switch (field) {
    case 'debutYear':
      if (artist.diedYear != null) {
        const origin = artist.birthYear ?? artist.debutYear
        if (origin > 0) {
          const ageAtDeath = artist.diedYear - origin
          const label = strings.ageDeceased[artist.gender] ?? strings.ageDeceased.male
          return label.replace('{age}', String(ageAtDeath))
        }
      }
      return artistAge(artist, refYear) > 0 ? String(artistAge(artist, refYear)) : '—'
    case 'breakthrough':
      return artist.breakthroughYear ? String(artist.breakthroughYear)
        : artist.debutYear ? String(artist.debutYear)
        : '—'
    case 'lineup':
      if (artist.type === 'solo') return strings.lineupValues.solo
      if (artist.type === 'duo') return strings.lineupValues.duo
      // members === 0 is the "unknown" sentinel, so interpolating it printed
      // "להקה (0)". Show the bare label until the count is actually known.
      return artist.members > 0
        ? strings.lineupValues.band.replace('{n}', String(artist.members))
        : strings.lineupValues.bandUnknown
    case 'gender': {
      // A solo artist is never 'mixed' (data also enforces it); keep a safe
      // fallback so the word always renders instead of an empty tile.
      const g = artist.type === 'solo' && artist.gender === 'mixed' ? 'male' : artist.gender
      return strings.genderValues[g] ?? strings.genderValues.male
    }
    case 'genre':
      return strings.genreValues[artist.primaryGenre] ?? strings.genreValues.other
    case 'popularity':
      return rankLabel(artist.popularityRank)
  }
}

// 1 = most popular, so the number reads as a placing ("#1" is the top artist).
function rankLabel(rank: number): string {
  return `#${Math.max(1, Math.round(rank))}`
}