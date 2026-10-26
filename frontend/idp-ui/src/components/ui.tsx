import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'

const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ')

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

const variants: Record<Variant, string> = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:outline-indigo-600 disabled:bg-indigo-300',
  secondary: 'bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:text-slate-400',
  danger: 'bg-red-600 text-white hover:bg-red-500 focus-visible:outline-red-600 disabled:bg-red-300',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
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
        'inline-flex items-center justify-center gap-2 rounded-md font-medium shadow-sm transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed',
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
      <span className="block text-sm font-medium text-slate-700">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  )
}

const inputClass =
  'block w-full rounded-md border-0 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 ' +
  'placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 disabled:bg-slate-100 disabled:text-slate-500'

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
      <input type="checkbox" {...props} className="mt-0.5 size-4 rounded border-slate-300 text-indigo-600 accent-indigo-600" />
      <span>
        <span className="font-medium text-slate-800">{label}</span>
        {description && <span className="block text-xs text-slate-500">{description}</span>}
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
  return <div role={kind === 'error' ? 'alert' : 'status'} className={cx('rounded-md px-3 py-2.5 text-sm ring-1 ring-inset', styles[kind])}>{children}</div>
}

export function Badge({ tone = 'slate', children }: { tone?: 'slate' | 'indigo' | 'green' | 'red' | 'amber'; children: ReactNode }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700 ring-slate-200',
    indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    red: 'bg-red-50 text-red-700 ring-red-200',
    amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  }
  return <span className={cx('inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset', tones[tone])}>{children}</span>
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-lg bg-white shadow-sm ring-1 ring-slate-200', className)}>{children}</div>
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:p-8" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal
        aria-label={title}
        className={cx('w-full rounded-lg bg-white shadow-xl', wide ? 'max-w-2xl' : 'max-w-md')}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Close">
            <svg viewBox="0 0 20 20" className="size-5" fill="currentColor"><path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" /></svg>
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 rounded-b-lg">{footer}</div>}
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
      <div className="text-sm text-slate-600">{message}</div>
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
  return <div className="px-6 py-12 text-center text-sm text-slate-500">{children}</div>
}

export function LoadingBlock() {
  return (
    <div className="flex justify-center py-12 text-slate-400">
      <Spinner />
    </div>
  )
}

/** One value per line, used for redirect URIs and resources. */
export const linesToList = (text: string) => text.split('\n').map((l) => l.trim()).filter(Boolean)
