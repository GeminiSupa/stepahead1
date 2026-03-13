import Link from 'next/link'
import { PageShell } from './components/PageShell'
import { Card, PrimaryButton, SecondaryButton, StatCard } from './components/ui'

export default function Home() {
  return (
    <PageShell
      variant="public"
      navItems={[
        { href: '/login', label: 'Sign in' },
        { href: 'https://stepaheadinclusive.com/', label: 'School website' },
      ]}
    >
      <div className="space-y-8">
        <Card>
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
            <div className="space-y-4">
              <p className="inline-flex w-fit items-center rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-800">
                Empowering Every Child
              </p>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900">
                Step Ahead Inclusive Platform
              </h1>
              <p className="text-base sm:text-lg app-muted">
                Built for inclusive education and therapy workflows: attendance, parent portal,
                therapy sessions, IEP progress, behavior insights, and kids portfolios.
              </p>

              <div className="flex flex-col gap-3 sm:flex-row">
                <PrimaryButton href="/login">Sign in</PrimaryButton>
                <a
                  href="https://stepaheadinclusive.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-full border app-border bg-white px-5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  Visit school website
                </a>
              </div>

              <p className="text-xs app-muted">
                Based on programs at{' '}
                <a
                  className="font-semibold text-sky-800 underline-offset-2 hover:underline"
                  href="https://stepaheadinclusive.com/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Step Ahead Inclusive
                </a>
                : OT, Speech Therapy, Physiotherapy, ABA Therapy, PECS training, parent training, and
                life skills.
              </p>
            </div>

            <div className="relative overflow-hidden rounded-3xl border app-border bg-gradient-to-br from-sky-100 via-white to-emerald-50 p-6">
              <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-sky-200/60 blur-2xl" />
              <div className="absolute -bottom-12 -left-12 h-56 w-56 rounded-full bg-emerald-200/50 blur-2xl" />
              <div className="relative space-y-4">
                <h2 className="text-lg font-semibold text-slate-900">Role-based dashboards</h2>
                <p className="text-sm app-muted">
                  Admin manages the whole school, teachers manage their classes, therapists manage
                  caseload and progress, and parents see only their child’s updates.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <RoleInfo title="Admin" description="Staff, students, classes, fees, reports." />
                  <RoleInfo title="Teacher" description="Classes, attendance, homework." />
                  <RoleInfo title="Therapist" description="IEP goals, progress, behavior." />
                  <RoleInfo title="Parent" description="Attendance, homework, portfolio." />
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Attendance" value="Fast" hint="Present / Late / Therapy / Absent" />
          <StatCard label="Progress" value="Visual" hint="IEP goals and trends by area" />
          <StatCard label="Portfolios" value="Meaningful" hint="Photos, videos, milestones" />
        </div>

        <section className="grid gap-6 lg:grid-cols-3">
          <FeatureCard
            title="Inclusive student profiles"
            items={[
              'Diagnosis & accommodations',
              'Therapy links (OT/PT/Speech/ABA)',
              'Medical notes & parent contacts',
            ]}
          />
          <FeatureCard
            title="Progress & portfolios"
            items={[
              'IEP goals and progress %',
              'Portfolio items (photos/videos/art)',
              'Home recommendations for parents',
            ]}
          />
          <FeatureCard
            title="Operational calm"
            items={[
              'Teacher dashboards per class',
              'Therapist caseload + behavior insights',
              'Clear access control per role',
            ]}
          />
        </section>

        <footer className="border-t app-border pt-6 text-xs app-muted">
          Admin can create users and set initial passwords from the dashboard.
        </footer>
      </div>
    </PageShell>
  )
}

type RoleInfoProps = {
  title: string
  description: string
}

function RoleInfo({ title, description }: RoleInfoProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm">
      <h2 className="mb-1 text-lg font-semibold text-slate-900">{title}</h2>
      <p className="text-sm text-slate-600">{description}</p>
    </div>
  )
}

type FeatureCardProps = {
  title: string
  items: string[]
}

function FeatureCard({ title, items }: FeatureCardProps) {
  return (
    <div className="rounded-3xl border app-border bg-white p-6 shadow-sm">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}


