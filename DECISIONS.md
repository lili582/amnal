# DECISIONS.md — record of every deviation from hebrew-spotle-game-spec.txt

## Decisions made

1. **Game name = "אמנדל"** (spec working title was "זמרדל"). Kept in
   `src/config.ts` -> `GAME_NAME` so it can be renamed in one place.

2. **6 clue tiles instead of 7.** The owner chose (2026-09-21) to replace the
   `region` tile with a **breakthrough-year** tile and to **drop the
   `talentShow` tile** entirely. Final tile order (right-to-left):
   `debutYear` -> `breakthrough` -> `lineup` -> `gender` -> `genre` ->
   `popularity`. The `region` field stays in the data model for internal
   analytics and future use but is NOT rendered.

3. **`breakthroughYear` sourcing.** No public API exposes an objective
   "breakthrough year". The merge script defaults `breakthroughYear` to
   `debutYear` so the game is fully playable out of the box; every defaulted
   value is listed in the review report for the owner to correct via
   `data/overrides.json`. Validation requires a present value.

4. **React 19 / Vite 8 / TypeScript 6** (scaffolded versions) are used instead
   of the spec's "React 18". No spec feature depends on the minor difference.

5. **Last.fm is best-effort.** Requires a free API key in `.env`
   (`LASTFM_API_KEY`). Without it, the pipeline skips Last.fm and re-weights the
   remaining popularity signals (spec section 7 already renormalises weights).

6. **Schedule repeat-window.** Spec says answers repeat only after the whole
   eligible list is used. Since the eligible pool grows over time, the schedule
   is rebuilt lazily: new artists appended at the end; existing order never
   reshuffled. `?day=N` preview is gated to `import.meta.env.DEV`.

7. **GDPR / privacy.** No accounts, no analytics, no third-party cookies.
   Local storage lives in the player's device only.

8. **Runtime data source = remote JSON endpoint.** The owner chose (2026-09-21)
   NOT to bundle `artists.json` / `schedule.json` inside the static build. The
   pipeline (scripts 01-08) writes them to `public/data/`, which any static
   host (GitHub Pages, S3, CDN) serves as plain JSON. At startup the app
   fetches them from `VITE_DATA_URL` (default `/data`, same-origin), validates
   the shape (`src/lib/dataLoader.ts`), and caches a copy in localStorage
   (24h TTL) with stale-on-error fallback so an offline player can still play.
   The app therefore does not need to be rebuilt when the roster changes. The
   daily schedule is stable, so a stale cached roster is fine to play with.

9. **Data pipeline fixes (2026-09-21).** Debugging concluded with three changes
   to the live-API pipeline:
   - `sanitize()` hex-encodes non-ASCII so Hebrew search terms can never
     collide to the same cache key;
   - stage-1 seeks only SPARQL pool growth; enrichment/validation uses the
     reliable MediaWiki `wbgetentities` endpoint;
   - artist-lookup requires a real musical signal (occupation or a
     musical-group instance type) plus at least lenient Israeli evidence,
     preferring explicit citizenship/country-of-origin.
   Unknown but legitimate values (missing debut year, unknown band member
   count, missing Hebrew label) are marked in the review report for owner
   overrides instead of being guessed or fatal.

10. **PHASE 3/4 UI (2026-09-22).** Implemented per spec sections 10-12 with the
    structured tile set from decision 2. The board shows the newest guess on
    top; the share grid is chronological (first guess first) so the emoji rows
    read top-to-bottom, per spec 11. There is no "yesterday view" in the MVP
    (daily-only mode; re-listed in the backlog). Dev preview `?day=N` is the
    only date override and is gated to `import.meta.env.DEV`.

11. **PHASE 5 polish (2026-09-22).** Added the optional spec-5 items: PWA
    `manifest.webmanifest` + generated 192/512 icons, a `404.html` SPA
    redirect that any static host can serve, colorblind and reduced-motion
    modes, and a mailto report-a-mistake link in the footer/end dialog
    (`REPORT_EMAIL` in `src/config.ts`). Deployment target is GitHub Pages via
    `.github/workflows/deploy.yml`; CI runs lint + typecheck + vitest +
    `data:validate`. `GAME_URL`, `REPORT_EMAIL`, and Pages enablement are
    owner TODOs before launch (acceptance 14).

12. **"גיל" tile (2026-09-25).** The first tile (`debutYear` field key)
    displays the artist's **age** instead of the formation year, and the
    comparison arrow flips to age semantics (older = higher value). Age uses
    `birthYear` from Wikidata when available, falling back to the debut year
    for groups without one so the tile is never empty. `birthYear` is merged
    (scripts/06) and validated; it is a per-artist override-able field.

13. **Reveal card + SoundCloud (2026-09-25).** The end dialog shows a reveal
    card with the artist's name, Wikidata portrait (`imageUrl`, merged from
    `data/raw/images.json` cache), and their biggest hit (`famousSong`, curated
    in `data/famous-songs.json` keyed by Wikidata QID). SoundCloud playback
    uses the official widget iframe only when a real track URL is curated;
    otherwise a SoundCloud **search** link is shown — track URLs are never
    fabricated. Widget/search helpers live in `src/lib/soundcloud.ts`.

14. **famousSong coverage complete (2026-09-28).** Every `answerEligible`
    artist now has a curated `famousSong` or is a deliberate omission. Final
    state: 184/348 artists with a famous song; the 25 remaining eligible
    artists are actors/actresses/comedians/non-singers with no notable solo
    hit (e.g. גברי בנאי, יעל אבקסיס, רונית אלקבץ, רבקה מיכאלי) or obscure
    names, and are intentionally left without a song — they are still valid
    puzzle answers. QC notes: picks were researched per-artist and a final
    audit re-verified ~a dozen of the most visible picks against hewiki/הפזמונט
    (caught one typo: דקלון → "כותל המזרח").

15. **Daily rotation robustness (2026-09-28).** Data fetches now carry a
    day-based `?v=` cache-busting stamp and `cache: 'no-store'`, so a stale
    copy of `schedule.json`/`artists.json` held by the browser or a CDN edge
    can never pin a player to an old day's artist. `today` also rolls over at
    the Israeli midnight even if the tab stays open (30s poll), loading that
    day's saved board. Fixed a latent dev-only bug where a missing/empty `?day`
    param resolved to day 0 (pinning every dev session to the same artist).
    Tests now derive the target exactly as `useGame` does, so the suite no
    longer depends on the calendar day's parity.
16. **Stale local data cache (2026-09-30).** The "artist not shown as dead"
    bug was not a data problem: `src/lib/dataLoader.ts` caches `artists.json`
    in `localStorage` for 24h, so players (and any stale snapshot) kept being
    served a pre-patch dataset with no `diedYear` field. The `?v=` stamp only
    defeats HTTP/CDN caches, not `readCacheRecord()`. Fixed by bumping
    `DATA_SCHEMA_VERSION` `'v1'` -> `'v2'` in `src/config.ts` (it is part of
    the localStorage cache key), which invalidates every stored copy. Rule for
    future schema changes: bump this constant whenever the shape of
    `artists.json` / `schedule.json` changes.

17. **Pool = top 1000 Israeli Spotify artists (2026-09-30).** The artist pool
    is now the **1000 most-listened Israeli/Hebrew artists on Spotify**, and
    listenership drives both pool membership and `popularityRank`.
    - Spotify's Web API is unusable (Feb 2026 removed artist `popularity`/
      `followers` for dev apps - see spec 6.6), so stage `scripts/00-kworb.ts`
      scrapes the public chart mirror `kworb.net/spotify/country/
      il_weekly_totals.html`, sums each artist's stream total, and writes
      `data/raw/kworb.json`. No key, no auth, no rate limit. (Spec 6.6 was
      re-scoped: the Web API is still "do not use", the mirror is the source.)
    - `scripts/01-wikidata.ts` resolves each chart name to a Wikidata QID with
      the same Israeli validation used for seeds, writes `data/raw/spotify.json`
      (`qid -> {name, spotifyId, streams}`), and tags entries `source:'spotify'`.
      The resolution was refactored into a two-pass `resolveBatch`: search all
      names (cached), then fetch the union of candidate entities in batched
      `wbgetentities` calls. The old per-hit fetch made a ~900-artist run take
      30+ minutes; the batched version does it in ~1 minute. `scripts/02` also
      moved its 1.15s MusicBrainz throttle into `cachedFetch`'s `delayMs` so
      cached artists skip the wait and re-runs are resumable.
    - `scripts/06-merge.ts` attaches `ids.spotify`, `metrics.spotifyStreams`,
      `metrics.spotifyRank`, weights Spotify as the dominant rank signal
      (0.45, ahead of hewiki 0.25 / deezer 0.20 / sitelinks 0.10; lastfm
      dropped), then forces the pool to **exactly 1000** artists: Spotify-ranked
      artists first, previously-scheduled artists always kept, best of the rest
      as filler. Artists whose `id` disappears from the pool are removed from
      the dataset entirely.
- `answerEligible` requires a valid debut year *and* at least one measured
      interest signal (Spotify streams, 90-day hewiki pageviews or Deezer fans),
      so every daily answer is a currently-trending artist. It does not use
      `popularityRank`: rank is a within-pool ordering, and eligibility should not
      depend on where the arbitrary pool cut-off fell. popularityRank drives
      autocomplete ordering only.
      - Debut year sources, in order: override, MusicBrainz begin (groups),
        Wikidata P2031, MusicBrainz first release (persons), Deezer earliest
        album release (new stage `scripts/05c-deezer-debut.ts`, 194 artists
        recovered), Wikidata P571.
    - Because the pool was re-baselined pre-launch,
      `scripts/08-build-schedule.ts` now regenerates the schedule from scratch
      (seeded shuffle, so an unchanged eligible set is stable). After launch
      the schedule must be treated as frozen/append-only.

    Result: pool 1000, answer-eligible/schedule 912.

## 18. Pool membership = Israeli *and* recognised as a music artist

  Two gates, because the request ("top 1000 Israeli/Hebrew artists, ranked by
  Spotify") turned out to need both, and the first version of this work
  silently got each wrong.

  Gate 1 (Israeliness) - the "has a Hebrew Wikipedia page" fallback was far too
  loose once discovery came from the chart. Of 656 chart artists it accepted
  456 as "Israeli" on the strength of a hewiki sitelink alone, and those were
  international records that merely chart here: Rolling Stones, Lizzo, Måneskin,
  Coldplay, Billie Eilish, a-ha. Chart names must now resolve to P27=Israel or
  P495=Israel. Only ~200 chart artists survive, which is short of 1000, so the
  other slots come from SPARQL branches that are Israeli by construction
  (P27/P495 = Israel + a music occupation, now covering singer, musician,
  singer-songwriter, rapper, DJ, composer, songwriter, guitarist, producer,
  ensemble, band).

Gate 2 (is actually a musician) - P106 cannot express this. A TV actor who
  sang one guest song gets occupation=singer, identical to a real singer who
  also acts, so both survive every Wikidata filter; the pool ended up with 360
  actor-musicians, median Deezer fans 48 against 327 for everyone else, which
  is the signature of actors rather than recording artists.
  scripts/05b-hecats.ts fetches Hebrew Wikipedia categories per artist, and
  scripts/music-cat.ts matches acting category names (actress / actor /
  television, film and stage performers / voice acting) on top of the Wikidata
  acting occupations.
    Trap: maintenance categories must be filtered first, otherwise "ערכים עם
    פרופילי קולנוענים-מוזיקאים", which sits on every artist page including
    pure actors, matches any acting pattern.

  **Superseded: the gate is now unconditional (2026-10-02).** The first version
  kept an artist who had an acting occupation if a *strong* performer category
  was also present. That kept Dana Ivgy (Q528853), whose Wikidata item carries
  both acting occupations and acting hewiki categories, because singer
  categories were present too. The user wants singers and bands only, so acting
  in either source now drops the artist outright, with no escape hatch except
  a deliberate `forceKeep: true` override. Discovery was widened at the same
  time (SPARQL sitelinks floor 2 => 1) so the 1000-artist pool could still be
  filled: 2261 enriched entries, 539 dropped as actors, 1722 survivors.

  Alternatives rejected: Deezer fan thresholds would have cut Gali Atari
  (Israel's Eurovision winner, 825 fans) and Yehoram Gaon (970); Deezer and
  MusicBrainz both fail on Hebrew artists outright (Deezer answers "Maya
  Shoef" with Masayoshi Takanaka, and has no index for Hebrew names).
  Last.fm is dead - the API key resolves 1 artist.

  Side effect worth noting: the category gate also caught a wrong-entity match
  - "Noa Carmi" had resolved to a 2001-born actress rather than the singer of
  that name.

  Result: 0 artists in the pool match an acting occupation or acting category;
  Dana Ivgy, Yehoram Gaon and Gali Atari are all absent. Pool 1000,
  eligible/schedule 912.
  Known judgement calls:
    - Ehud Manor is dropped, because hewiki files him as a lyricist/host rather
      than a performer, not because he did not sing.
    - Singers whose sources record *only* a singing occupation survive, because
      the data does not mention their acting work: Yafa Yarkoni (her lead calls
      her "זמרת ושחקנית"), David Tal and Idan Raichel.
    - Homonym contamination remains and is not automatable: "דוד אלעזר"
      resolves to an IDF commander (Q467177) whose Wikidata item wrongly
      includes singer. Requiring singer evidence from Wikidata/hewiki/Spotify
      was measured and rejected: it would drop 197 real entries, most of them
      legitimate bands with thin data (ברוש, פינג פונג, מלכה באיה, קושה דילז,
      השובלים).
    - Resolved with a curated blocklist instead. `exclude: true` in
      data/overrides.json drops an artist from the pool, and 65 names are now
      listed there. They were found data-driven rather than by eye: an artist
      with no singer/band category on hewiki but a strong non-music profession
      category (poet, writer, journalist, rabbi, film director, TV host,
      soldier, politician, linguist, encyclopedist) is a near-certain false
      positive, because the Wikidata "musician" branch admits anyone whose
      lyrics or poems were set to music. That probe found ~50 names, including
      a serial killer (ברק כהן) and an IDF commander (דוד אלעזר). Classical
      instrumentalists and conductors were excluded too (יבגני קיסין,
      מקסים ונגרוב, נסים אלשיך, מרק לברי, ...), since the game asks for
      singers and bands.
    - Kept deliberately despite ambiguity: אברהם זיגמן and יהושע אנגלמן
      (Hasidic singer-composers who also have poet/rabbi categories), מקס ברוד
      and יוסף שריג (singers who also write), יובל בן-עמי (a real
      percussionist who also writes), דניאל בארנבוים.
## Popularity is a 1..1000 rank, not a 1-5 tier

The tier model was replaced. `popularityTier: 1|2|3|4|5` is now
`popularityRank: number`, where 1 is the most popular artist in the pool and
1000 (POOL_SIZE) the least. The game UI shows `#12`, not five stars.

Why: five buckets collapse a 1000-artist pool into groups of ~200, so the tile
could not distinguish a near miss from a wild guess, and the "out of 5" framing
communicated nothing about how many artists were being compared. A rank is
directly interpretable and scales with the pool.

- Ranking runs *after* `forcePool`, not before. Ranking the ~2200 candidates
  first and then capping the pool left gaps in the middle wherever a dropped
  artist used to sit; ranking the final pool makes the range exactly 1..1000
  with no holes. Verified dense and unique after the change.
- The score is unchanged (weighted within-dataset percentiles: spotify 0.45,
  hewiki 0.25, deezer 0.20, sitelinks 0.10, renormalized over present signals).
  Only the bucketing changed.
- "Close" needed redefinition: on a 1-5 scale an adjacent tier was one step, but
  on a 1-1000 scale any fixed small gap is meaningless. `POPULARITY_CLOSE_SPAN`
  in src/lib/compare.ts is 50 (~5% of the pool) and is a single tunable
  constant. This is a game-feel guess, not a measured value - adjust after
  playing it.
- The arrow direction inverted, because rank 1 is now the top: a guess with a
  higher rank number than the target is the *less* popular one.
- `data/overrides.json` accepts `popularityRank` for hand-curated fixes. Pinned
  ranks are honoured and the rest are ranked around them.
- `metrics.spotifyRank` remains diagnostic only and is unrelated to this field.
## Why the 87 missing debut years are still missing

87 pool artists have no debut year. I tried three automated backfills and all
three failed verification, so none of the data was applied. Recording the
negative result so it is not repeated.

1. Name-based lookup (Deezer `search/artist` -> earliest album release_date).
   Resolved 33 of 87, but **25 of the 33 were the wrong artist**: ??? ??? ->
   Gabi Shoshan, ????? ???? -> ????? ?????, ??? ???? -> ??? ????, ???? ??? ->
   ???? ????, ???? ???? -> ????? ?????, ????? ???? -> ????? ?????, ???? ?? ->
   Yosef Karduner. Hebrew artist names collide constantly. A few rejections were
   false alarms (??? ?????? -> "Yaffa Yarkoni" and ??? ??? -> "Avi Peretz" are the
   same people, just transliterated), which is what makes the whole approach
   untrustworthy in both directions.
2. ID-based lookup (MusicBrainz by the Wikidata-verified MBID). This cannot
   resolve to the wrong artist, and 65 of the 87 have an MBID - but it resolved
   only **8 of 65**, and at least one of those 8 is wrong: ???? ????? came back
   as 2022, but he died in 1982. For a dead artist MusicBrainz's earliest
   release is often a posthumous compilation, not a debut. A second pass over
   `/release` (instead of `/release-group`) added nothing, so the coverage gap is
   real, not an endpoint choice.
3. Local Wikidata already has all 87 entities and no date claims on any of them:
   69 carry only a birth year, 9 have an `activeSince` that is unreliable
   (Max Brod's is 1906, which is his birth year, not a debut), and 9 have
   neither.

Blast radius is bounded: all 87 are `answerEligible: false`, because
`debutOk()` requires a debut year, so none can be a daily answer and the
schedule is safe. They are all still guessable, and their debut tile renders
"-" instead of a year.

So this needs manual curation in data/overrides.json (a real source per
artist), not another scraper. If a future automated attempt does get built, it
must key on an identifier rather than a name and must reject any candidate
later than the artist's death year.
## members === 0 means unknown, and it was corrupting the lineup tile

`members` uses 0 as its "unknown" sentinel (07-validate.ts relies on this: it
accepts `type !== 'solo' && members === 0`). Nothing in the UI or the game logic
honoured that, and all 188 bands in the pool have an unknown count, so every
band was affected.

- Display: `formatTile` interpolated the sentinel, so the lineup tile showed
  **"???? (0)"** - a band with zero members - for all 188 bands. It now renders
  the bare "????" until a count is known.
- Logic (the real bug): `lineupTile` awarded "correct" when
  `guess.members === target.members`, and `0 === 0`, so **any two unrelated
  bands scored a correct lineup tile** for a number nobody measured. It also
  emitted a direction arrow from `0 < 0`, which is always false and so always
  pointed "down". A tile must never be decided by a sentinel. Both members must
  now be real numbers before the tile can be "correct" or show an arrow;
  otherwise two groups are "close" and nothing more.

Regression tests cover unknown-vs-unknown, unknown-vs-known, and unknown
against a real solo. The underlying data gap is unchanged - band member counts
still need curating in data/overrides.json - but the game no longer invents an
answer from the sentinel.
## Unknown values were deciding tiles (the 0-sentinel audit)

Follow-up to the `members` bug: 0 is this codebase's "unknown" sentinel
(`debutYear`, `breakthroughYear`, `members`), and `age.ts` also falls through
`birthYear ?? debutYear`. Nothing distinguished "we do not know this" from a
real value when scoring tiles.

I audited every unordered pair in the pool (499,500 pairs) for tiles that
report "correct" only because two *unknown* values are equal:

| field | false "correct" pairs |
|---|---|
| breakthrough | 2,775 |
| debutYear | 55 |
| lineup | 188 bands (fixed earlier) |

- `yearTiles` now returns "wrong" with no arrow if either side is <= 0. A real
  year compared against 0 produced a meaningless diff, and 0 === 0 produced a
  free "correct". 75 pool artists have no breakthrough year, so this was the
  single largest source of unearned credit.
- `artistAge` guards the sentinel: with both `birthYear` and `debutYear`
  missing, `refYear - 0` rendered an age of **2026** for 11 artists (??? ???,
  ??? ????, ?????? and others). It now returns 0 so the tile shows "-".
- One existing test asserted the buggy output (`toBe('2026')` for an artist
  with no origin year). It was codifying the bug, so it now asserts "-".

Re-running the audit reports zero false "correct" tiles.

The audit script was a throwaway. If this needs guarding in future, the
invariant worth a permanent test is the cheap version: for each tile field, a
pair whose value is unknown on both sides must never be "correct".
## The curation worksheet (scripts/09-curation-sheet.ts)

Two gaps need a human with real sources and cannot be automated (see the
negative results above), so the pipeline now emits the worklist instead of
leaving it implicit in review-report.md:

    data/curation-worksheet.md

It regenerates from public/data/artists.json on every `data:merge` run, so it
cannot go stale, and it lists the 87 artists with no debut year and the 188
bands with no member count. Each row carries what a lookup actually needs - id,
Hebrew and Latin name, birth year, death year, Wikidata QID, MusicBrainz id and
the popularity rank - plus an empty `value` column to fill in.

The point of generating it rather than hand-writing it is that the identifiers
in the row are the *safe* join keys. The Deezer attempt failed precisely because
it joined on a name; here the owner starts from a QID or MBID and looks up the
date, which is what makes the result trustworthy.

Values go into data/overrides.json keyed by the Hebrew name, then re-run the
pipeline. The worksheet itself must not be edited.
## Wikidata P2031 is the weakest source but supplied 62% of the pool

Chasing the pre-1948 question turned up something worse than the 1948 gate.

`debutYear` sources, in the order 06-merge.ts applies them: MusicBrainz `begin`
(groups only), **Wikidata P2031 work-period start**, MusicBrainz first release,
Deezer earliest album, Wikidata P571.

P2031 outranked both sources that record an *actual release*. That matters
because of the coverage:

| binding source | pool artists |
|---|---|
| wikidata-p2031 (work period start) | 621 |
| deezer earliest album | 68 |
| wikidata-p571 inception | 14 |
| MusicBrainz (either field) | 0 |

So 62% of the pool got its headline "career start" number from the vaguest
source, and MusicBrainz contributed nothing at all. P2031 shows the signs of a
field that is not measuring what the game needs:

- `activeSince - birthYear` clusters hard: 70% of the 940 artists with both fall
  in +15..+24, median exactly +20. A real career-start distribution is far wider.
- 2 artists have `activeSince` *before* their birth year, which is impossible.
- It produced **debut years before birth** in the shipped data: ??? ???
  (b. 2000) at 1996 and ???? ?? (b. 2005) at 2004. Both were
  `answerEligible`, so "debuted four years before he was born" was reachable as
  a daily answer.

Fixes:

- **Reordered** the sources so a real release (MusicBrainz first release, Deezer
  earliest album) outranks P2031. In practice this recovered 3 artists
  (913 -> 916 eligible, 87 -> 84 missing) because it rescued names whose only
  other source was an out-of-range P2031 value. ??? ??? now reads 2001 from
  Deezer instead of 1996 from P2031.
- **Added a hard guard**: a derived debut year earlier than the birth year is
  rejected to 0 and reported as `debutYear-before-birth`. Curated overrides are
  exempt, since that is the owner's call. ???? ?? is now 0 and flagged.
- **Added the same check to 07-validate as a hard error**, so the class of bug
  cannot come back silently rather than depending on the merge stage.

What I did *not* do: widen the >= 1948 gate. It is not what blocks the 84 missing
years - those are mostly modern artists with no date at all - and the pre-1948
candidates it would admit come from P2031, which is the unreliable source. Nine
of them have an `activeSince` before 1948 (???? ????? 1947, ???? ???? 1945) and
those may well be real pre-statehood careers, but they need a human to confirm
before the gate moves.

Residual risk, stated plainly: the 621 P2031-sourced debut years are unverified.
They now pass a sanity guard, but sanity is not accuracy. `data/curation-worksheet.md`
does not list them because they are not *missing*, only suspect - if the debut
tile matters to the game, spot-checking the top ~200 by popularity rank is the
highest-value curation remaining.
## Correction: P2031 and MusicBrainz fail in opposite directions

The previous entry oversold the case against P2031. Two claims in it were wrong
and are retracted:

- "MusicBrainz supplies 0 pool debut years" - false. It was a broken probe of
  mine: I looked the cache up by artist id when `data/raw/musicbrainz.json` is
  keyed by MBID. Real coverage is 698 pool artists.
- "P2031 is the weakest source" - not defensible. Both sources are proxies for a
  debut and they fail in *opposite* directions.

The reorder that put a "real release" above P2031 was a net negative. For the
469 artists where both exist, the gap is <=1y for 172, 2-5y for 94, 6-10y for 93
and >10y for 110. MusicBrainz is the *later* value for 328 of them and the
earlier one for only 141, because MusicBrainz only knows catalogued releases and
misses early band, TV and child appearances. Checked against ground truth:

| artist | P2031 | MB | reality |
|---|---|---|---|
| ?? ????? | 2000 | 2021 | won Kokhav Nolad 2000 |
| ????? ???? | 1981 | 2004 | in ???? ?? ???? from 1981 |
| ???? ????? | 1980 | 2011 | performing from ~age 8 |
| ???? ???? | 1978 | 1995 | MB looks better here |

So the reorder fixed the impossible values and broke three verifiable ones. The
rule now is: take the **earliest** machine candidate (MusicBrainz begin for
groups, MusicBrainz first release, Deezer earliest album, P2031, P571), then
let the birth-year guard reject the impossible ones. An early claim is a
recoverable error; a late one silently rewrites a career that demonstrably
started earlier. With that rule ?? ????? reads 2000, ????? ???? 1981 and
???? ????? 1980 again, and ??? ??? is still rejected to 0.

Because the pipeline no longer pretends to resolve this, artists whose sources
disagree by 6+ years are reported as `debutYear-disagreement` (275 of them) for
a human to settle in data/overrides.json.

Honest residual: 11 artists still imply a career start before age 10, and
???? ???? is one I believe is wrong at 1978. Earliest-wins is a heuristic, not
a fact, and the disagreement flag is the honest output of that.

Result: pool 1000, 914 answer-eligible, 86 missing a debut year.