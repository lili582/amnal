import { REPORT_EMAIL } from '../config'

// mailto: link pre-filled with the game number and a short Hebrew template,
// used in the footer and the end dialog for data-correction reports.
export function reportLink(dayNumber: number): string {
  const number = dayNumber + 1
  const subject = encodeURIComponent('דיווח על טעות בנתונים — אמנדל')
  const body = encodeURIComponent(
    `משחק מספר ${number}\n\nאיזה נתון שגוי ולמה (קישור למקור)?\n`,
  )
  return `mailto:${REPORT_EMAIL}?subject=${subject}&body=${body}`
}