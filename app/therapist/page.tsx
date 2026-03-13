"use client"

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { PageShell } from '../components/PageShell'
import { Card, StatCard } from '../components/ui'

type SummaryCardProps = {
  title: string
  value: string
  subtitle?: string
}

type TherapySession = {
  id: string
  session_date: string
  therapy_type: string | null
}

type IepGoalRow = {
  id: string
  area: string
  status: string | null
}

type IepProgressRow = {
  id: string
  goal_id: string
  progress_pct: number | null
}

type BehaviorLog = {
  id: string
  date_time: string
  behavior_type: string | null
}

export default function TherapistDashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [todaySessions, setTodaySessions] = useState<TherapySession[]>([])
  const [iepGoals, setIepGoals] = useState<IepGoalRow[]>([])
  const [iepProgress, setIepProgress] = useState<IepProgressRow[]>([])
  const [behaviorLogs, setBehaviorLogs] = useState<BehaviorLog[]>([])

  useEffect(() => {
    const loadData = async () => {
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

      const todayStr = new Date().toISOString().slice(0, 10)
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 6)
      const weekAgoStr = weekAgo.toISOString().slice(0, 10)

      // 1) Find all students in this therapist's caseload
      const { data: therapistStudents, error: therapistStudentsError } = await supabase
        .from('therapist_students')
        .select('student_id')
        .eq('therapist_id', user.id)

      if (therapistStudentsError) {
        setError(therapistStudentsError.message)
        setLoading(false)
        return
      }

      const studentIds = (therapistStudents ?? []).map((row) => row.student_id as string)

      const [{ data: sessionsData, error: sessionsError }, { data: goalsData, error: goalsError }] =
        await Promise.all([
          supabase
            .from('therapy_sessions')
            .select('id, session_date, therapy_type')
            .eq('therapist_id', user.id)
            .eq('session_date', todayStr),
          studentIds.length
            ? supabase
                .from('iep_goals')
                .select('id, area, status, student_id')
                .in('student_id', studentIds)
            : Promise.resolve({ data: [], error: null }),
        ])

      const goalIds = ((goalsData as any[]) ?? []).map((g) => g.id as string)

      const [
        { data: progressData, error: progressError },
        { data: behaviorData, error: behaviorError },
      ] = await Promise.all([
        goalIds.length
          ? supabase
              .from('iep_progress_entries')
              .select('id, goal_id, progress_pct')
              .in('goal_id', goalIds)
          : Promise.resolve({ data: [], error: null }),
        studentIds.length
          ? supabase
              .from('behavior_logs')
              .select('id, date_time, behavior_type, student_id')
              .in('student_id', studentIds)
              .gte('date_time', weekAgoStr)
          : Promise.resolve({ data: [], error: null }),
      ])

      if (sessionsError || goalsError || progressError || behaviorError) {
        setError(
          sessionsError?.message ??
            goalsError?.message ??
            progressError?.message ??
            behaviorError?.message ??
            'Unable to load therapist data'
        )
        setLoading(false)
        return
      }

      setTodaySessions((sessionsData as TherapySession[]) ?? [])
      setIepGoals(
        ((goalsData as any[]) ?? []).map((g) => ({
          id: g.id,
          area: g.area,
          status: g.status,
        }))
      )
      setIepProgress(
        ((progressData as any[]) ?? []).map((p) => ({
          id: p.id,
          goal_id: p.goal_id,
          progress_pct: p.progress_pct,
        }))
      )
      setBehaviorLogs(
        ((behaviorData as any[]) ?? []).map((b) => ({
          id: b.id,
          date_time: b.date_time,
          behavior_type: b.behavior_type,
        }))
      )

      setLoading(false)
    }

    loadData()
  }, [router])

  const activeGoals = useMemo(() => iepGoals.filter((g) => g.status === 'active'), [iepGoals])
  const completedGoals = useMemo(() => iepGoals.filter((g) => g.status === 'completed'), [iepGoals])

  const avgProgressByArea = useMemo(() => {
    const map: Record<string, { sum: number; count: number }> = {}
    iepGoals.forEach((goal) => {
      const progressForGoal = iepProgress.filter((p) => p.goal_id === goal.id)
      if (progressForGoal.length === 0) return
      const latest = progressForGoal[progressForGoal.length - 1]
      if (latest.progress_pct == null) return
      if (!map[goal.area]) map[goal.area] = { sum: 0, count: 0 }
      map[goal.area].sum += latest.progress_pct
      map[goal.area].count += 1
    })
    return Object.entries(map).map(([area, { sum, count }]) => ({
      area,
      avg: sum / count,
    }))
  }, [iepGoals, iepProgress])

  const recentBehaviorCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    behaviorLogs.forEach((log) => {
      const key = log.behavior_type || 'Other'
      counts[key] = (counts[key] ?? 0) + 1
    })
    return counts
  }, [behaviorLogs])

  return (
    <PageShell
      title="Therapist Dashboard"
      subtitle="Warm snapshot of your caseload — sessions, IEP growth, and behavior insights."
      navItems={[
        { href: '/therapist', label: 'Dashboard' },
        { href: '/therapist/work', label: 'Work' },
        { href: '/therapist/portfolio', label: 'Portfolio' },
      ]}
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Today’s sessions"
            value={loading ? '…' : String(todaySessions.length)}
            hint="OT / PT / Speech / ABA"
            tone="lavender"
          />
          <StatCard
            label="Active IEP goals"
            value={loading ? '…' : String(activeGoals.length)}
            hint="Across your students"
            tone="mint"
          />
          <StatCard
            label="Behavior logs"
            value={loading ? '…' : String(behaviorLogs.length)}
            hint="Last 7 days"
            tone="coral"
          />
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card
            title="IEP progress overview"
            subtitle="Average progress by area across active goals."
            tone="lavender"
          >
            {loading ? (
              <p className="text-sm app-muted">Loading IEP data…</p>
            ) : avgProgressByArea.length === 0 ? (
              <p className="text-sm app-muted">
                No IEP progress has been recorded yet for your students.
              </p>
            ) : (
              <div className="space-y-3">
                {avgProgressByArea.map((row) => (
                  <div key={row.area}>
                    <div className="mb-1 flex items-center justify-between text-xs app-muted">
                      <span className="font-semibold text-slate-800 capitalize">{row.area}</span>
                      <span className="font-semibold text-slate-800">{row.avg.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-sky-700"
                        style={{ width: `${Math.min(Math.max(row.avg, 0), 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
                <p className="mt-2 text-xs app-muted">
                  Based on the latest progress entry for each goal in{' '}
                  <code className="rounded bg-slate-100 px-1 py-0.5">iep_progress_entries</code>.
                </p>
              </div>
            )}
            {!loading && completedGoals.length > 0 ? (
              <p className="mt-3 text-xs text-emerald-700">
                {completedGoals.length} completed goal{completedGoals.length === 1 ? '' : 's'} — celebrate these wins with families.
              </p>
            ) : null}
          </Card>

          <Card
            title="Behavior insights"
            subtitle="Frequency grouped by behavior type (last 7 days)."
            tone="coral"
          >
            {loading ? (
              <p className="text-sm app-muted">Loading behavior data…</p>
            ) : Object.keys(recentBehaviorCounts).length === 0 ? (
              <p className="text-sm app-muted">
                No behavior logs recorded in the past week for your caseload.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {Object.entries(recentBehaviorCounts).map(([type, count]) => (
                  <li
                    key={type}
                    className="flex items-center justify-between rounded-2xl border app-border bg-slate-50 px-3 py-2"
                  >
                    <span className="capitalize text-slate-800">{type}</span>
                    <span className="text-xs font-semibold text-slate-900">
                      {count} incident{count === 1 ? '' : 's'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs app-muted">
              Sensory profiles live in{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">sensory_profiles</code> and can be shown on each child’s detail page next.
            </p>
          </Card>
        </div>

        <Card
          title="Portfolio"
          subtitle="Upload therapy highlights and progress moments for parents."
          actions={
            <a
              href="/therapist/portfolio"
              className="inline-flex items-center justify-center rounded-full border border-indigo-100 bg-white px-4 py-2 text-sm font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50"
            >
              Open
            </a>
          }
        >
          <p className="text-sm app-muted">
            Use this for short clips, photos, or documents that support IEP progress and parent
            communication.
          </p>
        </Card>
      </div>
    </PageShell>
  )
}

