// Shared domain types. Keep this file free of UI concerns.

export type ArtistType = 'solo' | 'duo' | 'band'
export type Gender = 'male' | 'female' | 'mixed'

// Kept in the data model for internal analytics; NOT rendered as a tile.
export type Region =
  | 'tel-aviv-area' // גוש דן
  | 'center' // שרון / שפלה / מרכז
  | 'jerusalem' // ירושלים והסביבה
  | 'haifa-north' // חיפה, קריות, צפון
  | 'south' // באר שבע, נגב, אילת, דרום
  | 'abroad' // נולד/הוקם מחוץ לישראל

export type Genre =
  | 'pop' // פופ
  | 'mizrahi' // מזרחית
  | 'rock' // רוק
  | 'hiphop' // היפ-הופ / ראפ
  | 'mediterranean' // ים-תיכוני
  | 'electronic' // אלקטרוני / טראנס
  | 'ethnic-world' // אתנו / עולם
  | 'folk-israeli' // שיר עברי / פולק
  | 'indie-alt' // אינדי / אלטרנטיבי
  | 'religious-pop' // פופ דתי/חסידי
  | 'jazz-soul' // ג'אז / סול
  | 'other'

export interface FamousSong {
  title: string // Hebrew title of the artist's biggest hit
  soundcloud?: string // SoundCloud track URL (embedable); undefined -> search link fallback
}

export interface Artist {
  id: string // stable slug, e.g. "omer-adam"
  nameHe: string // display name, e.g. "עומר אדם"
  nameEn?: string // e.g. "Omer Adam"
  aliases: string[] // extra searchable names (he + en + nicknames)
  debutYear: number // first release / formation year
  birthYear?: number // birth year (solo/duo); used for the age tile
  breakthroughYear: number // year the artist first broke through with a hit
  type: ArtistType
  members: number // 1 for solo, 2 for duo, N for band
  gender: Gender // for groups: 'mixed' if both genders present
  primaryGenre: Genre
  secondaryGenres: Genre[] // 0-2 items, used for "close" matches
  popularityTier: 1 | 2 | 3 | 4 | 5 // 5 = most popular
  region: Region
  answerEligible: boolean // may be picked as a daily answer
  famousSong?: FamousSong // revealed after the round ends
  ids: {
    wikidata?: string
    musicbrainz?: string
    deezer?: number
    lastfm?: string
  }
  metrics?: {
    deezerFans?: number
    lastfmListeners?: number
    hewikiPageviews90d?: number
    wikidataSitelinks?: number
  }
  imageUrl?: string
}

// ---- Comparison / game types ----

export type Match = 'correct' | 'close' | 'wrong'

export const TILE_FIELDS = [
  'debutYear',
  'breakthrough',
  'lineup',
  'gender',
  'genre',
  'popularity',
] as const
export type TileField = (typeof TILE_FIELDS)[number]

export interface TileResult {
  field: TileField
  match: Match
  // 'up' = the target value is HIGHER (later year / more popular) than the guess
  arrow?: 'up' | 'down'
}

export type GameStatus = 'playing' | 'won' | 'lost'

export interface GuessRecord {
  artistId: string
  tiles: TileResult[]
}

export interface SaveState {
  guesses: GuessRecord[]
  status: GameStatus
  date: string // YYYY-MM-DD the saved game belongs to
}

export interface StatsState {
  played: number
  wins: number
  streak: number
  maxStreak: number
  dist: number[] // index = guess count (1..MAX_GUESSES)
  lastWinDate: string | null
}