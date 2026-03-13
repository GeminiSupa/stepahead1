"use client"

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { PageShell } from '../components/PageShell'
import { Card, StatCard } from '../components/ui'

type SummaryCardProps = {
  title: string
  value: string
  subtitle?: string
}

type ParentChild = {
  student_id: string
  relationship: string | null
  student_name: string
  class_id: string | null
}

type AttendanceRow = {
  id: string
  date: string
  status: 'present' | 'absent' | 'late' | 'therapy'
}

type HomeworkRow = {
  id: string
  title: string
  due_date: string | null
}

type PortfolioItem = {
  id: string
}

type TimetableEntry = {
  id: string
  class_id: string
  weekday: number
  start_time: string
  end_time: string
  title: string
  is_therapy: boolean
}

export default function ParentDashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [children, setChildren] = useState<ParentChild[]>([])
  const [attendance, setAttendance] = useState<Record<string, AttendanceRow[]>>({})
  const [homework, setHomework] = useState<Record<string, HomeworkRow[]>>({})
  const [portfolioCounts, setPortfolioCounts] = useState<Record<string, number>>({})
  const [timetableByClass, setTimetableByClass] = useState<Record<string, TimetableEntry[]>>({})

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

      // 1) Find children for this parent
      const { data: parentStudentRows, error: parentStudentError } = await supabase
        .from('parents_students')
        .select('student_id, relationship, students(full_name, class_id)')
        .eq('parent_id', user.id)

      if (parentStudentError) {
        setError(parentStudentError.message)
        setLoading(false)
        return
      }

      const mappedChildren: ParentChild[] =
        parentStudentRows?.map((row: any) => ({
          student_id: row.student_id,
          relationship: row.relationship,
          student_name: row.students?.full_name ?? 'Your child',
          class_id: row.students?.class_id ?? null,
        })) ?? []

      setChildren(mappedChildren)

      if (mappedChildren.length === 0) {
        setLoading(false)
        return
      }

      const studentIds = mappedChildren.map((c) => c.student_id)

      const today = new Date()
      const sevenDaysAgo = new Date(today)
      sevenDaysAgo.setDate(today.getDate() - 6)
      const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10)
      const todayStr = today.toISOString().slice(0, 10)

      const [
        { data: attendanceRows, error: attendanceError },
        { data: homeworkRows, error: homeworkError },
        { data: portfolioRows, error: portfolioError },
      ] = await Promise.all([
        supabase
          .from('attendance')
          .select('id, student_id, date, status')
          .in('student_id', studentIds)
          .gte('date', sevenDaysAgoStr)
          .lte('date', todayStr),
        supabase
          .from('homework')
          .select('id, title, due_date, class_id')
          .gte('due_date', todayStr),
        supabase
          .from('portfolio_items')
          .select('id, student_id')
          .in('student_id', studentIds)
          .eq('is_visible_to_parent', true),
      ])

      if (attendanceError || homeworkError || portfolioError) {
        setError(
          attendanceError?.message ??
            homeworkError?.message ??
            portfolioError?.message ??
            'Unable to load child data'
        )
        setLoading(false)
        return
      }

      // Group attendance by student
      const attendanceByStudent: Record<string, AttendanceRow[]> = {}
      ;(attendanceRows ?? []).forEach((row: any) => {
        if (!attendanceByStudent[row.student_id]) {
          attendanceByStudent[row.student_id] = []
        }
        attendanceByStudent[row.student_id].push({
          id: row.id,
          date: row.date,
          status: row.status,
        })
      })

      // Map homework by student via their class_id
      const homeworkByStudent: Record<string, HomeworkRow[]> = {}
      ;(homeworkRows ?? []).forEach((hw: any) => {
        mappedChildren.forEach((child) => {
          if (child.class_id && hw.class_id === child.class_id) {
            if (!homeworkByStudent[child.student_id]) {
              homeworkByStudent[child.student_id] = []
            }
            homeworkByStudent[child.student_id].push({
              id: hw.id,
              title: hw.title,
              due_date: hw.due_date,
            })
          }
        })
      })

      // Portfolio counts per student
      const portfolioCountByStudent: Record<string, number> = {}
      ;(portfolioRows ?? []).forEach((row: any) => {
        const sid = row.student_id as string
        portfolioCountByStudent[sid] = (portfolioCountByStudent[sid] ?? 0) + 1
      })

      setAttendance(attendanceByStudent)
      setHomework(homeworkByStudent)
      setPortfolioCounts(portfolioCountByStudent)

      const classIds = Array.from(
        new Set(mappedChildren.map((c) => c.class_id).filter(Boolean) as string[])
      )
      const weekday = new Date().getDay()
      const { data: ttRows, error: ttError } = classIds.length
        ? await supabase
            .from('class_timetable_entries')
            .select('id, class_id, weekday, start_time, end_time, title, is_therapy')
            .in('class_id', classIds)
            .eq('weekday', weekday)
        : { data: [], error: null }

      if (ttError) {
        setError(ttError.message)
        setLoading(false)
        return
      }

      const grouped: Record<string, TimetableEntry[]> = {}
      ;((ttRows as TimetableEntry[]) ?? [])
        .slice()
        .sort((a, b) => a.start_time.localeCompare(b.start_time))
        .forEach((row) => {
          grouped[row.class_id] = grouped[row.class_id] ?? []
          grouped[row.class_id].push(row)
        })
      setTimetableByClass(grouped)

      setLoading(false)
    }

    loadData()
  }, [router])

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), [])

  return (
    <PageShell
      title="Parent Portal"
      subtitle="A gentle home for your child’s attendance, homework, and proud moments."
      navItems={[
        { href: '/parent', label: 'Dashboard' },
        { href: '/parent/timetable', label: 'Timetable' },
        { href: '/parent/fees', label: 'Fees' },
        { href: '/parent/leave', label: 'Leave' },
        { href: '/parent/portfolio', label: 'Portfolio' },
      ]}
    >
      <div className="space-y-6">
        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm app-muted">Loading your child&apos;s information…</p>
        ) : children.length === 0 ? (
          <Card
            title="No child linked yet"
            subtitle="Ask the school admin to connect your account to your child."
          >
            <p className="text-sm app-muted">
              Once linked, you&apos;ll see attendance, homework, and portfolio updates here.
            </p>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {children.map((child) => {
                const attRows = attendance[child.student_id] ?? []
                const todayStatus = attRows.find((row) => row.date === todayStr)?.status
                const hwCount = (homework[child.student_id] ?? []).length
                const portfolioCount = portfolioCounts[child.student_id] ?? 0
                return (
                  <ChildSummaryCard
                    key={child.student_id}
                    childName={child.student_name}
                    relationship={child.relationship}
                    todayStatus={todayStatus}
                    homeworkCount={hwCount}
                    portfolioCount={portfolioCount}
                  />
                )
              })}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card
                title="Today’s timetable"
                subtitle="A calm routine for your child’s class (therapy blocks highlighted)."
                actions={
                  <Link
                    href="/parent/timetable"
                    className="inline-flex items-center justify-center rounded-full border border-indigo-100 bg-white px-4 py-2 text-sm font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50"
                  >
                    Open
                  </Link>
                }
                tone="sky"
              >
                {children.length === 0 ? (
                  <p className="text-sm app-muted">Ask admin to link your account to your child.</p>
                ) : (
                  <div className="space-y-3 text-sm">
                    {children.slice(0, 2).map((child) => {
                      const slots = child.class_id ? timetableByClass[child.class_id] ?? [] : []
                      return (
                        <div key={child.student_id} className="rounded-2xl border app-border bg-slate-50 px-3 py-3">
                          <p className="text-sm font-semibold text-slate-900">{child.student_name}</p>
                          {!child.class_id ? (
                            <p className="mt-1 text-xs app-muted">Class not set yet.</p>
                          ) : slots.length === 0 ? (
                            <p className="mt-1 text-xs app-muted">No timetable slots found for today.</p>
                          ) : (
                            <div className="mt-2 space-y-2">
                              {slots.slice(0, 2).map((s) => (
                                <div
                                  key={s.id}
                                  className={`flex items-center justify-between rounded-2xl border px-3 py-2 text-xs ${
                                    s.is_therapy ? 'border-indigo-100 bg-indigo-50' : 'border-slate-200 bg-white'
                                  }`}
                                >
                                  <span className="font-semibold text-slate-900">{s.title}</span>
                                  <span className="font-semibold text-slate-700">
                                    {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                    <p className="text-xs app-muted">Open the Timetable page for the full routine.</p>
                  </div>
                )}
              </Card>

              <Card
                title="Fees"
                subtitle="View fee status, due dates, and payment history for your child."
                actions={
                  <Link
                    href="/parent/fees"
                    className="inline-flex items-center justify-center rounded-full border border-indigo-100 bg-white px-4 py-2 text-sm font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50"
                  >
                    Open
                  </Link>
                }
                tone="mint"
              >
                <p className="text-sm app-muted">
                  Fee records are added by the school admin. You’ll see current balance and status
                  here.
                </p>
              </Card>

              <Card
                title="Leave requests"
                subtitle="Request leave and track approval status."
                actions={
                  <Link
                    href="/parent/leave"
                    className="inline-flex items-center justify-center rounded-full border border-indigo-100 bg-white px-4 py-2 text-sm font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50"
                  >
                    Open
                  </Link>
                }
                tone="lavender"
              >
                <p className="text-sm app-muted">
                  When approved, leave days are marked in attendance as Absent (Approved leave).
                </p>
              </Card>

              <Card
                title="Portfolio gallery"
                subtitle="See photos/videos shared by school (per child)."
                actions={
                  <Link
                    href="/parent/portfolio"
                    className="inline-flex items-center justify-center rounded-full border border-indigo-100 bg-white px-4 py-2 text-sm font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50"
                  >
                    Open
                  </Link>
                }
              >
                <p className="text-sm app-muted">
                  Only items marked “Visible to parent” show here.
                </p>
              </Card>

              <Card
                title="Daily snapshot"
                subtitle="Attendance for the last 7 days (present / late / therapy / absent)."
              >
                <div className="space-y-4 text-sm">
                  {children.map((child) => (
                    <DailyAttendanceRow
                      key={child.student_id}
                      childName={child.student_name}
                      attendance={attendance[child.student_id] ?? []}
                    />
                  ))}
                </div>
              </Card>

              <Card
                title="Homework & portfolio highlights"
                subtitle="Upcoming tasks and recent moments captured by school."
              >
                <div className="space-y-4 text-sm">
                  {children.map((child) => (
                    <div key={child.student_id} className="rounded-2xl border app-border bg-slate-50 px-3 py-3">
                      <p className="text-sm font-semibold text-slate-900">{child.student_name}</p>
                      <div className="mt-2 grid gap-3 sm:grid-cols-3">
                        <StatCard
                          label="Homework"
                          value={String(homework[child.student_id]?.length ?? 0)}
                          hint="Due soon"
                        />
                        <StatCard
                          label="Portfolio"
                          value={String(portfolioCounts[child.student_id] ?? 0)}
                          hint="Visible to you"
                        />
                        <StatCard label="Today" value={todayStatusLabel(todayStr, attendance[child.student_id] ?? [])} hint="Attendance" />
                      </div>
                      {homework[child.student_id] && homework[child.student_id].length > 0 ? (
                        <ul className="mt-3 space-y-1 text-xs app-muted">
                          {homework[child.student_id].slice(0, 3).map((hw) => (
                            <li key={hw.id}>
                              <span className="font-semibold text-slate-700">{hw.title}</span>{' '}
                              {hw.due_date ? (
                                <span>(due {new Date(hw.due_date).toLocaleDateString()})</span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </>
        )}
      </div>
    </PageShell>
  )
}

function SummaryCard({ title, value, subtitle }: SummaryCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
    </div>
  )
}

type ChildSummaryCardProps = {
  childName: string
  relationship: string | null
  todayStatus?: AttendanceRow['status']
  homeworkCount: number
  portfolioCount: number
}

function ChildSummaryCard({
  childName,
  relationship,
  todayStatus,
  homeworkCount,
  portfolioCount,
}: ChildSummaryCardProps) {
  const statusLabel =
    todayStatus === 'present'
      ? 'Present'
      : todayStatus === 'late'
      ? 'Late'
      : todayStatus === 'therapy'
      ? 'In therapy'
      : todayStatus === 'absent'
      ? 'Absent'
      : 'Not recorded'

  const statusColor =
    todayStatus === 'present'
      ? 'bg-emerald-50 text-emerald-700'
      : todayStatus === 'late'
      ? 'bg-amber-50 text-amber-700'
      : todayStatus === 'therapy'
      ? 'bg-sky-50 text-sky-700'
      : todayStatus === 'absent'
      ? 'bg-rose-50 text-rose-700'
      : 'bg-slate-50 text-slate-600'

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {relationship ? relationship : 'Child'}
      </p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{childName}</p>
      <div className="mt-3 flex flex-col gap-2 text-xs text-slate-600">
        <div className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 ${statusColor}`}>
          <span className="font-medium">Today</span>
          <span>· {statusLabel}</span>
        </div>
        <p>
          <span className="font-medium">{homeworkCount}</span> homework item
          {homeworkCount === 1 ? '' : 's'} due ·{' '}
          <span className="font-medium">{portfolioCount}</span> portfolio moment
          {portfolioCount === 1 ? '' : 's'}
        </p>
      </div>
    </div>
  )
}

type DailyAttendanceRowProps = {
  childName: string
  attendance: AttendanceRow[]
}

function DailyAttendanceRow({ childName, attendance }: DailyAttendanceRowProps) {
  const byDate = [...attendance].sort((a, b) => a.date.localeCompare(b.date))
  return (
    <div>
      <p className="text-xs font-medium text-slate-700">{childName}</p>
      <div className="mt-1 flex gap-1">
        {byDate.map((row) => (
          <span
            key={row.id}
            className={`h-3 w-3 rounded-full ${
              row.status === 'present'
                ? 'bg-emerald-500'
                : row.status === 'late'
                ? 'bg-amber-500'
                : row.status === 'therapy'
                ? 'bg-sky-500'
                : 'bg-rose-500'
            }`}
            title={`${row.date}: ${row.status}`}
          />
        ))}
      </div>
    </div>
  )
}

function todayStatusLabel(todayStr: string, rows: AttendanceRow[]) {
  const status = rows.find((r) => r.date === todayStr)?.status
  if (status === 'present') return 'Present'
  if (status === 'late') return 'Late'
  if (status === 'therapy') return 'Therapy'
  if (status === 'absent') return 'Absent'
  return '—'
}

