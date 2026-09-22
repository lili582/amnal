import { useState } from 'react'
import { strings } from '../strings.he'
import { loadStats } from '../lib/storage'
import { winRate } from '../lib/stats'
import { MAX_GUESSES } from '../config'
import { Modal } from './Modal'

export function StatsModal({ onClose }: { onClose: () => void }) {
  const [stats] = useState(() => loadStats())

  const max = Math.max(1, ...stats.dist)
  return (
    <Modal title={strings.statsTitle} onClose={onClose}>
      {stats.played === 0 ? (
        <p>{strings.stats.noStats}</p>
      ) : (
        <>
          <dl className="stat-grid">
            <div>
              <dt>{strings.stats.played}</dt>
              <dd>{stats.played}</dd>
            </div>
            <div>
              <dt>{strings.stats.winRate}</dt>
              <dd>{winRate(stats)}%</dd>
            </div>
            <div>
              <dt>{strings.stats.streak}</dt>
              <dd>{stats.streak}</dd>
            </div>
            <div>
              <dt>{strings.stats.maxStreak}</dt>
              <dd>{stats.maxStreak}</dd>
            </div>
          </dl>
          <h3 className="dist-title">{strings.stats.distribution}</h3>
          <ol className="dist-bars">
            {stats.dist.map((count, i) => (
              <li key={i} className="dist-row">
                <span className="dist-label">{strings.stats.guessCount.replace('{n}', String(i + 1))}</span>
                <span className="dist-bar-wrap">
                  <span
                    className={`dist-bar${i === MAX_GUESSES - 1 ? ' lost' : ''}`}
                    style={{ width: `${(count / max) * 100}%` }}
                  />
                </span>
                <span className="dist-value">{count}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </Modal>
  )
}