import type { Artist, TileField } from '../types'
import { strings } from '../strings.he'

// Display text for a tile's value (pure; kept out of the component file so
// fast-refresh can hot-reload components safely).
export function tileValue(artist: Artist, field: TileField): string {
  switch (field) {
    case 'debutYear':
      return String(artist.debutYear)
    case 'breakthrough':
      return String(artist.breakthroughYear)
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