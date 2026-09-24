import { describe, expect, it, beforeEach } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { Artist } from '../src/types'
import type { GameData } from '../src/lib/dataLoader'
import { useGame } from '../src/hooks/useGame'
import { Game } from '../src/Game'
import { strings } from '../src/strings.he'
import { loadStats, saveStats, emptyStats } from '../src/lib/storage'

function artist(id: string, nameHe: string): Artist {
  return {
    id,
    nameHe,
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
  } as Artist
}

const ART_A = artist('a', '××ž×Ÿ ×')
const ART_B = artist('b', '××ž×Ÿ ×‘')

function makeData(): GameData {
  return { artists: [ART_A, ART_B], schedule: ['a', 'b'] }
}

function Harness({ data }: { data: GameData }) {
  const g = useGame(data)
  return (
    <div>
      <span data-status={g.status} />
      <span data-count={String(g.guesses.length)} />
      <button data-testid="guess-a" onClick={() => g.submitGuess(ART_A)} />
      <button data-testid="guess-b" onClick={() => g.submitGuess(ART_B)} />
    </div>
  )
}

function setup() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  return { container, root }
}

function tearDown(root: Root, container: HTMLElement) {
  act(() => {
    root.unmount()
  })
  document.body.removeChild(container)
}

function click(container: HTMLElement, id: string) {
  act(() => {
    const el = container.querySelector(`[data-testid="${id}"]`) as HTMLButtonElement | null
    el?.click()
  })
}

describe('useGame (mounted in jsdom)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    saveStats(emptyStats())
  })

it('guessing a wrong artist keeps the game playing and survives a reload', () => {
    const { container, root } = setup()
    act(() => root.render(<Harness data={makeData()} />))
    const wrongId = makeData().schedule[0] === 'a' ? 'b' : 'a'
    click(container, `guess-${wrongId}`)
    expect(container.querySelector('[data-status]')?.getAttribute('data-status')).toBe('playing')
    expect(container.querySelector('[data-count]')?.getAttribute('data-count')).toBe('1')
    tearDown(root, container)

    // Mid-game reload: the board must restore the guess in progress.
    const again = setup()
    act(() => again.root.render(<Harness data={makeData()} />))
    expect(again.container.querySelector('[data-status]')?.getAttribute('data-status')).toBe('playing')
    expect(again.container.querySelector('[data-count]')?.getAttribute('data-count')).toBe('1')
    tearDown(again.root, again.container)
  })

  it('guessing the target wins immediately and records the result exactly once', () => {
    const { container, root } = setup()
    act(() => root.render(<Harness data={makeData()} />))
    const targetId = makeData().schedule[0]
    click(container, `guess-${targetId}`)
    expect(container.querySelector('[data-status]')?.getAttribute('data-status')).toBe('won')
    expect(container.querySelector('[data-count]')?.getAttribute('data-count')).toBe('1')

    const stats = loadStats()
    expect(stats.played).toBe(1)
    expect(stats.wins).toBe(1)
    expect(stats.dist[0]).toBe(1)
    tearDown(root, container)

    // "Reload": a fresh root restores the saved game; stats are not re-counted.
    const again = setup()
    act(() => again.root.render(<Harness data={makeData()} />))
    expect(again.container.querySelector('[data-status]')?.getAttribute('data-status')).toBe('won')
    expect(again.container.querySelector('[data-count]')?.getAttribute('data-count')).toBe('1')
    expect(loadStats().played).toBe(1)
    expect(loadStats().wins).toBe(1)
    tearDown(again.root, again.container)
  })

  it('submits after a win are ignored', () => {
    const { container, root } = setup()
    act(() => root.render(<Harness data={makeData()} />))
    const targetId = makeData().schedule[0]
    click(container, `guess-${targetId}`)
    click(container, `guess-${targetId}`)
expect(loadStats().played).toBe(1)
    expect(container.querySelector('[data-count]')?.getAttribute('data-count')).toBe('1')
    tearDown(root, container)
  })

  it('the win dialog close button dismisses the end modal', () => {
    const { container, root } = setup()
    act(() => root.render(<Game data={makeData()} source="network" />))

    const input = container.querySelector('input.combo-input') as HTMLInputElement
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )!.set!
      setter.call(input, ART_A.nameHe)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(container.querySelector<HTMLElement>('li.combo-option')).not.toBeNull()
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    const dialog = container.querySelector('.modal')
    expect(dialog).not.toBeNull()
    expect(dialog?.textContent).toContain(strings.winShort)

    const close = container.querySelector<HTMLButtonElement>(`button[aria-label="${strings.close}"]`)
    expect(close).not.toBeNull()
    act(() => close?.click())
    expect(container.querySelector('.modal')).toBeNull()
    tearDown(root, container)
  })
})
