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
      return strings.lineupValues.band.replace('{n}', String(artist.members))
    case 'gender': {
      // A solo artist is never 'mixed' (data also enforces it); keep a safe
      // fallback so the word always renders instead of an empty tile.
      const g = artist.type === 'solo' && artist.gender === 'mixed' ? 'male' : artist.gender
      return strings.genderValues[g] ?? strings.genderValues.male
    }
    case 'genre':
      return strings.genreValues[artist.primaryGenre] ?? strings.genreValues.other
    case 'popularity':
      return stars(artist.popularityTier)
  }
}

function stars(tier: number): string {
  const clamped = Math.max(0, Math.min(5, tier))
  return '★'.repeat(clamped) + '☆'.repeat(5 - clamped)
}