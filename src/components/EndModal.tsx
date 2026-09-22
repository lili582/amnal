import { useEffect, useState } from 'react'
import type { Match } from '../types'
import { strings } from '../strings.he'
import { israelDateString, israelMidnightEpoch, tomorrowIsraelDateString } from '../lib/daily'
import { buildShareText, shareText } from '../lib/share'
import { reportLink } from '../lib/report'
import { Modal } from './Modal'

interface EndModalProps {
  status: 'won' | 'lost'
  name: string
  dayNumber: number
  guessesUsed: number
  maxGuesses: number
  rows: Match[][]
  onClose: () => void
}

function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

function useCountdown(): string {
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])
  const today = israelDateString(new Date(nowMs))
  const midnight = israelMidnightEpoch(tomorrowIsraelDateString(today))
  return formatClock(midnight - nowMs)
}

export function EndModal({
  status,
  name,
  dayNumber,
  guessesUsed,
  maxGuesses,
  rows,
  onClose,
}: EndModalProps) {
  const [copied, setCopied] = useState(false)
  const countdown = useCountdown()

  async function onShare() {
    const text = buildShareText({ dayNumber, status, guessesUsed, maxGuesses, rows })
    const ok = await shareText(text)
    if (ok) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    }
  }

  const head =
    status === 'won'
      ? strings.win.replace('{name}', name)
      : strings.lose.replace('{name}', name)
  const sub =
    status === 'won'
      ? strings.guessesUsed.replace('{n}', String(guessesUsed))
      : 'X/' + maxGuesses

  return (
    <Modal title={status === 'won' ? strings.winShort : strings.loseShort} onClose={onClose}>
      <p className="end-headline">{head}</p>
      <p className="end-sub">{sub}</p>
      <p className="countdown">{strings.nextIn.replace('{time}', countdown)}</p>
      <div className="end-actions">
        <button type="button" className="primary-btn" onClick={() => void onShare()}>
          {strings.shareTitle}
        </button>
        {copied && <span className="copy-ok">{strings.copied}</span>}
      </div>
      <p className="report-link">
        <a href={reportLink(dayNumber)}>{strings.reportMistake}</a>
      </p>
    </Modal>
  )
}