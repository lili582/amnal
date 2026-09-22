import { GAME_NAME, GAME_URL } from '../config'
import type { GameStatus, Match } from '../types'

const RLM = '\u200F' // right-to-left mark
const LRM = '\u200E' // left-to-right mark

const MATCH_EMOJI: Record<Match, string> = {
  correct: '🟩',
  close: '🟨',
  wrong: '⬛',
}

export interface ShareOptions {
  dayNumber: number
  status: GameStatus
  guessesUsed: number
  maxGuesses: number
  rows: Match[][] // one array per played guess, in on-screen column order
  gameName?: string
  url?: string
}

// Builds the copyable share text. No artist names, no spoilers. The first text
// line is RTL-marked; each emoji row is LRM-marked so the tile order stays
// stable in RTL chat apps.
export function buildShareText({
  dayNumber,
  status,
  guessesUsed,
  maxGuesses,
  rows,
  gameName = GAME_NAME,
  url = GAME_URL,
}: ShareOptions): string {
  const used = status === 'won' ? `${guessesUsed}/${maxGuesses}` : 'X/10'
  const head = `${RLM}${gameName} #${dayNumber + 1} - ${used}`
  const grid = rows.map((row) => LRM + row.map((m) => MATCH_EMOJI[m]).join(''))
  return [head, ...grid, url].join('\n')
}

async function copyWithFallback(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

export async function shareText(text: string, title = GAME_NAME): Promise<boolean> {
  const nav = navigator as Navigator & { share?: (d: { title: string; text: string }) => Promise<void> }
  if (nav.share) {
    try {
      await nav.share({ title, text })
      return true
    } catch {
      // user cancelled the native sheet; try clipboard instead
    }
  }
  return copyWithFallback(text)
}