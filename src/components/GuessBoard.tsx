import type { Artist, Match, TileField, TileResult } from '../types'
import { TILE_FIELDS } from '../types'
import { strings } from '../strings.he'
import { tileValue } from '../lib/formatTile'

const MATCH_SYMBOL: Record<Match, string> = { correct: '✓', close: '~', wrong: '✗' }
const MATCH_NAME: Record<Match, string> = {
  correct: strings.legendCorrect,
  close: strings.legendClose,
  wrong: strings.legendWrong,
}
const ARROW_GLYPH = { up: '▲', down: '▼' }

function tileAria(label: string, value: string, tile: TileResult): string {
  const parts = [label, value, MATCH_NAME[tile.match]]
  if (tile.arrow) parts.push(tile.arrow === 'up' ? strings.arrowUp : strings.arrowDown)
  return parts.join(', ')
}

interface TileProps {
  field: TileField
  tile: TileResult
  value: string
  index: number
  animate: boolean
}

export function Tile({ field, tile, value, index, animate }: TileProps) {
  const style = animate
    ? { animationDelay: `${index * 150}ms` }
    : undefined
  return (
    <div
      className={`tile tile-${tile.match}${animate ? ' flip' : ''}`}
      style={style}
      role="img"
      aria-label={tileAria(strings.columns[field], value, tile)}
    >
      <span className="tile-value">{value}</span>
      <span className="tile-symbol">{MATCH_SYMBOL[tile.match]}</span>
      {tile.arrow && <span className="tile-arrow">{ARROW_GLYPH[tile.arrow]}</span>}
    </div>
  )
}

interface GuessBoardProps {
  guesses: { artistId: string; tiles: TileResult[] }[]
  artistsById: ReadonlyMap<string, Artist>
  animate: boolean
}

export function GuessBoard({ guesses, artistsById, animate }: GuessBoardProps) {
  return (
    <div className="board" aria-label={strings.boardEmpty}>
      <div className="tiles-grid tiles-header" aria-hidden="true">
        {TILE_FIELDS.map((f) => (
          <span key={f} className="tile-label">
            {strings.columns[f]}
          </span>
        ))}
      </div>
      {guesses.length === 0 && <p className="board-empty">{strings.boardEmpty}</p>}
      <ol className="guess-list">
        {[...guesses].reverse().map((g, ri) => {
          const artist = artistsById.get(g.artistId)
          if (!artist) return null
          const originalIdx = guesses.length - 1 - ri // stable key in game order
          const isLast = ri === 0 // newest guess is at the top
          return (
            <li key={originalIdx} className={`guess-card${isLast ? ' fresh' : ''}`}>
              <p className="guess-name">{artist.nameHe}</p>
              <div className="tiles-grid">
                {g.tiles.map((t, i) => (
                  <Tile
                    key={t.field}
                    field={t.field}
                    tile={t}
                    value={tileValue(artist, t.field)}
                    index={i}
                    animate={animate && isLast}
                  />
                ))}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}