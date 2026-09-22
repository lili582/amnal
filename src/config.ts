// Central app configuration. Rename the game here only.
export const GAME_NAME = 'אמנל'
export const GAME_URL = 'https://example.com' // TODO: set before launch
// Owner's inbox for data corrections (mailto in the footer and end dialog).
export const REPORT_EMAIL = 'owner@example.com' // TODO: set before launch
export const MAX_GUESSES = 10
// Israeli calendar date when the daily puzzle series starts.
export const LAUNCH_DATE = '2026-10-01'
export const TZ = 'Asia/Jerusalem'
export const SHOW_IMAGES = false

// Runtime data source. The app fetches artists.json and schedule.json from
// DATA_URL at startup instead of bundling them. Defaults to "/data" (same
// origin) so any static host works; override with VITE_DATA_URL for an
// external origin (e.g. an S3 bucket or another CDN).
const envDataUrl = (import.meta as { env?: { VITE_DATA_URL?: string } }).env?.VITE_DATA_URL
export const DATA_URL: string = envDataUrl?.replace(/\/+$/, '') ?? '/data'

// How long a freshly-downloaded dataset is considered fresh before we try the
// network again (browsers keep the cached copy offline meanwhile).
export const DATA_CACHE_TTL_MS = 24 * 60 * 60 * 1000

// Bump together with a breaking shape change of the served JSON files.
export const DATA_SCHEMA_VERSION = 'v1'