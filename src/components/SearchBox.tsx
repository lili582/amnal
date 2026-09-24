import { useMemo, useRef, useState } from 'react'
import type { Artist } from '../types'
import type { SearchEntry, SearchResult } from '../lib/search'
import { searchArtists } from '../lib/search'
import { normalizeHe } from '../lib/normalizeHe'
import { strings } from '../strings.he'

interface Props {
  index: SearchEntry[]
  guessedIds: ReadonlySet<string>
  disabled: boolean
  placeholder: string
  notFoundText: string
  onPick: (artist: Artist) => void
}

function listIdFor(i: number): string {
  return `suggestion-${i}`
}

// Exact name lookup for the "typed something unknown" path: matches the
// normalized query against every searchable name form of each artist.
function exactMatch(query: string, index: SearchEntry[]): Artist | null {
  const q = normalizeHe(query)
  if (!q) return null
  for (const entry of index) {
    const names = [entry.artist.nameHe, entry.artist.nameEn, ...entry.artist.aliases].filter(
      (n): n is string => Boolean(n),
    )
    if (names.some((n) => normalizeHe(n) === q)) return entry.artist
  }
  return null
}

export function SearchBox({
  index,
  guessedIds,
  disabled,
  placeholder,
  notFoundText,
  onPick,
}: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const suggestions = useMemo(
    () => searchArtists(query, index, guessedIds),
    [query, index, guessedIds],
  )

  const shown = open && suggestions.length > 0 ? suggestions : []

  function commit(result: SearchResult) {
    setQuery(result.artist.nameHe)
    setOpen(false)
    setError(null)
    onPick(result.artist)
  }

  function attemptSubmit() {
    if (shown.length > 0) {
      commit(shown[Math.min(active, shown.length - 1)])
      return
    }
    const artist = exactMatch(query, index)
    if (artist) {
      setQuery(artist.nameHe)
      setError(null)
      onPick(artist)
      return
    }
    setError(notFoundText)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (disabled) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (shown.length > 0) setActive((i) => (i + 1) % shown.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (shown.length > 0) setActive((i) => (i - 1 + shown.length) % shown.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      attemptSubmit()
    } else if (e.key === 'Escape') {
      setOpen(false)
      inputRef.current?.blur()
    }
  }

  function onMouseEnter(i: number) {
    if (open) setActive(i)
  }

  return (
    <div className="search-box">
      <div className="combo">
        <input
          ref={inputRef}
          className="combo-input"
          role="combobox"
          aria-expanded={shown.length > 0}
          aria-autocomplete="list"
          aria-controls="suggestion-list"
          aria-activedescendant={shown.length > 0 ? listIdFor(active) : undefined}
          aria-label={placeholder}
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => {
            setQuery(e.target.value)
            setError(null)
            setOpen(true)
            setActive(0)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
        />
        <ul id="suggestion-list" role="listbox" className="combo-list" hidden={shown.length === 0}>
          {shown.map((s, i) => (
            <li
              key={s.artist.id}
              id={listIdFor(i)}
              role="option"
              aria-selected={i === active}
              className={`combo-option${i === active ? ' active' : ''}`}
              onMouseEnter={() => onMouseEnter(i)}
              onMouseDown={(e) => {
                e.preventDefault()
                commit(s)
              }}
            >
              {s.artist.nameHe}
            </li>
          ))}
        </ul>
      </div>
      <button
        type="button"
        className="submit-btn"
        disabled={disabled}
        onClick={() => {
          inputRef.current?.focus()
          attemptSubmit()
        }}
      >
        {strings.submit}
      </button>
      {error && <p className="notice error" role="alert">{error}</p>}
    </div>
  )
}