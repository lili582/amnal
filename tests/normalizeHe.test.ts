import { describe, expect, it } from 'vitest'
import { normalizeHe, skeletonOf } from '../src/lib/normalizeHe'

describe('normalizeHe', () => {
  it('replaces the maqaf with a space', () => {
    expect(normalizeHe('בית־ספר')).toBe('בית ספר')
    expect(normalizeHe('שפת־אם')).toBe('שפת אמ') // final ם -> מ
  })

  it('strips niqqud and cantillation marks', () => {
    expect(normalizeHe('שָׁלוֹם')).toBe('שלומ') // final ם -> מ
    expect(normalizeHe('אֲבָל')).toBe('אבל')
    expect(normalizeHe('בְּרֵאשִׁית')).toBe('בראשית')
  })

  it('drops quote-like characters (geresh and friends)', () => {
    expect(normalizeHe("ג'ימבו ג'יי")).toBe('גימבו גיי')
    expect(normalizeHe('מוזיקה ׳קלאסית׳')).toBe('מוזיקה קלאסית')
  })

  it('maps final letters to their regular forms', () => {
    expect(normalizeHe('סוף')).toBe('סופ')
    expect(normalizeHe('שלום')).toBe('שלומ')
    expect(normalizeHe('מלך מנצח')).toBe('מלכ מנצח')
  })

  it('lowercases Latin text and NFKC normalises', () => {
    expect(normalizeHe('Omer Adam')).toBe('omer adam')
    expect(normalizeHe('BÉBÉ')).toBe('bébé')
  })

  it('collapses whitespace and drops punctuation', () => {
    expect(normalizeHe('שלום,   עולם!')).toBe('שלומ עולמ')
    expect(normalizeHe('  עומר  אדם  ')).toBe('עומר אדמ')
  })

  it('treats defective and full spellings as equal when quoting differs', () => {
    expect(normalizeHe("ג'ימבו ג'יי")).toBe(normalizeHe('גימבו גיי'))
  })
})

describe('skeletonOf', () => {
  it('removes vav and yod to tolerate full/defective spelling', () => {
    expect(skeletonOf('כוורת')).toBe(skeletonOf('כורת'))
    expect(skeletonOf('אורי')).toBe('אר')
  })
})