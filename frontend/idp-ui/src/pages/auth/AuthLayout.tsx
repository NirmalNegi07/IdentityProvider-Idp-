import type { ReactNode } from 'react'

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <img src="/favicon.svg" alt="" className="mx-auto size-11" />
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-slate-500">{subtitle}</p>}
        </div>
        <div className="rounded-xl bg-white px-6 py-7 shadow-sm ring-1 ring-slate-200">{children}</div>
        {footer && <div className="mt-6 text-center text-sm text-slate-500">{footer}</div>}
      </div>
    </div>
  )
}
