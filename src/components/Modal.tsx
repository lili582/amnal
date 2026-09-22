import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { strings } from '../strings.he'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
}

const FOCUSABLE =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Modal({ title, onClose, children }: ModalProps) {
  const dialogRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    const previouslyFocused = document.activeElement as HTMLElement | null

    // Move focus into the dialog; skip the close button to the second focusable.
    const focusables = dialog?.querySelectorAll<HTMLElement>(FOCUSABLE)
    ;(focusables?.[1] ?? focusables?.[0] ?? dialog)?.focus?.()

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      // Keep Tab cycling inside the dialog.
      if (e.key !== 'Tab' || !dialog) return
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      previouslyFocused?.focus?.()
    }
  }, [onClose])

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="modal"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={strings.close}>
            ✕
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  )
}