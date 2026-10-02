// Classifies whether a Hebrew Wikipedia article is categorised as a *music*
// artist, from category names alone.
//
// Why this exists: Wikidata occupations cannot make the distinction the game
// needs. A TV actor who sang one song ends up with occupation=actor+singer,
// identical to a real singer who also acts, so both survive every Wikidata
// filter. Hebrew Wikipedia categories record how a person is actually
// recognised, and that is what we want to gate on.
//
// Example of the split: Maya Shoef and Lee Biran carry "זמרות ישראליות" /
// "זמרי רוק ישראלים" so they stay, while Alona Kimhi carries only
// "שחקניות קולנוע וטלוויזיה ישראליות", "סופרות ישראליות" and "פעילות מרצ",
// so she goes.

// Maintenance categories are noise: they describe the wiki entry, not the
// person. "ערכים עם פרופילי קולנוענים-מוזיקאים" in particular appears on every
// artist page (including pure actors), and would otherwise match any
// "מוזיקאים" pattern below.
const META_CATEGORY = /ערכים עם|^ויקינתונים|^ויקיפדיה|^ערכים בלי תמונה|^Templates?:|^תבנית|מזהה|J9U|VIAF|MusicBrainz|ISNI|GND|SUDOC|NTA|LCCN|WorldCat|DtBio|RERO|SELIBR|NUKAT|NLG|BnF|GEC|BNE|NKC|SNAC|מדיניות עריכה|^Pages in|ערכים ללא עריכה|^רשת קישורים חיצוניים/

const MUSIC_CATEGORY_PATTERNS = [
  // singers (masculine / feminine / construct)
  /^זמרים/,
  /^זמרות/,
  /^זמרי[ /]/,
  /^זמרות-/,
  // instrumentalists, composers, producers - also matches city categories
  // like "נוף הגיל: מוזיקאים", which only exist for actual musicians.
  /מוזיקאים/,
  /מוזיקאות/,
  /^מלחינים/,
  /^מלחיני/,
  /^מלחינות/,
  /^מפיקים/,
  /^מפיקות/,
  /^נגנים/,
  /^נגני/,
  /^מנגינים/,
  /^קצרמר/,
  // other performing-music roles
  /^מדבבים/,
  /^מדבבות/,
  /^מדבבי/,
  /^ביסקסואלים/,
  /^חזנים/,
  /^חזני/,
  // bands / ensembles / choirs
  /^להקות/,
  /^חברי להקת/,
  /^מקהלות/,
  /^מקהלי/,
  // performance events that only musicians appear in
  /באירוויזיון/,
  /להזמר החסידי/,
]

/** Categories that name the person as a performing musician. */
export function musicCategories(categories: string[]): string[] {
  return categories.filter((c) => {
    const name = c.replace(/^קטגוריה:/, '')
    if (META_CATEGORY.test(name)) return false
    return MUSIC_CATEGORY_PATTERNS.some((p) => p.test(name))
  })
}

// Band membership alone is weak evidence: Israeli actors routinely served in
// military ensembles (חברי להקת גייסות השריון), so "member of band X" with no
// performer category looks exactly like a TV actor who once sang. Only these
// are disqualified when gating an acting occupation.
const WEAK_FOR_ACTORS = [/^להקות/, /^חברי להקת/, /^מקהלות/, /^מקהלי/]

export function isRecognisedMusician(categories: string[] | undefined, requireStrong = false): boolean {
  if (!categories) return false
  const matches = musicCategories(categories)
  if (matches.length === 0) return false
  if (!requireStrong) return true
  return matches.some((c) => {
    const name = c.replace(/^קטגוריה:/, '')
    return !WEAK_FOR_ACTORS.some((p) => p.test(name))
  })
}

// Wikidata P106 values that mean "performs on screen / stage as an actor".
const ACTING_OCCUPATIONS = [
  'Q33999', // actor
  'Q10800557', // film actor
  'Q10798782', // television actor
  'Q2405480', // voice actor
  'Q947873', // theatre actor
  'Q488111', // comedian
  'Q2259451', // stage actor
  'Q5716684', // dubbing artist
]

export function isActorOccupation(occupations: string[] | undefined): boolean {
  if (!occupations) return false
  return occupations.some((o) => ACTING_OCCUPATIONS.includes(o))
}

// The same judgement from hewiki, for the cases Wikidata gets wrong or simply
// does not record: an artist tagged only "singer" whose article is filed under
// "שחקני קולנוע וטלוויזיה ישראליים" is an actor.
const ACTING_CATEGORY_PATTERNS = [
  /^שחקני/, // actors (masculine / construct)
  /^שחקנים/,
  /^שחקניות/, // actresses
  /^שחקנים להט/, // TV-higher actors
  /^כוכבי ילדים/, // child stars
  /^בדרנים/, // comedians (Israeli usage)
  /^בדרניות/,
  /^סטנדאפיסטים/, // stand-up comedians
  /^סטנדאפיסטיות/,
]

export function actingCategories(categories: string[] | undefined): string[] {
  if (!categories) return []
  return categories.filter((c) => {
    const name = c.replace(/^קטגוריה:/, '')
    if (META_CATEGORY.test(name)) return false
    return ACTING_CATEGORY_PATTERNS.some((p) => p.test(name))
  })
}

export function hasActingCategory(categories: string[] | undefined): boolean {
  return actingCategories(categories).length > 0
}