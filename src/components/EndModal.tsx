import { useEffect, useState } from 'react'
import type { Artist, FamousSong, Match } from '../types'
import { strings } from '../strings.he'
import { israelDateString, israelMidnightEpoch, tomorrowIsraelDateString } from '../lib/daily'
import { buildShareText, shareText } from '../lib/share'
import { reportLink } from '../lib/report'
import { soundcloudEmbedUrl, soundcloudSearchUrl } from '../lib/soundcloud'
import { Modal } from './Modal'

interface EndModalProps {
  status: 'won' | 'lost'
  artist: Artist
  dayNumber: number
  guessesUsed: number
  maxGuesses: number
  rows: Match[][]
  onClose: () => void
}

// SoundCloud embeds need an oEmbed track URL; when only a search result exists
// we fall back to opening SoundCloud search (never fabricate a track URL).
function soundcloudTarget(song: FamousSong | undefined): string | null {
  if (song?.soundcloud) return song.soundcloud
  return null
}

function RevealCard({ artist }: { artist: Artist }) {
  const song = artist.famousSong
  const trackUrl = soundcloudTarget(song)

  return (
    <div className="reveal-card">
      <h3 className="reveal-title">{strings.revealCardTitle}</h3>
      <div className="reveal-main">
        {artist.imageUrl ? (
          <img
            className="reveal-img"
            src={artist.imageUrl}
            alt={strings.revealPictureAlt.replace('{name}', artist.nameHe)}
            loading="lazy"
          />
        ) : (
          <div className="reveal-img reveal-img-missing" aria-hidden="true">
            {artist.nameHe.charAt(0)}
          </div>
        )}
        <div className="reveal-details">
          <p className="reveal-name">{artist.nameHe}</p>
          <p className="reveal-sub">{artist.nameEn ?? artist.primaryGenre}</p>
        </div>
      </div>

      {song && (
        <div className="reveal-song">
          <p className="reveal-song-label">{strings.revealHitLabel}</p>
          <p className="reveal-song-title">{song.title}</p>
          {trackUrl ? (
            <iframe
              className="reveal-soundcloud"
              src={soundcloudEmbedUrl(trackUrl)}
              allow="autoplay"
              title={`${song.title} — ${artist.nameHe}`}
              loading="lazy"
            />
          ) : (
            <a
              className="reveal-soundcloud-link"
              href={soundcloudSearchUrl(song.title)}
              target="_blank"
              rel="noopener noreferrer"
            >
              {strings.revealSearch}
            </a>
          )}
        </div>
      )}
    </div>
  )
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
  artist,
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
      ? strings.win.replace('{name}', artist.nameHe)
      : strings.lose.replace('{name}', artist.nameHe)
  const sub =
    status === 'won'
      ? strings.guessesUsed.replace('{n}', String(guessesUsed))
      : 'X/' + maxGuesses

  return (
    <Modal title={status === 'won' ? strings.winShort : strings.loseShort} onClose={onClose}>
      <RevealCard artist={artist} />
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