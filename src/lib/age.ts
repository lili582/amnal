import type { Artist } from '../types'

// The age displayed in the "גיל" tile. Prefer the artist's birth year; groups
// without one fall back to their founding/first-release year so the tile is
// never empty. Age is anchored to the reference year (default: current year).
export function artistAge(artist: Artist, refYear = new Date().getFullYear()): number {
  const origin = artist.birthYear ?? artist.debutYear
  return Math.max(0, refYear - origin)
}