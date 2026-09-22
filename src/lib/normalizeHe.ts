// Hebrew text normalisation for search and comparison.

const MAQAF = '\u05BE'
const NIQQUD_RE = /[\u0591-\u05C7]/g
const QUOTE_RE = /["'`\u05F3\u05F4\u2019\u201D\u201C\u02BC\u02BB]/g
const FINAL_LETTERS: Record<string, string> = {
  '\u05DA': '\u05DB', // ך -> כ
  '\u05DD': '\u05DE', // ם -> מ
  '\u05DF': '\u05E0', // ן -> נ
  '\u05E3': '\u05E4', // ף -> פ
  '\u05E5': '\u05E6', // ץ -> צ
}
const NON_WORD_RE = /[^\p{L}\p{N}]+/gu

// Normalise a Hebrew (or mixed) string for robust matching:
// maqaf->space, strip niqqud, drop quote-like chars, unify final letters,
// lowercase Latin, NFKC, replace everything else with a space, collapse.
export function normalizeHe(s: string): string {
  let out = s.normalize('NFKC')
  out = out.split(MAQAF).join(' ')
  out = out.replace(NIQQUD_RE, '')
  out = out.replace(QUOTE_RE, '')
  out = out.replace(/[\u05DA\u05DD\u05DF\u05E3\u05E5]/g, (c) => FINAL_LETTERS[c])
  out = out.toLowerCase()
  out = out.replace(NON_WORD_RE, ' ')
  return out.replace(/\s+/g, ' ').trim()
}

// Skeleton form: the normalised string with the vowels ו (U+05D5) and י
// (U+05D9) removed, tolerating full/defective spelling ("כוורת" vs "כוורת").
export function skeletonOf(s: string): string {
  return normalizeHe(s)
    .replace(/\u05D5/g, '')
    .replace(/\u05D9/g, '')
}