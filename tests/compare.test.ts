import { describe, expect, it } from 'vitest'
import { compareArtist } from '../src/lib/compare'
import { fixturesById } from './fixtures'

// Arrow convention: 'up' when the TARGET value is higher/later/more than the guess.
describe('compareArtist', () => {
  it('returns correct tiles when guessing the target itself', () => {
    const a = fixturesById.get('pop-alpha')!
    const tiles = compareArtist(a, a)
    for (const t of tiles) {
      expect(t.match).toBe('correct')
      expect(t.arrow).toBeUndefined()
    }
    expect(tiles.map((t) => t.field)).toEqual([
      'debutYear',
      'breakthrough',
      'lineup',
      'gender',
      'genre',
      'popularity',
    ])
  })

  describe('debutYear', () => {
    const target = fixturesById.get('pop-alpha')! // debut 2010
    it('exact year is correct', () => {
      const g = { ...target, id: 'x', nameHe: 'x' } as typeof target
      expect(compareArtist(g, target)[0].match).toBe('correct')
    })
    it('within 3 years is close', () => {
      const g = { ...target, id: 'x', nameHe: 'x', debutYear: 2013 } as typeof target
      const t = compareArtist(g, target)[0]
      expect(t.match).toBe('close')
      expect(t.arrow).toBe('up') // target (born 2010) is older than guess (born 2013)
    })
    it('far apart is wrong with a direction arrow', () => {
      const g = { ...target, id: 'x', nameHe: 'x', debutYear: 1990 } as typeof target
      const t = compareArtist(g, target)[0]
      expect(t.match).toBe('wrong')
      expect(t.arrow).toBe('down') // target (born 2010) is younger than guess (born 1990)
    })
  })

  describe('breakthrough', () => {
    const target = fixturesById.get('pop-alpha')! // breakthrough 2012
    it('mirrors the debut-year rule and direction', () => {
      const later = { ...target, id: 'x', nameHe: 'x', breakthroughYear: 2015 } as typeof target
      const t = compareArtist(later, target)[1]
      expect(t.match).toBe('close')
      expect(t.arrow).toBe('down')
    })
    it('exact is correct', () => {
      expect(compareArtist(target, target)[1].match).toBe('correct')
    })
  })

  describe('lineup', () => {
    const band4 = fixturesById.get('rock-band')! // band, 4, mixed
    const band3 = fixturesById.get('rock-band2')! // band, 3, male
    const duo = fixturesById.get('rock-duo')! // duo, 2, male
    const solo = fixturesById.get('pop-alpha')! // solo, 1

    it('identical bands are correct', () => {
      expect(compareArtist(band4, band4)[2].match).toBe('correct')
    })
    it('two bands with different counts are close with an arrow', () => {
      const t = compareArtist(band4, band3)[2]
      expect(t.match).toBe('close')
      expect(t.arrow).toBe('down') // target has 3 < guess 4
    })
    it('band vs duo is close', () => {
      const t = compareArtist(band4, duo)[2]
      expect(t.match).toBe('close')
      expect(t.arrow).toBeDefined()
    })
    it('solo vs group is wrong', () => {
      expect(compareArtist(solo, band4)[2].match).toBe('wrong')
      expect(compareArtist(band4, solo)[2].match).toBe('wrong')
    })
  })

  describe('gender', () => {
    const mixed = fixturesById.get('rock-band')! // mixed
    const male = fixturesById.get('pop-alpha')! // male

    it('same gender is correct', () => {
      expect(compareArtist(male, popBetaMale())[3].match).toBe('correct')
    })
    it('exactly one mixed is close', () => {
      expect(compareArtist(mixed, male)[3].match).toBe('close')
      expect(compareArtist(male, mixed)[3].match).toBe('close')
    })
    it('male vs female is wrong', () => {
      expect(compareArtist(male, fixturesById.get('pop-beta')!)[3].match).toBe('wrong')
    })
  })

  describe('genre', () => {
    const pop = fixturesById.get('pop-alpha')! // pop
    const mizrahi = fixturesById.get('mizrahi-1')! // mizrahi, secondary [pop]
    const rock = fixturesById.get('rock-band')! // rock

    it('same primary genre is correct', () => {
      const g = { ...rock, id: 'x', nameHe: 'x' } as typeof rock
      expect(compareArtist(g, rock)[4].match).toBe('correct')
    })
    it('cross secondary relation is close (mizrahi <-> pop)', () => {
      expect(compareArtist(mizrahi, pop)[4].match).toBe('close')
      expect(compareArtist(pop, mizrahi)[4].match).toBe('close')
    })
    it('unrelated genres are wrong', () => {
      expect(compareArtist(rock, pop)[4].match).toBe('wrong')
    })
  })

  describe('popularity', () => {
    const tier5 = fixturesById.get('pop-alpha')! // tier 5
    const tier4 = fixturesById.get('pop-beta')! // tier 4
    const tier1 = fixturesById.get('rock-duo')! // tier 1

    it('same tier is correct', () => {
      expect(compareArtist(tier5, tier5)[5].match).toBe('correct')
    })
    it('adjacent tier is close with an arrow', () => {
      const t = compareArtist(tier4, tier5)[5]
      expect(t.match).toBe('close')
      expect(t.arrow).toBe('up') // target tier 5 > guess 4
    })
    it('far tier is wrong', () => {
      const t = compareArtist(tier1, tier5)[5]
      expect(t.match).toBe('wrong')
      expect(t.arrow).toBe('up')
    })
  })

  it('win condition is identity only, never all-green tiles', () => {
    // Two artists can tie on every tile and still not be the same artist.
    const a = fixturesById.get('pop-alpha')!
    const twin = {
      ...a,
      id: 'impostor',
      nameHe: 'אותו הדבר',
      popularityTier: a.popularityTier,
      debutYear: a.debutYear,
      breakthroughYear: a.breakthroughYear,
      type: a.type,
      members: a.members,
      gender: a.gender,
      primaryGenre: a.primaryGenre,
    } as typeof a
    const tiles = compareArtist(twin, a)
    expect(tiles.every((t) => t.match === 'correct')).toBe(true)
    expect(twin.id === a.id).toBe(false)
  })
})

function popBetaMale() {
  const b = fixturesById.get('pop-beta')!
  return { ...b, id: 'ignored', nameHe: 'x', gender: 'male' as const }
}