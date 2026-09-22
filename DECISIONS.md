# DECISIONS.md — record of every deviation from hebrew-spotle-game-spec.txt

## Decisions made

1. **Game name = "אמנל"** (spec working title was "זמרדל"). Kept in
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