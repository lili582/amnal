import { describe, expect, it } from 'vitest'
import { isActorOccupation, isRecognisedMusician, musicCategories } from '../scripts/music-cat'

describe('isRecognisedMusician', () => {
  it('accepts artists with a performer category', () => {
    expect(isRecognisedMusician(['קטגוריה:זמרות ישראליות', 'קטגוריה:שחקניות קולנוע ישראליות'])).toBe(true)
    expect(isRecognisedMusician(['קטגוריה:זמרי רוק ישראלים'])).toBe(true)
    expect(isRecognisedMusician(['קטגוריה:מוזיקאים ישראלים'])).toBe(true)
    expect(isRecognisedMusician(['קטגוריה:קצרמר ישראלים'])).toBe(true)
  })

  it('rejects pure actors, writers and presenters', () => {
    expect(isRecognisedMusician(['קטגוריה:שחקניות קולנוע וטלוויזיה ישראליות', 'קטגוריה:סופרות ישראליות'])).toBe(false)
    expect(isRecognisedMusician(['קטגוריה:מנחי טלוויזיה ישראלים', 'קטגוריה:שחקני תיאטרון ישראלים'])).toBe(false)
    expect(isRecognisedMusician([])).toBe(false)
    expect(isRecognisedMusician(undefined)).toBe(false)
  })

  it('ignores maintenance categories that appear on every article', () => {
    // "ערכים עם פרופילי קולנוענים-מוזיקאים" contains "מוזיקאים" and would
    // otherwise make every artist look like a musician.
    expect(isRecognisedMusician(['קטגוריה:ערכים עם פרופילי קולנוענים-מוזיקאים'])).toBe(false)
    expect(isRecognisedMusician(['קטגוריה:ויקיפדיה: ערכים עם מזהה MusicBrainz'])).toBe(false)
  })

  it('does not read "actors in musicals" as a music category', () => {
    expect(isRecognisedMusician(['קטגוריה:שחקני מחזות זמר ישראלים'])).toBe(false)
  })

  it('treats band membership as weak evidence', () => {
    const militaryBand = ['קטגוריה:חברי להקת גייסות השריון', 'קטגוריה:שחקניות תיאטרון ישראליות']
    expect(isRecognisedMusician(militaryBand)).toBe(true) // a real band member is a musician
    expect(isRecognisedMusician(militaryBand, true)).toBe(false) // ...but not, for an actor
  })

  it('does not accept a band-only artist when gating actors', () => {
    const bandOnly = ['קטגוריה:חברי להקת השכנים של צ\'יץ\'']
    expect(isRecognisedMusician(bandOnly)).toBe(true)
    expect(isRecognisedMusician(bandOnly, true)).toBe(false)
  })

  it('requires a strong category when gating actors', () => {
    expect(isRecognisedMusician(['קטגוריה:נוף הגיל: מוזיקאים'], true)).toBe(true)
    expect(isRecognisedMusician(['קטגוריה:חברי להקת גייסות השריון'], true)).toBe(false)
  })
})

describe('isActorOccupation', () => {
  it('detects screen and stage acting', () => {
    expect(isActorOccupation(['Q33999'])).toBe(true) // actor
    expect(isActorOccupation(['Q10798782'])).toBe(true) // television actor
    expect(isActorOccupation(['Q488111'])).toBe(true) // comedian
  })

  it('does not flag musicians', () => {
    expect(isActorOccupation(['Q177220', 'Q639669'])).toBe(false)
    expect(isActorOccupation([])).toBe(false)
    expect(isActorOccupation(undefined)).toBe(false)
  })
})

describe('musicCategories', () => {
  it('returns only the music categories, without meta ones', () => {
    const cats = musicCategories([
      'קטגוריה:זמרות ישראליות',
      'קטגוריה:ערכים עם קישורי רשת חברתית',
      'קטגוריה:ישראליות שנולדו ב-1988',
    ])
    expect(cats).toEqual(['קטגוריה:זמרות ישראליות'])
  })
})