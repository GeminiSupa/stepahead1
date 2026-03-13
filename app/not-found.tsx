import Link from 'next/link'
import { PageShell } from './components/PageShell'
import { Card, PrimaryButton, SecondaryButton } from './components/ui'

export default function NotFound() {
  return (
    <PageShell variant="public" navItems={[{ href: '/login', label: 'Sign in' }]}>
      <div className="mx-auto max-w-2xl">
        <Card title="Page not found" subtitle="The link you opened doesn’t exist or has moved.">
          <div className="space-y-4">
            <p className="text-sm app-muted">
              If you were trying to open a dashboard, please sign in again or use the home button.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <PrimaryButton href="/">Go home</PrimaryButton>
              <SecondaryButton href="/login">Sign in</SecondaryButton>
              <Link
                href="/admin"
                className="inline-flex items-center justify-center rounded-full border app-border bg-white px-5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Admin dashboard
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </PageShell>
  )
}

