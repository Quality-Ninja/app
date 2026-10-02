import { type ReactNode, useEffect, useId, useRef } from 'react'

// A modal question on the native <dialog>, styled like a cover sheet (.dialog in controls.css). Cancel, Escape, or
// closing it answers false; the confirm button answers true. The parent owns `open` and closes it by answering.
export function ConfirmDialog({
  open,
  title,
  confirmLabel,
  cancelLabel = 'Cancel',
  onAnswer,
  children,
}: {
  open: boolean
  title: string
  confirmLabel: string
  cancelLabel?: string
  onAnswer: (confirmed: boolean) => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className='dialog'
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onAnswer(false)
      }}
      onClose={() => {
        if (open) onAnswer(false)
      }}
    >
      <h2 id={titleId}>{title}</h2>
      {children}
      <div className='dialog-actions'>
        <button type='button' className='quiet' onClick={() => onAnswer(false)}>
          {cancelLabel}
        </button>
        <button
          type='button'
          className='primary'
          onClick={() => onAnswer(true)}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  )
}
