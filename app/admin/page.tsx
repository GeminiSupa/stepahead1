/* eslint-disable @next/next/no-img-element */
"use client"

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { PageShell } from '../components/PageShell'
import { Card, PrimaryButton, SecondaryButton, StatCard } from '../components/ui'

type AttendanceStatus = 'present' | 'absent' | 'late' | 'therapy'

type AttendanceRow = {
  status: AttendanceStatus
}

export default function AdminDashboardPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [totalStudents, setTotalStudents] = useState<number | null>(null)
  const [neurodiverseCount, setNeurodiverseCount] = useState<number | null>(null)
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRow[]>([])

  const [iepGoalTotal, setIepGoalTotal] = useState<number | null>(null)
  const [iepGoalCompleted, setIepGoalCompleted] = useState<number | null>(null)
  const [therapySessionsLast7, setTherapySessionsLast7] = useState<number | null>(null)
  const [portfolioItemsLast30, setPortfolioItemsLast30] = useState<number | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        router.push('/login')
        return
      }

      const today = new Date()
      const todayStr = today.toISOString().slice(0, 10)

      const sevenDaysAgo = new Date(today)
      sevenDaysAgo.setDate(today.getDate() - 6)
      const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10)

      const thirtyDaysAgo = new Date(today)
      thirtyDaysAgo.setDate(today.getDate() - 29)
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().slice(0, 10)

      const [
        { data: studentsData, error: studentsError },
        { data: attendanceData, error: attendanceError },
        { data: iepGoalsData, error: iepGoalsError },
        { data: therapyData, error: therapyError },
        { data: portfolioData, error: portfolioError },
      ] = await Promise.all([
        supabase.from('students').select('id, diagnosis'),
        supabase.from('attendance').select('status').eq('date', todayStr),
        supabase.from('iep_goals').select('id, status'),
        supabase.from('therapy_sessions').select('id, session_date').gte('session_date', sevenDaysAgoStr),
        supabase
          .from('portfolio_items')
          .select('id, created_at')
          .gte('created_at', `${thirtyDaysAgoStr}T00:00:00Z`),
      ])

      if (studentsError || attendanceError || iepGoalsError || therapyError || portfolioError) {
        setError(
          studentsError?.message ??
            attendanceError?.message ??
            iepGoalsError?.message ??
            therapyError?.message ??
            portfolioError?.message ??
            'Unable to load admin overview'
        )
        setLoading(false)
        return
      }

      const students = (studentsData as { id: string; diagnosis: string | null }[]) ?? []
      setTotalStudents(students.length)
      setNeurodiverseCount(
        students.filter((s) => (s.diagnosis ?? '').trim().length > 0).length
      )

      setTodayAttendance((attendanceData as AttendanceRow[]) ?? [])

      const goals = (iepGoalsData as { id: string; status: string | null }[]) ?? []
      setIepGoalTotal(goals.length)
      setIepGoalCompleted(goals.filter((g) => g.status === 'completed').length)

      setTherapySessionsLast7(((therapyData as any[]) ?? []).length)
      setPortfolioItemsLast30(((portfolioData as any[]) ?? []).length)

      setLoading(false)
    }

    load()
  }, [router])

  const neurodiversePctLabel = useMemo(() => {
    if (totalStudents == null || totalStudents === 0 || neurodiverseCount == null) return '—'
    const pct = (neurodiverseCount / totalStudents) * 100
    return `${pct.toFixed(0)}%`
  }, [totalStudents, neurodiverseCount])

  const attendanceSummaryLabel = useMemo(() => {
    if (!todayAttendance.length) return 'No data'
    const counts: Record<AttendanceStatus, number> = {
      present: 0,
      absent: 0,
      late: 0,
      therapy: 0,
    }
    todayAttendance.forEach((row) => {
      counts[row.status] = (counts[row.status] ?? 0) + 1
    })
    return `${counts.present} present · ${counts.therapy} therapy · ${counts.absent} absent`
  }, [todayAttendance])

  const iepCompletionLabel = useMemo(() => {
    if (iepGoalTotal == null || iepGoalTotal === 0 || iepGoalCompleted == null) return '—'
    const pct = (iepGoalCompleted / iepGoalTotal) * 100
    return `${iepGoalCompleted}/${iepGoalTotal} (${pct.toFixed(0)}%)`
  }, [iepGoalCompleted, iepGoalTotal])

  return (
    <PageShell
      title="Admin Dashboard"
      subtitle="Today at a glance — staff, students, and inclusive insights for your KG school."
      navItems={[
        { href: '/admin/staff', label: 'Staff' },
        { href: '/admin/students', label: 'Students' },
        { href: '/admin/parent-links', label: 'Parent links' },
        { href: '/admin/classes', label: 'Classes' },
        { href: '/admin/assignments', label: 'Assignments' },
        { href: '/admin/timetable', label: 'Timetable' },
        { href: '/admin/fees', label: 'Fees' },
        { href: '/admin/leave', label: 'Leave' },
        { href: '/admin/portfolio/approvals', label: 'Portfolio' },
      ]}
    >
      <div className="space-y-6">
        <Card
          title="Quick actions"
          subtitle="Start here to manage the school."
          actions={<SecondaryButton href="/">Home</SecondaryButton>}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <PrimaryButton href="/admin/staff">Staff &amp; Users</PrimaryButton>
            <SecondaryButton href="/admin/students">Students</SecondaryButton>
            <SecondaryButton href="/admin/parent-links">Parent links</SecondaryButton>
            <SecondaryButton href="/admin/classes">Classes</SecondaryButton>
            <SecondaryButton href="/admin/assignments">Assignments</SecondaryButton>
            <SecondaryButton href="/admin/fees">Fees</SecondaryButton>
            <SecondaryButton href="/admin/leave">Leave</SecondaryButton>
            <SecondaryButton href="/admin/portfolio/approvals">Portfolio approvals</SecondaryButton>
          </div>
        </Card>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Total students"
            value={loading || totalStudents === null ? '…' : String(totalStudents)}
            hint="From Supabase students table"
          />
          <StatCard
            label="Neurodiverse"
            value={loading ? '…' : neurodiversePctLabel}
            hint="% with any diagnosis set"
          />
          <StatCard
            label="Today attendance"
            value={loading ? '…' : attendanceSummaryLabel}
            hint="Present / Therapy / Absent"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card
            title="Students & classes"
            subtitle="Mixed-ability grouping and inclusive classroom operations."
          >
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-indigo-700">
                Student list (by class)
              </span>
              <span className="rounded-full bg-sky-50 px-3 py-1 text-sky-700">Add/edit student</span>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">Class setup</span>
            </div>
            <p className="mt-4 text-xs app-muted">
              Use the Students and Classes screens to keep these counts healthy and balanced.
            </p>
          </Card>

          <Card
            title="Inclusive insights"
            subtitle="Live numbers from IEP, therapy, and portfolio data."
          >
            <ul className="space-y-2 text-sm app-muted">
              <li>
                <span className="font-semibold text-slate-800">
                  IEP goals and completion rates per class
                </span>
                <br />
                Overall completion:{' '}
                <span className="font-semibold text-slate-900">
                  {loading ? '…' : iepCompletionLabel}
                </span>
              </li>
              <li>
                <span className="font-semibold text-slate-800">
                  Therapy hours and behavior incident trends
                </span>
                <br />
                Sessions last 7 days:{' '}
                <span className="font-semibold text-slate-900">
                  {loading || therapySessionsLast7 === null ? '…' : therapySessionsLast7}
                </span>
              </li>
              <li>
                <span className="font-semibold text-slate-800">
                  Portfolio engagement and parent participation
                </span>
                <br />
                Portfolio items last 30 days:{' '}
                <span className="font-semibold text-slate-900">
                  {loading || portfolioItemsLast30 === null ? '…' : portfolioItemsLast30}
                </span>
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </PageShell>
  )
}

