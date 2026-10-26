import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'

const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ')

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

// Buttons sit on a darker bottom edge and press down when clicked.
const variants: Record<Variant, string> = {
  primary:
    'border border-orange-800 bg-orange-700 text-white shadow-[0_2px_0_0_var(--color-orange-900)] hover:bg-orange-800 ' +
    'focus-visible:outline-orange-700 disabled:border-orange-300 disabled:bg-orange-300 disabled:shadow-none',
  secondary:
    'border border-line bg-white text-stone-800 shadow-[0_2px_0_0_var(--color-line)] hover:border-stone-400 ' +
    'disabled:text-stone-400 disabled:shadow-none',
  danger:
    'border border-red-800 bg-red-700 text-white shadow-[0_2px_0_0_var(--color-red-900)] hover:bg-red-800 ' +
    'focus-visible:outline-red-700 disabled:bg-red-300 disabled:shadow-none',
  ghost: 'text-stone-600 hover:bg-stone-900/5 hover:text-stone-900',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-[color,background-color,border-color,transform]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed',
        variant !== 'ghost' && 'enabled:active:translate-y-0.5 enabled:active:shadow-none',
        size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm',
        variants[variant],
        className,
      )}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cx('animate-spin', className ?? 'size-5')} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-stone-700">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-1 block text-xs text-stone-500">{hint}</span>}
    </label>
  )
}

const inputClass =
  'block w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-stone-900 ' +
  'placeholder:text-stone-400 hover:border-stone-400 focus:border-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-700/20 ' +
  'disabled:bg-stone-100 disabled:text-stone-500'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputClass, className)} />
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(inputClass, 'font-mono text-xs', className)} />
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(inputClass, 'pr-8', className)} />
}

export function Checkbox({ label, description, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: ReactNode }) {
  return (
    <label className="flex items-start gap-2.5 text-sm">
      <input type="checkbox" {...props} className="mt-0.5 size-4 rounded border-stone-300 text-orange-700 accent-orange-700" />
      <span>
        <span className="font-medium text-stone-800">{label}</span>
        {description && <span className="block text-xs text-stone-500">{description}</span>}
      </span>
    </label>
  )
}

export function Alert({ kind = 'error', children }: { kind?: 'error' | 'success' | 'info' | 'warning'; children: ReactNode }) {
  const styles = {
    error: 'bg-red-50 text-red-800 ring-red-200',
    success: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    info: 'bg-sky-50 text-sky-800 ring-sky-200',
    warning: 'bg-amber-50 text-amber-900 ring-amber-200',
  }
  return <div role={kind === 'error' ? 'alert' : 'status'} className={cx('rounded-lg px-3.5 py-2.5 text-sm ring-1 ring-inset', styles[kind])}>{children}</div>
}

export type BadgeTone = 'neutral' | 'brand' | 'green' | 'red' | 'amber'

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  const tones = {
    neutral: 'bg-stone-100 text-stone-700 ring-stone-300',
    brand: 'bg-orange-50 text-orange-800 ring-orange-200',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    red: 'bg-red-50 text-red-700 ring-red-200',
    amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  }
  return <span className={cx('inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-semibold ring-1 ring-inset', tones[tone])}>{children}</span>
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-xl border border-line bg-white', className)}>{children}</div>
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-stone-600">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  )
}

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/50 p-4 sm:p-8" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal
        aria-label={title}
        className={cx('w-full rounded-xl border border-line bg-white shadow-xl', wide ? 'max-w-2xl' : 'max-w-md')}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="text-base font-bold">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600" aria-label="Close">
            <svg viewBox="0 0 20 20" className="size-5" fill="currentColor"><path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" /></svg>
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 rounded-b-xl border-t border-line bg-canvas/60 px-5 py-3">{footer}</div>}
      </div>
    </div>
  )
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel?: string
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger" loading={busy} onClick={onConfirm}>{confirmLabel}</Button>
        </>
      }
    >
      <div className="text-sm text-stone-600">{message}</div>
    </Modal>
  )
}

export function CopyField({ value }: { value: string }) {
  return (
    <div className="flex gap-2">
      <Input readOnly value={value} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
      <Button variant="secondary" type="button" onClick={() => navigator.clipboard.writeText(value)}>Copy</Button>
    </div>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="px-6 py-14 text-center text-sm text-stone-500">{children}</div>
}


export function LoadingBlock() {
  return (
    <div className="flex justify-center py-12 text-stone-400">
      <Spinner />
    </div>
  )
}

/** One value per line, used for redirect URIs and resources. */
export const linesToList = (text: string) => text.split('\n').map((l) => l.trim()).filter(Boolean)
