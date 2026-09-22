import type { Match } from '../types'
import { TILE_FIELDS } from '../types'
import { strings } from '../strings.he'
import { Modal } from './Modal'

function LegendExample({ match }: { match: Match }) {
  const cls = match === 'correct' ? 'green' : match === 'close' ? 'yellow' : 'gray'
  return <span className={`legend-chip chip-${cls}`} />
}

export function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title={strings.helpTitle} onClose={onClose}>
      <p>{strings.helpBody}</p>
      <h3>רמזים</h3>
      <ul className="legend-list">
        <li>
          <span className="legend-row">
            <LegendExample match="correct" />
            {strings.legendCorrect}
          </span>
        </li>
        <li>
          <span className="legend-row">
            <LegendExample match="close" />
            {strings.legendClose}
          </span>
        </li>
        <li>
          <span className="legend-row">
            <LegendExample match="wrong" />
            {strings.legendWrong}
          </span>
        </li>
        <li>
          <span className="legend-row">
            <span className="legend-arrow">▲▼</span>
            {strings.legendArrow}
          </span>
        </li>
      </ul>
      <p className="tile-field-note">{TILE_FIELDS.map((f) => strings.columns[f]).join(' · ')}</p>
    </Modal>
  )
}