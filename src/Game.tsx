import { useEffect, useMemo, useState } from 'react'
import type { DataSource, GameData } from './lib/dataLoader'
import type { Settings } from './lib/storage'
import { loadSettings, saveSettings } from './lib/storage'
import { buildSearchIndex } from './lib/search'
import { useGame } from './hooks/useGame'
import { reportLink } from './lib/report'
import { strings } from './strings.he'
import { SearchBox } from './components/SearchBox'
import { GuessBoard } from './components/GuessBoard'
import { EndModal } from './components/EndModal'
import { HelpModal } from './components/HelpModal'
import { StatsModal } from './components/StatsModal'
import { SettingsModal } from './components/SettingsModal'

const NOTICE_TEXTS: Record<string, string> = {
  alreadyGuessed: strings.alreadyGuessed,
}

interface GameProps {
  data: GameData
  source: DataSource
}

export function Game({ data, source }: GameProps) {
  const game = useGame(data)
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [modal, setModal] = useState<'help' | 'stats' | 'settings' | null>(null)

  const index = useMemo(() => buildSearchIndex(data.artists), [data])

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme
    document.documentElement.dataset.cb = settings.colorblind ? 'true' : 'false'
    saveSettings(settings)
  }, [settings])

  const finished = game.status !== 'playing'

  return (
    <main className="game">
      <header className="app-header">
        <div>
          <h1 className="app-title">{strings.title}</h1>
          <p className="app-subtitle">{strings.subtitle}</p>
        </div>
        <nav className="app-actions" aria-label={strings.title}>
          <button type="button" className="icon-btn" onClick={() => setModal('help')}>
            {strings.btnHelp}
          </button>
          <button type="button" className="icon-btn" onClick={() => setModal('stats')}>
            {strings.btnStats}
          </button>
          <button type="button" className="icon-btn" onClick={() => setModal('settings')}>
            {strings.btnSettings}
          </button>
        </nav>
      </header>

      {source === 'stale-cache' && <p className="notice info">{strings.staleDataNote}</p>}

      <p className="counter" aria-live="polite" aria-atomic="true">
        {strings.guessCounter.replace('{n}', String(game.guesses.length)).replace('{max}', String(game.maxGuesses))}
        <span className="day-number">· {strings.numberOfDay.replace('{n}', String(game.dayNumber + 1))}</span>
      </p>

      <SearchBox
        index={index}
        guessedIds={game.guessedIds}
        disabled={finished}
        placeholder={strings.placeholder}
        notFoundText={strings.notFound}
        pickHint={strings.pickFromList}
        onPick={game.submitGuess}
      />

      {game.notice && <p className="notice error" role="alert">{NOTICE_TEXTS[game.notice] ?? game.notice}</p>}

      <div className="legend" role="note" aria-label={strings.legendArrow}>
        <span className="legend-item">
          <span className="legend-chip chip-green" /> {strings.legendCorrect}
        </span>
        <span className="legend-item">
          <span className="legend-chip chip-yellow" /> {strings.legendClose}
        </span>
        <span className="legend-item">
          <span className="legend-chip chip-gray" /> {strings.legendWrong}
        </span>
        <span className="legend-item">
          <span className="legend-arrow">▲▼</span> {strings.legendArrow}
        </span>
      </div>

      <GuessBoard guesses={game.guesses} artistsById={game.artistsById} animate />

      {(modal === 'help' || modal === 'stats' || modal === 'settings') && (
        <>
          {modal === 'help' && <HelpModal onClose={() => setModal(null)} />}
          {modal === 'stats' && <StatsModal onClose={() => setModal(null)} />}
          {modal === 'settings' && (
            <SettingsModal settings={settings} onChange={setSettings} onClose={() => setModal(null)} />
          )}
        </>
      )}

      {finished && game.target && (
        <EndModal
          status={game.status === 'playing' ? 'lost' : game.status}
          name={game.target.nameHe}
          dayNumber={game.dayNumber}
          guessesUsed={game.guesses.length}
          maxGuesses={game.maxGuesses}
          rows={game.shareRows}
          onClose={() => setModal(null)}
        />
      )}

      <footer className="footer">
        <p>{strings.footerCredits}</p>
        <a href={reportLink(game.dayNumber)}>{strings.reportMistake}</a>
      </footer>
    </main>
  )
}