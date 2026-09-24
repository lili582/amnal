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

function lineupTile(guess: Artist, target: Artist): TileResult {
  const field = 'lineup' as const
  if (guess.type === target.type && guess.members === target.members) {
    return { field, match: 'correct' }
  }
  const bothGroups = guess.type !== 'solo' && target.type !== 'solo'
  if (bothGroups) {
    const match: Match = 'close'
    const arrow = guess.members < target.members ? 'up' : 'down'
    return { field, match, arrow }
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

function popularityTile(guess: Artist, target: Artist): TileResult {
  const field = 'popularity' as const
  if (guess.popularityTier === target.popularityTier) return { field, match: 'correct' }
  const diff = Math.abs(guess.popularityTier - target.popularityTier)
  const match: Match = diff === 1 ? 'close' : 'wrong'
  const arrow = guess.popularityTier < target.popularityTier ? 'up' : 'down'
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