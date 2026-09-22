import { describe, expect, it } from 'vitest'
import type { Artist } from '../src/types'
import { tileValue } from '../src/lib/formatTile'

function artist(partial: Partial<Artist>): Artist {
  return {
    id: 'x',
    nameHe: 'אמן',
    aliases: [],
    debutYear: 2000,
    breakthroughYear: 2005,
    type: 'solo',
    members: 1,
    gender: 'male',
    primaryGenre: 'pop',
    secondaryGenres: [],
    popularityTier: 3,
    region: 'tel-aviv-area',
    answerEligible: true,
    ids: {},
    ...partial,
  }
}

describe('tileValue', () => {
  it('debut/breakthrough render as plain years', () => {
    expect(tileValue(artist({ debutYear: 1990 }), 'debutYear')).toBe('1990')
    expect(tileValue(artist({ breakthroughYear: 1991 }), 'breakthrough')).toBe('1991')
  })

  it('lineup renders solo / duo / band with member count', () => {
    expect(tileValue(artist({ type: 'solo', members: 1 }), 'lineup')).toBe('סולו')
    expect(tileValue(artist({ type: 'duo', members: 2 }), 'lineup')).toBe('צמד')
    expect(tileValue(artist({ type: 'band', members: 4 }), 'lineup')).toBe('להקה (4)')
  })

  it('gender and genre map to Hebrew labels', () => {
    expect(tileValue(artist({ gender: 'female' }), 'gender')).toBe('אישה')
    expect(tileValue(artist({ primaryGenre: 'rock' }), 'genre')).toBe('רוק')
  })

  it('unknown genre falls back to "אחר"', () => {
    expect(tileValue(artist({ primaryGenre: 'other' }), 'genre')).toBe('אחר')
  })

  it('popularity renders as 1-5 stars clamped to [1,5]', () => {
    expect(tileValue(artist({ popularityTier: 5 }), 'popularity')).toBe('★★★★★')
    expect(tileValue(artist({ popularityTier: 2 }), 'popularity')).toBe('★★☆☆☆')
    // @ts-expect-error invalid tier forced on purpose
    expect(tileValue(artist({ popularityTier: 9 }), 'popularity')).toBe('★★★★★')
  })
})