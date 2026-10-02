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
    listenership drives both pool membership and `popularityTier`.
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
      `metrics.spotifyRank`, weights Spotify as the dominant tier signal
      (0.45, ahead of hewiki 0.25 / deezer 0.20 / sitelinks 0.10; lastfm
      dropped), then forces the pool to **exactly 1000** artists: Spotify-ranked
      artists first, previously-scheduled artists always kept, best of the rest
      as filler. Artists whose `id` disappears from the pool are removed from
      the dataset entirely.
- `answerEligible` requires a valid debut year *and* at least one measured
      interest signal (Spotify streams, 90-day hewiki pageviews or Deezer fans),
      so every daily answer is a currently-trending artist. It does not use
      `popularityTier`: tier is a within-pool percentile, so at most ~60-85% of
      the pool can ever reach tier >= 3, which makes a 1000-artist answerable
      pool impossible. Tier still drives hint strength and guess ordering.
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