# אמנדל — נחשו את האמן הישראלי היומי

A Hebrew, RTL, daily "spotle"-style game: identify the day's Israeli artist in up to
10 guesses using 6 color-coded clue tiles first appeared as arrows (debut year,
breakthrough year, lineup, gender, genre, popularity).

The game is a static Vite + React + TypeScript site. The artist roster and the
daily answer schedule are **not bundled** — they are produced by the data
pipeline and served as plain JSON, so the app updates simply by changing data.

## Stack

- React 19 / Vite 8 / TypeScript 6, oxlint, Vitest (jsdom)
- RTL Heebo UI, dark/light themes, colorblind mode, reduced-motion support
- PWA manifest + icons for installability

## Getting started

```bash
npm install
npm run dev          # dev server; ?day=N previews any date (DEV builds only)
npm test             # vitest (headless)
npm run lint         # oxlint
npm run typecheck    # tsc --noEmit style check
npm run build        # tsc -b && vite build -> dist/
npm run preview      # serve dist/ locally
```

The app fetches `artists.json` + `schedule.json` from `VITE_DATA_URL`
(default `/data`, same-origin). Set `VITE_DATA_URL` at build time to point at
another static origin, e.g. `VITE_DATA_URL=https://cdn.example.com/amnal-data npm run build`.

## Data pipeline (scripts/01–08)

Live-API pipeline → `public/data/`:

| Stage | Source | Produces |
|-------|--------|----------|
| 01 | Wikidata (`wbgetentities` + optional SPARQL pool growth) | `data/raw/wikidata.json` |
| 02 | MusicBrainz | begin date, type, members, gender, tags, `qid-mbid` |
| 03 | Deezer | `deezerFans` |
| 04 | Last.fm (needs `LASTFM_API_KEY` in `.env`; skips otherwise) | `lastfmListeners` |
| 05 | Wikimedia pageviews | `hewikiPageviews90d` |
| 06–08 | merge, validate, build schedule | `public/data/artists.json`, `public/data/schedule.json`, `data/review-report.md` |

```bash
npm run data         # full pipeline (network) — slow, needs network
npm run data:merge   # merge+validate+schedule only (no API calls)
npm run data:validate
```

The seed list is `data/seed-names.json`; genre/region hints in `data/genre-map.json`
and `data/city-region.json`. Unknown values are flagged in
`data/review-report.md`, never guessed; the owner corrects them via
`data/overrides.json`.

The schedule is deterministic (seeded shuffle, seed `amnal-schedule-2026-10`),
never reshuffled after launch — new eligible artists are appended at the end.

## Storage

`localStorage` (namespace `amnal:v1`) holds today's game, settings, stats, and
the 24h data cache. Every access is wrapped so the game works with storage
blocked, just without persistence.

## Deployment (GitHub Pages)

- CI (`.github/workflows/ci.yml`): lint + typecheck + vitest + `data:validate` on push/PR.
- Deploy (`.github/workflows/deploy.yml`): build → Pages on push to `main`.

Before enabling Pages:

1. Set `GAME_URL` and `REPORT_EMAIL` in `src/config.ts`.
2. Push to GitHub; in Settings → Pages choose **Source: GitHub Actions**.
3. Verify `/`, `/data/artists.json`, `/data/schedule.json` return 200.

## Launch checklist (spec section 14)

- [x] ≥300-artist pool (348), ≥150 answerEligible (209)
- [x] validation script passes (11 warnings, see review report)
- [ ] review report reaches 0 `genre-unmapped` (275) / `region-unmapped` (159) flags (owner overrides)
- [ ] 20 sampled artists hand-checked against Wikipedia/MusicBrainz
- [x] compare/normalizeHe/daily logic covered incl. DST and arrows
- [x] full game playable on 360px, keyboard-only, screen reader
- [x] RTL correct; localStorage-disabled safe; reload restores the board
- [x] colorblind + reduced motion
- [x] first load < 250 KB gzipped (JS ~77 KB + compressed JSON); Lighthouse ≥90 to confirm
- [x] CI runs lint + tsc + vitest + validate

## Credits / licensing

Data: Wikidata (CC0), MusicBrainz (CC0 core data), Last.fm (non-commercial),
Deezer. Images/audio off by default (`SHOW_IMAGES=false`). No accounts, no
analytics, no third-party cookies.