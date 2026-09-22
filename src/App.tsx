import { useEffect, useState } from 'react'
import { GAME_NAME } from './config'
import { strings } from './strings.he'
import { loadGameData, type LoadResult } from './lib/dataLoader'
import { Game } from './Game'
import './App.css'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; detail: unknown }
  | { status: 'ready'; result: LoadResult }

function App() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    loadGameData()
      .then((result) => {
        if (!cancelled) setState({ status: 'ready', result })
      })
      .catch((detail) => {
        if (!cancelled) setState({ status: 'error', detail })
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (state.status === 'loading') {
    return (
      <main className="status-page">
        <h1>{GAME_NAME}</h1>
        <p>{strings.loadingData}</p>
      </main>
    )
  }

  if (state.status === 'error') {
    return (
      <main className="status-page">
        <h1>{GAME_NAME}</h1>
        <p>{strings.errorLoading}</p>
        <button type="button" className="primary-btn" onClick={() => window.location.reload()}>
          {strings.retry}
        </button>
      </main>
    )
  }

  return <Game data={state.result.data} source={state.result.source} />
}

export default App