import type { Artist } from '../types'

// The age displayed in the "גיל" tile. Prefer the artist's birth year; groups
// without one fall back to their founding/first-release year so the tile is
// never empty. Age is anchored to the reference year (default: current year).
export function artistAge(artist: Artist, refYear = new Date().getFullYear()): number {
  const origin = artist.birthYear ?? artist.debutYear
  // Guard the sentinel: birthYear ?? debutYear falls through to 0 when both are
  // missing, and refYear - 0 rendered as an age of 2026.
  if (!origin || origin <= 0) return 0
  return Math.max(0, refYear - origin)
}