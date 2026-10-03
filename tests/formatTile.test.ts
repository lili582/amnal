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
    popularityRank: 1,
    region: 'tel-aviv-area',
    answerEligible: true,
    ids: {},
    ...partial,
  }
}

describe('tileValue', () => {
  it('debut renders as age (ref year - birth), breakthrough as a year', () => {
    expect(tileValue(artist({ birthYear: 1980 }), 'debutYear', 2026)).toBe('46')
    expect(tileValue(artist({ debutYear: 1990 }), 'debutYear', 2026)).toBe('36')
    expect(tileValue(artist({ breakthroughYear: 1991 }), 'breakthrough')).toBe('1991')
  })

  it('breakthrough falls back to debut when missing, then to a dash', () => {
    expect(tileValue(artist({ breakthroughYear: 0, debutYear: 1993 }), 'breakthrough')).toBe('1993')
    expect(tileValue(artist({ breakthroughYear: 0, debutYear: 0 }), 'breakthrough')).toBe('—')
  })

  it('deceased artist shows age at death with (deceased) suffix', () => {
    expect(tileValue(artist({ birthYear: 1939, diedYear: 2013 }), 'debutYear', 2026)).toBe('נפטר בגיל 74')
    expect(tileValue(artist({ birthYear: 1957, diedYear: 2000 }), 'debutYear', 2026)).toBe('נפטר בגיל 43')
    expect(tileValue(artist({ birthYear: 1955, diedYear: 2024, gender: 'female' }), 'debutYear', 2026)).toBe('נפטרה בגיל 69')
  })

  // debutYear 0 is the "unknown" sentinel, so birthYear ?? debutYear fell
  // through to 0 and the tile rendered an age of 2026. It must show a dash.
  it('deceased artist without origin year shows a dash, not a bogus age', () => {
    expect(tileValue(artist({ birthYear: undefined, debutYear: 0, diedYear: 1964 }), 'debutYear', 2026)).toBe('—')
  })

  it('lineup renders solo / duo / band with member count', () => {
    expect(tileValue(artist({ type: 'solo', members: 1 }), 'lineup')).toBe('סולו')
    expect(tileValue(artist({ type: 'duo', members: 2 }), 'lineup')).toBe('צמד')
    expect(tileValue(artist({ type: 'band', members: 4 }), 'lineup')).toBe('להקה (4)')
  })

  // members === 0 is the "unknown" sentinel. Interpolating it rendered
  // "להקה (0)", i.e. a band with zero members.
  it('band with an unknown member count omits the count', () => {
    expect(tileValue(artist({ type: 'band', members: 0 }), 'lineup')).toBe('להקה')
  })

  it('gender and genre map to Hebrew labels', () => {
    expect(tileValue(artist({ gender: 'female' }), 'gender')).toBe('אישה')
    expect(tileValue(artist({ primaryGenre: 'rock' }), 'genre')).toBe('רוק')
  })

  it('unknown genre falls back to "אחר"', () => {
    expect(tileValue(artist({ primaryGenre: 'other' }), 'genre')).toBe('אחר')
  })

  it('popularity renders as a rank label, 1 = most popular', () => {
    expect(tileValue(artist({ popularityRank: 1 }), 'popularity')).toBe('#1')
    expect(tileValue(artist({ popularityRank: 250 }), 'popularity')).toBe('#250')
    // a rank below 1 would be meaningless, so it is clamped up to the top spot
    // @ts-expect-error invalid rank forced on purpose
    expect(tileValue(artist({ popularityRank: 0 }), 'popularity')).toBe('#1')
  })
})