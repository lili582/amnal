import type { Artist, Match, TileResult } from '../types'
import { artistAge } from './age'

function yearTiles(
  guessValue: number,
  targetValue: number,
  field: 'debutYear' | 'breakthrough',
): TileResult {
  if (guessValue === targetValue) return { field, match: 'correct' }
  const diff = Math.abs(guessValue - targetValue)
  const match: Match = diff <= 3 ? 'close' : 'wrong'
  const arrow = guessValue < targetValue ? 'up' : 'down'
  return { field, match, arrow }
}

// members === 0 means "unknown", not "zero members". In the current dataset
// that is every band in the pool, so two unknowns must never be treated as a
// match: doing so hands out a "correct" tile for a number nobody measured.
function lineupTile(guess: Artist, target: Artist): TileResult {
  const field = 'lineup' as const
  const guessKnown = guess.members > 0
  const targetKnown = target.members > 0

  if (guess.type === target.type && guessKnown && targetKnown && guess.members === target.members) {
    return { field, match: 'correct' }
  }
  const bothGroups = guess.type !== 'solo' && target.type !== 'solo'
  if (bothGroups) {
    // Only claim a direction when both counts are real numbers.
    if (guessKnown && targetKnown) {
      const match: Match = 'close'
      const arrow = guess.members < target.members ? 'up' : 'down'
      return { field, match, arrow }
    }
    return { field, match: 'close' }
  }
  return { field, match: 'wrong' }
}

function genderTile(guess: Artist, target: Artist): TileResult {
  const field = 'gender' as const
  if (guess.gender === target.gender) return { field, match: 'correct' }
  const oneIsMixed =
    (guess.gender === 'mixed') !== (target.gender === 'mixed')
  return { field, match: oneIsMixed ? 'close' : 'wrong' }
}

function genreTile(guess: Artist, target: Artist): TileResult {
  const field = 'genre' as const
  if (guess.primaryGenre === target.primaryGenre) return { field, match: 'correct' }
  const cross =
    target.secondaryGenres.includes(guess.primaryGenre) ||
    guess.secondaryGenres.includes(target.primaryGenre)
  const shared = guess.secondaryGenres.some((g) => target.secondaryGenres.includes(g))
  return { field, match: cross || shared ? 'close' : 'wrong' }
}

// How close two popularity ranks must be to count as "close". popularityRank
// spans the whole pool (1..POOL_SIZE), so the old "adjacent tier" rule has no
// direct equivalent: a fixed 1-position gap is far too strict on a 1000-wide
// scale. 50 positions (~5% of the pool) is the point where two artists still
// feel comparable to a player. Tune here if the tile feels too tight or loose.
const POPULARITY_CLOSE_SPAN = 50

function popularityTile(guess: Artist, target: Artist): TileResult {
  const field = 'popularity' as const
  if (guess.popularityRank === target.popularityRank) return { field, match: 'correct' }
  const diff = Math.abs(guess.popularityRank - target.popularityRank)
  const match: Match = diff <= POPULARITY_CLOSE_SPAN ? 'close' : 'wrong'
  // Rank 1 is the most popular, so a guess with the larger rank is the less
  // popular one and the player has to move "up" the list to reach the target.
  const arrow = guess.popularityRank > target.popularityRank ? 'up' : 'down'
  return { field, match, arrow }
}

// Compare a guessed artist against the target. Pure and deterministic.
// Returns tiles in on-screen (right-to-left) field order. Never call this to
// decide a win; the win condition is guess.id === target.id.
export function compareArtist(guess: Artist, target: Artist): TileResult[] {
  return [
    yearTiles(artistAge(guess), artistAge(target), 'debutYear'),
    yearTiles(guess.breakthroughYear, target.breakthroughYear, 'breakthrough'),
    lineupTile(guess, target),
    genderTile(guess, target),
    genreTile(guess, target),
    popularityTile(guess, target),
  ]
}