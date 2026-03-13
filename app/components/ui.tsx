import Link from 'next/link'

export function Card({
  title,
  subtitle,
  children,
  actions,
  tone = 'plain',
}: {
  title?: string
  subtitle?: string
  actions?: React.ReactNode
  tone?: 'plain' | 'sky' | 'lavender' | 'mint' | 'coral'
  children: React.ReactNode
}) {
  const toneClasses: Record<NonNullable<typeof tone>, string> = {
    plain: 'bg-white/95',
    sky: 'bg-sky-50',
    lavender: 'bg-indigo-50',
    mint: 'bg-emerald-50',
    coral: 'bg-rose-50',
  }
  return (
    <section className={`rounded-3xl border app-border p-5 shadow-sm ${toneClasses[tone]}`}>
      {(title || actions) && (
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title ? <h2 className="text-lg font-semibold text-slate-900">{title}</h2> : null}
            {subtitle ? <p className="mt-1 text-sm app-muted">{subtitle}</p> : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      )}
      {children}
    </section>
  )
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'plain',
}: {
  label: string
  value: string
  hint?: string
  tone?: 'plain' | 'sky' | 'lavender' | 'mint' | 'coral'
}) {
  const toneClasses: Record<NonNullable<typeof tone>, string> = {
    plain: 'bg-white/95',
    sky: 'bg-sky-50',
    lavender: 'bg-indigo-50',
    mint: 'bg-emerald-50',
    coral: 'bg-rose-50',
  }
  return (
    <div className={`rounded-3xl border app-border p-4 shadow-sm ${toneClasses[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs app-muted">{hint}</p> : null}
    </div>
  )
}

export function PrimaryButton({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center rounded-full bg-indigo-500 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-600 active:bg-indigo-700"
    >
      {children}
    </Link>
  )
}

export function SecondaryButton({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center rounded-full border border-indigo-100 bg-white px-5 py-2 text-sm font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50"
    >
      {children}
    </Link>
  )
}

export function Badge({
  tone = 'slate',
  children,
}: {
  tone?: 'slate' | 'indigo' | 'sky' | 'emerald' | 'amber' | 'rose'
  children: React.ReactNode
}) {
  const tones: Record<NonNullable<typeof tone>, string> = {
    slate: 'bg-slate-100 text-slate-700',
    indigo: 'bg-indigo-50 text-indigo-700',
    sky: 'bg-sky-50 text-sky-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  )
}

