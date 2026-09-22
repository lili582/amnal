import { describe, expect, it } from 'vitest'
import { buildShareText } from '../src/lib/share'

const RLM = '\u200F'
const LRM = '\u200E'

describe('buildShareText', () => {
  const rows = [
    ['correct', 'close', 'wrong'] as const,
    ['close', 'correct', 'correct'] as const,
  ]

  it('renders the header with game number and guesses used', () => {
    const text = buildShareText({
      dayNumber: 11,
      status: 'won',
      guessesUsed: 4,
      maxGuesses: 10,
      rows,
      url: 'https://example.com',
    })
    const lines = text.split('\n')
    expect(lines[0]).toBe(`${RLM}אמנל #12 - 4/10`)
    expect(lines[1].startsWith(LRM)).toBe(true)
    expect(lines[2].startsWith(LRM)).toBe(true)
    expect(lines[3]).toBe('https://example.com')
  })

  it('shows X/10 on a loss and uses all played rows', () => {
    const text = buildShareText({
      dayNumber: 0,
      status: 'lost',
      guessesUsed: 10,
      maxGuesses: 10,
      rows: [['wrong', 'wrong', 'wrong', 'wrong', 'wrong', 'wrong'] as const],
      url: 'https://example.com',
    })
    expect(text.split('\n')[0]).toBe(`${RLM}אמנל #1 - X/10`)
    expect(text.split('\n')[1]).toBe(`${LRM}⬛⬛⬛⬛⬛⬛`)
  })

  it('maps matches to the correct emoji in order', () => {
    const text = buildShareText({
      dayNumber: 5,
      status: 'won',
      guessesUsed: 2,
      maxGuesses: 10,
      rows: [['correct', 'close', 'wrong', 'correct', 'correct', 'wrong'] as const],
      url: 'https://example.com',
    })
    expect(text.split('\n')[1]).toBe(`${LRM}🟩🟨⬛🟩🟩⬛`)
  })

  it('never leaks artist names into the share text', () => {
    const text = buildShareText({
      dayNumber: 1,
      status: 'won',
      guessesUsed: 3,
      maxGuesses: 10,
      rows,
    })
    expect(text).not.toMatch(/name|ascii/i)
    expect(text).toContain('אמנל')
  })
})
