import type { ReactNode } from 'react'
import { AppearancePicker } from '../../components/AppearancePicker'

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="relative flex min-h-full flex-col items-center justify-center px-4 py-12">
      <div className="absolute top-3 right-3">
        <AppearancePicker placement="down" />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <img src="/favicon.svg" alt="" className="mx-auto size-11" />
          <div className="mt-3 text-sm font-bold tracking-tight text-base-500">LAHI IDP</div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-base-900">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-base-500">{subtitle}</p>}
        </div>
        <div className="rounded-xl border border-line bg-surface px-6 py-7 shadow-[0_2px_0_0_var(--color-line)]">{children}</div>
        {footer && <div className="mt-6 text-center text-sm text-base-500">{footer}</div>}
      </div>
    </div>
  )
}
